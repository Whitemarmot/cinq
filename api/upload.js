/**
 * File Upload API - Upload files (PDF, DOC, ZIP, etc.) for chat attachments
 * 
 * Endpoints:
 * - POST - Upload file (base64)
 */

import { supabase, requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit } from './_rate-limit.js';
import { logError, logInfo, createErrorResponse } from './_error-logger.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = {
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/rtf': 'rtf',
    // Archives
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/x-rar-compressed': 'rar',
    'application/vnd.rar': 'rar',
    'application/x-7z-compressed': '7z',
    'application/gzip': 'gz',
    'application/x-tar': 'tar',
    // Other common formats
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',
};

const BUCKET_NAME = 'attachments';

// Human-readable file type names
const TYPE_LABELS = {
    pdf: 'PDF',
    doc: 'Word',
    docx: 'Word',
    xls: 'Excel',
    xlsx: 'Excel',
    ppt: 'PowerPoint',
    pptx: 'PowerPoint',
    txt: 'Texte',
    csv: 'CSV',
    rtf: 'RTF',
    zip: 'ZIP',
    rar: 'RAR',
    '7z': '7-Zip',
    gz: 'GZip',
    tar: 'TAR',
    json: 'JSON',
    xml: 'XML',
};

export const config = {
    api: { bodyParser: { sizeLimit: '12mb' } }
};

export default async function handler(req, res) {
    if (handleCors(req, res, ['POST', 'OPTIONS'])) return;

    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting (15 uploads per minute)
    if (!checkRateLimit(req, res, { 
        max: 15,
        windowMs: 60000, 
        keyPrefix: 'file-upload', 
        userId: user.id 
    })) {
        return;
    }

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ error: 'Method not allowed' });
        }

        const { file, contentType, fileName } = req.body;

        if (!file) {
            return res.status(400).json({ error: 'Fichier requis' });
        }

        if (!contentType || !ALLOWED_TYPES[contentType]) {
            const allowedExts = [...new Set(Object.values(ALLOWED_TYPES))].join(', ').toUpperCase();
            return res.status(400).json({ 
                error: 'Format non supporté',
                hint: `Formats acceptés: ${allowedExts}`
            });
        }

        // Decode base64
        let fileBuffer;
        try {
            const base64Data = file.includes(',') ? file.split(',')[1] : file;
            fileBuffer = Buffer.from(base64Data, 'base64');
        } catch {
            return res.status(400).json({ error: 'Format fichier invalide' });
        }

        if (fileBuffer.length > MAX_FILE_SIZE) {
            return res.status(400).json({ 
                error: 'Fichier trop grand',
                hint: 'Taille max: 10 Mo'
            });
        }

        // Extract safe filename
        const ext = ALLOWED_TYPES[contentType];
        const safeName = sanitizeFileName(fileName || `file.${ext}`);
        const timestamp = Date.now();
        const storagePath = `${user.id}/${timestamp}-${safeName}`;

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
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
            .getPublicUrl(storagePath);

        logInfo('File uploaded', { 
            userId: user.id, 
            fileName: safeName, 
            size: fileBuffer.length,
            type: ext 
        });

        return res.json({ 
            success: true, 
            url: publicUrl,
            fileName: safeName,
            fileSize: fileBuffer.length,
            fileType: ext,
            fileTypeLabel: TYPE_LABELS[ext] || ext.toUpperCase()
        });

    } catch (e) {
        logError(e, { 
            endpoint: '/api/upload',
            method: req.method,
            userId: user?.id 
        });
        return res.status(500).json(
            createErrorResponse(e, { 
                includeDebug: process.env.NODE_ENV === 'development',
                hint: 'Impossible de télécharger le fichier. Réessaie avec un fichier plus petit.'
            })
        );
    }
}

/**
 * Sanitize filename for safe storage
 */
function sanitizeFileName(name) {
    // Remove path components
    name = name.split(/[/\\]/).pop();
    
    // Remove or replace unsafe characters
    name = name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\.{2,}/g, '.')
        .trim();
    
    // Limit length
    if (name.length > 100) {
        const ext = name.split('.').pop();
        const base = name.slice(0, 90);
        name = `${base}.${ext}`;
    }
    
    return name || 'fichier';
}
