import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { validateDisplayName, validateBio, validateURL } from './_validation.js';

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

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'profile', userId: user.id })) {
        return;
    }

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
            
            // Validate and sanitize display_name
            if (display_name !== undefined) {
                const result = validateDisplayName(display_name);
                if (!result.valid) {
                    return res.status(400).json({ error: result.error, field: 'display_name' });
                }
                updates.display_name = result.name;
            }
            
            // Validate and sanitize avatar_url
            if (avatar_url !== undefined) {
                const result = validateURL(avatar_url);
                if (!result.valid) {
                    return res.status(400).json({ error: result.error, field: 'avatar_url' });
                }
                updates.avatar_url = result.url;
            }
            
            // Validate and sanitize bio
            if (bio !== undefined) {
                const result = validateBio(bio);
                if (!result.valid) {
                    return res.status(400).json({ error: result.error, field: 'bio' });
                }
                updates.bio = result.bio;
            }

            // Nothing to update
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
            }

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
