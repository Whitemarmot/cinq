/**
 * Avatar Upload API - Profile picture upload
 * 
 * Endpoints:
 * - POST - Upload new avatar (base64)
 * - DELETE - Remove avatar
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit } from './_rate-limit.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const BUCKET_NAME = 'avatars';

export const config = {
    api: { bodyParser: { sizeLimit: '2mb' } }
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['POST', 'DELETE', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Strict rate limiting for uploads
    if (!checkRateLimit(req, res, { 
        windowMs: 60000, 
        maxRequests: 5, 
        keyPrefix: 'avatar-upload', 
        userId: user.id 
    })) {
        return;
    }

    try {
        if (req.method === 'POST') {
            return handleUpload(req, res, user);
        }

        if (req.method === 'DELETE') {
            return handleDelete(req, res, user);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/upload-avatar',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de télécharger l\'avatar. Réessaie avec une image plus petite.'
            })
        );
    }
}

// ===== UPLOAD =====

async function handleUpload(req, res, user) {
    const { image, contentType } = req.body;

    if (!image) {
        return res.status(400).json({ error: 'Image requise' });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
        return res.status(400).json({ 
            error: 'Format non supporté',
            hint: 'Formats acceptés: JPEG, PNG, GIF, WebP'
        });
    }

    // Decode base64
    let imageBuffer;
    try {
        const base64Data = image.includes(',') ? image.split(',')[1] : image;
        imageBuffer = Buffer.from(base64Data, 'base64');
    } catch {
        return res.status(400).json({ error: 'Format image invalide' });
    }

    if (imageBuffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({ 
            error: 'Image trop grande',
            hint: 'Taille max: 2 Mo'
        });
    }

    // Clean up old avatar
    await cleanupOldAvatar(user.id);

    // Generate filename and upload
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, imageBuffer, {
            contentType,
            upsert: true
        });

    if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Échec de l\'upload');
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);

    // Update user profile
    const { error: updateError } = await supabase
        .from('users')
        .update({ 
            avatar_url: publicUrl,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (updateError) {
        await supabase.storage.from(BUCKET_NAME).remove([filename]);
        throw new Error('Échec de la mise à jour du profil');
    }

    // Return both formats for compatibility
    return res.json({ 
        success: true, 
        avatarUrl: publicUrl,
        avatar_url: publicUrl
    });
}

async function cleanupOldAvatar(userId) {
    try {
        const { data: files } = await supabase.storage
            .from(BUCKET_NAME)
            .list(userId);
        
        if (files?.length > 0) {
            const oldFiles = files.map(f => `${userId}/${f.name}`);
            await supabase.storage.from(BUCKET_NAME).remove(oldFiles);
        }
    } catch (e) {
        console.log('Cleanup old avatar:', e.message);
    }
}

// ===== DELETE =====

async function handleDelete(req, res, user) {
    // Get current avatar URL
    const { data: profile } = await supabase
        .from('users')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

    if (profile?.avatar_url) {
        try {
            const url = new URL(profile.avatar_url);
            const pathParts = url.pathname.split(`/${BUCKET_NAME}/`);
            if (pathParts[1]) {
                await supabase.storage
                    .from(BUCKET_NAME)
                    .remove([decodeURIComponent(pathParts[1])]);
            }
        } catch (e) {
            console.log('Delete file error:', e.message);
        }
    }

    const { error } = await supabase
        .from('users')
        .update({ 
            avatar_url: null,
            updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

    if (error) throw error;

    return res.json({ success: true });
}
