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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    try {
        // ============ GET - Fetch messages with a contact ============
        if (req.method === 'GET') {
            const { contact_id, limit = 50, before } = req.query;

            if (!contact_id) {
                return res.status(400).json({ error: 'contact_id requis' });
            }

            // Verify contact relationship exists
            const { data: contact } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', user.id)
                .eq('contact_user_id', contact_id)
                .single();

            if (!contact) {
                return res.status(403).json({ error: 'Pas dans tes contacts' });
            }

            // Build query
            let query = supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),and(sender_id.eq.${contact_id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: false })
                .limit(parseInt(limit));

            if (before) {
                query = query.lt('created_at', before);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Mark as read
            await supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('receiver_id', user.id)
                .eq('sender_id', contact_id)
                .is('read_at', null);

            return res.json({ messages: data.reverse() });
        }

        // ============ POST - Send message or ping ============
        if (req.method === 'POST') {
            const { contact_id, content, is_ping = false } = req.body;

            if (!contact_id) {
                return res.status(400).json({ error: 'contact_id requis' });
            }

            if (!is_ping && !content) {
                return res.status(400).json({ error: 'content requis (ou is_ping: true)' });
            }

            // Verify contact
            const { data: contact } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', user.id)
                .eq('contact_user_id', contact_id)
                .single();

            if (!contact) {
                return res.status(403).json({ error: 'Pas dans tes contacts' });
            }

            // Create message
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: contact_id,
                    content: is_ping ? '👋' : content,
                    is_ping
                })
                .select()
                .single();

            if (error) throw error;

            // TODO: Send push notification to receiver

            return res.status(201).json({ success: true, message: data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Messages error:', e);
        return res.status(500).json({ error: e.message });
    }
}
