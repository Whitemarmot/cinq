/**
 * ==========================================================================
 * CINQ - Contact Card Module
 * ==========================================================================
 * 
 * Generate beautiful digital business cards with QR code,
 * exportable as PNG images.
 * 
 * Features:
 * - Generate styled contact card with profile info + QR code
 * - Multiple card styles (dark, light, gradient)
 * - Export as high-quality PNG
 * - Share card via Web Share API
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

(function(window) {
    
    // ============================================
    // Configuration
    // ============================================
    
    const CARD_CONFIG = {
        width: 600,
        height: 340,
        padding: 32,
        qrSize: 180,
        avatarSize: 80,
        borderRadius: 24,
        profileUrlBase: 'https://cinq.app/profile.html'
    };
    
    // Card themes
    const CARD_THEMES = {
        dark: {
            background: '#1a1a2e',
            backgroundGradient: null,
            text: '#ffffff',
            textSecondary: '#a0a0b8',
            accent: '#6366f1',
            qrDark: '#1a1a2e',
            qrLight: '#ffffff'
        },
        light: {
            background: '#ffffff',
            backgroundGradient: null,
            text: '#1a1a2e',
            textSecondary: '#6b7280',
            accent: '#6366f1',
            qrDark: '#1a1a2e',
            qrLight: '#ffffff'
        },
        gradient: {
            background: null,
            backgroundGradient: ['#1a1a2e', '#312e81'],
            text: '#ffffff',
            textSecondary: '#c4b5fd',
            accent: '#a855f7',
            qrDark: '#1a1a2e',
            qrLight: '#ffffff'
        },
        aurora: {
            background: null,
            backgroundGradient: ['#0f172a', '#1e3a5f', '#312e81'],
            text: '#ffffff',
            textSecondary: '#94a3b8',
            accent: '#38bdf8',
            qrDark: '#0f172a',
            qrLight: '#ffffff'
        }
    };
    
    // ============================================
    // QR Code Library Loading
    // ============================================
    
    async function loadQRCodeLibrary() {
        if (window.QRCode) return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load QRCode library'));
            document.head.appendChild(script);
        });
    }
    
    // ============================================
    // Canvas Drawing Utilities
    // ============================================
    
    /**
     * Draw rounded rectangle
     */
    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
    
    /**
     * Load image as promise
     */
    function loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = src;
        });
    }
    
    /**
     * Wrap text to fit within width
     */
    function wrapText(ctx, text, maxWidth) {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        
        if (currentLine) {
            lines.push(currentLine);
        }
        
        return lines;
    }
    
    // ============================================
    // Contact Card Generation
    // ============================================
    
    /**
     * Generate a contact card canvas
     * @param {Object} profile - User profile
     * @param {Object} options - Card options
     * @returns {Promise<HTMLCanvasElement>}
     */
    async function generateContactCard(profile, options = {}) {
        await loadQRCodeLibrary();
        
        const theme = CARD_THEMES[options.theme] || CARD_THEMES.dark;
        const width = options.width || CARD_CONFIG.width;
        const height = options.height || CARD_CONFIG.height;
        const padding = CARD_CONFIG.padding;
        const qrSize = CARD_CONFIG.qrSize;
        const avatarSize = CARD_CONFIG.avatarSize;
        
        // Create main canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw background
        if (theme.backgroundGradient) {
            const gradient = ctx.createLinearGradient(0, 0, width, height);
            const colors = theme.backgroundGradient;
            colors.forEach((color, i) => {
                gradient.addColorStop(i / (colors.length - 1), color);
            });
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = theme.background;
        }
        
        roundRect(ctx, 0, 0, width, height, CARD_CONFIG.borderRadius);
        ctx.fill();
        
        // Add subtle noise texture
        ctx.globalAlpha = 0.03;
        for (let i = 0; i < 5000; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            ctx.fillStyle = Math.random() > 0.5 ? '#fff' : '#000';
            ctx.fillRect(x, y, 1, 1);
        }
        ctx.globalAlpha = 1;
        
        // Draw decorative accent line
        ctx.fillStyle = theme.accent;
        ctx.fillRect(0, 0, 6, height);
        
        // Generate QR code
        const profileUrl = `${CARD_CONFIG.profileUrlBase}?id=${encodeURIComponent(profile.id)}&source=card`;
        
        const qrCanvas = document.createElement('canvas');
        await QRCode.toCanvas(qrCanvas, profileUrl, {
            width: qrSize,
            margin: 1,
            color: {
                dark: theme.qrDark,
                light: theme.qrLight
            },
            errorCorrectionLevel: 'M'
        });
        
        // Position QR code on the right
        const qrX = width - padding - qrSize;
        const qrY = (height - qrSize) / 2;
        
        // Draw QR code background with rounded corners
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 16);
        ctx.fill();
        
        // Draw QR code
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
        
        // Calculate text area width
        const textAreaWidth = width - padding - qrSize - padding - padding - 20;
        const textX = padding + 16;
        
        // Draw avatar
        const avatarX = textX;
        const avatarY = padding + 10;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        
        if (profile.avatar_url) {
            try {
                const avatarImg = await loadImage(profile.avatar_url);
                ctx.drawImage(avatarImg, avatarX, avatarY, avatarSize, avatarSize);
            } catch (e) {
                // Fallback to gradient avatar with initial
                const gradient = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
                gradient.addColorStop(0, '#6366f1');
                gradient.addColorStop(1, '#a855f7');
                ctx.fillStyle = gradient;
                ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
            }
        } else {
            // Gradient avatar with initial
            const gradient = ctx.createLinearGradient(avatarX, avatarY, avatarX + avatarSize, avatarY + avatarSize);
            gradient.addColorStop(0, '#6366f1');
            gradient.addColorStop(1, '#a855f7');
            ctx.fillStyle = gradient;
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();
        
        // Draw initial if no avatar or as overlay
        if (!profile.avatar_url) {
            const initial = (profile.display_name || '?')[0].toUpperCase();
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${avatarSize * 0.5}px "Space Grotesk", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(initial, avatarX + avatarSize / 2, avatarY + avatarSize / 2);
        }
        
        // Draw display name
        ctx.textAlign = 'left';
        ctx.fillStyle = theme.text;
        ctx.font = `bold 28px "Space Grotesk", sans-serif`;
        
        const nameY = avatarY + avatarSize + 32;
        const displayName = profile.display_name || 'Utilisateur';
        
        // Truncate name if too long
        let truncatedName = displayName;
        while (ctx.measureText(truncatedName).width > textAreaWidth && truncatedName.length > 3) {
            truncatedName = truncatedName.slice(0, -1);
        }
        if (truncatedName !== displayName) {
            truncatedName = truncatedName.slice(0, -2) + '...';
        }
        
        ctx.fillText(truncatedName, textX, nameY);
        
        // Draw bio (if exists)
        if (profile.bio) {
            ctx.fillStyle = theme.textSecondary;
            ctx.font = `400 15px "Inter", sans-serif`;
            
            const bioLines = wrapText(ctx, profile.bio, textAreaWidth);
            const maxBioLines = 3;
            const bioY = nameY + 24;
            
            for (let i = 0; i < Math.min(bioLines.length, maxBioLines); i++) {
                let line = bioLines[i];
                if (i === maxBioLines - 1 && bioLines.length > maxBioLines) {
                    line = line.slice(0, -3) + '...';
                }
                ctx.fillText(line, textX, bioY + i * 20);
            }
        }
        
        // Draw "Cinq" branding at bottom
        ctx.fillStyle = theme.textSecondary;
        ctx.font = `600 14px "Space Grotesk", sans-serif`;
        ctx.textAlign = 'left';
        ctx.fillText('cinq.app', textX, height - padding);
        
        // Draw subtle "Scan to connect" text under QR
        ctx.fillStyle = theme.textSecondary;
        ctx.font = `400 11px "Inter", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Scanne pour me contacter', qrX + qrSize / 2, height - padding + 4);
        
        return canvas;
    }
    
    /**
     * Generate contact card as data URL
     */
    async function generateContactCardDataUrl(profile, options = {}) {
        const canvas = await generateContactCard(profile, options);
        return canvas.toDataURL('image/png', 1.0);
    }
    
    /**
     * Generate contact card as Blob
     */
    async function generateContactCardBlob(profile, options = {}) {
        const canvas = await generateContactCard(profile, options);
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
        });
    }
    
    // ============================================
    // UI Components
    // ============================================
    
    /**
     * Show contact card modal
     */
    async function showContactCardModal(profile) {
        // Remove existing modal
        const existingModal = document.getElementById('contact-card-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'contact-card-modal';
        modal.className = 'contact-card-modal';
        modal.innerHTML = `
            <div class="contact-card-backdrop" onclick="window.CinqContactCard.closeModal()"></div>
            <div class="contact-card-content" role="dialog" aria-labelledby="contact-card-title" aria-modal="true">
                <button class="contact-card-close" onclick="window.CinqContactCard.closeModal()" aria-label="Fermer">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                
                <div class="contact-card-header">
                    <h2 id="contact-card-title">Ma carte de visite</h2>
                    <p class="contact-card-subtitle">Partage ta carte digitale</p>
                </div>
                
                <div class="contact-card-preview">
                    <div class="contact-card-loading" id="card-loading">
                        <div class="contact-card-spinner"></div>
                        <span>Génération de la carte...</span>
                    </div>
                    <img id="contact-card-image" class="contact-card-image" alt="Carte de visite" style="display: none;">
                </div>
                
                <div class="contact-card-themes" id="card-themes">
                    <span class="theme-label">Style :</span>
                    <button class="theme-btn active" data-theme="dark" aria-label="Thème sombre">
                        <span class="theme-preview" style="background: linear-gradient(135deg, #1a1a2e, #1a1a2e);"></span>
                    </button>
                    <button class="theme-btn" data-theme="gradient" aria-label="Thème gradient">
                        <span class="theme-preview" style="background: linear-gradient(135deg, #1a1a2e, #312e81);"></span>
                    </button>
                    <button class="theme-btn" data-theme="aurora" aria-label="Thème aurora">
                        <span class="theme-preview" style="background: linear-gradient(135deg, #0f172a, #38bdf8);"></span>
                    </button>
                    <button class="theme-btn" data-theme="light" aria-label="Thème clair">
                        <span class="theme-preview" style="background: linear-gradient(135deg, #ffffff, #f3f4f6);"></span>
                    </button>
                </div>
                
                <div class="contact-card-actions">
                    <button class="contact-card-btn contact-card-btn-secondary" onclick="window.CinqContactCard.downloadCard()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Télécharger PNG
                    </button>
                    <button class="contact-card-btn contact-card-btn-primary" onclick="window.CinqContactCard.shareCard()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        Partager
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Store profile reference
        modal.dataset.profileId = profile.id;
        modal.dataset.displayName = profile.display_name || 'profile';
        window._contactCardProfile = profile;
        window._contactCardTheme = 'dark';
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('contact-card-visible');
        });
        
        // Setup theme buttons
        const themeBtns = modal.querySelectorAll('.theme-btn');
        themeBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                themeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                window._contactCardTheme = btn.dataset.theme;
                await renderCard(profile, btn.dataset.theme);
            });
        });
        
        // Generate initial card
        await renderCard(profile, 'dark');
        
        // Focus first button
        const firstBtn = modal.querySelector('.contact-card-btn');
        if (firstBtn) firstBtn.focus();
    }
    
    /**
     * Render card with given theme
     */
    async function renderCard(profile, theme) {
        const loading = document.getElementById('card-loading');
        const cardImage = document.getElementById('contact-card-image');
        
        if (loading) loading.style.display = 'flex';
        if (cardImage) cardImage.style.display = 'none';
        
        try {
            const dataUrl = await generateContactCardDataUrl(profile, { theme });
            
            if (cardImage) {
                cardImage.onload = () => {
                    if (loading) loading.style.display = 'none';
                    cardImage.style.display = 'block';
                };
                cardImage.src = dataUrl;
            }
            
            // Store for download/share
            const modal = document.getElementById('contact-card-modal');
            if (modal) {
                modal.dataset.cardDataUrl = dataUrl;
            }
            
        } catch (error) {
            console.error('Card generation error:', error);
            if (loading) {
                loading.innerHTML = `<span style="color: var(--color-error);">❌ Erreur de génération</span>`;
            }
        }
    }
    
    /**
     * Close contact card modal
     */
    function closeModal() {
        const modal = document.getElementById('contact-card-modal');
        if (!modal) return;
        
        modal.classList.remove('contact-card-visible');
        setTimeout(() => {
            modal.remove();
            delete window._contactCardProfile;
            delete window._contactCardTheme;
        }, 300);
    }
    
    /**
     * Download contact card as PNG
     */
    async function downloadCard() {
        const modal = document.getElementById('contact-card-modal');
        if (!modal) return;
        
        const profile = window._contactCardProfile;
        const theme = window._contactCardTheme || 'dark';
        
        if (!profile) return;
        
        try {
            const dataUrl = await generateContactCardDataUrl(profile, { theme });
            
            const link = document.createElement('a');
            const safeName = (profile.display_name || 'contact').replace(/[^a-z0-9]/gi, '-').toLowerCase();
            link.download = `cinq-card-${safeName}.png`;
            link.href = dataUrl;
            link.click();
            
            if (typeof triggerHaptic === 'function') {
                triggerHaptic('success');
            }
            if (typeof showToast === 'function') {
                showToast({ message: 'Carte téléchargée !', type: 'success' });
            }
            
        } catch (error) {
            console.error('Download error:', error);
            if (typeof showToast === 'function') {
                showToast({ message: 'Erreur lors du téléchargement', type: 'error' });
            }
        }
    }
    
    /**
     * Share contact card
     */
    async function shareCard() {
        const profile = window._contactCardProfile;
        const theme = window._contactCardTheme || 'dark';
        
        if (!profile) return;
        
        const displayName = profile.display_name || 'mon profil';
        
        // Try native share with file
        if (navigator.share && navigator.canShare) {
            try {
                const blob = await generateContactCardBlob(profile, { theme });
                const safeName = (profile.display_name || 'contact').replace(/[^a-z0-9]/gi, '-').toLowerCase();
                const file = new File([blob], `cinq-card-${safeName}.png`, { type: 'image/png' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: `Carte Cinq - ${displayName}`,
                        text: `Ma carte de visite Cinq. Scanne le QR code pour me contacter !`,
                        files: [file]
                    });
                    
                    if (typeof triggerHaptic === 'function') {
                        triggerHaptic('success');
                    }
                    return;
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn('File share failed:', e);
                }
            }
        }
        
        // Fallback: download the image
        await downloadCard();
    }
    
    // ============================================
    // Export Public API
    // ============================================
    
    window.CinqContactCard = {
        // Generation
        generateContactCard,
        generateContactCardDataUrl,
        generateContactCardBlob,
        
        // UI
        showContactCardModal,
        closeModal,
        downloadCard,
        shareCard,
        
        // Configuration
        themes: Object.keys(CARD_THEMES),
        config: CARD_CONFIG
    };
    
})(window);
