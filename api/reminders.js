/**
 * Reminders API - Schedule reminders on chat messages
 * 
 * Endpoints:
 * - GET - List all pending reminders for current user
 * - POST - Create a new reminder on a message
 * - DELETE - Cancel a reminder
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { sendPushNotification } from './_push-helper.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = req.method === 'POST' ? RATE_LIMITS.CREATE : RATE_LIMITS.READ;
    if (!checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'reminders', userId: user.id })) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetReminders(req, res, user);
        }

        if (req.method === 'POST') {
            return handleCreateReminder(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleDeleteReminder(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/reminders',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Erreur avec les rappels. Réessaie.'
            })
        );
    }
}

// ===== GET - Fetch reminders =====

async function handleGetReminders(req, res, user) {
    const { message_id, contact_id, include_triggered = false } = req.query;
    
    let query = supabase
        .from('reminders')
        .select(`
            id,
            message_id,
            contact_id,
            remind_at,
            note,
            triggered,
            created_at,
            message:messages(id, content, sender_id, created_at),
            contact:users!reminders_contact_id_fkey(id, display_name, avatar_url, email)
        `)
        .eq('user_id', user.id)
        .order('remind_at', { ascending: true });
    
    // Filter by message if specified
    if (message_id) {
        if (!isValidUUID(message_id)) {
            return res.status(400).json({ error: 'Format message_id invalide' });
        }
        query = query.eq('message_id', message_id);
    }
    
    // Filter by contact if specified
    if (contact_id) {
        if (!isValidUUID(contact_id)) {
            return res.status(400).json({ error: 'Format contact_id invalide' });
        }
        query = query.eq('contact_id', contact_id);
    }
    
    // By default, only show non-triggered reminders
    if (include_triggered !== 'true') {
        query = query.eq('triggered', false);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    return res.json({ reminders: data || [] });
}

// ===== POST - Create reminder =====

async function handleCreateReminder(req, res, user) {
    const { message_id, contact_id, remind_at, note } = req.body;
    
    // Validate required fields
    if (!message_id) {
        return res.status(400).json({ error: 'message_id requis' });
    }
    
    if (!isValidUUID(message_id)) {
        return res.status(400).json({ error: 'Format message_id invalide' });
    }
    
    if (!contact_id) {
        return res.status(400).json({ error: 'contact_id requis' });
    }
    
    if (!isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Format contact_id invalide' });
    }
    
    if (!remind_at) {
        return res.status(400).json({ error: 'remind_at requis' });
    }
    
    const remindDate = new Date(remind_at);
    if (isNaN(remindDate.getTime())) {
        return res.status(400).json({ error: 'Format remind_at invalide' });
    }
    
    // Ensure remind_at is in the future
    if (remindDate <= new Date()) {
        return res.status(400).json({ error: 'Le rappel doit être dans le futur' });
    }
    
    // Limit to 1 year in the future
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 1);
    if (remindDate > maxDate) {
        return res.status(400).json({ error: 'Le rappel ne peut pas être programmé plus d\'un an à l\'avance' });
    }
    
    // Verify the message exists and user has access
    const { data: messageData, error: messageError } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content')
        .eq('id', message_id)
        .single();
    
    if (messageError || !messageData) {
        return res.status(404).json({ error: 'Message non trouvé' });
    }
    
    // Verify user is part of the conversation
    if (messageData.sender_id !== user.id && messageData.receiver_id !== user.id) {
        return res.status(403).json({ error: 'Accès refusé à ce message' });
    }
    
    // Check if reminder already exists for this message
    const { data: existingReminder } = await supabase
        .from('reminders')
        .select('id')
        .eq('user_id', user.id)
        .eq('message_id', message_id)
        .eq('triggered', false)
        .single();
    
    if (existingReminder) {
        return res.status(409).json({ error: 'Un rappel existe déjà pour ce message' });
    }
    
    // Limit total active reminders per user (e.g., 50)
    const { count: reminderCount } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('triggered', false);
    
    if (reminderCount >= 50) {
        return res.status(400).json({ error: 'Tu as atteint la limite de 50 rappels actifs' });
    }
    
    // Create the reminder
    const { data, error } = await supabase
        .from('reminders')
        .insert({
            user_id: user.id,
            message_id,
            contact_id,
            remind_at: remindDate.toISOString(),
            note: note?.trim()?.substring(0, 200) || null,
            triggered: false
        })
        .select()
        .single();
    
    if (error) throw error;
    
    logInfo('Reminder created', { 
        reminderId: data.id, 
        userId: user.id, 
        messageId: message_id,
        remindAt: remindDate.toISOString()
    });
    
    return res.status(201).json({ success: true, reminder: data });
}

// ===== DELETE - Cancel reminder =====

async function handleDeleteReminder(req, res, user) {
    const { id } = req.query;
    
    if (!id) {
        return res.status(400).json({ error: 'id requis' });
    }
    
    if (!isValidUUID(id)) {
        return res.status(400).json({ error: 'Format id invalide' });
    }
    
    // Verify the reminder belongs to the user
    const { data: reminder, error: findError } = await supabase
        .from('reminders')
        .select('id')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();
    
    if (findError || !reminder) {
        return res.status(404).json({ error: 'Rappel non trouvé' });
    }
    
    // Delete the reminder
    const { error } = await supabase
        .from('reminders')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
    
    if (error) throw error;
    
    logInfo('Reminder deleted', { reminderId: id, userId: user.id });
    
    return res.json({ success: true });
}

// ===== TRIGGER REMINDERS (called by cron/heartbeat) =====

export async function triggerDueReminders() {
    const now = new Date().toISOString();
    
    // Get all due reminders that haven't been triggered
    const { data: dueReminders, error } = await supabase
        .from('reminders')
        .select(`
            id,
            user_id,
            message_id,
            contact_id,
            remind_at,
            note,
            message:messages(id, content, sender_id),
            contact:users!reminders_contact_id_fkey(id, display_name, email)
        `)
        .eq('triggered', false)
        .lte('remind_at', now)
        .limit(100);
    
    if (error) {
        logError(error, { context: 'triggerDueReminders' });
        return { triggered: 0, errors: 1 };
    }
    
    if (!dueReminders || dueReminders.length === 0) {
        return { triggered: 0, errors: 0 };
    }
    
    let triggered = 0;
    let errors = 0;
    
    for (const reminder of dueReminders) {
        try {
            // Mark as triggered first to prevent double-sending
            await supabase
                .from('reminders')
                .update({ triggered: true })
                .eq('id', reminder.id);
            
            // Build notification content
            const contactName = reminder.contact?.display_name || 
                               reminder.contact?.email?.split('@')[0] || 
                               'un contact';
            
            const messagePreview = reminder.message?.content?.substring(0, 50) || 'Message';
            const noteText = reminder.note ? `\n📝 ${reminder.note}` : '';
            
            const title = '⏰ Rappel';
            const body = `Rappel : message de ${contactName}\n"${messagePreview}..."${noteText}`;
            
            // Send push notification
            await sendPushNotification(reminder.user_id, {
                title,
                body,
                tag: `reminder-${reminder.id}`,
                data: { 
                    type: 'reminder',
                    reminderId: reminder.id,
                    messageId: reminder.message_id,
                    contactId: reminder.contact_id
                }
            });
            
            logInfo('Reminder triggered', { 
                reminderId: reminder.id, 
                userId: reminder.user_id 
            });
            
            triggered++;
            
        } catch (e) {
            logError(e, { 
                context: 'triggerReminder', 
                reminderId: reminder.id 
            });
            errors++;
        }
    }
    
    return { triggered, errors };
}
