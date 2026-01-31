import { createClient } from '@supabase/supabase-js';
import { sendPushNotification } from './_push-helper.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, validateMessageContent, validateLocation } from './_validation.js';
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
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'proposals', userId: user.id })) {
        return;
    }

    try {
        // ============ GET - List proposals with a contact ============
        if (req.method === 'GET') {
            const { contact_id } = req.query;

            // Build base query - using user.id which is verified by getUser()
            let query = supabase
                .from('proposals')
                .select('*')
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .order('created_at', { ascending: false });

            if (contact_id) {
                // SECURITY FIX: Validate UUID before using in query
                if (!isValidUUID(contact_id)) {
                    return res.status(400).json({ error: 'Format contact_id invalide' });
                }
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

            // SECURITY FIX: Validate UUID
            if (!isValidUUID(contact_id)) {
                return res.status(400).json({ error: 'Format contact_id invalide' });
            }

            // Validate proposed_at is a valid date
            const proposedDate = new Date(proposed_at);
            if (isNaN(proposedDate.getTime())) {
                return res.status(400).json({ error: 'Format proposed_at invalide' });
            }

            // Validate and sanitize location
            const locationResult = validateLocation(location);
            if (!locationResult.valid) {
                return res.status(400).json({ error: locationResult.error });
            }

            // Validate and sanitize message
            const messageResult = validateMessageContent(message, { maxLength: 500, required: false });
            if (!messageResult.valid) {
                return res.status(400).json({ error: messageResult.error });
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
                    proposed_at: proposedDate.toISOString(),
                    location: locationResult.location,
                    message: messageResult.content,
                    status: 'pending'
                })
                .select()
                .single();

            if (error) throw error;

            // Send push notification to receiver
            const senderName = user.email?.split('@')[0] || 'Quelqu\'un';
            const date = proposedDate.toLocaleDateString('fr-FR', { 
                weekday: 'short', day: 'numeric', month: 'short' 
            });
            sendPushNotification(contact_id, {
                title: '📅 Nouvelle proposition',
                body: `${senderName} te propose un RDV ${date}${locationResult.location ? ' à ' + locationResult.location : ''}`,
                tag: `proposal-${data.id}`,
                data: { proposalId: data.id, senderId: user.id }
            });

            return res.status(201).json({ success: true, proposal: data });
        }

        // ============ PATCH - Accept/decline proposal ============
        if (req.method === 'PATCH') {
            const { proposal_id, action } = req.body;

            if (!proposal_id || !['accept', 'decline'].includes(action)) {
                return res.status(400).json({ error: 'proposal_id et action (accept/decline) requis' });
            }

            // SECURITY FIX: Validate UUID
            if (!isValidUUID(proposal_id)) {
                return res.status(400).json({ error: 'Format proposal_id invalide' });
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

            // Send push notification to proposal sender
            const responderName = user.email?.split('@')[0] || 'Quelqu\'un';
            const emoji = action === 'accept' ? '✅' : '❌';
            const status = action === 'accept' ? 'accepté' : 'décliné';
            sendPushNotification(proposal.sender_id, {
                title: `${emoji} Proposition ${status}e`,
                body: `${responderName} a ${status} ton RDV`,
                tag: `proposal-${data.id}`,
                data: { proposalId: data.id, responderId: user.id }
            });

            return res.json({ success: true, proposal: data });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/proposals',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Ta proposition n\'a pas pu être créée. Réessaie.'
            })
        );
    }
}
