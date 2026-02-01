/**
 * Conversation Streaks API - Track consecutive conversation days
 * 
 * Endpoints:
 * - GET - Get all conversation streaks for current user
 * - GET ?contact_id=xxx - Get streak with specific contact
 * - POST /reset - Reset streak with a contact { contact_id }
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { isValidUUID } from './_validation.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    const rateLimitConfig = RATE_LIMITS.READ;
    if (!(await checkRateLimit(req, res, { ...rateLimitConfig, keyPrefix: 'conversation_streaks', userId: user.id }))) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return handleGetStreaks(req, res, user);
        }

        if (req.method === 'POST') {
            const { pathname } = new URL(req.url, `http://${req.headers.host}`);
            if (pathname.endsWith('/reset')) {
                return handleResetStreak(req, res, user);
            }
            return res.status(405).json({ error: 'Invalid POST endpoint' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, {
            endpoint: '/api/conversation-streaks',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                genericMessage: 'Failed to process conversation streaks'
            })
        );
    }
}

async function handleGetStreaks(req, res, user) {
    const { contact_id } = req.query;

    try {
        let query = supabase
            .from('conversation_streaks')
            .select(`
                id,
                contact_user_id,
                current_streak,
                longest_streak,
                last_message_date,
                streak_start_date,
                created_at,
                updated_at,
                contact:contact_user_id (
                    id,
                    display_name,
                    avatar_url,
                    avatar_emoji
                )
            `)
            .eq('user_id', user.id)
            .order('current_streak', { ascending: false });

        // Filter by specific contact if requested
        if (contact_id) {
            if (!isValidUUID(contact_id)) {
                return res.status(400).json({ error: 'Invalid contact_id' });
            }
            query = query.eq('contact_user_id', contact_id);
        }

        const { data: streaks, error } = await query;

        if (error) {
            throw new Error(`Failed to fetch streaks: ${error.message}`);
        }

        // Calculate streak status for each
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        const processedStreaks = streaks?.map(streak => {
            const lastMsgDate = new Date(streak.last_message_date + 'T00:00:00.000Z');
            const daysSinceLastMessage = Math.floor((today.getTime() - lastMsgDate.getTime()) / (24 * 60 * 60 * 1000));
            
            let status = 'active'; // active, at_risk, broken
            let timeUntilRisk = null;
            let isToday = false;

            if (lastMsgDate.getTime() === today.getTime()) {
                status = 'active';
                isToday = true;
            } else if (lastMsgDate.getTime() === yesterday.getTime()) {
                status = 'at_risk';
                // Countdown until midnight (streak breaks)
                const midnight = new Date(today.getTime() + 24 * 60 * 60 * 1000);
                timeUntilRisk = Math.floor((midnight.getTime() - now.getTime()) / 1000); // seconds
            } else if (daysSinceLastMessage >= 2) {
                status = 'broken';
            }

            return {
                ...streak,
                status,
                days_since_last_message: daysSinceLastMessage,
                time_until_risk: timeUntilRisk,
                is_today: isToday,
                streak_emoji: getStreakEmoji(streak.current_streak)
            };
        });

        // If requesting specific contact, return single object
        if (contact_id) {
            const singleStreak = processedStreaks?.[0] || null;
            return res.status(200).json({
                success: true,
                streak: singleStreak
            });
        }

        // Return all streaks with summary stats
        const totalContacts = processedStreaks?.length || 0;
        const activeStreaks = processedStreaks?.filter(s => s.status === 'active').length || 0;
        const atRiskStreaks = processedStreaks?.filter(s => s.status === 'at_risk').length || 0;
        const longestCurrentStreak = Math.max(0, ...processedStreaks?.map(s => s.current_streak) || [0]);
        const totalStreakDays = processedStreaks?.reduce((sum, s) => sum + s.current_streak, 0) || 0;

        return res.status(200).json({
            success: true,
            streaks: processedStreaks,
            summary: {
                total_contacts: totalContacts,
                active_streaks: activeStreaks,
                at_risk_streaks: atRiskStreaks,
                longest_current_streak: longestCurrentStreak,
                total_streak_days: totalStreakDays
            }
        });

    } catch (e) {
        logError(e, { userId: user.id, contactId: contact_id });
        throw e;
    }
}

async function handleResetStreak(req, res, user) {
    const { contact_id } = req.body;

    if (!contact_id || !isValidUUID(contact_id)) {
        return res.status(400).json({ error: 'Valid contact_id required' });
    }

    try {
        // Verify this is a valid contact
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', user.id)
            .eq('contact_user_id', contact_id)
            .single();

        if (contactError || !contact) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        // Reset the streak
        const { error } = await supabase
            .from('conversation_streaks')
            .update({
                current_streak: 0,
                streak_start_date: null,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id)
            .eq('contact_user_id', contact_id);

        if (error) {
            throw new Error(`Failed to reset streak: ${error.message}`);
        }

        logInfo('Conversation streak reset', { 
            userId: user.id, 
            contactId: contact_id
        });

        return res.status(200).json({
            success: true,
            message: 'Streak reset successfully'
        });

    } catch (e) {
        logError(e, { userId: user.id, contactId: contact_id });
        throw e;
    }
}

// Helper function to get emoji for streak length
function getStreakEmoji(streak) {
    if (streak === 0) return '💔';
    if (streak < 3) return '🌱';
    if (streak < 7) return '🔥';
    if (streak < 14) return '⚡';
    if (streak < 30) return '💎';
    if (streak < 100) return '🏆';
    return '👑';
}