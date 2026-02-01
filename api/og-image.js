/**
 * Dynamic OG Image Generator API
 * 
 * Generates Open Graph images for posts for social sharing.
 * Returns SVG (can be converted to PNG by Vercel Edge or a service).
 * 
 * Endpoints:
 * - GET ?id=xxx - Generate OG image for a post
 * - GET ?title=xxx&author=xxx - Generate OG with custom text
 */

import { supabase, getUserInfo, handleCors } from './_supabase.js';
import { isValidUUID, sanitizeText } from './_validation.js';
import { logError } from './_error-logger.js';

// OG Image dimensions (standard)
const WIDTH = 1200;
const HEIGHT = 630;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id, title, author } = req.query;
        
        let postContent = title || 'Cinq — Ton cercle proche';
        let authorName = author || '';
        let hasImage = false;
        let imageUrl = null;
        
        // If post ID provided, fetch the post
        if (id && isValidUUID(id)) {
            const { data: post } = await supabase
                .from('posts')
                .select('*')
                .eq('id', id)
                .single();
            
            if (post) {
                postContent = post.content;
                hasImage = !!post.image_url;
                imageUrl = post.image_url;
                
                const authorInfo = await getUserInfo(post.user_id);
                authorName = authorInfo?.display_name || 'Anonyme';
            }
        }
        
        // Truncate content for display
        const maxContentLength = 200;
        const displayContent = postContent.length > maxContentLength
            ? postContent.substring(0, maxContentLength).trim() + '...'
            : postContent;
        
        // Generate SVG
        const svg = generateOGSvg({
            content: escapeXml(displayContent),
            author: escapeXml(authorName),
            hasImage,
            imageUrl
        });
        
        // Set cache headers (1 hour for generated images)
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
        
        return res.send(svg);

    } catch (e) {
        logError(e, {
            endpoint: '/api/og-image',
            method: req.method
        });
        
        // Return fallback image
        return res.send(generateFallbackSvg());
    }
}

function escapeXml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function generateOGSvg({ content, author, hasImage, imageUrl }) {
    // Split content into lines for better display
    const lines = wrapText(content, 45);
    const lineHeight = 36;
    const startY = author ? 200 : 250;
    
    // Generate text lines
    const textLines = lines.slice(0, 5).map((line, i) => 
        `<text x="80" y="${startY + i * lineHeight}" fill="white" font-size="28" font-family="'Inter', 'Segoe UI', sans-serif" font-weight="500">${line}</text>`
    ).join('\n        ');
    
    // Author line
    const authorLine = author 
        ? `<text x="80" y="${startY + lines.length * lineHeight + 30}" fill="#a78bfa" font-size="20" font-family="'Inter', 'Segoe UI', sans-serif" font-weight="600">— ${author}</text>`
        : '';
    
    // Image indicator
    const imageIndicator = hasImage
        ? `<rect x="1040" y="80" width="80" height="80" rx="12" fill="rgba(255,255,255,0.1)"/>
        <text x="1080" y="130" fill="white" font-size="32" text-anchor="middle">📷</text>`
        : '';
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0d0d1a"/>
            <stop offset="50%" style="stop-color:#1a1a2e"/>
            <stop offset="100%" style="stop-color:#16213e"/>
        </linearGradient>
        <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#6366f1"/>
            <stop offset="100%" style="stop-color:#a855f7"/>
        </linearGradient>
        <!-- Noise texture -->
        <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="4" stitchTiles="stitch"/>
            <feColorMatrix type="saturate" values="0"/>
            <feComponentTransfer>
                <feFuncA type="linear" slope="0.05"/>
            </feComponentTransfer>
            <feBlend mode="overlay" in="SourceGraphic"/>
        </filter>
    </defs>
    
    <!-- Background -->
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    
    <!-- Subtle gradient overlay -->
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#brand)" opacity="0.05"/>
    
    <!-- Logo/Brand -->
    <g transform="translate(80, 60)">
        <circle cx="30" cy="30" r="30" fill="url(#brand)"/>
        <text x="30" y="42" fill="white" font-size="32" font-weight="700" font-family="'Space Grotesk', sans-serif" text-anchor="middle">5</text>
    </g>
    <text x="130" y="85" fill="white" font-size="28" font-weight="700" font-family="'Space Grotesk', sans-serif">Cinq</text>
    
    <!-- Content -->
    <g>
        ${textLines}
        ${authorLine}
    </g>
    
    ${imageIndicator}
    
    <!-- Bottom bar -->
    <rect x="0" y="${HEIGHT - 60}" width="${WIDTH}" height="60" fill="rgba(0,0,0,0.3)"/>
    <text x="80" y="${HEIGHT - 25}" fill="rgba(255,255,255,0.6)" font-size="16" font-family="'Inter', 'Segoe UI', sans-serif">cinq.app — Ton cercle proche</text>
    
    <!-- Decorative elements -->
    <circle cx="${WIDTH - 100}" cy="100" r="60" fill="url(#brand)" opacity="0.1"/>
    <circle cx="${WIDTH - 60}" cy="${HEIGHT - 150}" r="80" fill="url(#brand)" opacity="0.08"/>
</svg>`;
}

function generateFallbackSvg() {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#0d0d1a"/>
            <stop offset="100%" style="stop-color:#1a1a2e"/>
        </linearGradient>
        <linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style="stop-color:#6366f1"/>
            <stop offset="100%" style="stop-color:#a855f7"/>
        </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    <circle cx="${WIDTH/2}" cy="${HEIGHT/2 - 40}" r="80" fill="url(#brand)"/>
    <text x="${WIDTH/2}" y="${HEIGHT/2 - 20}" fill="white" font-size="72" font-weight="700" text-anchor="middle" font-family="'Space Grotesk', sans-serif">5</text>
    <text x="${WIDTH/2}" y="${HEIGHT/2 + 80}" fill="white" font-size="48" font-weight="600" text-anchor="middle" font-family="'Space Grotesk', sans-serif">Cinq</text>
    <text x="${WIDTH/2}" y="${HEIGHT/2 + 130}" fill="rgba(255,255,255,0.6)" font-size="24" text-anchor="middle" font-family="'Inter', sans-serif">Ton cercle proche</text>
</svg>`;
}

/**
 * Wrap text into lines of max length
 */
function wrapText(text, maxChars) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
        if ((currentLine + ' ' + word).trim().length <= maxChars) {
            currentLine = (currentLine + ' ' + word).trim();
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
        }
    }
    
    if (currentLine) lines.push(currentLine);
    
    return lines;
}
