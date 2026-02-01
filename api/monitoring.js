/**
 * Monitoring API - Performance metrics and health checks
 * 
 * Endpoints:
 * - GET /api/monitoring - System status and metrics overview
 * - GET /api/monitoring?detailed=true - Detailed performance metrics
 * - GET /api/monitoring?endpoint=posts&method=GET - Specific endpoint metrics
 * 
 * This endpoint is rate-limited but doesn't require authentication
 * for infrastructure monitoring tools.
 */

import { supabase, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { getMetrics, getAllMetrics, getPerformanceStore } from './_performance.js';
import { get } from './_cache.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    // Rate limiting (stricter for public endpoint)
    if (!(await checkRateLimit(req, res, RATE_LIMITS.PUBLIC))) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGet(req, res);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Monitoring] Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            status: 'error'
        });
    }
}

async function handleGet(req, res) {
    const { detailed, endpoint, method, minutes } = req.query;
    const timeWindow = parseInt(minutes) || 60;

    try {
        // Health check
        const health = await performHealthCheck();

        // Specific endpoint metrics
        if (endpoint && method) {
            const metrics = await getMetrics(endpoint, method, timeWindow);
            return res.json({
                status: 'ok',
                health,
                metrics,
                timestamp: new Date().toISOString()
            });
        }

        // Detailed metrics
        if (detailed === 'true') {
            const allMetrics = await getAllMetrics(timeWindow);
            const cacheStats = await getCacheStats();
            
            return res.json({
                status: 'ok',
                health,
                metrics: {
                    endpoints: allMetrics,
                    cache: cacheStats,
                    timeWindow: `${timeWindow}m`
                },
                timestamp: new Date().toISOString()
            });
        }

        // Basic status
        const overviewMetrics = await getOverviewMetrics(timeWindow);
        
        return res.json({
            status: health.overall === 'healthy' ? 'ok' : 'degraded',
            health,
            metrics: overviewMetrics,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Monitoring] Failed to get metrics:', error);
        return res.status(500).json({
            status: 'error',
            error: 'Failed to retrieve metrics',
            timestamp: new Date().toISOString()
        });
    }
}

/**
 * Perform basic health checks
 */
async function performHealthCheck() {
    const checks = {
        database: 'unknown',
        cache: 'unknown',
        overall: 'unknown'
    };

    try {
        // Test database connectivity
        const { error: dbError } = await supabase
            .from('users')
            .select('id')
            .limit(1);
        
        checks.database = dbError ? 'unhealthy' : 'healthy';
    } catch {
        checks.database = 'unhealthy';
    }

    try {
        // Test cache connectivity
        await get('health_check');
        checks.cache = 'healthy';
    } catch {
        checks.cache = 'degraded'; // Not critical
    }

    // Overall health
    if (checks.database === 'healthy') {
        checks.overall = 'healthy';
    } else {
        checks.overall = 'unhealthy';
    }

    return checks;
}

/**
 * Get overview metrics for dashboard
 */
async function getOverviewMetrics(timeWindow) {
    const allMetrics = await getAllMetrics(timeWindow);
    
    if (allMetrics.length === 0) {
        return {
            totalRequests: 0,
            avgResponseTime: 0,
            errorRate: 0,
            cacheHitRate: 0,
            activeEndpoints: 0
        };
    }

    const totalRequests = allMetrics.reduce((sum, m) => sum + m.requestCount, 0);
    const weightedResponseTime = allMetrics.reduce((sum, m) => sum + (m.avgDuration * m.requestCount), 0);
    const avgResponseTime = totalRequests > 0 ? Math.round(weightedResponseTime / totalRequests) : 0;
    
    const weightedErrorRate = allMetrics.reduce((sum, m) => {
        const rate = parseFloat(m.errorRate) || 0;
        return sum + (rate * m.requestCount);
    }, 0);
    const overallErrorRate = totalRequests > 0 ? (weightedErrorRate / totalRequests).toFixed(1) : '0.0';

    const weightedCacheRate = allMetrics.reduce((sum, m) => {
        const rate = parseFloat(m.cacheHitRate) || 0;
        return sum + (rate * m.requestCount);
    }, 0);
    const overallCacheRate = totalRequests > 0 ? (weightedCacheRate / totalRequests).toFixed(1) : '0.0';

    return {
        totalRequests,
        avgResponseTime,
        errorRate: overallErrorRate,
        cacheHitRate: overallCacheRate,
        activeEndpoints: allMetrics.length,
        topEndpoints: allMetrics.slice(0, 5).map(m => ({
            endpoint: `${m.endpoint} ${m.method}`,
            requests: m.requestCount,
            avgDuration: m.avgDuration,
            errorRate: m.errorRate
        }))
    };
}

/**
 * Get cache statistics
 */
async function getCacheStats() {
    // This would need to be enhanced with actual cache size/hit data
    // For now, return basic info
    return {
        status: 'active',
        type: process.env.REDIS_URL ? 'redis' : 'memory',
        // These would come from actual cache metrics in production
        size: 'unknown',
        hitRate: 'calculated_per_endpoint',
        evictions: 'unknown'
    };
}

/**
 * Debug endpoint for performance data (for development)
 */
export async function debugPerformance() {
    if (process.env.NODE_ENV !== 'development') {
        return { error: 'Debug endpoint only available in development' };
    }
    
    return {
        performanceStore: getPerformanceStore(),
        allMetrics: await getAllMetrics(60),
        cacheStats: await getCacheStats()
    };
}