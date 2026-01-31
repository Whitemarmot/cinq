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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    try {
        // ============ GET - List proposals with a contact ============
        if (req.method === 'GET') {
            const { contact_id } = req.query;

            let query = supabase
                .from('proposals')
                .select('*')
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (contact_id) {
                query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),and(sender_id.eq.${contact_id},receiver_id.eq.${user.id})`);
            }

            const { data, error } = await query;
            if (error) throw error;
            return res.json({ proposals: data });
        }

        // ============ POST - Create proposal ============
        if (req.method === 'POST') {
            const { contact_id, proposed_at, location, message } = req.body;

            if (!contact_id || !proposed_at) {
                return res.status(400).json({ error: 'contact_id et proposed_at requis' });
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

            const { data, error } = await supabase
                .from('proposals')
                .insert({
                    sender_id: user.id,
                    receiver_id: contact_id,
                    proposed_at,
                    location,
                    message,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, proposal: data });
        }

        // ============ PATCH - Accept/decline proposal ============
        if (req.method === 'PATCH') {
            const { proposal_id, action } = req.body;

            if (!proposal_id || !['accept', 'decline'].includes(action)) {
                return res.status(400).json({ error: 'proposal_id et action (accept/decline) requis' });
            }

            // Verify user is receiver
            const { data: proposal } = await supabase
                .from('proposals')
                .select('*')
                .eq('id', proposal_id)
                .eq('receiver_id', user.id)
                .single();

            if (!proposal) {
                return res.status(404).json({ error: 'Proposition non trouvée' });
            }

            const { data, error } = await supabase
                .from('proposals')
                .update({ 
                    status: action === 'accept' ? 'accepted' : 'declined',
                    responded_at: new Date().toISOString()
                })
                .eq('id', proposal_id)
                .select()
                .single();

            if (error) throw error;
            return res.json({ success: true, proposal: data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Proposals error:', e);
        return res.status(500).json({ error: e.message });
    }
}
