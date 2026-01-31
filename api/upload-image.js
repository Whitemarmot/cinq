import { createClient } from '@supabase/supabase-js';
import { checkRateLimit } from './_rate-limit.js';
import { logError, createErrorResponse } from './_error-logger.js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB for posts
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const BUCKET_NAME = 'posts';

async function getUser(req) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return null;
    const { data: { user } } = await supabase.auth.getUser(auth.split(' ')[1]);
    return user;
}

// Generate image using Replicate (nano banana model)
async function generateImageWithAI(prompt) {
    const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
    
    if (!REPLICATE_API_TOKEN) {
        throw new Error('Génération IA non configurée');
    }

    // Start prediction with nano banana (fast SDXL variant)
    const startRes = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            // nano banana - fast SDXL model
            version: "joehoover/nanobanana:4dba55c97fd1d4e64e9c4c1c4e1b0e3e3d3a3f3a3a3d3f3e3d3a3f3a3a3d3f3e",
            input: {
                prompt: prompt,
                negative_prompt: "ugly, blurry, low quality, distorted",
                width: 1024,
                height: 1024,
                num_inference_steps: 4,  // nano is fast
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
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, 1000));
        
        const pollRes = await fetch(prediction.urls.get, {
            headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` }
        });
        
        const result = await pollRes.json();
        
        if (result.status === 'succeeded') {
            // Return first output URL
            return result.output?.[0] || result.output;
        }
        
        if (result.status === 'failed') {
            throw new Error(result.error || 'Génération échouée');
        }
    }
    
    throw new Error('Timeout: génération trop longue');
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '5mb'
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

        const { image, contentType, action, prompt } = req.body;

        // ============ AI Generation ============
        if (action === 'generate') {
            if (!prompt || typeof prompt !== 'string') {
                return res.status(400).json({ error: 'Prompt requis pour la génération' });
            }

            if (prompt.length > 500) {
                return res.status(400).json({ error: 'Prompt trop long (max 500 caractères)' });
            }

            // Extra rate limit for AI generation
            if (!checkRateLimit(req, res, { 
                windowMs: 3600000, // 1 hour
                maxRequests: 5,    // 5 generations per hour
                keyPrefix: 'ai-generate', 
                userId: user.id 
            })) {
                return;
            }

            try {
                const imageUrl = await generateImageWithAI(prompt);
                
                // Download the generated image
                const imageRes = await fetch(imageUrl);
                if (!imageRes.ok) throw new Error('Impossible de télécharger l\'image générée');
                
                const imageBuffer = Buffer.from(await imageRes.arrayBuffer());
                const generatedContentType = imageRes.headers.get('content-type') || 'image/png';
                
                // Upload to Supabase Storage
                const ext = generatedContentType.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
                const filename = `${user.id}/${Date.now()}-ai.${ext}`;

                const { error: uploadError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .upload(filename, imageBuffer, {
                        contentType: generatedContentType,
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from(BUCKET_NAME)
                    .getPublicUrl(filename);

                return res.json({ 
                    success: true, 
                    url: publicUrl,
                    generated: true,
                    prompt: prompt
                });

            } catch (e) {
                console.error('AI generation error:', e);
                return res.status(500).json({ 
                    error: 'Génération IA échouée',
                    hint: e.message
                });
            }
        }

        // ============ File Upload ============
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
            const base64Data = image.includes(',') ? image.split(',')[1] : image;
            imageBuffer = Buffer.from(base64Data, 'base64');
        } catch (e) {
            return res.status(400).json({ error: 'Format image invalide' });
        }

        // Check file size
        if (imageBuffer.length > MAX_FILE_SIZE) {
            return res.status(400).json({ 
                error: 'Image trop grande',
                hint: 'Taille max: 5 Mo'
            });
        }

        // Generate unique filename
        const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
        const filename = `${user.id}/${Date.now()}.${ext}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filename, imageBuffer, {
                contentType,
                upsert: false
            });

        if (uploadError) {
            console.error('Upload error:', uploadError);
            
            // Check if bucket doesn't exist
            if (uploadError.message?.includes('not found') || uploadError.statusCode === 404) {
                return res.status(500).json({ 
                    error: 'Storage non configuré',
                    hint: 'Le bucket "posts" doit être créé dans Supabase Storage'
                });
            }
            
            throw new Error('Échec de l\'upload');
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filename);

        return res.json({ 
            success: true, 
            url: publicUrl 
        });

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
