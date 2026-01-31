/**
 * CINQ Proposals - Netlify Function
 * "Proposer un moment" - Suggest a meetup to a contact
 * 
 * GET /api/proposals?contact_id=<uuid>
 *   - Returns proposals between user and contact
 * 
 * POST /api/proposals
 *   - Create a new proposal
 *   - Body: { contact_id, proposed_at, location?, message? }
 * 
 * PATCH /api/proposals
 *   - Accept or decline a proposal
 *   - Body: { proposal_id, action: 'accept' | 'decline' }
 * 
 * Requires: Authorization: Bearer <access_token>
 */

const { createClient } = require('@supabase/supabase-js');
const { success, error, headers } = require('./gift-utils');

// ============================================
// Supabase Clients
// ============================================

function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

function getSupabaseWithToken(token) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
        throw new Error('Missing Supabase configuration');
    }
    
    return createClient(url, key, {
        global: {
            headers: { Authorization: `Bearer ${token}` }
        },
        auth: { autoRefreshToken: false, persistSession: false }
    });
}

// ============================================
// Auth Helper
// ============================================

function getAuthToken(event) {
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }
    return authHeader.slice(7);
}

// ============================================
// Validation
// ============================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(str) {
    return str && typeof str === 'string' && UUID_REGEX.test(str);
}

function sanitizeText(text, maxLen = 200) {
    if (!text || typeof text !== 'string') return '';
    return text.trim().slice(0, maxLen);
}

function isValidDate(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
}

// ============================================
// Verify Contact Relationship
// ============================================

async function verifyContactRelationship(supabaseAdmin, userId, contactUserId) {
    const { data: contact, error: contactError } = await supabaseAdmin
        .from('contacts')
        .select('id')
        .eq('user_id', userId)
        .eq('contact_user_id', contactUserId)
        .single();
    
    if (contactError || !contact) {
        return false;
    }
    
    return true;
}

// ============================================
// Handler
// ============================================

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    // ========================================
    // Authentication
    // ========================================
    
    const token = getAuthToken(event);
    if (!token) {
        return error('Authorization required', 401);
    }

    const supabaseAdmin = getSupabaseAdmin();
    const supabase = getSupabaseWithToken(token);

    // Verify token and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
        return error('Invalid or expired token', 401);
    }

    // ========================================
    // GET - Fetch Proposals
    // ========================================
    
    if (event.httpMethod === 'GET') {
        try {
            const params = event.queryStringParameters || {};
            const contactId = params.contact_id;
            
            if (!isValidUUID(contactId)) {
                return error('Valid contact_id is required', 400);
            }
            
            // Verify contact relationship
            const hasContact = await verifyContactRelationship(supabaseAdmin, user.id, contactId);
            if (!hasContact) {
                return error('Contact not found in your circle', 403);
            }
            
            // Get proposals between user and contact (both directions)
            const { data: proposals, error: propError } = await supabaseAdmin
                .from('proposals')
                .select('id, sender_id, receiver_id, proposed_at, location, message, status, responded_at, created_at')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true });
            
            if (propError) {
                if (propError.code === '42P01') {
                    return success({ proposals: [], contact_id: contactId });
                }
                console.error('Error fetching proposals:', propError);
                return error('Failed to fetch proposals', 500);
            }
            
            // Format proposals
            const formattedProposals = (proposals || []).map(p => ({
                id: p.id,
                sender_id: p.sender_id,
                receiver_id: p.receiver_id,
                proposed_at: p.proposed_at,
                location: p.location,
                message: p.message,
                status: p.status,
                responded_at: p.responded_at,
                is_mine: p.sender_id === user.id,
                created_at: p.created_at
            }));
            
            return success({
                proposals: formattedProposals,
                contact_id: contactId,
                count: formattedProposals.length
            });
            
        } catch (err) {
            console.error('GET proposals error:', err);
            return error('Server error fetching proposals', 500);
        }
    }
    
    // ========================================
    // POST - Create Proposal
    // ========================================
    
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { contact_id, proposed_at, location, message } = body;
            
            // Validate contact_id
            if (!isValidUUID(contact_id)) {
                return error('Valid contact_id is required', 400);
            }
            
            // Validate proposed_at
            if (!isValidDate(proposed_at)) {
                return error('Valid proposed_at date is required', 400);
            }
            
            const proposedDate = new Date(proposed_at);
            const now = new Date();
            
            // Proposal must be in the future
            if (proposedDate <= now) {
                return error('Proposed time must be in the future', 400);
            }
            
            // Verify contact relationship
            const hasContact = await verifyContactRelationship(supabaseAdmin, user.id, contact_id);
            if (!hasContact) {
                return error('Contact not found in your circle', 403);
            }
            
            // Insert proposal
            const { data: newProposal, error: insertError } = await supabaseAdmin
                .from('proposals')
                .insert({
                    sender_id: user.id,
                    receiver_id: contact_id,
                    proposed_at: proposedDate.toISOString(),
                    location: sanitizeText(location, 100) || null,
                    message: sanitizeText(message, 200) || null,
                    status: 'pending'
                })
                .select('id, sender_id, receiver_id, proposed_at, location, message, status, created_at')
                .single();
            
            if (insertError) {
                console.error('Error inserting proposal:', insertError);
                
                if (insertError.code === '42P01') {
                    return error('Proposals not available yet', 503);
                }
                
                return error('Failed to create proposal', 500);
            }
            
            return success({
                proposal: {
                    id: newProposal.id,
                    sender_id: newProposal.sender_id,
                    receiver_id: newProposal.receiver_id,
                    proposed_at: newProposal.proposed_at,
                    location: newProposal.location,
                    message: newProposal.message,
                    status: newProposal.status,
                    is_mine: true,
                    created_at: newProposal.created_at
                }
            }, 201);
            
        } catch (err) {
            console.error('POST proposal error:', err);
            
            if (err instanceof SyntaxError) {
                return error('Invalid JSON body', 400);
            }
            
            return error('Server error creating proposal', 500);
        }
    }
    
    // ========================================
    // PATCH - Accept/Decline Proposal
    // ========================================
    
    if (event.httpMethod === 'PATCH') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { proposal_id, action } = body;
            
            // Validate proposal_id
            if (!isValidUUID(proposal_id)) {
                return error('Valid proposal_id is required', 400);
            }
            
            // Validate action
            if (!['accept', 'decline'].includes(action)) {
                return error('Action must be "accept" or "decline"', 400);
            }
            
            // Get the proposal
            const { data: proposal, error: fetchError } = await supabaseAdmin
                .from('proposals')
                .select('*')
                .eq('id', proposal_id)
                .single();
            
            if (fetchError || !proposal) {
                return error('Proposal not found', 404);
            }
            
            // Only receiver can accept/decline
            if (proposal.receiver_id !== user.id) {
                return error('Only the receiver can respond to this proposal', 403);
            }
            
            // Can only respond to pending proposals
            if (proposal.status !== 'pending') {
                return error(`Proposal already ${proposal.status}`, 400);
            }
            
            // Update proposal
            const newStatus = action === 'accept' ? 'accepted' : 'declined';
            
            const { data: updated, error: updateError } = await supabaseAdmin
                .from('proposals')
                .update({
                    status: newStatus,
                    responded_at: new Date().toISOString()
                })
                .eq('id', proposal_id)
                .select('id, sender_id, receiver_id, proposed_at, location, message, status, responded_at, created_at')
                .single();
            
            if (updateError) {
                console.error('Error updating proposal:', updateError);
                return error('Failed to update proposal', 500);
            }
            
            return success({
                proposal: {
                    ...updated,
                    is_mine: updated.sender_id === user.id
                }
            });
            
        } catch (err) {
            console.error('PATCH proposal error:', err);
            
            if (err instanceof SyntaxError) {
                return error('Invalid JSON body', 400);
            }
            
            return error('Server error updating proposal', 500);
        }
    }
    
    return error('Method not allowed', 405);
};
