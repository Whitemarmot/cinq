/**
 * Admin API - Protected admin endpoints
 * GET /api/admin?action=stats|users|activity|moderation
 * POST /api/admin?action=ban|unban|delete-user|delete-post
 */

const { getSupabaseAdmin } = require('./_supabase');
const { handleCors, corsHeaders } = require('./_cors');

// Admin emails - should be in env in production
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@cinq.app').split(',').map(e => e.trim().toLowerCase());

async function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return { valid: false, error: 'Missing authorization header' };
    }

    const token = authHeader.substring(7);
    const supabase = getSupabaseAdmin();
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
        return { valid: false, error: 'Invalid token' };
    }

    if (!ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
        return { valid: false, error: 'Access denied: not an admin' };
    }

    return { valid: true, user };
}

async function getStats(supabase) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Parallel queries for performance
    const [
        { count: totalUsers },
        { count: usersToday },
        { count: usersWeek },
        { count: usersMonth },
        { count: totalMessages },
        { count: messagesWeek },
        { count: totalPosts },
        { count: postsWeek },
        { count: totalContacts },
        { count: activeGiftCodes },
        { count: redeemedGiftCodes },
        { count: waitlistCount }
    ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', today),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('users').select('*', { count: 'exact', head: true }).gte('created_at', monthAgo),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('posts').select('*', { count: 'exact', head: true }),
        supabase.from('posts').select('*', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('contacts').select('*', { count: 'exact', head: true }),
        supabase.from('gift_codes').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('gift_codes').select('*', { count: 'exact', head: true }).eq('status', 'redeemed'),
        supabase.from('waitlist').select('*', { count: 'exact', head: true })
    ]);

    return {
        users: {
            total: totalUsers || 0,
            today: usersToday || 0,
            week: usersWeek || 0,
            month: usersMonth || 0
        },
        messages: {
            total: totalMessages || 0,
            week: messagesWeek || 0
        },
        posts: {
            total: totalPosts || 0,
            week: postsWeek || 0
        },
        contacts: {
            total: totalContacts || 0
        },
        giftCodes: {
            active: activeGiftCodes || 0,
            redeemed: redeemedGiftCodes || 0
        },
        waitlist: waitlistCount || 0
    };
}

async function getActivity(supabase, days = 14) {
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    
    // Get signups per day
    const { data: signups } = await supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

    // Get messages per day
    const { data: messages } = await supabase
        .from('messages')
        .select('created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

    // Get posts per day
    const { data: posts } = await supabase
        .from('posts')
        .select('created_at')
        .gte('created_at', startDate)
        .order('created_at', { ascending: true });

    // Aggregate by day
    const aggregateByDay = (items) => {
        const counts = {};
        (items || []).forEach(item => {
            const day = item.created_at.split('T')[0];
            counts[day] = (counts[day] || 0) + 1;
        });
        return counts;
    };

    return {
        signups: aggregateByDay(signups),
        messages: aggregateByDay(messages),
        posts: aggregateByDay(posts)
    };
}

async function getRecentUsers(supabase, limit = 20) {
    const { data: users, error } = await supabase
        .from('users')
        .select('id, email, display_name, avatar_url, gift_code_used, created_at, banned')
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return users || [];
}

async function getRecentPosts(supabase, limit = 20) {
    const { data: posts, error } = await supabase
        .from('posts')
        .select(`
            id, content, image_url, created_at,
            users:user_id (id, email, display_name)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;
    return posts || [];
}

async function banUser(supabase, userId, banned = true) {
    const { data, error } = await supabase
        .from('users')
        .update({ banned })
        .eq('id', userId)
        .select()
        .single();

    if (error) throw error;
    return data;
}

async function deleteUser(supabase, userId) {
    // Delete from auth (cascades to users table)
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;
    return { deleted: true };
}

async function deletePost(supabase, postId) {
    const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);

    if (error) throw error;
    return { deleted: true };
}

module.exports = async function handler(req, res) {
    // Handle CORS
    if (handleCors(req, res)) return;

    try {
        // Verify admin access
        const auth = await verifyAdmin(req);
        if (!auth.valid) {
            return res.status(401).json({ success: false, error: auth.error });
        }

        const supabase = getSupabaseAdmin();
        const action = req.query.action || (req.body && req.body.action);

        if (req.method === 'GET') {
            switch (action) {
                case 'stats':
                    const stats = await getStats(supabase);
                    return res.status(200).json({ success: true, data: stats });

                case 'activity':
                    const days = parseInt(req.query.days) || 14;
                    const activity = await getActivity(supabase, days);
                    return res.status(200).json({ success: true, data: activity });

                case 'users':
                    const limit = parseInt(req.query.limit) || 20;
                    const users = await getRecentUsers(supabase, limit);
                    return res.status(200).json({ success: true, data: users });

                case 'posts':
                    const postLimit = parseInt(req.query.limit) || 20;
                    const posts = await getRecentPosts(supabase, postLimit);
                    return res.status(200).json({ success: true, data: posts });

                default:
                    return res.status(400).json({ success: false, error: 'Invalid action' });
            }
        }

        if (req.method === 'POST') {
            const { userId, postId, banned } = req.body || {};

            switch (action) {
                case 'ban':
                    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
                    const bannedUser = await banUser(supabase, userId, true);
                    return res.status(200).json({ success: true, data: bannedUser });

                case 'unban':
                    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
                    const unbannedUser = await banUser(supabase, userId, false);
                    return res.status(200).json({ success: true, data: unbannedUser });

                case 'delete-user':
                    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
                    const deletedUser = await deleteUser(supabase, userId);
                    return res.status(200).json({ success: true, data: deletedUser });

                case 'delete-post':
                    if (!postId) return res.status(400).json({ success: false, error: 'postId required' });
                    const deletedPost = await deletePost(supabase, postId);
                    return res.status(200).json({ success: true, data: deletedPost });

                default:
                    return res.status(400).json({ success: false, error: 'Invalid action' });
            }
        }

        return res.status(405).json({ success: false, error: 'Method not allowed' });

    } catch (err) {
        console.error('Admin API error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
};
