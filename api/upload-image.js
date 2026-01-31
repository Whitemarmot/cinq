/**
 * Image Upload API - Post images upload
 * 
 * Endpoints:
 * - POST - Upload image (base64)
 * - POST ?action=generate - Generate image with AI
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit } from './_rate-limit.js';
import { logError, createErrorResponse } from './_error-logger.js';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const BUCKET_NAME = 'posts';
const AI_MAX_PROMPT_LENGTH = 500;

export const config = {
    api: { bodyParser: { sizeLimit: '5mb' } }
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting
    if (!checkRateLimit(req, res, { 
        windowMs: 60000, 
        maxRequests: 10, 
        keyPrefix: 'image-upload', 
        userId: user.id 
    })) {
        return;
    }

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { action, prompt, image, contentType } = req.body;

        if (action === 'generate') {
            return handleAiGeneration(req, res, user, prompt);
        }

        return handleUpload(req, res, user, image, contentType);

    } catch (e) {
        logError(e, { 
            endpoint: '/api/upload-image',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de télécharger l\'image. Réessaie avec une image plus petite.'
            })
        );
    }
}

// ===== FILE UPLOAD =====

async function handleUpload(req, res, user, image, contentType) {
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
            hint: 'Taille max: 5 Mo'
        });
    }

    // Generate unique filename
    const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
    const filename = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, imageBuffer, {
            contentType,
            upsert: false
        });

    if (uploadError) {
        console.error('Upload error:', uploadError);
        
        if (uploadError.message?.includes('not found') || uploadError.statusCode === 404) {
            return res.status(500).json({ 
                error: 'Storage non configuré',
                hint: `Le bucket "${BUCKET_NAME}" doit être créé dans Supabase Storage`
            });
        }
        
        throw new Error('Échec de l\'upload');
    }

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);

    return res.json({ success: true, url: publicUrl });
}

// ===== AI IMAGE GENERATION =====

async function handleAiGeneration(req, res, user, prompt) {
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt requis pour la génération' });
    }

    if (prompt.length > AI_MAX_PROMPT_LENGTH) {
        return res.status(400).json({ error: `Prompt trop long (max ${AI_MAX_PROMPT_LENGTH} caractères)` });
    }

    // Extra strict rate limit for AI generation
    if (!checkRateLimit(req, res, { 
        windowMs: 3600000, // 1 hour
        maxRequests: 5,    // 5 per hour
        keyPrefix: 'ai-generate', 
        userId: user.id 
    })) {
        return;
    }

    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    if (!REPLICATE_API_TOKEN) {
        return res.status(500).json({ error: 'Génération IA non configurée' });
    }

    try {
        const imageUrl = await generateWithReplicate(prompt, REPLICATE_API_TOKEN);
        const publicUrl = await uploadGeneratedImage(imageUrl, user.id);

        return res.json({ 
            success: true, 
            url: publicUrl,
            generated: true,
            prompt
        });

    } catch (e) {
        console.error('AI generation error:', e);
        return res.status(500).json({ 
            error: 'Génération IA échouée',
            hint: e.message
        });
    }
}

async function generateWithReplicate(prompt, apiToken) {
    // Using SDXL Lightning (fast, high quality)
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            version: "5f24084160c9089501c1b3545d9be3c27883ae2239b6f412990e82d4a6210f8f", // SDXL Lightning
            input: {
                prompt,
                negative_prompt: "ugly, blurry, low quality, distorted, deformed",
                width: 1024,
                height: 1024,
                num_inference_steps: 4,
                guidance_scale: 0
            }
        })
    });

    if (!startRes.ok) {
        const error = await startRes.json();
        throw new Error(error.detail || 'Erreur Replicate');
    }

    const prediction = await startRes.json();
    
    // Poll for completion (max 60 seconds)
    for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 1000));
        
        const pollRes = await fetch(prediction.urls.get, {
            headers: { 'Authorization': `Bearer ${apiToken}` }
        });
        
        const result = await pollRes.json();
        
        if (result.status === 'succeeded') {
            return result.output?.[0] || result.output;
        }
        
        if (result.status === 'failed') {
            throw new Error(result.error || 'Génération échouée');
        }
    }
    
    throw new Error('Timeout: génération trop longue');
}

async function uploadGeneratedImage(imageUrl, userId) {
    // Download generated image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error('Impossible de télécharger l\'image générée');
    
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
    const contentType = imageRes.headers.get('content-type') || 'image/png';
    
    // Upload to Supabase
    const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
    const filename = `${userId}/${Date.now()}-ai.${ext}`;

    const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filename, imageBuffer, {
            contentType,
            upsert: false
        });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filename);

    return publicUrl;
}
