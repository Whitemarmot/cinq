/**
 * Cinq - URL Unfurl API
 * Extracts Open Graph metadata from URLs for rich link previews
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Cache for unfurled URLs (in-memory, resets on cold start)
const unfurlCache = new Map();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Regex patterns for special embeds
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TWITTER_REGEX = /(?:twitter\.com|x\.com)\/(?:\w+)\/status\/(\d+)/;
const INSTAGRAM_REGEX = /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/;
const TIKTOK_REGEX = /tiktok\.com\/@[\w.-]+\/video\/(\d+)/;
const SPOTIFY_REGEX = /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/;
const GITHUB_REGEX = /github\.com\/([^\/]+\/[^\/]+)/;

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        // Get URL from query or body
        const url = req.method === 'GET' 
            ? req.query.url 
            : req.body?.url;
        
        if (!url) {
            return res.status(400).json({ error: 'URL required' });
        }
        
        // Validate URL
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                throw new Error('Invalid protocol');
            }
        } catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }
        
        // Check cache first
        const cached = unfurlCache.get(url);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
            return res.status(200).json(cached.data);
        }
        
        // Detect special embed types
        const embedData = detectEmbed(url);
        if (embedData) {
            const result = { url, ...embedData };
            unfurlCache.set(url, { data: result, timestamp: Date.now() });
            return res.status(200).json(result);
        }
        
        // Fetch Open Graph metadata
        const ogData = await fetchOpenGraph(url);
        
        // Cache result
        unfurlCache.set(url, { data: ogData, timestamp: Date.now() });
        
        return res.status(200).json(ogData);
        
    } catch (error) {
        console.error('Unfurl error:', error);
        return res.status(500).json({ 
            error: 'Failed to unfurl URL',
            message: error.message 
        });
    }
}

/**
 * Detect special embed types (YouTube, Twitter, etc.)
 */
function detectEmbed(url) {
    // YouTube
    const ytMatch = url.match(YOUTUBE_REGEX);
    if (ytMatch) {
        const videoId = ytMatch[1];
        return {
            type: 'youtube',
            provider: 'YouTube',
            videoId,
            embedUrl: `https://www.youtube.com/embed/${videoId}`,
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            thumbnailFallback: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
        };
    }
    
    // Twitter/X
    const twitterMatch = url.match(TWITTER_REGEX);
    if (twitterMatch) {
        const tweetId = twitterMatch[1];
        return {
            type: 'twitter',
            provider: 'X (Twitter)',
            tweetId,
            embedUrl: url
        };
    }
    
    // Instagram
    const igMatch = url.match(INSTAGRAM_REGEX);
    if (igMatch) {
        const postId = igMatch[1];
        return {
            type: 'instagram',
            provider: 'Instagram',
            postId,
            embedUrl: `https://www.instagram.com/p/${postId}/embed`
        };
    }
    
    // TikTok
    const tiktokMatch = url.match(TIKTOK_REGEX);
    if (tiktokMatch) {
        const videoId = tiktokMatch[1];
        return {
            type: 'tiktok',
            provider: 'TikTok',
            videoId,
            embedUrl: url
        };
    }
    
    // Spotify
    const spotifyMatch = url.match(SPOTIFY_REGEX);
    if (spotifyMatch) {
        const [, contentType, contentId] = spotifyMatch;
        return {
            type: 'spotify',
            provider: 'Spotify',
            contentType,
            contentId,
            embedUrl: `https://open.spotify.com/embed/${contentType}/${contentId}`
        };
    }
    
    // GitHub
    const ghMatch = url.match(GITHUB_REGEX);
    if (ghMatch) {
        const repo = ghMatch[1];
        return {
            type: 'github',
            provider: 'GitHub',
            repo,
            embedUrl: url
        };
    }
    
    return null;
}

/**
 * Fetch Open Graph metadata from URL
 */
async function fetchOpenGraph(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CinqBot/1.0; +https://cinq.app)',
                'Accept': 'text/html,application/xhtml+xml',
                'Accept-Language': 'fr,en;q=0.9'
            },
            signal: controller.signal,
            redirect: 'follow'
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            // Non-HTML content, return basic info
            return {
                url,
                type: 'link',
                title: new URL(url).hostname,
                description: null,
                image: null,
                siteName: new URL(url).hostname
            };
        }
        
        const html = await response.text();
        
        // Parse Open Graph tags
        const og = {
            url,
            type: 'link',
            title: extractMeta(html, 'og:title') || extractTitle(html) || new URL(url).hostname,
            description: extractMeta(html, 'og:description') || extractMeta(html, 'description'),
            image: extractMeta(html, 'og:image'),
            siteName: extractMeta(html, 'og:site_name') || new URL(url).hostname,
            favicon: extractFavicon(html, url)
        };
        
        // Additional metadata
        og.author = extractMeta(html, 'author') || extractMeta(html, 'twitter:creator');
        og.publishedTime = extractMeta(html, 'article:published_time');
        
        // Twitter card fallbacks
        if (!og.image) {
            og.image = extractMeta(html, 'twitter:image');
        }
        if (!og.title || og.title === new URL(url).hostname) {
            og.title = extractMeta(html, 'twitter:title') || og.title;
        }
        if (!og.description) {
            og.description = extractMeta(html, 'twitter:description');
        }
        
        // Resolve relative image URLs
        if (og.image && !og.image.startsWith('http')) {
            try {
                og.image = new URL(og.image, url).href;
            } catch {}
        }
        
        // Resolve relative favicon URLs
        if (og.favicon && !og.favicon.startsWith('http')) {
            try {
                og.favicon = new URL(og.favicon, url).href;
            } catch {}
        }
        
        return og;
        
    } catch (error) {
        clearTimeout(timeout);
        console.error('Fetch OG error:', error.message);
        
        // Return minimal data on error
        return {
            url,
            type: 'link',
            title: new URL(url).hostname,
            description: null,
            image: null,
            siteName: new URL(url).hostname,
            error: error.message
        };
    }
}

/**
 * Extract meta tag content
 */
function extractMeta(html, property) {
    // Try property attribute first (Open Graph)
    let match = html.match(new RegExp(
        `<meta[^>]+property=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
        'i'
    ));
    
    if (!match) {
        // Try content before property
        match = html.match(new RegExp(
            `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escapeRegex(property)}["']`,
            'i'
        ));
    }
    
    if (!match) {
        // Try name attribute (standard meta tags)
        match = html.match(new RegExp(
            `<meta[^>]+name=["']${escapeRegex(property)}["'][^>]+content=["']([^"']+)["']`,
            'i'
        ));
    }
    
    if (!match) {
        // Try content before name
        match = html.match(new RegExp(
            `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escapeRegex(property)}["']`,
            'i'
        ));
    }
    
    return match ? decodeHTMLEntities(match[1]) : null;
}

/**
 * Extract page title
 */
function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match ? decodeHTMLEntities(match[1].trim()) : null;
}

/**
 * Extract favicon
 */
function extractFavicon(html, baseUrl) {
    // Try various favicon link tags
    const patterns = [
        /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i,
        /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i,
        /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    // Default to /favicon.ico
    try {
        return new URL('/favicon.ico', baseUrl).href;
    } catch {
        return null;
    }
}

/**
 * Decode HTML entities
 */
function decodeHTMLEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&#x2F;/g, '/')
        .replace(/&nbsp;/g, ' ');
}

/**
 * Escape regex special characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
