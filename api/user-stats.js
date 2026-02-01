/**
 * User Stats API - Personal statistics endpoint
 * 
 * GET /api/user-stats
 *   - Returns user's personal statistics:
 *     - messages_sent: total messages sent
 *     - posts_count: total posts created
 *     - contacts_count: number of contacts
 *     - member_since: registration date
 *     - weekly_activity: activity data for the last 8 weeks
 * 
 * Requires: Authorization: Bearer <access_token>
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { logRequest, logError } from './_analytics.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    logRequest(req, '/api/user-stats');

    // Only GET allowed
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Require authentication
    const user = await requireAuth(req, res);
    if (!user) return;

    try {
        const userId = user.id;

        // Fetch all stats in parallel for performance
        const [
            messagesResult,
            postsResult,
            contactsResult,
            userResult,
            weeklyActivityResult
        ] = await Promise.all([
            // Count messages sent by user
            supabase
                .from('messages')
                .select('id', { count: 'exact', head: true })
                .eq('sender_id', userId),

            // Count posts by user
            supabase
                .from('posts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId),

            // Count contacts
            supabase
                .from('contacts')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId),

            // Get user profile for registration date
            supabase
                .from('users')
                .select('created_at')
                .eq('id', userId)
                .single(),

            // Get weekly activity for last 8 weeks
            getWeeklyActivity(userId)
        ]);

        // Extract counts (handle possible null/errors gracefully)
        const messagesSent = messagesResult.count ?? 0;
        const postsCount = postsResult.count ?? 0;
        const contactsCount = contactsResult.count ?? 0;
        const memberSince = userResult.data?.created_at || user.created_at || null;

        // Calculate time since registration
        const memberDays = memberSince 
            ? Math.floor((Date.now() - new Date(memberSince).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

        return res.json({
            messages_sent: messagesSent,
            posts_count: postsCount,
            contacts_count: contactsCount,
            member_since: memberSince,
            member_days: memberDays,
            weekly_activity: weeklyActivityResult
        });

    } catch (err) {
        logError(err, '/api/user-stats');
        console.error('User stats error:', err);
        return res.status(500).json({ 
            error: 'Erreur lors du chargement des statistiques',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
}

/**
 * Get activity data for the last 8 weeks
 * Returns array of objects: { week_start, messages, posts }
 */
async function getWeeklyActivity(userId) {
    const weeks = [];
    const now = new Date();
    
    // Calculate the start of the current week (Monday)
    const currentDay = now.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    const currentWeekStart = new Date(now);
    currentWeekStart.setDate(now.getDate() + mondayOffset);
    currentWeekStart.setHours(0, 0, 0, 0);

    // Generate 8 weeks of date ranges
    for (let i = 0; i < 8; i++) {
        const weekStart = new Date(currentWeekStart);
        weekStart.setDate(currentWeekStart.getDate() - (i * 7));
        
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        weeks.push({
            week_start: weekStart.toISOString(),
            week_end: weekEnd.toISOString(),
            week_label: formatWeekLabel(weekStart, i),
            messages: 0,
            posts: 0
        });
    }

    // Fetch messages count per week
    const messagesPromises = weeks.map(week =>
        supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('sender_id', userId)
            .gte('created_at', week.week_start)
            .lt('created_at', week.week_end)
    );

    // Fetch posts count per week
    const postsPromises = weeks.map(week =>
        supabase
            .from('posts')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', week.week_start)
            .lt('created_at', week.week_end)
    );

    try {
        const [messagesResults, postsResults] = await Promise.all([
            Promise.all(messagesPromises),
            Promise.all(postsPromises)
        ]);

        // Populate counts
        weeks.forEach((week, i) => {
            week.messages = messagesResults[i]?.count ?? 0;
            week.posts = postsResults[i]?.count ?? 0;
            // Clean up internal date fields
            delete week.week_end;
        });

    } catch (err) {
        console.error('Error fetching weekly activity:', err);
        // Return weeks with 0 counts on error
    }

    // Reverse to show oldest first (for chart display)
    return weeks.reverse();
}

/**
 * Format week label for display
 */
function formatWeekLabel(date, weeksAgo) {
    if (weeksAgo === 0) return 'Cette sem.';
    if (weeksAgo === 1) return 'Sem. dern.';
    
    const day = date.getDate();
    const month = date.toLocaleDateString('fr-FR', { month: 'short' });
    return `${day} ${month}`;
}
