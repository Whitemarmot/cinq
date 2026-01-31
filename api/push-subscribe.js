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
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    try {
        // ============ POST - Subscribe to push ============
        if (req.method === 'POST') {
            const { subscription } = req.body;

            if (!subscription?.endpoint) {
                return res.status(400).json({ error: 'subscription requis' });
            }

            // Upsert subscription
            const { error } = await supabase
                .from('push_subscriptions')
                .upsert({
                    user_id: user.id,
                    endpoint: subscription.endpoint,
                    keys: subscription.keys,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'endpoint' });

            if (error) throw error;
            return res.json({ success: true, message: 'Notifications activées' });
        }

        // ============ DELETE - Unsubscribe ============
        if (req.method === 'DELETE') {
            const { endpoint } = req.body;

            const { error } = await supabase
                .from('push_subscriptions')
                .delete()
                .eq('user_id', user.id)
                .eq('endpoint', endpoint);

            if (error) throw error;
            return res.json({ success: true, message: 'Notifications désactivées' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        console.error('Push error:', e);
        return res.status(500).json({ error: e.message });
    }
}
