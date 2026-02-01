/**
 * Account Deletion API - GDPR Compliant
 * 
 * Implements a 7-day grace period for account deletion requests.
 * 
 * Endpoints:
 * - POST ?action=request - Initiate deletion (schedules for 7 days)
 * - POST ?action=cancel - Cancel pending deletion request
 * - POST ?action=confirm - Confirm and execute deletion immediately (admin/cron)
 * - GET ?action=status - Check deletion status
 */

import { supabase, getUser, handleCors, getUserEmail } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const GRACE_PERIOD_DAYS = 7;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'POST', 'OPTIONS'])) return;

    const action = req.query.action || req.body?.action;

    // Rate limiting for deletion requests
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.AUTH, keyPrefix: 'delete-account' })) {
        return;
    }

    try {
        switch (action) {
            case 'request':
                return handleRequestDeletion(req, res);
            case 'cancel':
                return handleCancelDeletion(req, res);
            case 'status':
                return handleGetStatus(req, res);
            case 'execute':
                return handleExecuteDeletion(req, res);
            default:
                return res.status(400).json({
                    error: 'Action invalide',
                    hint: 'Actions disponibles: request, cancel, status, execute',
                    received: action
                });
        }
    } catch (e) {
        logError(e, {
            endpoint: '/api/delete-account',
            action,
            method: req.method
        });
        return res.status(500).json(
            createErrorResponse(e, { includeDebug: process.env.NODE_ENV === 'development' })
        );
    }
}

// ===== REQUEST DELETION =====
// Step 1: User initiates account deletion

async function handleRequestDeletion(req, res) {
    const user = await getUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const { confirmation } = req.body || {};

    // Require "SUPPRIMER" confirmation
    if (!confirmation || confirmation.toUpperCase() !== 'SUPPRIMER') {
        return res.status(400).json({
            error: 'Confirmation requise',
            hint: 'Tape SUPPRIMER pour confirmer la demande de suppression'
        });
    }

    // Calculate scheduled deletion date
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + GRACE_PERIOD_DAYS);

    // Check if there's already a pending deletion request
    const { data: existing } = await supabase
        .from('account_deletions')
        .select('id, scheduled_at, status')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

    if (existing) {
        return res.status(409).json({
            error: 'Demande déjà en cours',
            scheduled_at: existing.scheduled_at,
            message: `Ton compte sera supprimé le ${formatDate(existing.scheduled_at)}`,
            can_cancel: true
        });
    }

    // Create deletion request
    const { data, error } = await supabase
        .from('account_deletions')
        .insert({
            user_id: user.id,
            email: user.email,
            scheduled_at: scheduledAt.toISOString(),
            status: 'pending',
            requested_at: new Date().toISOString(),
            ip_address: req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown'
        })
        .select()
        .single();

    if (error) {
        logError(error, { context: 'create_deletion_request', userId: user.id });
        return res.status(500).json({ error: 'Erreur lors de la création de la demande' });
    }

    // Send confirmation email
    await sendDeletionConfirmationEmail(user.id, user.email, scheduledAt);

    logInfo('Account deletion requested', {
        userId: user.id,
        scheduledAt: scheduledAt.toISOString()
    });

    return res.status(200).json({
        success: true,
        message: `Demande de suppression enregistrée`,
        scheduled_at: scheduledAt.toISOString(),
        grace_period_days: GRACE_PERIOD_DAYS,
        can_cancel: true,
        cancel_before: scheduledAt.toISOString()
    });
}

// ===== CANCEL DELETION =====
// User changes their mind during grace period

async function handleCancelDeletion(req, res) {
    const user = await getUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    // Find pending deletion request
    const { data: pending, error: findError } = await supabase
        .from('account_deletions')
        .select('id, scheduled_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .single();

    if (findError || !pending) {
        return res.status(404).json({
            error: 'Aucune demande de suppression en cours',
            message: 'Ton compte n\'est pas programmé pour suppression'
        });
    }

    // Cancel the request
    const { error: updateError } = await supabase
        .from('account_deletions')
        .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
        })
        .eq('id', pending.id);

    if (updateError) {
        logError(updateError, { context: 'cancel_deletion', userId: user.id });
        return res.status(500).json({ error: 'Erreur lors de l\'annulation' });
    }

    // Send cancellation confirmation email
    await sendCancellationEmail(user.id, user.email);

    logInfo('Account deletion cancelled', { userId: user.id });

    return res.status(200).json({
        success: true,
        message: 'Demande de suppression annulée',
        account_safe: true
    });
}

// ===== GET STATUS =====
// Check if there's a pending deletion request

async function handleGetStatus(req, res) {
    const user = await getUser(req);
    if (!user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    const { data, error } = await supabase
        .from('account_deletions')
        .select('id, scheduled_at, status, requested_at')
        .eq('user_id', user.id)
        .order('requested_at', { ascending: false })
        .limit(1)
        .single();

    if (error || !data) {
        return res.status(200).json({
            has_pending_deletion: false,
            account_status: 'active'
        });
    }

    if (data.status === 'pending') {
        const daysRemaining = Math.ceil(
            (new Date(data.scheduled_at) - new Date()) / (1000 * 60 * 60 * 24)
        );

        return res.status(200).json({
            has_pending_deletion: true,
            account_status: 'pending_deletion',
            scheduled_at: data.scheduled_at,
            days_remaining: Math.max(0, daysRemaining),
            can_cancel: daysRemaining > 0,
            requested_at: data.requested_at
        });
    }

    return res.status(200).json({
        has_pending_deletion: false,
        account_status: 'active',
        last_request_status: data.status
    });
}

// ===== EXECUTE DELETION =====
// Called by cron job after grace period expires

async function handleExecuteDeletion(req, res) {
    // Verify cron secret for automated calls
    const cronSecret = req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;

    // Allow either cron secret or authenticated admin user
    const user = await getUser(req);
    const isAdmin = user?.email?.endsWith('@cinq.app') || user?.user_metadata?.role === 'admin';

    if (!cronSecret && !isAdmin) {
        // Also allow authenticated user to force-delete their own account
        if (!user) {
            return res.status(401).json({ error: 'Non autorisé' });
        }
    }

    if (cronSecret && cronSecret !== expectedSecret) {
        return res.status(403).json({ error: 'Secret invalide' });
    }

    // Get pending deletions that are past their scheduled date
    const { data: pendingDeletions, error: fetchError } = await supabase
        .from('account_deletions')
        .select('id, user_id, email')
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString());

    if (fetchError) {
        logError(fetchError, { context: 'fetch_pending_deletions' });
        return res.status(500).json({ error: 'Erreur de récupération' });
    }

    if (!pendingDeletions || pendingDeletions.length === 0) {
        return res.status(200).json({
            success: true,
            message: 'Aucune suppression à exécuter',
            processed: 0
        });
    }

    const results = [];

    for (const deletion of pendingDeletions) {
        try {
            // Delete user data from all tables
            await deleteUserData(deletion.user_id);

            // Delete auth user
            const { error: authError } = await supabase.auth.admin.deleteUser(deletion.user_id);

            if (authError) {
                throw authError;
            }

            // Mark deletion as completed
            await supabase
                .from('account_deletions')
                .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                })
                .eq('id', deletion.id);

            // Send final goodbye email
            await sendGoodbyeEmail(deletion.email);

            results.push({ userId: deletion.user_id, status: 'deleted' });

            logInfo('Account deleted', {
                userId: deletion.user_id,
                email: deletion.email
            });

        } catch (err) {
            logError(err, {
                context: 'execute_deletion',
                userId: deletion.user_id
            });
            results.push({ userId: deletion.user_id, status: 'error', error: err.message });
        }
    }

    return res.status(200).json({
        success: true,
        processed: results.length,
        results
    });
}

// ===== HELPER FUNCTIONS =====

async function deleteUserData(userId) {
    // Delete in order to respect foreign key constraints
    const tables = [
        'push_subscriptions',
        'messages',
        'contacts',
        'posts',
        'proposals',
        'user_preferences',
        'users'
    ];

    for (const table of tables) {
        const { error } = await supabase
            .from(table)
            .delete()
            .eq('user_id', userId);

        if (error && !error.message.includes('no rows')) {
            logError(error, { context: `delete_${table}`, userId });
        }
    }

    // Also delete where user might be referenced differently
    await supabase.from('contacts').delete().eq('contact_id', userId);
    await supabase.from('messages').delete().eq('receiver_id', userId);
}

async function sendDeletionConfirmationEmail(userId, email, scheduledAt) {
    try {
        // Use Supabase edge function or external email service
        // For now, log the intent - implement actual sending based on your email provider
        logInfo('Deletion confirmation email queued', {
            userId,
            email: email?.substring(0, 3) + '***',
            scheduledAt: scheduledAt.toISOString()
        });

        // If you have Resend, SendGrid, etc., call it here:
        // await sendEmail({
        //     to: email,
        //     subject: 'Confirmation de suppression de compte - Cinq',
        //     template: 'account-deletion-scheduled',
        //     data: { scheduledAt, cancelUrl: 'https://cinq.app/settings' }
        // });

    } catch (err) {
        logError(err, { context: 'send_deletion_email', userId });
    }
}

async function sendCancellationEmail(userId, email) {
    try {
        logInfo('Cancellation email queued', {
            userId,
            email: email?.substring(0, 3) + '***'
        });
    } catch (err) {
        logError(err, { context: 'send_cancellation_email', userId });
    }
}

async function sendGoodbyeEmail(email) {
    try {
        logInfo('Goodbye email queued', {
            email: email?.substring(0, 3) + '***'
        });
    } catch (err) {
        logError(err, { context: 'send_goodbye_email' });
    }
}

function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}
