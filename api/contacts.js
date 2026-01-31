import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const MAX_CONTACTS = 5;

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
    return user;
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    try {
        // ============ GET - List contacts ============
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('contacts')
                .select(`
                    id,
                    contact_user_id,
                    created_at,
                    contact:users!contacts_contact_user_id_fkey(id, email)
                `)
                .eq('user_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;
            return res.json({ contacts: data, count: data.length, max: MAX_CONTACTS });
        }

        // ============ POST - Add contact ============
        if (req.method === 'POST') {
            const { contactId } = req.body;

            if (!contactId) {
                return res.status(400).json({ error: 'contactId requis' });
            }

            // Check limit
            const { count } = await supabase
                .from('contacts')
                .select('*', { count: 'exact', head: true })
                .eq('user_id', user.id);

            if (count >= MAX_CONTACTS) {
                return res.status(400).json({ 
                    error: `Limite atteinte ! Tu as déjà ${MAX_CONTACTS} contacts.`,
                    hint: 'Supprime un contact pour en ajouter un nouveau.'
                });
            }

            // Check if already contact
            const { data: existing } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', user.id)
                .eq('contact_user_id', contactId)
                .single();

            if (existing) {
                return res.status(400).json({ error: 'Déjà dans tes contacts' });
            }

            // Add contact
            const { data, error } = await supabase
                .from('contacts')
                .insert({
                    user_id: user.id,
                    contact_user_id: contactId
                })
                .select()
                .single();

            if (error) throw error;
            return res.status(201).json({ success: true, contact: data });
        }

        // ============ DELETE - Remove contact ============
        if (req.method === 'DELETE') {
            const contactId = req.query.id;
            
            if (!contactId) {
                return res.status(400).json({ error: 'id requis' });
            }

            const { error } = await supabase
                .from('contacts')
                .delete()
                .eq('id', contactId)
                .eq('user_id', user.id);

            if (error) throw error;
            return res.json({ success: true, message: 'Contact supprimé' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Contacts error:', e);
        return res.status(500).json({ error: e.message });
    }
}
