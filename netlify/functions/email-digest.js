/**
 * CINQ Email Digest - Netlify Scheduled Function
 * SARAH Backend - Daily Message Digest
 * 
 * This function sends daily email digests to users with unread messages.
 * 
 * Trigger: Netlify Scheduled Function (cron)
 * Schedule: Daily at 9:00 AM UTC (configure in netlify.toml)
 * 
 * [functions."email-digest"]
 * schedule = "0 9 * * *"
 * 
 * Can also be triggered manually:
 * POST /api/email-digest (with INTERNAL_API_KEY)
 */

const { createClient } = require('@supabase/supabase-js');
const { sendEmail } = require('./email-send');
const { success, error, headers } = require('./gift-utils');

// ============================================
// Supabase Admin Client
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

// ============================================
// Digest Logic
// ============================================

async function generateAndSendDigests() {
    const supabase = getSupabaseAdmin();
    const results = {
        processed: 0,
        sent: 0,
        skipped: 0,
        errors: []
    };
    
    // Get all users with unread messages from the last 24 hours
    // This query finds messages where receiver hasn't read them yet
    const { data: unreadData, error: unreadError } = await supabase
        .rpc('get_users_with_unread_messages')
        .select('*');
    
    // If RPC doesn't exist, fallback to manual query
    let usersWithUnread = unreadData;
    
    if (unreadError) {
        console.log('RPC not available, using fallback query');
        
        // Fallback: Get messages from last 24h grouped by receiver
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const { data: recentMessages, error: msgError } = await supabase
            .from('messages')
            .select(`
                receiver_id,
                sender_id,
                content,
                created_at
            `)
            .gte('created_at', since)
            .order('created_at', { ascending: false });
        
        if (msgError) {
            throw new Error(`Failed to fetch messages: ${msgError.message}`);
        }
        
        // Group by receiver
        const byReceiver = {};
        for (const msg of recentMessages || []) {
            if (!byReceiver[msg.receiver_id]) {
                byReceiver[msg.receiver_id] = {
                    user_id: msg.receiver_id,
                    messages: []
                };
            }
            byReceiver[msg.receiver_id].messages.push(msg);
        }
        
        usersWithUnread = Object.values(byReceiver);
    }
    
    // Process each user
    for (const userData of usersWithUnread || []) {
        results.processed++;
        
        try {
            // Get user email and notification preferences
            const { data: user, error: userError } = await supabase
                .from('users')
                .select('id, email, display_name, notification_preferences')
                .eq('id', userData.user_id)
                .single();
            
            if (userError || !user) {
                // Try auth table
                const { data: { users }, error: authListError } = await supabase.auth.admin
                    .listUsers({ page: 1, perPage: 1000 });
                
                const authUser = users?.find(u => u.id === userData.user_id);
                if (!authUser?.email) {
                    results.skipped++;
                    continue;
                }
                user = { id: authUser.id, email: authUser.email };
            }
            
            // Check notification preferences
            const prefs = user.notification_preferences || {};
            if (prefs.email_digest === false) {
                results.skipped++;
                continue;
            }
            
            // Get sender details for the digest
            const messages = userData.messages || [];
            const bySender = {};
            
            for (const msg of messages) {
                if (!bySender[msg.sender_id]) {
                    bySender[msg.sender_id] = {
                        sender_id: msg.sender_id,
                        messages: []
                    };
                }
                bySender[msg.sender_id].messages.push(msg);
            }
            
            // Get sender names
            const senderIds = Object.keys(bySender);
            const { data: senders } = await supabase
                .from('users')
                .select('id, display_name, username')
                .in('id', senderIds);
            
            const senderMap = {};
            for (const s of senders || []) {
                senderMap[s.id] = s.display_name || s.username || 'Someone';
            }
            
            // Build contacts array for template
            const contacts = Object.values(bySender).map(s => ({
                name: senderMap[s.sender_id] || 'Someone',
                message_count: s.messages.length,
                last_message_preview: s.messages[0]?.content || ''
            }));
            
            const totalUnread = messages.length;
            
            // Send digest email
            await sendEmail({
                to: user.email,
                template: 'new-message-digest',
                data: {
                    unread_count: totalUnread,
                    contacts
                }
            });
            
            results.sent++;
            console.log(`Digest sent to ${user.email}: ${totalUnread} messages`);
            
        } catch (err) {
            console.error(`Error processing user ${userData.user_id}:`, err);
            results.errors.push({
                user_id: userData.user_id,
                error: err.message
            });
        }
    }
    
    return results;
}

// ============================================
// Handler
// ============================================

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // Check if this is a scheduled invocation or manual trigger
    const isScheduled = event.httpMethod === 'GET' && !event.queryStringParameters;
    const isManual = event.httpMethod === 'POST';
    
    // For manual triggers, verify internal API key
    if (isManual) {
        const internalKey = event.headers['x-internal-key'] || event.headers['X-Internal-Key'];
        const expectedKey = process.env.INTERNAL_API_KEY;
        
        if (expectedKey && internalKey !== expectedKey) {
            return error('Unauthorized', 401);
        }
    }
    
    // Only allow scheduled or authorized manual triggers
    if (!isScheduled && !isManual) {
        return error('Method not allowed', 405);
    }
    
    try {
        console.log('Starting daily digest job...');
        const startTime = Date.now();
        
        const results = await generateAndSendDigests();
        
        const duration = Date.now() - startTime;
        console.log(`Digest job completed in ${duration}ms:`, results);
        
        return success({
            message: 'Digest job completed',
            duration_ms: duration,
            ...results
        });
        
    } catch (err) {
        console.error('Digest job error:', err);
        return error(`Digest job failed: ${err.message}`, 500);
    }
};

// ============================================
// Netlify Scheduled Function Config
// ============================================

// Export schedule for Netlify to pick up
// Daily at 9:00 AM UTC
exports.config = {
    schedule: '0 9 * * *'
};
