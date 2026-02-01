/**
 * Performance monitoring for Cinq API
 * 
 * Tracks response times, error rates, and cache hit rates
 * for optimization insights and alerting.
 */

import { set, get } from './_cache.js';

// In-memory performance metrics (persisted in Redis when available)
const performanceStore = new Map();

/**
 * Start timing a request
 * @param {string} endpoint - API endpoint name
 * @param {string} method - HTTP method
 * @param {string} userId - User ID (optional)
 * @returns {Function} finish function to call when request completes
 */
export function startTiming(endpoint, method, userId = null) {
    const startTime = Date.now();
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
        requestId,
        finish: (statusCode, cacheHit = false, error = null) => {
            const duration = Date.now() - startTime;
            recordMetric(endpoint, method, duration, statusCode, cacheHit, userId, error);
        }
    };
}

/**
 * Record performance metric
 */
async function recordMetric(endpoint, method, duration, statusCode, cacheHit, userId, error) {
    const key = `${endpoint}_${method}`;
    const now = Date.now();
    const minuteBucket = Math.floor(now / 60000) * 60000; // Round to minute
    
    const metric = {
        endpoint,
        method,
        duration,
        statusCode,
        cacheHit,
        userId,
        error: error ? error.message : null,
        timestamp: now,
        minuteBucket
    };
    
    try {
        // Store in cache for aggregation
        const cacheKey = `metrics:${minuteBucket}:${key}`;
        const existing = await get(cacheKey) || { requests: [] };
        existing.requests.push(metric);
        
        // Keep only last 100 requests per minute-bucket
        if (existing.requests.length > 100) {
            existing.requests = existing.requests.slice(-100);
        }
        
        await set(cacheKey, existing, 3600); // Keep for 1 hour
        
        // Also store in memory for immediate access
        if (!performanceStore.has(key)) {
            performanceStore.set(key, []);
        }
        const memoryMetrics = performanceStore.get(key);
        memoryMetrics.push(metric);
        
        // Keep only last 1000 requests in memory
        if (memoryMetrics.length > 1000) {
            memoryMetrics.splice(0, memoryMetrics.length - 1000);
        }
        
        // Check for alerts
        await checkAlerts(key, metric);
        
    } catch (err) {
        console.warn('[Performance] Failed to record metric:', err.message);
    }
}

/**
 * Check for performance alerts
 */
async function checkAlerts(key, metric) {
    // Only check for errors and slow responses
    if (metric.statusCode >= 500) {
        console.warn(`[Alert] Server error on ${metric.endpoint} ${metric.method}: ${metric.statusCode}`);
    }
    
    if (metric.duration > 5000) { // > 5 seconds
        console.warn(`[Alert] Slow response on ${metric.endpoint} ${metric.method}: ${metric.duration}ms`);
    }
    
    // Check error rate over last 10 requests
    const memoryMetrics = performanceStore.get(key) || [];
    const last10 = memoryMetrics.slice(-10);
    
    if (last10.length >= 10) {
        const errorCount = last10.filter(m => m.statusCode >= 400).length;
        const errorRate = errorCount / 10;
        
        if (errorRate > 0.5) { // > 50% error rate
            console.error(`[Alert] High error rate on ${key}: ${(errorRate * 100).toFixed(1)}%`);
        }
    }
}

/**
 * Get performance metrics for an endpoint
 * @param {string} endpoint - API endpoint
 * @param {string} method - HTTP method  
 * @param {number} minutes - Time window in minutes (default 60)
 * @returns {Object} Aggregated metrics
 */
export async function getMetrics(endpoint, method, minutes = 60) {
    const key = `${endpoint}_${method}`;
    const now = Date.now();
    const since = now - (minutes * 60 * 1000);
    
    // Get from memory first (fast)
    const memoryMetrics = performanceStore.get(key) || [];
    const recentMetrics = memoryMetrics.filter(m => m.timestamp >= since);
    
    if (recentMetrics.length === 0) {
        return {
            endpoint,
            method,
            requestCount: 0,
            avgDuration: 0,
            p95Duration: 0,
            errorRate: 0,
            cacheHitRate: 0,
            timeWindow: `${minutes}m`
        };
    }
    
    // Calculate aggregated metrics
    const durations = recentMetrics.map(m => m.duration).sort((a, b) => a - b);
    const errors = recentMetrics.filter(m => m.statusCode >= 400);
    const cacheHits = recentMetrics.filter(m => m.cacheHit);
    
    const p95Index = Math.floor(durations.length * 0.95);
    const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    
    return {
        endpoint,
        method,
        requestCount: recentMetrics.length,
        avgDuration: Math.round(avgDuration),
        p95Duration: durations[p95Index] || 0,
        errorRate: (errors.length / recentMetrics.length * 100).toFixed(1),
        cacheHitRate: (cacheHits.length / recentMetrics.length * 100).toFixed(1),
        timeWindow: `${minutes}m`
    };
}

/**
 * Get overview of all endpoints performance
 * @param {number} minutes - Time window in minutes
 * @returns {Array} Array of metrics for all endpoints
 */
export async function getAllMetrics(minutes = 60) {
    const endpoints = Array.from(performanceStore.keys());
    
    const metrics = await Promise.all(
        endpoints.map(async (key) => {
            const [endpoint, method] = key.split('_');
            return await getMetrics(endpoint, method, minutes);
        })
    );
    
    // Sort by request count descending
    return metrics
        .filter(m => m.requestCount > 0)
        .sort((a, b) => b.requestCount - a.requestCount);
}

/**
 * Middleware wrapper for automatic performance tracking
 * @param {string} endpoint - Endpoint name
 * @returns {Function} Middleware function
 */
export function trackPerformance(endpoint) {
    return (req, res, next) => {
        const timer = startTiming(endpoint, req.method, req.user?.id);
        
        // Override res.json to capture response
        const originalJson = res.json;
        res.json = function(data) {
            timer.finish(res.statusCode, data?.cached === true);
            return originalJson.call(this, data);
        };
        
        // Override res.status to capture errors
        const originalStatus = res.status;
        res.status = function(code) {
            if (code >= 400) {
                timer.finish(code, false, new Error(`HTTP ${code}`));
            }
            return originalStatus.call(this, code);
        };
        
        if (next) next();
    };
}

/**
 * Clean up old performance data (call periodically)
 */
function cleanupPerformanceData() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    for (const [key, metrics] of performanceStore.entries()) {
        const filtered = metrics.filter(m => m.timestamp >= cutoff);
        if (filtered.length === 0) {
            performanceStore.delete(key);
        } else {
            performanceStore.set(key, filtered);
        }
    }
}

// Cleanup old data every hour
setInterval(cleanupPerformanceData, 60 * 60 * 1000);

// Export for debugging
export function getPerformanceStore() {
    return Object.fromEntries(performanceStore);
}

export default {
    startTiming,
    getMetrics,
    getAllMetrics,
    trackPerformance,
    getPerformanceStore
};