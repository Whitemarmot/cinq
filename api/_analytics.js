/**
 * Cinq Analytics - Server-side event tracking
 * 
 * Tracks: registrations, messages, pings, gift codes
 * Stores events in Supabase for admin dashboard
 */

import { supabase } from './_supabase.js';

// Event types enum
export const EventType = {
    USER_REGISTERED: 'user_registered',
    USER_LOGIN: 'user_login',
    MESSAGE_SENT: 'message_sent',
    PING_SENT: 'ping_sent',
    GIFT_CODE_CREATED: 'gift_code_created',
    GIFT_CODE_REDEEMED: 'gift_code_redeemed',
    GIFT_CODE_VERIFIED: 'gift_code_verified',
    WAITLIST_SIGNUP: 'waitlist_signup',
    CONTACT_ADDED: 'contact_added',
    PROPOSAL_CREATED: 'proposal_created',
    PROPOSAL_RESPONDED: 'proposal_responded',
    API_ERROR: 'api_error'
};

/**
 * Track an analytics event
 * @param {string} eventType - Type of event (see EventType)
 * @param {Object} metadata - Additional event data
 * @param {string|null} userId - User ID if available
 */
export async function trackEvent(eventType, metadata = {}, userId = null) {
    try {
        const event = {
            event_type: eventType,
            user_id: userId,
            metadata: JSON.stringify(metadata),
            created_at: new Date().toISOString()
        };

        // Fire and forget - don't block the main request
        supabase
            .from('analytics_events')
            .insert(event)
            .then(({ error }) => {
                if (error) {
                    console.error('[Analytics] Failed to track event:', error.message);
                }
            });

        // Also log structured for debugging
        logStructured('event', eventType, { userId, ...metadata });
        
    } catch (e) {
        console.error('[Analytics] Track error:', e.message);
    }
}

/**
 * Structured logging helper
 * @param {string} level - Log level: info, warn, error, event
 * @param {string} message - Log message
 * @param {Object} context - Additional context
 */
export function logStructured(level, message, context = {}) {
    const timestamp = new Date().toISOString();
    const log = {
        timestamp,
        level,
        message,
        ...context,
        service: 'cinq-api'
    };
    
    const output = JSON.stringify(log);
    
    switch (level) {
        case 'error':
            console.error(output);
            break;
        case 'warn':
            console.warn(output);
            break;
        default:
            console.log(output);
    }
}

/**
 * Log API request (middleware-style helper)
 * @param {Object} req - Request object
 * @param {string} endpoint - API endpoint name
 */
export function logRequest(req, endpoint) {
    logStructured('info', `${req.method} ${endpoint}`, {
        endpoint,
        method: req.method,
        action: req.query?.action || req.body?.action,
        userAgent: req.headers?.['user-agent']?.substring(0, 100)
    });
}

/**
 * Log API error
 * @param {Error} error - Error object
 * @param {string} endpoint - API endpoint name
 * @param {Object} context - Additional context
 */
export function logError(error, endpoint, context = {}) {
    logStructured('error', error.message, {
        endpoint,
        stack: error.stack?.substring(0, 500),
        ...context
    });
    
    // Track as analytics event too
    trackEvent(EventType.API_ERROR, {
        endpoint,
        error: error.message,
        ...context
    });
}

/**
 * Get analytics stats (for admin dashboard)
 * @param {string} period - 'day', 'week', 'month', 'all'
 */
export async function getStats(period = 'week') {
    const now = new Date();
    let since;
    
    switch (period) {
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
            since = new Date('2024-01-01');
    }

    // Get event counts grouped by type
    const { data: events, error } = await supabase
        .from('analytics_events')
        .select('event_type, created_at')
        .gte('created_at', since.toISOString());

    if (error) throw error;

    // Aggregate counts
    const counts = {};
    for (const event of events || []) {
        counts[event.event_type] = (counts[event.event_type] || 0) + 1;
    }

    // Get totals from various tables
    const [userCount, messageCount, giftCount, activeGiftCount, waitlistCount] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('gift_codes').select('*', { count: 'exact', head: true }),
        supabase.from('gift_codes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('waitlist').select('*', { count: 'exact', head: true })
    ]);

    // Daily breakdown for charts
    const dailyStats = {};
    for (const event of events || []) {
        const day = event.created_at.substring(0, 10);
        if (!dailyStats[day]) dailyStats[day] = {};
        dailyStats[day][event.event_type] = (dailyStats[day][event.event_type] || 0) + 1;
    }

    return {
        period,
        since: since.toISOString(),
        totals: {
            users: userCount.count || 0,
            messages: messageCount.count || 0,
            gift_codes: giftCount.count || 0,
            active_gift_codes: activeGiftCount.count || 0,
            waitlist: waitlistCount.count || 0
        },
        events: counts,
        daily: dailyStats
    };
}

export default {
    trackEvent,
    logStructured,
    logRequest,
    logError,
    getStats,
    EventType
};
