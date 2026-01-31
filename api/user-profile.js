import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
    return user;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    try {
        // ============ GET - Get profile ============
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', user.id)
                .single();

            if (error) throw error;

            // Get contact count
            const { count } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            return res.json({ 
                profile: data,
                stats: {
                    contactCount: count || 0,
                    maxContacts: 5
                }
            });
        }

        // ============ PUT - Update profile ============
        if (req.method === 'PUT') {
            const { display_name, avatar_url, bio } = req.body;

            const updates = {};
            if (display_name !== undefined) updates.display_name = display_name;
            if (avatar_url !== undefined) updates.avatar_url = avatar_url;
            if (bio !== undefined) updates.bio = bio;
            updates.updated_at = new Date().toISOString();

            const { data, error } = await supabase
                .from('users')
                .update(updates)
                .eq('id', user.id)
                .select()
                .single();

            if (error) throw error;
            return res.json({ success: true, profile: data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Profile error:', e);
        return res.status(500).json({ error: e.message });
    }
}
