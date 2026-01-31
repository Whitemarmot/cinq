/**
 * Cinq Stats API - Admin-only endpoint for viewing metrics
 * 
 * GET /api/stats?period=week
 * Requires: Authorization header with admin token or ADMIN_SECRET env var
 */

import { createClient } from '@supabase/supabase-js';
import { getStats, logRequest, logError, logStructured } from './_analytics.js';
import { cors } from './_cors.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

// Admin emails - add your admin emails here
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').filter(Boolean);

// Admin secret for API access without user auth
const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function isAdmin(req) {
    // Check admin secret header first
    const secretHeader = req.headers['x-admin-secret'];
    if (ADMIN_SECRET && secretHeader === ADMIN_SECRET) {
        return true;
    }

    // Check user authentication
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return false;
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) return false;
    
    // Check if user email is in admin list
    return ADMIN_EMAILS.includes(user.email);
}

export default async function handler(req, res) {
    // SECURITY: Validate CORS origin (admin endpoints still need CORS protection)
    if (!cors(req, res)) return;

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

        // Add some derived metrics
        stats.derived = {
            messages_per_user: stats.totals.users > 0 
                ? (stats.totals.messages / stats.totals.users).toFixed(2) 
                : 0,
            gift_redemption_rate: stats.totals.gift_codes > 0
                ? (((stats.totals.gift_codes - stats.totals.active_gift_codes) / stats.totals.gift_codes) * 100).toFixed(1) + '%'
                : '0%',
            conversion_rate: stats.totals.waitlist > 0 && stats.totals.users > 0
                ? ((stats.totals.users / (stats.totals.waitlist + stats.totals.users)) * 100).toFixed(1) + '%'
                : '0%'
        };

        logStructured('info', 'Stats fetched successfully', { 
            period,
            userCount: stats.totals.users 
        });

        return res.json(stats);

    } catch (e) {
        logError(e, '/api/stats');
        return res.status(500).json({ 
            error: 'Failed to fetch stats',
            details: process.env.NODE_ENV === 'development' ? e.message : undefined
        });
    }
}
