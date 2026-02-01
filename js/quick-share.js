/**
 * ==========================================================================
 * CINQ - Quick Share Module
 * ==========================================================================
 * 
 * Allows users to quickly share images from clipboard using Ctrl+V / Cmd+V.
 * Works in the feed composer and chat input areas.
 * 
 * Features:
 * - Paste images directly from clipboard (screenshots, copied images)
 * - Shows visual feedback and preview
 * - Supports JPEG, PNG, GIF, WebP formats
 * - File size validation (max 5MB)
 * - Keyboard shortcut hint in UI
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * CinqQuickShare - Quick image sharing from clipboard
 */
const CinqQuickShare = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const VALID_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    // ============================================
    // State
    // ============================================
    
    let initialized = false;
    let onImagePasted = null; // Callback when image is pasted
    
    // ============================================
    // Utility Functions
    // ============================================
    
    /**
     * Show toast notification (uses global showToast if available)
     */
    function notify(type, message) {
        if (typeof showToast === 'function') {
            showToast({ type, message });
        } else if (typeof window.Cinq?.showToast === 'function') {
            window.Cinq.showToast({ type, message });
        } else {
            console.log(`[QuickShare] ${type}: ${message}`);
        }
    }
    
    /**
     * Validate image file
     * @param {File} file - The image file to validate
     * @returns {Object} { valid: boolean, error?: string }
     */
    function validateImage(file) {
        if (!file) {
            return { valid: false, error: 'Aucun fichier' };
        }
        
        if (!VALID_TYPES.includes(file.type)) {
            return { valid: false, error: 'Format non supporté (JPEG, PNG, GIF, WebP)' };
        }
        
        if (file.size > MAX_FILE_SIZE) {
            return { valid: false, error: 'Image trop grande (max 5 Mo)' };
        }
        
        return { valid: true };
    }
    
    /**
     * Convert File to base64 data URL
     * @param {File} file - The file to convert
     * @returns {Promise<string>} Base64 data URL
     */
    function fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Erreur de lecture du fichier'));
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Get image from clipboard event
     * @param {ClipboardEvent} event - The paste event
     * @returns {File|null} The image file or null
     */
    function getImageFromClipboard(event) {
        const items = event.clipboardData?.items;
        if (!items) return null;
        
        for (const item of items) {
            if (item.type.startsWith('image/')) {
                return item.getAsFile();
            }
        }
        
        return null;
    }
    
    // ============================================
    // Core Paste Handler
    // ============================================
    
    /**
     * Handle paste event
     * @param {ClipboardEvent} event - The paste event
     * @param {Object} options - Handler options
     * @param {Function} options.onImage - Callback with { base64, file, type }
     * @param {boolean} options.preventDefault - Whether to prevent default paste
     */
    async function handlePaste(event, options = {}) {
        const imageFile = getImageFromClipboard(event);
        
        // If no image in clipboard, let the default paste behavior continue
        if (!imageFile) {
            return;
        }
        
        // Validate image
        const validation = validateImage(imageFile);
        if (!validation.valid) {
            notify('error', validation.error);
            event.preventDefault();
            return;
        }
        
        // Prevent default paste (don't paste file path or anything)
        event.preventDefault();
        
        try {
            // Convert to base64
            const base64 = await fileToBase64(imageFile);
            
            // Show success feedback
            notify('success', '📋 Image collée !');
            
            // Call the callback
            if (options.onImage) {
                options.onImage({
                    base64,
                    file: imageFile,
                    type: imageFile.type
                });
            }
            
            // Also call global callback if set
            if (onImagePasted) {
                onImagePasted({
                    base64,
                    file: imageFile,
                    type: imageFile.type
                });
            }
            
        } catch (error) {
            console.error('[QuickShare] Error processing pasted image:', error);
            notify('error', 'Erreur lors du traitement de l\'image');
        }
    }
    
    // ============================================
    // Element Binding
    // ============================================
    
    /**
     * Bind paste listener to an element
     * @param {HTMLElement|string} element - The element or selector
     * @param {Function} onImage - Callback when image is pasted
     * @returns {Function} Cleanup function to remove listener
     */
    function bindTo(element, onImage) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        
        if (!el) {
            console.warn('[QuickShare] Element not found:', element);
            return () => {};
        }
        
        const handler = (event) => handlePaste(event, { onImage });
        
        el.addEventListener('paste', handler);
        
        // Return cleanup function
        return () => el.removeEventListener('paste', handler);
    }
    
    /**
     * Bind paste listener to the document (global paste)
     * @param {Function} onImage - Callback when image is pasted
     * @returns {Function} Cleanup function to remove listener
     */
    function bindGlobal(onImage) {
        const handler = (event) => {
            // Only handle if target is an input, textarea, or contenteditable
            const target = event.target;
            const isEditable = target.tagName === 'INPUT' || 
                               target.tagName === 'TEXTAREA' || 
                               target.isContentEditable;
            
            if (isEditable) {
                handlePaste(event, { onImage });
            }
        };
        
        document.addEventListener('paste', handler);
        
        return () => document.removeEventListener('paste', handler);
    }
    
    // ============================================
    // Auto-initialization for Feed & Chat
    // ============================================
    
    /**
     * Initialize Quick Share for the feed composer
     */
    function initFeed() {
        const postContent = document.getElementById('post-content');
        
        if (!postContent) {
            console.log('[QuickShare] Feed composer not found, skipping');
            return;
        }
        
        bindTo(postContent, async ({ base64, type }) => {
            // Use existing feed functions if available
            if (typeof showImagePreview === 'function') {
                showImagePreview(base64);
            }
            
            if (typeof uploadImage === 'function') {
                await uploadImage(base64, type);
            }
        });
        
        // Add keyboard hint to composer
        addKeyboardHint(postContent.closest('.composer'));
        
        console.log('[QuickShare] Feed composer initialized');
    }
    
    /**
     * Initialize Quick Share for the chat input
     * Images are sent as file attachments in chat
     */
    function initChat() {
        const chatInput = document.getElementById('chat-input');
        const chatInputArea = document.getElementById('chat-input-area');
        
        if (!chatInput) {
            console.log('[QuickShare] Chat input not found, skipping');
            return;
        }
        
        bindTo(chatInput, async ({ base64, file, type }) => {
            // Use the file attachment system for chat images
            // Create a synthetic file if needed
            const imageFile = file || dataURLtoFile(base64, `image_${Date.now()}.${type.split('/')[1] || 'png'}`);
            
            // Trigger the file attachment flow
            simulateFileAttachment(imageFile, type);
        });
        
        // Add keyboard hint to chat area
        if (chatInputArea) {
            addKeyboardHint(chatInputArea, true);
        }
        
        console.log('[QuickShare] Chat input initialized');
    }
    
    /**
     * Convert a data URL to a File object
     */
    function dataURLtoFile(dataurl, filename) {
        const arr = dataurl.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
    }
    
    /**
     * Simulate file attachment for chat (uses existing file attachment UI)
     */
    function simulateFileAttachment(file, type) {
        // Update UI to show image preview
        const inputArea = document.getElementById('chat-input-area');
        const sendBtn = document.getElementById('send-btn');
        const iconEl = document.getElementById('file-preview-icon');
        const nameEl = document.getElementById('file-preview-name');
        const metaEl = document.getElementById('file-preview-meta');
        
        if (!inputArea) return;
        
        // Store the file in the global pending attachment
        window.pendingFileAttachment = {
            file: file,
            name: file.name || 'image.png',
            size: file.size,
            type: type || file.type,
            ext: (type || file.type).split('/')[1] || 'png',
            isImage: true
        };
        
        // Update preview UI with image-specific display
        if (iconEl) iconEl.textContent = '🖼️';
        if (nameEl) nameEl.textContent = 'Image collée';
        if (metaEl) metaEl.textContent = `${(file.size / 1024).toFixed(1)} Ko`;
        
        // Switch to file mode
        inputArea.classList.add('file-mode');
        inputArea.classList.remove('voice-mode');
        if (sendBtn) sendBtn.disabled = false;
        
        // Trigger haptic feedback if available
        if (typeof triggerHaptic === 'function') {
            triggerHaptic('tap');
        }
    }
    
    /**
     * Initialize Quick Share for reply composers (dynamic elements)
     */
    function initReplyComposers() {
        // Use MutationObserver to catch dynamically added reply composers
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const replyInputs = node.querySelectorAll?.('.reply-composer-input');
                        replyInputs?.forEach(input => {
                            bindTo(input, async ({ base64, type }) => {
                                // Reply composers may have their own image handling
                                console.log('[QuickShare] Image pasted in reply composer');
                            });
                        });
                    }
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        console.log('[QuickShare] Reply composer observer initialized');
    }
    
    /**
     * Add keyboard hint UI to an element
     * @param {HTMLElement} container - The container element
     * @param {boolean} isChat - Whether this is for chat input
     */
    function addKeyboardHint(container, isChat = false) {
        if (!container) return;
        
        // Check if hint already exists
        if (container.querySelector('.quick-share-hint')) return;
        
        // Detect Mac for proper key display
        const isMac = navigator.platform?.toLowerCase().includes('mac') || 
                      navigator.userAgent?.toLowerCase().includes('mac');
        const modKey = isMac ? '⌘' : 'Ctrl';
        
        const hint = document.createElement('div');
        hint.className = 'quick-share-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.innerHTML = `
            <span class="quick-share-icon">📋</span>
            <kbd>${modKey}</kbd>+<kbd>V</kbd> ${isChat ? 'envoyer une image' : 'coller une image'}
        `;
        hint.style.cssText = `
            font-size: 0.7rem;
            color: var(--color-text-muted, #888);
            opacity: 0;
            transition: opacity 0.2s;
            padding: 0.25rem 0.5rem;
            display: flex;
            align-items: center;
            gap: 0.35rem;
            pointer-events: none;
        `;
        
        // Style the kbd elements
        const style = document.createElement('style');
        style.textContent = `
            .quick-share-hint kbd {
                background: var(--color-bg-secondary, #222);
                border: 1px solid var(--color-border, #333);
                border-radius: 4px;
                padding: 0.1rem 0.35rem;
                font-family: inherit;
                font-size: 0.65rem;
                font-weight: 500;
            }
            .quick-share-hint .quick-share-icon {
                font-size: 0.8rem;
            }
            .composer:focus-within .quick-share-hint,
            .chat-input-area:focus-within .quick-share-hint {
                opacity: 0.7;
            }
            .chat-input-area .quick-share-hint {
                position: absolute;
                bottom: 100%;
                left: 50%;
                transform: translateX(-50%);
                margin-bottom: 0.25rem;
                white-space: nowrap;
                background: var(--color-bg-primary, #1a1a1a);
                border-radius: 0.5rem;
                z-index: 10;
            }
        `;
        
        if (!document.getElementById('quick-share-styles')) {
            style.id = 'quick-share-styles';
            document.head.appendChild(style);
        }
        
        // Find a good place to insert the hint
        if (isChat) {
            // For chat, position above the input area
            container.style.position = 'relative';
            container.appendChild(hint);
        } else {
            const footer = container.querySelector('.composer-footer, .composer-actions');
            if (footer) {
                footer.insertAdjacentElement('beforebegin', hint);
            } else {
                container.appendChild(hint);
            }
        }
    }
    
    // ============================================
    // Main Initialization
    // ============================================
    
    /**
     * Initialize Quick Share on page load
     */
    function init() {
        if (initialized) {
            console.log('[QuickShare] Already initialized');
            return;
        }
        
        // Initialize based on what's available on the page
        initFeed();
        initChat();
        initReplyComposers();
        
        initialized = true;
        console.log('[QuickShare] ✅ Module initialized');
    }
    
    /**
     * Set a global callback for when images are pasted
     * @param {Function} callback - The callback function
     */
    function setCallback(callback) {
        onImagePasted = callback;
    }
    
    // ============================================
    // Auto-init when DOM is ready
    // ============================================
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM already loaded, init on next tick
        setTimeout(init, 0);
    }
    
    // ============================================
    // Public API
    // ============================================
    
    return {
        init,
        bindTo,
        bindGlobal,
        handlePaste,
        setCallback,
        validateImage,
        fileToBase64
    };
    
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CinqQuickShare;
}

// Add to window for global access
window.CinqQuickShare = CinqQuickShare;
