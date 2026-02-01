/**
 * Cinq Analytics API Endpoint
 * 
 * Receives batched analytics events from the client
 * Stores in Supabase for analysis
 */

import { supabase } from './_supabase.js';
import { handleCors, setCorsHeaders } from './_cors.js';
import { rateLimit } from './_rate-limit.js';

// Validate event structure
function validateEvent(event) {
    if (!event || typeof event !== 'object') return false;
    if (!event.type || typeof event.type !== 'string') return false;
    if (!event.timestamp || typeof event.timestamp !== 'number') return false;
    if (!event.sessionId || typeof event.sessionId !== 'string') return false;
    return true;
}

// Sanitize event data
function sanitizeEvent(event) {
    return {
        event_type: String(event.type).substring(0, 50),
        session_id: String(event.sessionId).substring(0, 100),
        visitor_id: event.visitorId ? String(event.visitorId).substring(0, 100) : null,
        page_url: event.page?.url ? String(event.page.url).substring(0, 500) : null,
        page_title: event.page?.title ? String(event.page.title).substring(0, 200) : null,
        page_referrer: event.page?.referrer ? String(event.page.referrer).substring(0, 500) : null,
        viewport: event.device?.viewport ? String(event.device.viewport).substring(0, 20) : null,
        screen_width: event.device?.screenWidth ? parseInt(event.device.screenWidth) || null : null,
        screen_height: event.device?.screenHeight ? parseInt(event.device.screenHeight) || null : null,
        language: event.device?.language ? String(event.device.language).substring(0, 10) : null,
        platform: event.device?.platform ? String(event.device.platform).substring(0, 50) : null,
        event_data: event.data ? JSON.stringify(event.data).substring(0, 2000) : null,
        client_timestamp: new Date(event.timestamp).toISOString(),
        created_at: new Date().toISOString()
    };
}

// Process batch of events
async function processEvents(events, ip, userAgent) {
    if (!Array.isArray(events) || events.length === 0) {
        return { processed: 0, errors: 0 };
    }

    // Limit batch size
    const batch = events.slice(0, 50);
    const validEvents = [];
    let errors = 0;

    for (const event of batch) {
        if (validateEvent(event)) {
            const sanitized = sanitizeEvent(event);
            sanitized.ip_hash = ip ? hashIP(ip) : null;
            sanitized.user_agent = userAgent ? String(userAgent).substring(0, 200) : null;
            validEvents.push(sanitized);
        } else {
            errors++;
        }
    }

    if (validEvents.length > 0) {
        const { error } = await supabase
            .from('client_analytics')
            .insert(validEvents);

        if (error) {
            console.error('[Analytics API] Insert error:', error.message);
            throw error;
        }
    }

    return { processed: validEvents.length, errors };
}

// Hash IP for privacy (one-way, non-reversible)
function hashIP(ip) {
    if (!ip) return null;
    // Simple hash - in production use crypto
    let hash = 0;
    const salt = 'cinq_analytics_2024';
    const str = ip + salt;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'ip_' + Math.abs(hash).toString(36);
}

// Get analytics stats
async function getStats(req) {
    const period = req.query?.period || 'day';
    
    let since;
    const now = new Date();
    
    switch (period) {
        case 'hour':
            since = new Date(now - 60 * 60 * 1000);
            break;
        case 'day':
            since = new Date(now - 24 * 60 * 60 * 1000);
            break;
        case 'week':
            since = new Date(now - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            since = new Date(now - 30 * 24 * 60 * 60 * 1000);
            break;
        default:
            since = new Date(now - 24 * 60 * 60 * 1000);
    }

    // Get event counts
    const { data: events, error } = await supabase
        .from('client_analytics')
        .select('event_type, page_url, created_at')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(10000);

    if (error) throw error;

    // Aggregate stats
    const stats = {
        period,
        since: since.toISOString(),
        totalEvents: events?.length || 0,
        byType: {},
        byPage: {},
        uniqueSessions: new Set(),
        uniqueVisitors: new Set()
    };

    for (const event of events || []) {
        // Count by type
        stats.byType[event.event_type] = (stats.byType[event.event_type] || 0) + 1;
        
        // Count by page
        if (event.page_url) {
            stats.byPage[event.page_url] = (stats.byPage[event.page_url] || 0) + 1;
        }
    }

    // Get unique counts
    const { data: uniqueData } = await supabase
        .from('client_analytics')
        .select('session_id, visitor_id')
        .gte('created_at', since.toISOString());

    if (uniqueData) {
        for (const row of uniqueData) {
            if (row.session_id) stats.uniqueSessions.add(row.session_id);
            if (row.visitor_id) stats.uniqueVisitors.add(row.visitor_id);
        }
    }

    return {
        period,
        since: since.toISOString(),
        totalEvents: stats.totalEvents,
        uniqueSessions: stats.uniqueSessions.size,
        uniqueVisitors: stats.uniqueVisitors.size,
        byType: stats.byType,
        topPages: Object.entries(stats.byPage)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20)
            .map(([url, count]) => ({ url, count }))
    };
}

// Main handler
export default async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;
    setCorsHeaders(res);

    // Rate limiting
    const clientIP = req.headers['x-forwarded-for']?.split(',')[0]?.trim() 
        || req.headers['x-real-ip'] 
        || req.socket?.remoteAddress 
        || 'unknown';
    
    const rateLimited = await rateLimit(clientIP, 'analytics', 100, 60000); // 100 req/min
    if (rateLimited) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    try {
        // GET - Return stats (for admin dashboard)
        if (req.method === 'GET') {
            const stats = await getStats(req);
            return res.status(200).json(stats);
        }

        // POST - Receive events
        if (req.method === 'POST') {
            const { events } = req.body || {};
            
            if (!events) {
                return res.status(400).json({ error: 'Missing events array' });
            }

            const userAgent = req.headers['user-agent'];
            const result = await processEvents(events, clientIP, userAgent);

            return res.status(200).json({
                success: true,
                processed: result.processed,
                errors: result.errors
            });
        }

        // Method not allowed
        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('[Analytics API] Error:', error.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
