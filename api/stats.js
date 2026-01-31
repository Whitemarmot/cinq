/**
 * Stats API - Admin-only metrics endpoint
 * 
 * Endpoints:
 * - GET ?period=week - Get platform statistics
 * 
 * Requires admin access (x-admin-secret header or admin email)
 */

import { supabase, getUser, handleCors } from './_supabase.js';
import { getStats, logRequest, logError as analyticsLogError, logStructured } from './_analytics.js';

// Admin emails
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);
const ADMIN_SECRET = process.env.ADMIN_SECRET;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    logRequest(req, '/api/stats');

    try {
        // Admin check
        if (!await isAdmin(req)) {
            logStructured('warn', 'Unauthorized stats access attempt');
            return res.status(403).json({ 
                error: 'Admin access required',
                hint: 'Provide valid admin credentials'
            });
        }

        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const period = req.query.period || 'week';
        const validPeriods = ['day', 'week', 'month', 'all'];
        
        if (!validPeriods.includes(period)) {
            return res.status(400).json({ 
                error: 'Invalid period',
                hint: `Valid periods: ${validPeriods.join(', ')}`
            });
        }

        logStructured('info', 'Fetching stats', { period });
        
        const stats = await getStats(period);

        // Add derived metrics
        stats.derived = computeDerivedMetrics(stats.totals);

        logStructured('info', 'Stats fetched successfully', { 
            period,
            userCount: stats.totals.users 
        });

        return res.json(stats);

    } catch (e) {
        analyticsLogError(e, '/api/stats');
        return res.status(500).json({ 
            error: 'Failed to fetch stats',
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
}

// ===== HELPERS =====

async function isAdmin(req) {
    // Check admin secret header
    const secretHeader = req.headers['x-admin-secret'];
    if (ADMIN_SECRET && secretHeader === ADMIN_SECRET) {
        return true;
    }

    // Check user authentication
    const user = await getUser(req);
    if (!user) return false;
    
    // Check if user email is in admin list
    return ADMIN_EMAILS.includes(user.email);
}

function computeDerivedMetrics(totals) {
    return {
        messages_per_user: totals.users > 0 
            ? (totals.messages / totals.users).toFixed(2) 
            : 0,
        gift_redemption_rate: totals.gift_codes > 0
            ? (((totals.gift_codes - totals.active_gift_codes) / totals.gift_codes) * 100).toFixed(1) + '%'
            : '0%',
        conversion_rate: totals.waitlist > 0 && totals.users > 0
            ? ((totals.users / (totals.waitlist + totals.users)) * 100).toFixed(1) + '%'
            : '0%'
    };
}
