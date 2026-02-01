/**
 * Contact Insights API - Statistics about relationship with a contact
 * 
 * Endpoints:
 * - GET ?contact_id=xxx - Get insights for a specific contact
 * 
 * Returns:
 * - totalMessages: Total messages exchanged
 * - messagesSent: Messages sent by current user
 * - messagesReceived: Messages received from contact
 * - firstContact: Date of first message
 * - lastConversation: Date of most recent message
 * - daysSinceFirstContact: Days since first message
 * - averageMessagesPerDay: Average messages per day since first contact
 * - longestStreak: Longest streak of consecutive days with messages
 * - currentStreak: Current streak of consecutive days
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'contact-insights', userId: user.id })) {
        return;
    }

    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { contact_id } = req.query;

        if (!contact_id) {
            return res.status(400).json({ error: 'contact_id requis' });
        }

        if (!isValidUUID(contact_id)) {
            return res.status(400).json({ error: 'Format contact_id invalide' });
        }

        // Verify contact relationship
        const { data: contactRelation, error: contactError } = await supabase
            .from('contacts')
            .select('id, created_at')
            .eq('user_id', user.id)
            .eq('contact_user_id', contact_id)
            .single();

        if (contactError || !contactRelation) {
            return res.status(403).json({ error: 'Pas dans tes contacts' });
        }

        // Get all messages between the two users
        const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('id, sender_id, created_at')
            .or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),and(sender_id.eq.${contact_id},receiver_id.eq.${user.id})`)
            .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        // Calculate insights
        const insights = calculateInsights(messages || [], user.id, contact_id, contactRelation.created_at);

        return res.json({ 
            success: true, 
            insights,
            contactAddedAt: contactRelation.created_at
        });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/contact-insights',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de charger les statistiques. Réessaie.'
            })
        );
    }
}

function calculateInsights(messages, userId, contactId, contactAddedAt) {
    const now = new Date();
    
    if (messages.length === 0) {
        return {
            totalMessages: 0,
            messagesSent: 0,
            messagesReceived: 0,
            firstContact: null,
            lastConversation: null,
            daysSinceFirstContact: null,
            averageMessagesPerDay: 0,
            longestStreak: 0,
            currentStreak: 0,
            mostActiveDay: null,
            responseRate: null
        };
    }

    // Basic counts
    const totalMessages = messages.length;
    const messagesSent = messages.filter(m => m.sender_id === userId).length;
    const messagesReceived = totalMessages - messagesSent;

    // First and last message dates
    const firstContact = messages[0].created_at;
    const lastConversation = messages[messages.length - 1].created_at;

    // Days since first contact
    const firstDate = new Date(firstContact);
    const daysSinceFirstContact = Math.floor((now - firstDate) / (1000 * 60 * 60 * 24));

    // Average messages per day
    const daysActive = Math.max(1, daysSinceFirstContact);
    const averageMessagesPerDay = Math.round((totalMessages / daysActive) * 10) / 10;

    // Calculate streaks (consecutive days with messages)
    const messageDates = new Set(
        messages.map(m => new Date(m.created_at).toISOString().split('T')[0])
    );
    const sortedDates = Array.from(messageDates).sort();
    
    let longestStreak = 0;
    let currentStreak = 0;
    let tempStreak = 1;
    
    for (let i = 1; i < sortedDates.length; i++) {
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(sortedDates[i]);
        const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            tempStreak++;
        } else {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 1;
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
    
    // Current streak (check if last message was today or yesterday)
    const today = now.toISOString().split('T')[0];
    const yesterday = new Date(now - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (messageDates.has(today) || messageDates.has(yesterday)) {
        // Count back from the most recent date
        let streakCount = 1;
        const lastDateIdx = sortedDates.length - 1;
        
        for (let i = lastDateIdx; i > 0; i--) {
            const currDate = new Date(sortedDates[i]);
            const prevDate = new Date(sortedDates[i - 1]);
            const diffDays = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
                streakCount++;
            } else {
                break;
            }
        }
        currentStreak = streakCount;
    }

    // Most active day of the week
    const dayCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    messages.forEach(m => {
        const day = new Date(m.created_at).getDay();
        dayCount[day]++;
    });
    
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    let mostActiveDay = null;
    let maxCount = 0;
    
    for (const [day, count] of Object.entries(dayCount)) {
        if (count > maxCount) {
            maxCount = count;
            mostActiveDay = dayNames[parseInt(day)];
        }
    }

    // Response rate (percentage of received messages that got a reply)
    // Simple heuristic: count message pairs where receiver replied within 24h
    let repliedCount = 0;
    for (let i = 0; i < messages.length - 1; i++) {
        const curr = messages[i];
        const next = messages[i + 1];
        
        // If we received a message and then sent one within 24h
        if (curr.sender_id === contactId && next.sender_id === userId) {
            const currTime = new Date(curr.created_at);
            const nextTime = new Date(next.created_at);
            const diffHours = (nextTime - currTime) / (1000 * 60 * 60);
            
            if (diffHours <= 24) {
                repliedCount++;
            }
        }
    }
    
    const responseRate = messagesReceived > 0 
        ? Math.round((repliedCount / messagesReceived) * 100) 
        : null;

    return {
        totalMessages,
        messagesSent,
        messagesReceived,
        firstContact,
        lastConversation,
        daysSinceFirstContact,
        averageMessagesPerDay,
        longestStreak,
        currentStreak,
        mostActiveDay,
        responseRate
    };
}
