/**
 * Push notification helper for Cinq API routes
 */
import webpush from 'web-push';
import { supabase } from './_supabase.js';

// Configure web-push on module load
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:hello@cinq.app',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

/**
 * Send push notification to a user
 * @param {string} userId - Target user ID
 * @param {Object} notification - Notification payload
 * @param {string} notification.title - Notification title
 * @param {string} notification.body - Notification body
 * @param {string} [notification.url] - URL to open on click
 * @param {string} [notification.tag] - Notification tag for grouping
 * @param {Object} [notification.data] - Additional data
 */
export async function sendPushNotification(userId, notification) {
    if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
        console.log('[Push] VAPID not configured, skipping');
        return { sent: 0, failed: 0 };
    }

    try {
        // Get user's push subscriptions
        const { data: subscriptions, error } = await supabase
            .from('push_subscriptions')
            .select('*')
            .eq('user_id', userId);

        if (error || !subscriptions?.length) {
            console.log('[Push] No subscriptions for user:', userId);
            return { sent: 0, failed: 0 };
        }

        const payload = JSON.stringify({
            title: notification.title || 'Cinq',
            body: notification.body,
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/icon-72x72.png',
            url: notification.url || '/app.html',
            tag: notification.tag || 'cinq-notification',
            data: notification.data || {}
        });

        let sent = 0;
        let failed = 0;
        const expiredEndpoints = [];

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: sub.keys
                }, payload);
                sent++;
                console.log('[Push] Sent to:', sub.endpoint.substring(0, 50));
            } catch (err) {
                failed++;
                console.error('[Push] Failed:', err.message);
                // Mark expired subscriptions for cleanup
                if (err.statusCode === 410 || err.statusCode === 404) {
                    expiredEndpoints.push(sub.endpoint);
                }
            }
        }

        // Clean up expired subscriptions
        if (expiredEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', expiredEndpoints);
            console.log('[Push] Cleaned', expiredEndpoints.length, 'expired subscriptions');
        }

        return { sent, failed };
    } catch (err) {
        console.error('[Push] Error:', err);
        return { sent: 0, failed: 1 };
    }
}
