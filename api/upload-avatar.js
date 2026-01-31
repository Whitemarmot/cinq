import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError, createErrorResponse } from './_error-logger.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
    return user;
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '2mb'
        }
    }
};

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await getUser(req);
    if (!user) return res.status(401).json({ error: 'Non authentifié' });

    // Rate limiting - stricter for uploads
    if (!checkRateLimit(req, res, { 
        windowMs: 60000, 
        maxRequests: 5, 
        keyPrefix: 'avatar-upload', 
        userId: user.id 
    })) {
        return;
    }

    try {
        // ============ POST - Upload avatar ============
        if (req.method === 'POST') {
            const { image, contentType } = req.body;

            if (!image) {
                return res.status(400).json({ error: 'Image requise' });
            }

            // Validate content type
            if (!ALLOWED_TYPES.includes(contentType)) {
                return res.status(400).json({ 
                    error: 'Format non supporté',
                    hint: 'Formats acceptés: JPEG, PNG, GIF, WebP'
                });
            }

            // Decode base64
            let imageBuffer;
            try {
                // Handle data URL format or raw base64
                const base64Data = image.includes(',') ? image.split(',')[1] : image;
                imageBuffer = Buffer.from(base64Data, 'base64');
            } catch (e) {
                return res.status(400).json({ error: 'Format image invalide' });
            }

            // Check file size
            if (imageBuffer.length > MAX_FILE_SIZE) {
                return res.status(400).json({ 
                    error: 'Image trop grande',
                    hint: 'Taille max: 2 Mo'
                });
            }

            // Generate unique filename
            const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
            const filename = `${user.id}/${Date.now()}.${ext}`;

            // Delete old avatar first (optional - keeps storage clean)
            try {
                const { data: files } = await supabase.storage
                    .from('avatars')
                    .list(user.id);
                
                if (files && files.length > 0) {
                    const oldFiles = files.map(f => `${user.id}/${f.name}`);
                    await supabase.storage.from('avatars').remove(oldFiles);
                }
            } catch (e) {
                // Ignore errors when cleaning up old files
                console.log('Cleanup old avatar:', e.message);
            }

            // Upload to Supabase Storage
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filename, imageBuffer, {
                    contentType,
                    upsert: true
                });

            if (uploadError) {
                console.error('Upload error:', uploadError);
                throw new Error('Échec de l\'upload');
            }

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filename);

            // Update user profile with new avatar URL
            const { error: updateError } = await supabase
                .from('users')
                .update({ 
                    avatar_url: publicUrl,
                    updated_at: new Date().toISOString()
                })
                .eq('id', user.id);

            if (updateError) {
                console.error('Profile update error:', updateError);
                // Try to clean up the uploaded file
                await supabase.storage.from('avatars').remove([filename]);
                throw new Error('Échec de la mise à jour du profil');
            }

            return res.json({ 
                success: true, 
                avatar_url: publicUrl 
            });
        }

        // ============ DELETE - Remove avatar ============
        if (req.method === 'DELETE') {
            // Get current avatar to find file path
            const { data: profile } = await supabase
                .from('users')
                .select('avatar_url')
                .eq('id', user.id)
                .single();

            if (profile?.avatar_url) {
                // Extract filename from URL
                try {
                    const url = new URL(profile.avatar_url);
                    const pathParts = url.pathname.split('/avatars/');
                    if (pathParts[1]) {
                        await supabase.storage
                            .from('avatars')
                            .remove([decodeURIComponent(pathParts[1])]);
                    }
                } catch (e) {
                    console.log('Delete file error:', e.message);
                }
            }

            // Clear avatar_url in profile
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
