/**
 * Proposals API - Schedule meetings with contacts
 * 
 * Endpoints:
 * - GET / - List proposals (optionally filter by contact)
 * - POST - Create new proposal
 * - PATCH - Accept/decline proposal
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { sendPushNotification } from './_push-helper.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID, validateMessageContent, validateLocation } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'PATCH', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'GET' ? RATE_LIMITS.READ : RATE_LIMITS.CREATE;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'proposals', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetProposals(req, res, user);
        }

        if (req.method === 'POST') {
            return handleCreateProposal(req, res, user);
        }

        if (req.method === 'PATCH') {
            return handleRespondToProposal(req, res, user);
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

// ===== GET PROPOSALS =====

async function handleGetProposals(req, res, user) {
    const { contact_id } = req.query;

    let query = supabase
        .from('proposals')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

    if (contact_id) {
        if (!isValidUUID(contact_id)) {
            return res.status(400).json({ error: 'Format contact_id invalide' });
        }
        query = query.or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),and(sender_id.eq.${contact_id},receiver_id.eq.${user.id})`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ proposals: data });
}

// ===== CREATE PROPOSAL =====

async function handleCreateProposal(req, res, user) {
    const { contact_id, proposed_at, location, message } = req.body;

    if (!contact_id || !proposed_at) {
        return res.status(400).json({ error: 'contact_id et proposed_at requis' });
    }

    if (!isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Format contact_id invalide' });
    }

    // Validate date
    const proposedDate = new Date(proposed_at);
    if (isNaN(proposedDate.getTime())) {
        return res.status(400).json({ error: 'Format proposed_at invalide' });
    }

    // Validate location
    const locationResult = validateLocation(location);
    if (!locationResult.valid) {
        return res.status(400).json({ error: locationResult.error });
    }

    // Validate message
    const messageResult = validateMessageContent(message, { maxLength: 500, required: false });
    if (!messageResult.valid) {
        return res.status(400).json({ error: messageResult.error });
    }

    // Verify contact relationship
    const { data: contact } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .eq('contact_user_id', contact_id)
        .single();

    if (!contact) {
        return res.status(403).json({ error: 'Pas dans tes contacts' });
    }

    // Create proposal
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

    // Send push notification
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

// ===== RESPOND TO PROPOSAL =====

async function handleRespondToProposal(req, res, user) {
    const { proposal_id, action } = req.body;

    if (!proposal_id || !['accept', 'decline'].includes(action)) {
        return res.status(400).json({ error: 'proposal_id et action (accept/decline) requis' });
    }

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

    // Update proposal
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

    // Send push notification to sender
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
