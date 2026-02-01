/**
 * GIPHY API Proxy
 * 
 * Proxies GIPHY API calls to hide the API key from the client
 * 
 * Endpoints:
 * - GET ?q=search_term - Search GIFs
 * - GET ?trending=1 - Get trending GIFs
 * - GET ?id=gif_id - Get single GIF details
 */

import { requireAuth, handleCors } from './_supabase.js';
import { checkRateLimit, RATE_LIMITS } from './_rate-limit.js';
import { logError } from './_error-logger.js';

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;
const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';

// Limits
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_OFFSET = 500;

export default async function handler(req, res) {
    if (handleCors(req, res, ['GET', 'OPTIONS'])) return;

    // Only GET allowed
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Auth required
    const user = await requireAuth(req, res);
    if (!user) return;

    // Rate limiting - use read limits
    if (!checkRateLimit(req, res, { ...RATE_LIMITS.READ, keyPrefix: 'giphy', userId: user.id })) {
        return;
    }

    // Check API key
    if (!GIPHY_API_KEY) {
        logError(new Error('GIPHY_API_KEY not configured'), { endpoint: '/api/giphy' });
        return res.status(500).json({ error: 'Service GIPHY non configuré' });
    }

    try {
        const { q, trending, id, limit, offset, rating } = req.query;
        
        // Validate and parse params
        const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_LIMIT), MAX_LIMIT);
        const safeOffset = Math.min(Math.max(0, parseInt(offset) || 0), MAX_OFFSET);
        const safeRating = ['g', 'pg', 'pg-13', 'r'].includes(rating) ? rating : 'pg-13';

        let endpoint;
        let params = new URLSearchParams({
            api_key: GIPHY_API_KEY,
            limit: safeLimit.toString(),
            offset: safeOffset.toString(),
            rating: safeRating,
            lang: 'fr'
        });

        // Get single GIF by ID
        if (id) {
            const safeId = id.replace(/[^a-zA-Z0-9-_]/g, '');
            endpoint = `${GIPHY_API_URL}/${safeId}`;
            params = new URLSearchParams({ api_key: GIPHY_API_KEY });
        }
        // Trending GIFs
        else if (trending === '1' || trending === 'true') {
            endpoint = `${GIPHY_API_URL}/trending`;
        }
        // Search GIFs
        else if (q) {
            const safeQuery = q.trim().substring(0, 100);
            if (!safeQuery) {
                return res.status(400).json({ error: 'Terme de recherche requis' });
            }
            endpoint = `${GIPHY_API_URL}/search`;
            params.append('q', safeQuery);
        }
        // Default to trending
        else {
            endpoint = `${GIPHY_API_URL}/trending`;
        }

        // Fetch from GIPHY
        const response = await fetch(`${endpoint}?${params.toString()}`);
        
        if (!response.ok) {
            const errorText = await response.text();
            logError(new Error(`GIPHY API error: ${response.status}`), { 
                endpoint: '/api/giphy',
                giphyStatus: response.status,
                giphyError: errorText.substring(0, 200)
            });
            return res.status(502).json({ error: 'Erreur GIPHY API' });
        }

        const data = await response.json();

        // Transform response to only include what we need (reduces payload)
        const transformGif = (gif) => ({
            id: gif.id,
            title: gif.title,
            url: gif.url,
            // Different sizes for different uses
            images: {
                // Preview (small, for grid)
                preview: {
                    url: gif.images.fixed_width_small?.url || gif.images.preview_gif?.url,
                    width: parseInt(gif.images.fixed_width_small?.width) || 100,
                    height: parseInt(gif.images.fixed_width_small?.height) || 100
                },
                // Standard (for chat/post display)
                standard: {
                    url: gif.images.fixed_width?.url,
                    width: parseInt(gif.images.fixed_width?.width) || 200,
                    height: parseInt(gif.images.fixed_width?.height) || 200
                },
                // Original (full size)
                original: {
                    url: gif.images.original?.url,
                    width: parseInt(gif.images.original?.width) || 480,
                    height: parseInt(gif.images.original?.height) || 480,
                    mp4: gif.images.original_mp4?.mp4
                },
                // Downsized for sharing
                downsized: {
                    url: gif.images.downsized?.url || gif.images.original?.url,
                    size: gif.images.downsized?.size
                }
            }
        });

        // Single GIF response
        if (id) {
            return res.status(200).json({
                success: true,
                gif: transformGif(data.data)
            });
        }

        // List response
        return res.status(200).json({
            success: true,
            gifs: (data.data || []).map(transformGif),
            pagination: {
                total: data.pagination?.total_count || 0,
                count: data.pagination?.count || 0,
                offset: data.pagination?.offset || 0
            }
        });

    } catch (e) {
        logError(e, { endpoint: '/api/giphy', userId: user?.id });
        return res.status(500).json({ error: 'Erreur lors de la recherche de GIFs' });
    }
}
