/**
 * CINQ Email Service - Netlify Function
 * SARAH Backend - Email Notifications with Resend
 * 
 * Internal API (not exposed publicly - called by other functions)
 * 
 * POST /api/email-send
 * Body: { template, to, data }
 * 
 * Templates:
 * - welcome: New user registration
 * - gift-received: Someone sent you a gift
 * - new-message-digest: Daily unread messages summary
 * 
 * Env vars:
 * - RESEND_API_KEY: Resend API key
 * - EMAIL_FROM: Sender email (default: noreply@cinq.app)
 */

const { success, error, headers } = require('./gift-utils');

// ============================================
// Configuration
// ============================================

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'CINQ <noreply@cinq.app>';

// ============================================
// Email Templates
// ============================================

const templates = {
    /**
     * Welcome email for new users
     * data: { name?, email }
     */
    welcome: (data) => ({
        subject: 'Bienvenue sur CINQ! 🎉',
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; }
        .logo { font-size: 48px; margin-bottom: 10px; }
        h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
        .content { background: #f9f9f9; border-radius: 12px; padding: 30px; margin: 20px 0; }
        .cta { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; color: #888; font-size: 14px; padding: 30px 0; }
        .emoji { font-size: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">✋</div>
        <h1>Bienvenue sur CINQ!</h1>
    </div>
    
    <div class="content">
        <p>Salut${data.name ? ` ${data.name}` : ''} 👋</p>
        
        <p>Tu fais maintenant partie du cercle CINQ — l'endroit où tu restes connecté avec les 5 personnes qui comptent vraiment.</p>
        
        <p><strong>Prochaines étapes:</strong></p>
        <ul>
            <li><span class="emoji">📝</span> Complète ton profil</li>
            <li><span class="emoji">👥</span> Invite tes 5 proches</li>
            <li><span class="emoji">💫</span> Envoie ton premier ping!</li>
        </ul>
        
        <p style="text-align: center;">
            <a href="https://cinq.app" class="cta">Commencer →</a>
        </p>
    </div>
    
    <div class="footer">
        <p>CINQ — Pour ceux qui comptent vraiment</p>
        <p>🤍</p>
    </div>
</body>
</html>
        `.trim(),
        text: `
Bienvenue sur CINQ! 🎉

Salut${data.name ? ` ${data.name}` : ''} 👋

Tu fais maintenant partie du cercle CINQ — l'endroit où tu restes connecté avec les 5 personnes qui comptent vraiment.

Prochaines étapes:
- Complète ton profil
- Invite tes 5 proches
- Envoie ton premier ping!

→ https://cinq.app

---
CINQ — Pour ceux qui comptent vraiment
        `.trim()
    }),

    /**
     * Gift received notification
     * data: { sender_name, amount?, message? }
     */
    'gift-received': (data) => ({
        subject: `${data.sender_name || 'Quelqu\'un'} t'a envoyé un cadeau CINQ! 🎁`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; }
        .gift-icon { font-size: 64px; margin-bottom: 10px; }
        h1 { color: #1a1a1a; font-size: 24px; margin-bottom: 20px; }
        .content { background: linear-gradient(135deg, #fff5f5 0%, #fff 100%); border-radius: 12px; padding: 30px; margin: 20px 0; border: 1px solid #ffe0e0; }
        .sender { font-size: 18px; font-weight: 600; color: #e53e3e; }
        .message { background: #fff; border-radius: 8px; padding: 20px; margin: 20px 0; font-style: italic; border-left: 4px solid #e53e3e; }
        .cta { display: inline-block; background: #e53e3e; color: #fff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; color: #888; font-size: 14px; padding: 30px 0; }
    </style>
</head>
<body>
    <div class="header">
        <div class="gift-icon">🎁</div>
        <h1>Tu as reçu un cadeau!</h1>
    </div>
    
    <div class="content">
        <p><span class="sender">${data.sender_name || 'Quelqu\'un de spécial'}</span> t'a envoyé une invitation CINQ!</p>
        
        ${data.message ? `
        <div class="message">
            "${data.message}"
        </div>
        ` : ''}
        
        <p>Utilise ce cadeau pour rejoindre le cercle et rester connecté avec ceux qui comptent vraiment.</p>
        
        <p style="text-align: center;">
            <a href="https://cinq.app/gift" class="cta">Accepter le cadeau →</a>
        </p>
    </div>
    
    <div class="footer">
        <p>CINQ — Pour ceux qui comptent vraiment</p>
        <p>❤️</p>
    </div>
</body>
</html>
        `.trim(),
        text: `
Tu as reçu un cadeau CINQ! 🎁

${data.sender_name || 'Quelqu\'un de spécial'} t'a envoyé une invitation CINQ!

${data.message ? `Message: "${data.message}"` : ''}

Utilise ce cadeau pour rejoindre le cercle et rester connecté avec ceux qui comptent vraiment.

→ https://cinq.app/gift

---
CINQ — Pour ceux qui comptent vraiment
        `.trim()
    }),

    /**
     * Daily message digest
     * data: { unread_count, contacts: [{ name, message_count, last_message_preview }] }
     */
    'new-message-digest': (data) => ({
        subject: `💬 ${data.unread_count} message${data.unread_count > 1 ? 's' : ''} non lu${data.unread_count > 1 ? 's' : ''} sur CINQ`,
        html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 30px 0; }
        .badge { display: inline-block; background: #4a5568; color: #fff; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; }
        h1 { color: #1a1a1a; font-size: 24px; margin: 20px 0; }
        .contact-list { background: #f9f9f9; border-radius: 12px; overflow: hidden; margin: 20px 0; }
        .contact { padding: 20px; border-bottom: 1px solid #eee; }
        .contact:last-child { border-bottom: none; }
        .contact-name { font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
        .contact-count { color: #718096; font-size: 14px; }
        .contact-preview { color: #4a5568; font-size: 14px; margin-top: 8px; padding: 10px; background: #fff; border-radius: 8px; }
        .cta { display: inline-block; background: #000; color: #fff !important; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; color: #888; font-size: 14px; padding: 30px 0; }
        .unsubscribe { color: #aaa; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <span class="badge">💬 ${data.unread_count} non lu${data.unread_count > 1 ? 's' : ''}</span>
        <h1>Ton résumé CINQ</h1>
    </div>
    
    <div class="contact-list">
        ${(data.contacts || []).map(c => `
        <div class="contact">
            <div class="contact-name">${c.name}</div>
            <div class="contact-count">${c.message_count} message${c.message_count > 1 ? 's' : ''}</div>
            ${c.last_message_preview ? `
            <div class="contact-preview">"${c.last_message_preview.slice(0, 100)}${c.last_message_preview.length > 100 ? '...' : ''}"</div>
            ` : ''}
        </div>
        `).join('')}
    </div>
    
    <p style="text-align: center;">
        <a href="https://cinq.app/messages" class="cta">Voir les messages →</a>
    </p>
    
    <div class="footer">
        <p>CINQ — Pour ceux qui comptent vraiment</p>
        <p class="unsubscribe">
            <a href="https://cinq.app/settings/notifications" style="color: #aaa;">Gérer les notifications</a>
        </p>
    </div>
</body>
</html>
        `.trim(),
        text: `
💬 ${data.unread_count} message${data.unread_count > 1 ? 's' : ''} non lu${data.unread_count > 1 ? 's' : ''} sur CINQ

${(data.contacts || []).map(c => `
${c.name} — ${c.message_count} message${c.message_count > 1 ? 's' : ''}
${c.last_message_preview ? `"${c.last_message_preview.slice(0, 100)}${c.last_message_preview.length > 100 ? '...' : ''}"` : ''}
`).join('\n')}

→ https://cinq.app/messages

---
CINQ — Pour ceux qui comptent vraiment
Gérer les notifications: https://cinq.app/settings/notifications
        `.trim()
    })
};

// ============================================
// Send Email Function (Internal Use)
// ============================================

async function sendEmail({ to, template, data }) {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
        throw new Error('RESEND_API_KEY not configured');
    }
    
    if (!templates[template]) {
        throw new Error(`Unknown template: ${template}`);
    }
    
    const emailContent = templates[template](data || {});
    const from = process.env.EMAIL_FROM || DEFAULT_FROM;
    
    const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            from,
            to: Array.isArray(to) ? to : [to],
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Resend API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    return await response.json();
}

// ============================================
// Exported Helper (for other functions)
// ============================================

// Allow other functions to import and use directly
module.exports.sendEmail = sendEmail;
module.exports.templates = Object.keys(templates);

// ============================================
// HTTP Handler (Internal API)
// ============================================

exports.handler = async (event, context) => {
    // CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return error('Method not allowed', 405);
    }
    
    // Optional: Add internal API key check for security
    const internalKey = event.headers['x-internal-key'] || event.headers['X-Internal-Key'];
    const expectedKey = process.env.INTERNAL_API_KEY;
    
    if (expectedKey && internalKey !== expectedKey) {
        return error('Unauthorized', 401);
    }
    
    try {
        const body = JSON.parse(event.body || '{}');
        const { template, to, data } = body;
        
        // Validation
        if (!template) {
            return error('Template is required', 400);
        }
        
        if (!to) {
            return error('Recipient (to) is required', 400);
        }
        
        if (!templates[template]) {
            return error(`Unknown template: ${template}. Available: ${Object.keys(templates).join(', ')}`, 400);
        }
        
        // Check if email service is configured
        if (!process.env.RESEND_API_KEY) {
            console.warn('RESEND_API_KEY not configured - email not sent');
            return success({
                message: 'Email service not configured (development mode)',
                would_send: { template, to, data }
            });
        }
        
        // Send the email
        const result = await sendEmail({ to, template, data });
        
        return success({
            message: 'Email sent successfully',
            id: result.id,
            template
        });
        
    } catch (err) {
        console.error('Email send error:', err);
        
        if (err instanceof SyntaxError) {
            return error('Invalid JSON body', 400);
        }
        
        return error(`Failed to send email: ${err.message}`, 500);
    }
};
