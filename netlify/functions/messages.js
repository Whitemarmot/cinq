/**
 * CINQ Messages - Netlify Function
 * SARAH Backend - Messaging System
 * 
 * GET /api/messages?contact_id=<uuid>
 *   - Returns messages between user and contact
 *   - Optionally: ?limit=50&before=<timestamp>
 * 
 * POST /api/messages
 *   - Send a message or ping to a contact
 *   - Body: { contact_id, content?, is_ping? }
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

function sanitizeContent(content) {
    if (!content || typeof content !== 'string') return '';
    // Trim and limit length
    return content.trim().slice(0, 500);
}

// ============================================
// Verify Contact Relationship
// ============================================

async function verifyContactRelationship(supabaseAdmin, userId, contactUserId) {
    // Check if there's a mutual contact relationship
    // User must have added contactUserId as a contact
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
    // GET - Fetch Messages
    // ========================================
    
    if (event.httpMethod === 'GET') {
        try {
            const params = event.queryStringParameters || {};
            const contactId = params.contact_id;
            const limit = Math.min(parseInt(params.limit) || 50, 100);
            const before = params.before; // ISO timestamp for pagination
            
            if (!isValidUUID(contactId)) {
                return error('Valid contact_id is required', 400);
            }
            
            // Verify contact relationship
            const hasContact = await verifyContactRelationship(supabaseAdmin, user.id, contactId);
            if (!hasContact) {
                return error('Contact not found in your circle', 403);
            }
            
            // Build query for messages between user and contact (both directions)
            let query = supabaseAdmin
                .from('messages')
                .select('id, sender_id, receiver_id, content, is_ping, created_at')
                .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contactId}),and(sender_id.eq.${contactId},receiver_id.eq.${user.id})`)
                .order('created_at', { ascending: true })
                .limit(limit);
            
            if (before) {
                query = query.lt('created_at', before);
            }
            
            const { data: messages, error: msgError } = await query;
            
            if (msgError) {
                // Table might not exist
                if (msgError.code === '42P01') {
                    return success({ messages: [], contact_id: contactId });
                }
                console.error('Error fetching messages:', msgError);
                return error('Failed to fetch messages', 500);
            }
            
            // Format messages for frontend
            const formattedMessages = (messages || []).map(msg => ({
                id: msg.id,
                sender_id: msg.sender_id,
                receiver_id: msg.receiver_id,
                content: msg.content,
                is_ping: msg.is_ping || false,
                is_mine: msg.sender_id === user.id,
                created_at: msg.created_at
            }));
            
            return success({
                messages: formattedMessages,
                contact_id: contactId,
                count: formattedMessages.length
            });
            
        } catch (err) {
            console.error('GET messages error:', err);
            return error('Server error fetching messages', 500);
        }
    }
    
    // ========================================
    // POST - Send Message
    // ========================================
    
    if (event.httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { contact_id, content, is_ping } = body;
            
            // Validate contact_id
            if (!isValidUUID(contact_id)) {
                return error('Valid contact_id is required', 400);
            }
            
            // Validate content (required unless ping)
            const isPingMessage = is_ping === true;
            const messageContent = isPingMessage ? '💫' : sanitizeContent(content);
            
            if (!isPingMessage && !messageContent) {
                return error('Message content is required', 400);
            }
            
            // Verify contact relationship
            const hasContact = await verifyContactRelationship(supabaseAdmin, user.id, contact_id);
            if (!hasContact) {
                return error('Contact not found in your circle', 403);
            }
            
            // Insert message
            const { data: newMessage, error: insertError } = await supabaseAdmin
                .from('messages')
                .insert({
                    sender_id: user.id,
                    receiver_id: contact_id,
                    content: messageContent,
                    is_ping: isPingMessage
                })
                .select('id, sender_id, receiver_id, content, is_ping, created_at')
                .single();
            
            if (insertError) {
                console.error('Error inserting message:', insertError);
                
                // Table might not exist
                if (insertError.code === '42P01') {
                    return error('Messaging not available yet', 503);
                }
                
                return error('Failed to send message', 500);
            }
            
            return success({
                message: {
                    id: newMessage.id,
                    sender_id: newMessage.sender_id,
                    receiver_id: newMessage.receiver_id,
                    content: newMessage.content,
                    is_ping: newMessage.is_ping,
                    is_mine: true,
                    created_at: newMessage.created_at
                }
            }, 201);
            
        } catch (err) {
            console.error('POST message error:', err);
            
            if (err instanceof SyntaxError) {
                return error('Invalid JSON body', 400);
            }
            
            return error('Server error sending message', 500);
        }
    }
    
    return error('Method not allowed', 405);
};
