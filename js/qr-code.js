/**
 * ==========================================================================
 * CINQ - QR Code Module
 * ==========================================================================
 * 
 * Generate QR codes for profile sharing and scan QR codes to add contacts.
 * Uses qrcode library for generation and camera API for scanning.
 * 
 * Features:
 * - Generate profile QR code with custom styling
 * - Scan QR codes using device camera
 * - Download QR code as image
 * - Share QR code (Web Share API)
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

(function(window) {
    
    // ============================================
    // Configuration
    // ============================================
    
    const QR_CONFIG = {
        size: 256,
        margin: 2,
        darkColor: '#1a1a2e',
        lightColor: '#ffffff',
        errorCorrectionLevel: 'M',
        profileUrlBase: 'https://cinq.app/profile.html'
    };
    
    // ============================================
    // QR Code Generation
    // ============================================
    
    /**
     * Load QRCode library dynamically
     * @returns {Promise<void>}
     */
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
    
    /**
     * Generate a QR code for a user profile
     * @param {string} userId - User ID to encode
     * @param {Object} options - Optional configuration
     * @returns {Promise<string>} - Data URL of the QR code image
     */
    async function generateProfileQRCode(userId, options = {}) {
        await loadQRCodeLibrary();
        
        const profileUrl = `${QR_CONFIG.profileUrlBase}?id=${encodeURIComponent(userId)}&source=qr`;
        
        const qrOptions = {
            width: options.size || QR_CONFIG.size,
            margin: options.margin || QR_CONFIG.margin,
            color: {
                dark: options.darkColor || QR_CONFIG.darkColor,
                light: options.lightColor || QR_CONFIG.lightColor
            },
            errorCorrectionLevel: options.errorCorrectionLevel || QR_CONFIG.errorCorrectionLevel
        };
        
        try {
            const dataUrl = await QRCode.toDataURL(profileUrl, qrOptions);
            return dataUrl;
        } catch (error) {
            console.error('QR Code generation failed:', error);
            throw new Error('Impossible de générer le QR code');
        }
    }
    
    /**
     * Generate QR code and render to canvas element
     * @param {HTMLCanvasElement} canvas - Target canvas element
     * @param {string} userId - User ID to encode
     * @param {Object} options - Optional configuration
     */
    async function generateProfileQRCodeToCanvas(canvas, userId, options = {}) {
        await loadQRCodeLibrary();
        
        const profileUrl = `${QR_CONFIG.profileUrlBase}?id=${encodeURIComponent(userId)}&source=qr`;
        
        const qrOptions = {
            width: options.size || QR_CONFIG.size,
            margin: options.margin || QR_CONFIG.margin,
            color: {
                dark: options.darkColor || QR_CONFIG.darkColor,
                light: options.lightColor || QR_CONFIG.lightColor
            },
            errorCorrectionLevel: options.errorCorrectionLevel || QR_CONFIG.errorCorrectionLevel
        };
        
        await QRCode.toCanvas(canvas, profileUrl, qrOptions);
    }
    
    /**
     * Generate a contact add QR code (encodes full contact info)
     * @param {Object} profile - User profile object
     * @returns {Promise<string>} - Data URL of the QR code image
     */
    async function generateContactQRCode(profile) {
        await loadQRCodeLibrary();
        
        // Create a cinq:// protocol URL for the app to handle
        const contactData = {
            type: 'cinq_contact',
            version: 1,
            id: profile.id,
            name: profile.display_name,
            avatar: profile.avatar_url || null,
            timestamp: Date.now()
        };
        
        const encodedData = `cinq://contact/${btoa(JSON.stringify(contactData))}`;
        
        const qrOptions = {
            width: QR_CONFIG.size,
            margin: QR_CONFIG.margin,
            color: {
                dark: QR_CONFIG.darkColor,
                light: QR_CONFIG.lightColor
            },
            errorCorrectionLevel: 'M'
        };
        
        try {
            return await QRCode.toDataURL(encodedData, qrOptions);
        } catch (error) {
            console.error('Contact QR Code generation failed:', error);
            throw new Error('Impossible de générer le QR code contact');
        }
    }
    
    // ============================================
    // QR Code Scanning
    // ============================================
    
    let videoStream = null;
    let scanAnimationFrame = null;
    let scanCallback = null;
    
    /**
     * Load jsQR library for QR code scanning
     * @returns {Promise<void>}
     */
    async function loadJsQRLibrary() {
        if (window.jsQR) return;
        
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load jsQR library'));
            document.head.appendChild(script);
        });
    }
    
    /**
     * Start QR code scanning using device camera
     * @param {HTMLVideoElement} videoElement - Video element for camera preview
     * @param {HTMLCanvasElement} canvasElement - Canvas for frame processing
     * @param {Function} onScan - Callback when QR code is detected
     * @param {Function} onError - Callback on error
     * @returns {Promise<void>}
     */
    async function startQRScanner(videoElement, canvasElement, onScan, onError) {
        try {
            await loadJsQRLibrary();
            
            // Request camera access
            const constraints = {
                video: {
                    facingMode: 'environment', // Prefer back camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };
            
            videoStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoElement.srcObject = videoStream;
            videoElement.setAttribute('playsinline', true);
            await videoElement.play();
            
            scanCallback = onScan;
            
            // Start scanning loop
            const ctx = canvasElement.getContext('2d', { willReadFrequently: true });
            
            function scanFrame() {
                if (!videoStream) return;
                
                if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
                    canvasElement.width = videoElement.videoWidth;
                    canvasElement.height = videoElement.videoHeight;
                    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
                    
                    const imageData = ctx.getImageData(0, 0, canvasElement.width, canvasElement.height);
                    const code = jsQR(imageData.data, imageData.width, imageData.height, {
                        inversionAttempts: 'dontInvert'
                    });
                    
                    if (code && code.data) {
                        // QR code detected
                        const result = parseQRCodeData(code.data);
                        if (result && scanCallback) {
                            scanCallback(result);
                            return; // Stop scanning after successful read
                        }
                    }
                }
                
                scanAnimationFrame = requestAnimationFrame(scanFrame);
            }
            
            scanAnimationFrame = requestAnimationFrame(scanFrame);
            
        } catch (error) {
            console.error('QR Scanner error:', error);
            if (onError) {
                if (error.name === 'NotAllowedError') {
                    onError(new Error('Accès à la caméra refusé. Autorise l\'accès dans les paramètres.'));
                } else if (error.name === 'NotFoundError') {
                    onError(new Error('Aucune caméra détectée sur cet appareil.'));
                } else {
                    onError(new Error('Impossible d\'accéder à la caméra.'));
                }
            }
        }
    }
    
    /**
     * Stop QR code scanning
     */
    function stopQRScanner() {
        if (scanAnimationFrame) {
            cancelAnimationFrame(scanAnimationFrame);
            scanAnimationFrame = null;
        }
        
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        
        scanCallback = null;
    }
    
    /**
     * Parse QR code data and extract contact info
     * @param {string} data - Raw QR code data
     * @returns {Object|null} - Parsed contact data or null
     */
    function parseQRCodeData(data) {
        // Handle cinq:// protocol URLs
        if (data.startsWith('cinq://contact/')) {
            try {
                const encoded = data.replace('cinq://contact/', '');
                const decoded = JSON.parse(atob(encoded));
                
                if (decoded.type === 'cinq_contact' && decoded.id) {
                    return {
                        type: 'contact',
                        userId: decoded.id,
                        displayName: decoded.name,
                        avatarUrl: decoded.avatar,
                        source: 'qr_scan'
                    };
                }
            } catch (e) {
                console.warn('Failed to parse cinq:// URL:', e);
            }
        }
        
        // Handle profile URLs
        if (data.includes('/profile.html?id=') || data.includes('/profile?id=')) {
            try {
                const url = new URL(data);
                const userId = url.searchParams.get('id');
                const username = url.searchParams.get('user');
                
                if (userId || username) {
                    return {
                        type: 'profile',
                        userId: userId,
                        username: username,
                        source: 'qr_scan'
                    };
                }
            } catch (e) {
                console.warn('Failed to parse profile URL:', e);
            }
        }
        
        // Handle plain user IDs (UUID format)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(data)) {
            return {
                type: 'userId',
                userId: data,
                source: 'qr_scan'
            };
        }
        
        return null;
    }
    
    // ============================================
    // UI Components
    // ============================================
    
    /**
     * Create and show QR code modal for profile sharing
     * @param {Object} profile - User profile object
     */
    async function showProfileQRModal(profile) {
        // Remove any existing modal
        const existingModal = document.getElementById('qr-modal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.id = 'qr-modal';
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-modal-backdrop" onclick="window.CinqQR.closeQRModal()"></div>
            <div class="qr-modal-content" role="dialog" aria-labelledby="qr-modal-title" aria-modal="true">
                <button class="qr-modal-close" onclick="window.CinqQR.closeQRModal()" aria-label="Fermer">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                
                <div class="qr-modal-header">
                    <h2 id="qr-modal-title">Mon QR Code</h2>
                    <p class="qr-modal-subtitle">Scanne ce code pour ajouter mon profil</p>
                </div>
                
                <div class="qr-code-container">
                    <div class="qr-code-loading">
                        <div class="qr-spinner"></div>
                        <span>Génération...</span>
                    </div>
                    <img id="qr-code-image" class="qr-code-image" alt="QR Code de profil" style="display: none;">
                </div>
                
                <div class="qr-profile-info">
                    <div class="qr-avatar">
                        ${profile.avatar_url 
                            ? `<img src="${escapeHtml(profile.avatar_url)}" alt="">`
                            : `<span>${(profile.display_name || '?')[0].toUpperCase()}</span>`
                        }
                    </div>
                    <span class="qr-display-name">${escapeHtml(profile.display_name)}</span>
                </div>
                
                <div class="qr-modal-actions">
                    <button class="qr-btn qr-btn-secondary" onclick="window.CinqQR.downloadQRCode()">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Télécharger
                    </button>
                    <button class="qr-btn qr-btn-primary" onclick="window.CinqQR.shareQRCode()">
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
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('qr-modal-visible');
        });
        
        // Generate QR code
        try {
            const qrDataUrl = await generateContactQRCode(profile);
            const qrImage = document.getElementById('qr-code-image');
            const loading = modal.querySelector('.qr-code-loading');
            
            qrImage.onload = () => {
                loading.style.display = 'none';
                qrImage.style.display = 'block';
            };
            qrImage.src = qrDataUrl;
            
            // Store for download/share
            modal.dataset.qrDataUrl = qrDataUrl;
            modal.dataset.displayName = profile.display_name;
            
        } catch (error) {
            console.error('QR generation error:', error);
            modal.querySelector('.qr-code-loading').innerHTML = `
                <span style="color: var(--color-error);">❌ ${error.message}</span>
            `;
        }
        
        // Trap focus in modal
        const focusableElements = modal.querySelectorAll('button');
        if (focusableElements.length > 0) {
            focusableElements[0].focus();
        }
    }
    
    /**
     * Close QR code modal
     */
    function closeQRModal() {
        const modal = document.getElementById('qr-modal');
        if (!modal) return;
        
        modal.classList.remove('qr-modal-visible');
        setTimeout(() => modal.remove(), 300);
    }
    
    /**
     * Download QR code as PNG image
     */
    function downloadQRCode() {
        const modal = document.getElementById('qr-modal');
        if (!modal || !modal.dataset.qrDataUrl) return;
        
        const link = document.createElement('a');
        link.download = `cinq-qr-${modal.dataset.displayName || 'profile'}.png`;
        link.href = modal.dataset.qrDataUrl;
        link.click();
        
        if (typeof triggerHaptic === 'function') {
            triggerHaptic('success');
        }
        if (typeof showToast === 'function') {
            showToast({ message: 'QR code téléchargé !', type: 'success' });
        }
    }
    
    /**
     * Share QR code using Web Share API
     */
    async function shareQRCode() {
        const modal = document.getElementById('qr-modal');
        if (!modal || !modal.dataset.qrDataUrl) return;
        
        const displayName = modal.dataset.displayName || 'mon profil';
        
        // Try native share first
        if (navigator.share && navigator.canShare) {
            try {
                // Convert data URL to blob for sharing
                const response = await fetch(modal.dataset.qrDataUrl);
                const blob = await response.blob();
                const file = new File([blob], `cinq-qr-${displayName}.png`, { type: 'image/png' });
                
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        title: `QR Code Cinq - ${displayName}`,
                        text: `Scanne ce QR code pour m'ajouter sur Cinq !`,
                        files: [file]
                    });
                    
                    if (typeof triggerHaptic === 'function') {
                        triggerHaptic('success');
                    }
                    return;
                }
            } catch (e) {
                if (e.name !== 'AbortError') {
                    console.warn('File share failed, trying URL share:', e);
                }
            }
            
            // Fallback to URL share
            try {
                await navigator.share({
                    title: `Profil Cinq - ${displayName}`,
                    text: `Ajoute-moi sur Cinq !`,
                    url: `${QR_CONFIG.profileUrlBase}?source=share`
                });
                return;
            } catch (e) {
                if (e.name === 'AbortError') return;
            }
        }
        
        // Fallback: copy profile URL
        try {
            await navigator.clipboard.writeText(`${QR_CONFIG.profileUrlBase}?source=share`);
            if (typeof showToast === 'function') {
                showToast({ message: 'Lien copié !', type: 'success' });
            }
        } catch (e) {
            console.error('Share/copy failed:', e);
        }
    }
    
    /**
     * Create and show QR scanner modal
     * @param {Function} onContactFound - Callback when contact is found
     */
    function showScannerModal(onContactFound) {
        // Remove any existing modal
        const existingModal = document.getElementById('qr-scanner-modal');
        if (existingModal) {
            stopQRScanner();
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.id = 'qr-scanner-modal';
        modal.className = 'qr-modal';
        modal.innerHTML = `
            <div class="qr-modal-backdrop" onclick="window.CinqQR.closeScannerModal()"></div>
            <div class="qr-modal-content qr-scanner-content" role="dialog" aria-labelledby="qr-scanner-title" aria-modal="true">
                <button class="qr-modal-close" onclick="window.CinqQR.closeScannerModal()" aria-label="Fermer">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                
                <div class="qr-modal-header">
                    <h2 id="qr-scanner-title">Scanner un QR Code</h2>
                    <p class="qr-modal-subtitle">Pointe la caméra vers un QR code Cinq</p>
                </div>
                
                <div class="qr-scanner-container">
                    <video id="qr-scanner-video" playsinline></video>
                    <canvas id="qr-scanner-canvas" style="display: none;"></canvas>
                    <div class="qr-scanner-overlay">
                        <div class="qr-scanner-frame"></div>
                    </div>
                    <div class="qr-scanner-status" id="qr-scanner-status">
                        <div class="qr-spinner"></div>
                        <span>Initialisation de la caméra...</span>
                    </div>
                </div>
                
                <div class="qr-scanner-instructions">
                    <p>📱 Demande à ton ami d'afficher son QR code Cinq</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('qr-modal-visible');
        });
        
        // Start scanner
        const video = document.getElementById('qr-scanner-video');
        const canvas = document.getElementById('qr-scanner-canvas');
        const status = document.getElementById('qr-scanner-status');
        
        startQRScanner(
            video,
            canvas,
            (result) => {
                // QR code detected
                status.innerHTML = `
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <span style="color: var(--color-success);">Contact trouvé !</span>
                `;
                
                if (typeof triggerHaptic === 'function') {
                    triggerHaptic('success');
                }
                
                stopQRScanner();
                
                setTimeout(() => {
                    closeScannerModal();
                    if (onContactFound) {
                        onContactFound(result);
                    }
                }, 800);
            },
            (error) => {
                // Error
                status.innerHTML = `
                    <span style="color: var(--color-error);">❌ ${error.message}</span>
                `;
            }
        );
        
        // Update status when video starts
        video.addEventListener('playing', () => {
            status.style.display = 'none';
        });
    }
    
    /**
     * Close scanner modal
     */
    function closeScannerModal() {
        stopQRScanner();
        
        const modal = document.getElementById('qr-scanner-modal');
        if (!modal) return;
        
        modal.classList.remove('qr-modal-visible');
        setTimeout(() => modal.remove(), 300);
    }
    
    // ============================================
    // Export Public API
    // ============================================
    
    window.CinqQR = {
        // Generation
        generateProfileQRCode,
        generateProfileQRCodeToCanvas,
        generateContactQRCode,
        
        // Scanning
        startQRScanner,
        stopQRScanner,
        parseQRCodeData,
        
        // UI
        showProfileQRModal,
        closeQRModal,
        downloadQRCode,
        shareQRCode,
        showScannerModal,
        closeScannerModal,
        
        // Configuration
        config: QR_CONFIG
    };
    
})(window);
