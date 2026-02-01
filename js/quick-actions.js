/**
 * ==========================================================================
 * CINQ - Quick Actions (Long Press Context Menu)
 * ==========================================================================
 * 
 * Mobile-first context menu triggered by long press on posts and messages.
 * Provides quick actions like copy, share, bookmark, reply, delete.
 * 
 * Features:
 * - Long press detection with visual feedback
 * - Haptic feedback (on supported devices)
 * - Accessible keyboard navigation
 * - Touch and mouse support
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * QuickActions - Context menu module for long press interactions
 */
const QuickActions = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const CONFIG = {
        /** Duration to trigger long press (ms) */
        longPressDuration: 500,
        
        /** Move threshold to cancel long press (px) */
        moveThreshold: 10,
        
        /** Default quick reactions */
        defaultReactions: ['❤️', '😂', '😮', '😢', '👍'],
        
        /** Enable haptic feedback */
        enableHaptics: true
    };
    
    // ============================================
    // State
    // ============================================
    
    /** @type {HTMLElement|null} Currently active menu */
    let activeMenu = null;
    
    /** @type {HTMLElement|null} Currently active overlay */
    let activeOverlay = null;
    
    /** @type {HTMLElement|null} Long press visual indicator */
    let longPressRing = null;
    
    /** @type {number|null} Long press timeout ID */
    let longPressTimeout = null;
    
    /** @type {Object|null} Touch start position */
    let touchStart = null;
    
    /** @type {HTMLElement|null} Element being long-pressed */
    let pressingElement = null;
    
    /** @type {Object|null} Current context data */
    let currentContext = null;
    
    // ============================================
    // Haptic Feedback
    // ============================================
    
    /**
     * Trigger haptic feedback if available
     * @param {string} type - 'light', 'medium', 'heavy', 'selection'
     */
    function haptic(type = 'medium') {
        if (!CONFIG.enableHaptics) return;
        
        try {
            // iOS/Safari
            if (window.navigator && window.navigator.vibrate) {
                const patterns = {
                    light: [10],
                    medium: [20],
                    heavy: [30],
                    selection: [5]
                };
                window.navigator.vibrate(patterns[type] || [20]);
            }
            
            // Experimental Haptics API
            if ('Haptics' in window) {
                window.Haptics.vibrate(type);
            }
        } catch (e) {
            // Haptics not supported, ignore
        }
    }
    
    // ============================================
    // Long Press Ring (Visual Indicator)
    // ============================================
    
    /**
     * Create or get the long press visual indicator
     * @returns {HTMLElement}
     */
    function getLongPressRing() {
        if (!longPressRing) {
            longPressRing = document.createElement('div');
            longPressRing.className = 'long-press-ring';
            longPressRing.setAttribute('aria-hidden', 'true');
            document.body.appendChild(longPressRing);
        }
        return longPressRing;
    }
    
    /**
     * Show long press ring at position
     * @param {number} x - X coordinate
     * @param {number} y - Y coordinate
     */
    function showLongPressRing(x, y) {
        const ring = getLongPressRing();
        ring.style.left = x + 'px';
        ring.style.top = y + 'px';
        ring.classList.add('active');
    }
    
    /**
     * Hide long press ring
     */
    function hideLongPressRing() {
        if (longPressRing) {
            longPressRing.classList.remove('active');
        }
    }
    
    // ============================================
    // Menu Creation
    // ============================================
    
    /**
     * Create the overlay element
     * @returns {HTMLElement}
     */
    function createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'quick-actions-overlay';
        overlay.setAttribute('role', 'presentation');
        overlay.addEventListener('click', hide);
        return overlay;
    }
    
    /**
     * Create the context menu element
     * @param {Object} options - Menu options
     * @returns {HTMLElement}
     */
    function createMenu(options) {
        const {
            type = 'post',
            author = '',
            preview = '',
            avatar = '',
            actions = [],
            reactions = null,
            isOwn = false
        } = options;
        
        const menu = document.createElement('div');
        menu.className = `quick-actions-menu ${type === 'message' ? 'message-quick-actions' : ''}`;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', 'Actions rapides');
        
        // Build header with preview
        if (author || preview) {
            const header = document.createElement('div');
            header.className = 'quick-actions-header';
            
            if (avatar) {
                const avatarEl = document.createElement('div');
                avatarEl.className = 'quick-actions-avatar';
                avatarEl.textContent = avatar;
                header.appendChild(avatarEl);
            }
            
            const previewContainer = document.createElement('div');
            previewContainer.className = 'quick-actions-preview';
            
            if (author) {
                const authorEl = document.createElement('div');
                authorEl.className = 'quick-actions-author';
                authorEl.textContent = author + (isOwn ? ' (toi)' : '');
                previewContainer.appendChild(authorEl);
            }
            
            if (preview) {
                const textEl = document.createElement('div');
                textEl.className = 'quick-actions-text';
                textEl.textContent = preview.length > 50 ? preview.slice(0, 50) + '…' : preview;
                previewContainer.appendChild(textEl);
            }
            
            header.appendChild(previewContainer);
            menu.appendChild(header);
        }
        
        // Quick reactions bar
        if (reactions !== false && type === 'post') {
            const reactionsBar = document.createElement('div');
            reactionsBar.className = 'quick-reactions-bar';
            
            const reactionsList = reactions || CONFIG.defaultReactions;
            reactionsList.forEach(emoji => {
                const btn = document.createElement('button');
                btn.className = 'quick-reaction-btn';
                btn.textContent = emoji;
                btn.setAttribute('aria-label', `Réagir avec ${emoji}`);
                btn.addEventListener('click', () => {
                    haptic('light');
                    handleAction('react', { emoji });
                });
                reactionsBar.appendChild(btn);
            });
            
            menu.appendChild(reactionsBar);
        }
        
        // Actions list
        const list = document.createElement('div');
        list.className = 'quick-actions-list';
        
        actions.forEach((action, index) => {
            if (action.divider) {
                const divider = document.createElement('div');
                divider.className = 'quick-actions-divider';
                divider.setAttribute('role', 'separator');
                list.appendChild(divider);
                return;
            }
            
            const item = document.createElement('button');
            item.className = 'quick-action-item';
            if (action.destructive) item.classList.add('destructive');
            item.setAttribute('role', 'menuitem');
            item.setAttribute('tabindex', index === 0 ? '0' : '-1');
            
            item.innerHTML = `
                <span class="quick-action-icon">${action.icon || ''}</span>
                <span class="quick-action-label">${window.Cinq?.escapeHtml(action.label) || action.label}</span>
                ${action.shortcut ? `<span class="quick-action-shortcut">${action.shortcut}</span>` : ''}
            `;
            
            item.addEventListener('click', () => {
                haptic('light');
                handleAction(action.action, action.data);
            });
            
            list.appendChild(item);
        });
        
        menu.appendChild(list);
        
        // Cancel button (visible on mobile)
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'quick-actions-cancel';
        cancelBtn.textContent = 'Annuler';
        cancelBtn.addEventListener('click', hide);
        list.appendChild(cancelBtn);
        
        return menu;
    }
    
    // ============================================
    // Action Handling
    // ============================================
    
    /**
     * Handle action selection
     * @param {string} actionName - Action identifier
     * @param {Object} data - Additional data
     */
    function handleAction(actionName, data = {}) {
        if (!currentContext) {
            hide();
            return;
        }
        
        const context = { ...currentContext, ...data };
        
        switch (actionName) {
            case 'copy':
                copyContent(context);
                break;
            case 'share':
                shareContent(context);
                break;
            case 'bookmark':
                bookmarkContent(context);
                break;
            case 'reply':
                replyToContent(context);
                break;
            case 'react':
                reactToContent(context);
                break;
            case 'delete':
                deleteContent(context);
                break;
            case 'edit':
                editContent(context);
                break;
            case 'report':
                reportContent(context);
                break;
            default:
                // Custom action - emit event
                emitAction(actionName, context);
        }
        
        hide();
    }
    
    /**
     * Copy content to clipboard
     */
    async function copyContent(context) {
        const text = context.content || context.preview || '';
        
        try {
            if (window.Cinq?.copyToClipboard) {
                await window.Cinq.copyToClipboard(text);
            } else if (navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            }
            
            showFeedback('Copié !', 'success');
        } catch (err) {
            showFeedback('Erreur de copie', 'error');
        }
    }
    
    /**
     * Share content via Web Share API or fallback
     */
    async function shareContent(context) {
        const shareData = {
            title: context.author ? `Post de ${context.author}` : 'Cinq',
            text: context.content || context.preview || '',
            url: context.url || window.location.href
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback: copy link
                await copyContent({ content: shareData.url });
                showFeedback('Lien copié !', 'success');
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                showFeedback('Erreur de partage', 'error');
            }
        }
    }
    
    /**
     * Bookmark content
     */
    function bookmarkContent(context) {
        // Emit event for the app to handle
        emitAction('bookmark', context);
        showFeedback('Ajouté aux favoris ⭐', 'success');
    }
    
    /**
     * Reply to content
     */
    function replyToContent(context) {
        emitAction('reply', context);
    }
    
    /**
     * React to content with emoji
     */
    function reactToContent(context) {
        emitAction('react', context);
        showFeedback(context.emoji || '❤️', 'success');
    }
    
    /**
     * Delete content
     */
    function deleteContent(context) {
        emitAction('delete', context);
    }
    
    /**
     * Edit content
     */
    function editContent(context) {
        emitAction('edit', context);
    }
    
    /**
     * Report content
     */
    function reportContent(context) {
        emitAction('report', context);
        showFeedback('Signalement envoyé', 'success');
    }
    
    /**
     * Emit custom action event
     */
    function emitAction(action, context) {
        const event = new CustomEvent('quickaction', {
            detail: { action, context },
            bubbles: true
        });
        document.dispatchEvent(event);
    }
    
    /**
     * Show feedback toast
     */
    function showFeedback(message, type = 'success') {
        if (window.Cinq?.showToast) {
            window.Cinq.showToast(message, { type, duration: 2000 });
        }
    }
    
    // ============================================
    // Show/Hide Menu
    // ============================================
    
    /**
     * Show context menu for an element
     * @param {HTMLElement} element - The target element
     * @param {Object} options - Menu configuration
     * @param {number} x - X position (optional, for desktop)
     * @param {number} y - Y position (optional, for desktop)
     */
    function show(element, options, x, y) {
        hide(); // Close any existing menu
        
        currentContext = options.context || {};
        
        // Create overlay and menu
        activeOverlay = createOverlay();
        activeMenu = createMenu(options);
        
        document.body.appendChild(activeOverlay);
        document.body.appendChild(activeMenu);
        
        // Position menu
        if (window.innerWidth > 640 && x !== undefined && y !== undefined) {
            // Desktop: position at cursor
            positionMenuAt(activeMenu, x, y);
        }
        // Mobile: menu uses CSS fixed bottom positioning
        
        // Animate in
        requestAnimationFrame(() => {
            activeOverlay.classList.add('active');
            activeMenu.classList.add('active');
            
            // Focus first item
            const firstItem = activeMenu.querySelector('.quick-action-item');
            if (firstItem) firstItem.focus();
        });
        
        // Prevent body scroll on mobile
        document.body.style.overflow = 'hidden';
        
        // Add keyboard listeners
        document.addEventListener('keydown', handleKeyDown);
        
        haptic('medium');
    }
    
    /**
     * Position menu at coordinates (desktop)
     */
    function positionMenuAt(menu, x, y) {
        const rect = menu.getBoundingClientRect();
        const padding = 16;
        
        let left = x;
        let top = y;
        
        // Keep within viewport
        if (left + rect.width > window.innerWidth - padding) {
            left = window.innerWidth - rect.width - padding;
        }
        if (top + rect.height > window.innerHeight - padding) {
            top = window.innerHeight - rect.height - padding;
        }
        
        left = Math.max(padding, left);
        top = Math.max(padding, top);
        
        menu.style.left = left + 'px';
        menu.style.top = top + 'px';
    }
    
    /**
     * Hide and cleanup the menu
     */
    function hide() {
        if (activeOverlay) {
            activeOverlay.classList.remove('active');
            setTimeout(() => activeOverlay?.remove(), 200);
            activeOverlay = null;
        }
        
        if (activeMenu) {
            activeMenu.classList.remove('active');
            setTimeout(() => activeMenu?.remove(), 250);
            activeMenu = null;
        }
        
        currentContext = null;
        document.body.style.overflow = '';
        document.removeEventListener('keydown', handleKeyDown);
    }
    
    /**
     * Handle keyboard navigation
     */
    function handleKeyDown(e) {
        if (!activeMenu) return;
        
        const items = activeMenu.querySelectorAll('.quick-action-item');
        const currentIndex = Array.from(items).indexOf(document.activeElement);
        
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                hide();
                break;
            case 'ArrowDown':
                e.preventDefault();
                const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
                items[nextIndex]?.focus();
                break;
            case 'ArrowUp':
                e.preventDefault();
                const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
                items[prevIndex]?.focus();
                break;
            case 'Tab':
                // Keep focus within menu
                if (!e.shiftKey && currentIndex === items.length - 1) {
                    e.preventDefault();
                    items[0]?.focus();
                } else if (e.shiftKey && currentIndex === 0) {
                    e.preventDefault();
                    items[items.length - 1]?.focus();
                }
                break;
        }
    }
    
    // ============================================
    // Long Press Detection
    // ============================================
    
    /**
     * Start long press detection
     * @param {HTMLElement} element - Element being pressed
     * @param {TouchEvent|MouseEvent} e - Event
     * @param {Object} options - Menu options getter or options object
     */
    function startLongPress(element, e, options) {
        // Get coordinates
        const touch = e.touches ? e.touches[0] : e;
        touchStart = { x: touch.clientX, y: touch.clientY };
        pressingElement = element;
        
        // Add pressing class
        element.classList.add('pressing');
        
        // Show visual indicator
        showLongPressRing(touch.clientX, touch.clientY);
        
        // Set timeout for long press
        longPressTimeout = setTimeout(() => {
            // Get options (could be a function)
            const menuOptions = typeof options === 'function' ? options(element) : options;
            
            // Show menu
            show(element, menuOptions, touch.clientX, touch.clientY);
            
            // Cleanup
            cancelLongPress();
        }, CONFIG.longPressDuration);
    }
    
    /**
     * Cancel long press
     */
    function cancelLongPress() {
        if (longPressTimeout) {
            clearTimeout(longPressTimeout);
            longPressTimeout = null;
        }
        
        if (pressingElement) {
            pressingElement.classList.remove('pressing');
            pressingElement = null;
        }
        
        hideLongPressRing();
        touchStart = null;
    }
    
    /**
     * Check if touch has moved too far
     */
    function checkTouchMove(e) {
        if (!touchStart) return;
        
        const touch = e.touches ? e.touches[0] : e;
        const dx = Math.abs(touch.clientX - touchStart.x);
        const dy = Math.abs(touch.clientY - touchStart.y);
        
        if (dx > CONFIG.moveThreshold || dy > CONFIG.moveThreshold) {
            cancelLongPress();
        }
    }
    
    // ============================================
    // Event Binding for Elements
    // ============================================
    
    /**
     * Enable long press on an element
     * @param {HTMLElement} element - Target element
     * @param {Object|Function} options - Menu options or getter function
     */
    function enable(element, options) {
        if (!element) return;
        
        element.classList.add('long-press-target');
        
        // Touch events
        element.addEventListener('touchstart', (e) => {
            // Don't intercept if user is scrolling or on an interactive element
            if (e.target.closest('a, button, input, textarea, select, [role="button"]')) {
                return;
            }
            startLongPress(element, e, options);
        }, { passive: true });
        
        element.addEventListener('touchmove', checkTouchMove, { passive: true });
        element.addEventListener('touchend', cancelLongPress);
        element.addEventListener('touchcancel', cancelLongPress);
        
        // Mouse events (for desktop with touch capabilities)
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const menuOptions = typeof options === 'function' ? options(element) : options;
            show(element, menuOptions, e.clientX, e.clientY);
        });
    }
    
    /**
     * Enable long press on all matching elements
     * @param {string} selector - CSS selector
     * @param {Object|Function} options - Menu options or getter function
     */
    function enableAll(selector, options) {
        document.querySelectorAll(selector).forEach(el => enable(el, options));
    }
    
    // ============================================
    // Post Actions Configuration
    // ============================================
    
    /**
     * Get default post actions
     * @param {boolean} isOwn - Whether the post belongs to current user
     * @returns {Array}
     */
    function getPostActions(isOwn = false) {
        const actions = [
            { icon: '📋', label: 'Copier le texte', action: 'copy' },
            { icon: '🔗', label: 'Partager', action: 'share' },
            { icon: '⭐', label: 'Ajouter aux favoris', action: 'bookmark' },
        ];
        
        if (isOwn) {
            actions.push({ divider: true });
            actions.push({ icon: '✏️', label: 'Modifier', action: 'edit' });
            actions.push({ icon: '🗑️', label: 'Supprimer', action: 'delete', destructive: true });
        } else {
            actions.push({ divider: true });
            actions.push({ icon: '🚩', label: 'Signaler', action: 'report' });
        }
        
        return actions;
    }
    
    /**
     * Get default message actions
     * @param {boolean} isOwn - Whether the message belongs to current user
     * @returns {Array}
     */
    function getMessageActions(isOwn = false) {
        const actions = [
            { icon: '↩️', label: 'Répondre', action: 'reply' },
            { icon: '📋', label: 'Copier', action: 'copy' },
        ];
        
        if (isOwn) {
            actions.push({ divider: true });
            actions.push({ icon: '🗑️', label: 'Supprimer', action: 'delete', destructive: true });
        }
        
        return actions;
    }
    
    // ============================================
    // Auto-initialization
    // ============================================
    
    /**
     * Initialize quick actions on posts
     */
    function initPosts() {
        enableAll('.post-card', (element) => {
            const postId = element.dataset.postId || element.id?.replace('post-', '');
            const authorName = element.querySelector('.post-author-name')?.textContent || 'Utilisateur';
            const content = element.querySelector('.post-content')?.textContent || '';
            const avatar = element.querySelector('.post-avatar')?.textContent || authorName.charAt(0).toUpperCase();
            const isOwn = element.querySelector('.you-badge') !== null || element.dataset.own === 'true';
            
            return {
                type: 'post',
                author: authorName.replace(' (toi)', ''),
                preview: content,
                avatar: avatar,
                isOwn: isOwn,
                actions: getPostActions(isOwn),
                context: {
                    id: postId,
                    content: content,
                    author: authorName
                }
            };
        });
    }
    
    /**
     * Initialize quick actions on messages
     */
    function initMessages() {
        enableAll('.message', (element) => {
            const msgId = element.id?.replace('msg-', '') || element.dataset.msgId;
            const content = element.querySelector('.message-text, p')?.textContent || '';
            const isOwn = element.classList.contains('text-right') || element.dataset.mine === 'true';
            
            return {
                type: 'message',
                preview: content,
                isOwn: isOwn,
                reactions: false, // Messages use different reaction system
                actions: getMessageActions(isOwn),
                context: {
                    id: msgId,
                    content: content,
                    isOwn: isOwn
                }
            };
        });
    }
    
    /**
     * Initialize on DOM ready
     */
    function init() {
        // Check for touch support
        const isTouchDevice = ('ontouchstart' in window) || 
                              (navigator.maxTouchPoints > 0) || 
                              (navigator.msMaxTouchPoints > 0);
        
        if (!isTouchDevice) {
            // On desktop, only use right-click context menu
            CONFIG.longPressDuration = 0; // Disable long press
        }
        
        // Initialize if posts exist
        if (document.querySelector('.post-card')) {
            initPosts();
        }
        
        // Initialize if messages exist
        if (document.querySelector('.message')) {
            initMessages();
        }
        
        // Listen for dynamic content
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    
                    if (node.classList?.contains('post-card')) {
                        enable(node, getPostOptionsForElement);
                    } else if (node.classList?.contains('message')) {
                        enable(node, getMessageOptionsForElement);
                    }
                    
                    // Check children
                    node.querySelectorAll?.('.post-card, .message').forEach(el => {
                        if (el.classList.contains('post-card')) {
                            enable(el, getPostOptionsForElement);
                        } else {
                            enable(el, getMessageOptionsForElement);
                        }
                    });
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    /**
     * Get post options for dynamically added elements
     */
    function getPostOptionsForElement(element) {
        const postId = element.dataset.postId || element.id?.replace('post-', '');
        const authorName = element.querySelector('.post-author-name')?.textContent || 'Utilisateur';
        const content = element.querySelector('.post-content')?.textContent || '';
        const avatar = element.querySelector('.post-avatar')?.textContent || authorName.charAt(0).toUpperCase();
        const isOwn = element.querySelector('.you-badge') !== null || element.dataset.own === 'true';
        
        return {
            type: 'post',
            author: authorName.replace(' (toi)', ''),
            preview: content,
            avatar: avatar,
            isOwn: isOwn,
            actions: getPostActions(isOwn),
            context: { id: postId, content, author: authorName }
        };
    }
    
    /**
     * Get message options for dynamically added elements
     */
    function getMessageOptionsForElement(element) {
        const msgId = element.id?.replace('msg-', '') || element.dataset.msgId;
        const content = element.querySelector('.message-text, p')?.textContent || '';
        const isOwn = element.classList.contains('text-right') || element.dataset.mine === 'true';
        
        return {
            type: 'message',
            preview: content,
            isOwn: isOwn,
            reactions: false,
            actions: getMessageActions(isOwn),
            context: { id: msgId, content, isOwn }
        };
    }
    
    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ============================================
    // Public API
    // ============================================
    
    return {
        /** Show context menu */
        show,
        /** Hide context menu */
        hide,
        /** Enable long press on element */
        enable,
        /** Enable long press on all matching elements */
        enableAll,
        /** Initialize posts */
        initPosts,
        /** Initialize messages */
        initMessages,
        /** Get post actions configuration */
        getPostActions,
        /** Get message actions configuration */
        getMessageActions,
        /** Configuration */
        config: CONFIG
    };
    
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickActions;
}

// Attach to window
window.QuickActions = QuickActions;
