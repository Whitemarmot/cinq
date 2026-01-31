import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from './_push-helper.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, validateMessageContent } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { cors } from './_cors.js';

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
    // SECURITY: Validate CORS origin
    if (!cors(req, res)) return;

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    // Rate limiting
    const rateLimitConfig = req.method === 'POST' ? RATE_LIMITS.CREATE : RATE_LIMITS.READ;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'messages', userId: user.id })) {
        return;
    }

    try {
        // ============ GET - Fetch messages with a contact ============
        if (req.method === 'GET') {
            const { contact_id, limit = 50, before } = req.query;

            if (!contact_id) {
                return res.status(400).json({ error: 'contact_id requis' });
            }

            // SECURITY FIX: Validate UUID format to prevent injection
            if (!isValidUUID(contact_id)) {
                return res.status(400).json({ error: 'Format contact_id invalide' });
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

            // Validate limit
            const safeLimit = Math.min(Math.max(1, parseInt(limit) || 50), 100);

            // Build query - now safe because contact_id is validated as UUID
            let query = supabase
                .from('messages')
                .select('*')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),and(sender_id.eq.${contact_id},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: false })
                .limit(safeLimit);

            if (before) {
                // Validate before timestamp
                const beforeDate = new Date(before);
                if (!isNaN(beforeDate.getTime())) {
                    query = query.lt('created_at', before);
                }
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

            // SECURITY FIX: Validate UUID format
            if (!isValidUUID(contact_id)) {
                return res.status(400).json({ error: 'Format contact_id invalide' });
            }

            // Validate content
            if (!is_ping) {
                const contentResult = validateMessageContent(content, { maxLength: 2000, required: true });
                if (!contentResult.valid) {
                    return res.status(400).json({ error: contentResult.error });
                }
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

            // Sanitize content
            const safeContent = is_ping ? '👋' : validateMessageContent(content, { maxLength: 2000 }).content;

            // Create message
            const { data, error } = await supabase
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: contact_id,
                    content: safeContent,
                    is_ping
                })
                .select()
                .single();

            if (error) throw error;

            // Send push notification to receiver
            const senderName = user.email?.split('@')[0] || 'Quelqu\'un';
            sendPushNotification(contact_id, {
                title: is_ping ? '👋 Ping !' : `Message de ${senderName}`,
                body: is_ping ? `${senderName} te fait coucou` : safeContent.substring(0, 100),
                tag: `msg-${data.id}`,
                data: { messageId: data.id, senderId: user.id }
            });

            return res.status(201).json({ success: true, message: data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/messages',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Ton message n\'a pas pu être envoyé. Réessaie.'
            })
        );
    }
}
