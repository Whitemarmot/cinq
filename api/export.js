/**
 * GDPR Data Export API
 * 
 * Generates a ZIP file containing all user data:
 * - contacts.json: User's contacts list
 * - messages.json: All sent and received messages
 * - posts.json: All user's posts
 * - profile.json: User profile information
 * 
 * Endpoint:
 * - GET / - Generate and download ZIP with user data
 */

import { supabase, requireAuth, getUserEmail, getUserProfile, handleCors } from './_supabase.js';
import { checkRateLimit } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';
import JSZip from 'jszip';

// Rate limit: 2 exports per hour to prevent abuse
const EXPORT_RATE_LIMIT = {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 2,
    keyPrefix: 'gdpr-export'
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting - strict for export
    if (!checkRateLimit(req, res, { ...EXPORT_RATE_LIMIT, userId: user.id })) {
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        logInfo('GDPR export requested', { userId: user.id });

        // Fetch all user data in parallel
        const [
            contactsResult,
            messagesResult,
            postsResult,
            profileResult,
            userEmail
        ] = await Promise.all([
            // Get contacts
            supabase
                .from('contacts')
                .select(`
                    id,
                    contact_id,
                    created_at,
                    contact:users!contacts_contact_id_fkey(
                        id,
                        display_name,
                        email,
                        bio,
                        avatar_url
                    )
                `)
                .eq('user_id', user.id),

            // Get all messages (sent and received)
            supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
                .order('created_at', { ascending: true }),

            // Get all posts
            supabase
                .from('posts')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true }),

            // Get user profile
            getUserProfile(user.id),

            // Get user email
            getUserEmail(user.id)
        ]);

        // Prepare data objects
        const exportDate = new Date().toISOString();
        
        const contacts = (contactsResult.data || []).map(c => ({
            id: c.id,
            contact_id: c.contact_id,
            added_at: c.created_at,
            contact_info: c.contact ? {
                display_name: c.contact.display_name,
                email: c.contact.email,
                bio: c.contact.bio
            } : null
        }));

        const messages = (messagesResult.data || []).map(m => ({
            id: m.id,
            type: m.sender_id === user.id ? 'sent' : 'received',
            sender_id: m.sender_id,
            receiver_id: m.receiver_id,
            content: m.content,
            is_ping: m.is_ping || false,
            created_at: m.created_at,
            read_at: m.read_at
        }));

        const posts = (postsResult.data || []).map(p => ({
            id: p.id,
            content: p.content,
            image_url: p.image_url,
            visibility: p.visibility,
            created_at: p.created_at,
            updated_at: p.updated_at
        }));

        const profile = {
            id: user.id,
            email: userEmail || user.email,
            display_name: profileResult?.display_name,
            bio: profileResult?.bio,
            avatar_url: profileResult?.avatar_url,
            created_at: user.created_at,
            last_sign_in_at: user.last_sign_in_at
        };

        // Create ZIP file
        const zip = new JSZip();
        
        // Add metadata file
        zip.file('_export_info.json', JSON.stringify({
            exported_at: exportDate,
            user_id: user.id,
            email: userEmail || user.email,
            version: '1.0',
            files: ['profile.json', 'contacts.json', 'messages.json', 'posts.json'],
            gdpr_request: true
        }, null, 2));

        // Add data files
        zip.file('profile.json', JSON.stringify(profile, null, 2));
        zip.file('contacts.json', JSON.stringify({
            total: contacts.length,
            exported_at: exportDate,
            data: contacts
        }, null, 2));
        zip.file('messages.json', JSON.stringify({
            total: messages.length,
            sent: messages.filter(m => m.type === 'sent').length,
            received: messages.filter(m => m.type === 'received').length,
            exported_at: exportDate,
            data: messages
        }, null, 2));
        zip.file('posts.json', JSON.stringify({
            total: posts.length,
            exported_at: exportDate,
            data: posts
        }, null, 2));

        // Generate ZIP buffer
        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 9 }
        });

        // Generate filename with date
        const dateStr = new Date().toISOString().split('T')[0];
        const filename = `cinq-data-export-${dateStr}.zip`;

        logInfo('GDPR export completed', { 
            userId: user.id, 
            contacts: contacts.length,
            messages: messages.length,
            posts: posts.length,
            sizeBytes: zipBuffer.length
        });

        // Send ZIP file
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', zipBuffer.length);
        res.setHeader('Cache-Control', 'no-store');
        
        return res.status(200).send(zipBuffer);

    } catch (e) {
        logError(e, { 
            endpoint: '/api/export',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'L\'export a échoué. Réessaie dans quelques minutes.'
            })
        );
    }
}
