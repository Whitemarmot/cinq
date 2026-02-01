/**
 * Birthday Reminders API - Automatic birthday notifications
 * 
 * Endpoints:
 * - GET - Get upcoming birthday reminders for current user
 * - GET /today - Get today's birthday reminders
 * - POST /generate - Regenerate birthday reminders for all contacts
 * - POST /mark-sent - Mark a reminder as sent { reminder_id }
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import { sendPushNotification } from './_push-helper.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = RATE_LIMITS.READ;
    if (!(await checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'birthday_reminders', userId: user.id }))) {
        return;
    }

    try {
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);
        
        if (req.method === 'GET') {
            if (pathname.endsWith('/today')) {
                return handleGetTodaysBirthdays(req, res, user);
            }
            return handleGetUpcomingBirthdays(req, res, user);
        }

        if (req.method === 'POST') {
            if (pathname.endsWith('/generate')) {
                return handleGenerateReminders(req, res, user);
            }
            if (pathname.endsWith('/mark-sent')) {
                return handleMarkReminderSent(req, res, user);
            }
            return res.status(405).json({ error: 'Invalid POST endpoint' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/birthday-reminders',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                genericMessage: 'Failed to process birthday reminders'
            })
        );
    }
}

async function handleGetUpcomingBirthdays(req, res, user) {
    const { limit = '10', include_past = 'false' } = req.query;
    const limitInt = Math.min(50, Math.max(1, parseInt(limit) || 10));
    
    try {
        let query = supabase
            .from('birthday_reminders')
            .select(`
                id,
                contact_user_id,
                reminder_date,
                birthday_date,
                year,
                sent_at,
                created_at,
                contact:contact_user_id (
                    id,
                    display_name,
                    avatar_url,
                    avatar_emoji,
                    birthday
                )
            `)
            .eq('user_id', user.id)
            .order('reminder_date', { ascending: true })
            .limit(limitInt);

        if (include_past !== 'true') {
            query = query.gte('reminder_date', new Date().toISOString().split('T')[0]);
        }

        const { data: reminders, error } = await query;

        if (error) {
            throw new Error(`Failed to fetch birthday reminders: ${error.message}`);
        }

        // Calculate additional info for each reminder
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const processedReminders = reminders?.map(reminder => {
            const reminderDate = new Date(reminder.reminder_date + 'T00:00:00.000Z');
            const birthdayDate = new Date(reminder.birthday_date + 'T00:00:00.000Z');
            const daysUntilReminder = Math.floor((reminderDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            const daysUntilBirthday = Math.floor((birthdayDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
            
            // Calculate age (if birthday has passed this year)
            const currentYear = now.getFullYear();
            const birthYear = reminder.contact?.birthday ? new Date(reminder.contact.birthday + 'T00:00:00.000Z').getFullYear() : null;
            const age = birthYear ? (reminder.year - birthYear) : null;

            let status = 'upcoming';
            if (daysUntilReminder === 0) status = 'today';
            else if (daysUntilReminder < 0) status = 'past';
            else if (daysUntilReminder <= 3) status = 'soon';

            return {
                ...reminder,
                days_until_reminder: daysUntilReminder,
                days_until_birthday: daysUntilBirthday,
                status,
                age,
                is_sent: !!reminder.sent_at
            };
        });

        return res.status(200).json({
            success: true,
            reminders: processedReminders,
            summary: {
                total: processedReminders?.length || 0,
                today: processedReminders?.filter(r => r.status === 'today').length || 0,
                this_week: processedReminders?.filter(r => r.days_until_reminder >= 0 && r.days_until_reminder <= 7).length || 0,
                pending: processedReminders?.filter(r => !r.is_sent && r.days_until_reminder >= 0).length || 0
            }
        });

    } catch (e) {
        logError(e, { userId: user.id });
        throw e;
    }
}

async function handleGetTodaysBirthdays(req, res, user) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get today's birthday reminders
        const { data: todayReminders, error: reminderError } = await supabase
            .from('birthday_reminders')
            .select(`
                id,
                contact_user_id,
                reminder_date,
                birthday_date,
                year,
                sent_at,
                contact:contact_user_id (
                    id,
                    display_name,
                    avatar_url,
                    avatar_emoji,
                    birthday
                )
            `)
            .eq('user_id', user.id)
            .eq('reminder_date', today);

        if (reminderError) {
            throw new Error(`Failed to fetch today's reminders: ${reminderError.message}`);
        }

        // Also get contacts who have birthdays today (even if reminder was yesterday)
        const { data: todayBirthdays, error: birthdayError } = await supabase
            .from('contacts')
            .select(`
                id,
                contact_user_id,
                nickname,
                contact:contact_user_id (
                    id,
                    display_name,
                    avatar_url,
                    avatar_emoji,
                    birthday
                )
            `)
            .eq('user_id', user.id)
            .eq('archived', false)
            .not('contact.birthday', 'is', null);

        if (birthdayError) {
            throw new Error(`Failed to fetch contacts with birthdays: ${birthdayError.message}`);
        }

        // Filter contacts whose birthday is today (month and day match)
        const todayBirthdayContacts = todayBirthdays?.filter(contact => {
            if (!contact.contact?.birthday) return false;
            
            const birthday = new Date(contact.contact.birthday + 'T00:00:00.000Z');
            const now = new Date();
            
            return birthday.getMonth() === now.getMonth() && 
                   birthday.getDate() === now.getDate();
        }) || [];

        // Calculate ages for today's birthdays
        const processedTodayBirthdays = todayBirthdayContacts.map(contact => {
            const birthday = new Date(contact.contact.birthday + 'T00:00:00.000Z');
            const age = new Date().getFullYear() - birthday.getFullYear();
            
            return {
                ...contact,
                age,
                is_birthday_today: true
            };
        });

        return res.status(200).json({
            success: true,
            today_reminders: todayReminders || [],
            today_birthdays: processedTodayBirthdays,
            summary: {
                reminders_count: todayReminders?.length || 0,
                birthdays_count: processedTodayBirthdays.length,
                sent_reminders: todayReminders?.filter(r => r.sent_at).length || 0
            }
        });

    } catch (e) {
        logError(e, { userId: user.id });
        throw e;
    }
}

async function handleGenerateReminders(req, res, user) {
    try {
        // Call the stored function to regenerate reminders
        const { error } = await supabase.rpc('generate_birthday_reminders');
        
        if (error) {
            throw new Error(`Failed to generate reminders: ${error.message}`);
        }

        logInfo('Birthday reminders regenerated', { userId: user.id });

        return res.status(200).json({
            success: true,
            message: 'Birthday reminders regenerated successfully'
        });

    } catch (e) {
        logError(e, { userId: user.id });
        throw e;
    }
}

async function handleMarkReminderSent(req, res, user) {
    const { reminder_id } = req.body;

    if (!reminder_id || !isValidUUID(reminder_id)) {
        return res.status(400).json({ error: 'Valid reminder_id required' });
    }

    try {
        // Verify this reminder belongs to the user
        const { data: reminder, error: fetchError } = await supabase
            .from('birthday_reminders')
            .select('id, contact_user_id, reminder_date, birthday_date')
            .eq('id', reminder_id)
            .eq('user_id', user.id)
            .single();

        if (fetchError || !reminder) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        // Mark as sent
        const { error } = await supabase
            .from('birthday_reminders')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', reminder_id);

        if (error) {
            throw new Error(`Failed to mark reminder as sent: ${error.message}`);
        }

        logInfo('Birthday reminder marked as sent', { 
            userId: user.id, 
            reminderId: reminder_id,
            contactId: reminder.contact_user_id
        });

        return res.status(200).json({
            success: true,
            message: 'Reminder marked as sent'
        });

    } catch (e) {
        logError(e, { userId: user.id, reminderId: reminder_id });
        throw e;
    }
}