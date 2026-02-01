/**
 * ==========================================================================
 * CINQ - Message Search Module
 * ==========================================================================
 * 
 * Search through message history within a chat conversation.
 * Features:
 * - Real-time search as you type
 * - Highlight matching text in messages
 * - Navigate between results (prev/next)
 * - Keyboard shortcuts support
 * - Scroll to matched message
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * CinqMessageSearch - Message search module
 */
const CinqMessageSearch = (function() {
    
    // ============================================
    // State
    // ============================================
    
    /** @type {boolean} Search panel visibility */
    let isOpen = false;
    
    /** @type {string} Current search query */
    let searchQuery = '';
    
    /** @type {Array<{messageId: string, element: HTMLElement, matches: Array}>} Search results */
    let searchResults = [];
    
    /** @type {number} Current result index (0-based) */
    let currentIndex = -1;
    
    /** @type {number} Debounce timer */
    let searchTimer = null;
    
    /** @type {Map<string, string>} Original message content cache */
    const originalContent = new Map();
    
    // ============================================
    // DOM References
    // ============================================
    
    const getElements = () => ({
        panel: document.getElementById('message-search-panel'),
        input: document.getElementById('message-search-input'),
        clearBtn: document.getElementById('message-search-clear'),
        countEl: document.getElementById('message-search-result-count'),
        positionEl: document.getElementById('message-search-position'),
        prevBtn: document.getElementById('message-search-prev'),
        nextBtn: document.getElementById('message-search-next'),
        searchBtn: document.getElementById('chat-search-btn'),
        messagesContainer: document.getElementById('chat-messages')
    });
    
    // ============================================
    // Core Functions
    // ============================================
    
    /**
     * Initialize the message search module
     */
    function init() {
        bindEvents();
        bindKeyboardShortcuts();
    }
    
    /**
     * Open the search panel
     */
    function open() {
        const { panel, input, searchBtn } = getElements();
        if (!panel) return;
        
        isOpen = true;
        panel.classList.add('visible');
        searchBtn?.classList.add('active');
        
        // Focus input after animation
        setTimeout(() => {
            input?.focus();
        }, 50);
        
        // Announce for screen readers
        announceToScreenReader('Recherche de messages ouverte');
    }
    
    /**
     * Close the search panel
     */
    function close() {
        const { panel, input, searchBtn } = getElements();
        if (!panel) return;
        
        isOpen = false;
        panel.classList.remove('visible');
        searchBtn?.classList.remove('active');
        
        // Clear search
        clearSearch();
        if (input) input.value = '';
        
        // Announce for screen readers
        announceToScreenReader('Recherche fermée');
    }
    
    /**
     * Toggle the search panel
     */
    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }
    
    /**
     * Perform search with debouncing
     * @param {string} query - Search query
     */
    function search(query) {
        clearTimeout(searchTimer);
        
        searchQuery = query.trim().toLowerCase();
        
        if (searchQuery.length < 2) {
            clearSearch();
            updateUI();
            return;
        }
        
        // Debounce for performance
        searchTimer = setTimeout(() => {
            performSearch();
        }, 150);
    }
    
    /**
     * Execute the actual search
     */
    function performSearch() {
        const { messagesContainer } = getElements();
        if (!messagesContainer) return;
        
        // Clear previous results
        clearHighlights();
        searchResults = [];
        currentIndex = -1;
        
        // Find all message bubbles
        const messageBubbles = messagesContainer.querySelectorAll('.message-bubble, .msg-content');
        
        messageBubbles.forEach((bubble) => {
            const messageEl = bubble.closest('.message-row, .message');
            if (!messageEl) return;
            
            const messageId = messageEl.id || messageEl.dataset.id || generateTempId();
            messageEl.id = messageId;
            
            // Get text content
            const contentEl = bubble.querySelector('.msg-text, .message-text') || bubble;
            const originalText = contentEl.textContent || contentEl.innerText || '';
            
            // Store original content for restoration
            if (!originalContent.has(messageId)) {
                originalContent.set(messageId, contentEl.innerHTML);
            }
            
            // Check for matches
            const lowerText = originalText.toLowerCase();
            const matchIndices = findAllOccurrences(lowerText, searchQuery);
            
            if (matchIndices.length > 0) {
                searchResults.push({
                    messageId,
                    element: messageEl,
                    contentEl,
                    originalText,
                    matches: matchIndices
                });
                
                // Highlight matches in this message
                highlightMatches(contentEl, originalText, matchIndices);
                bubble.classList.add('has-search-match');
            }
        });
        
        // Navigate to first result if found
        if (searchResults.length > 0) {
            navigateTo(0);
        }
        
        updateUI();
        
        // Announce results
        if (searchResults.length === 0) {
            announceToScreenReader(`Aucun résultat pour "${searchQuery}"`);
        } else {
            announceToScreenReader(`${searchResults.length} résultat${searchResults.length > 1 ? 's' : ''} trouvé${searchResults.length > 1 ? 's' : ''}`);
        }
    }
    
    /**
     * Find all occurrences of a substring in text
     * @param {string} text - Text to search in
     * @param {string} query - Query to find
     * @returns {Array<{start: number, end: number}>} Match positions
     */
    function findAllOccurrences(text, query) {
        const matches = [];
        let pos = 0;
        
        while ((pos = text.indexOf(query, pos)) !== -1) {
            matches.push({
                start: pos,
                end: pos + query.length
            });
            pos += 1;
        }
        
        return matches;
    }
    
    /**
     * Highlight matches in a content element
     * @param {HTMLElement} el - Element to highlight in
     * @param {string} originalText - Original text content
     * @param {Array} matches - Match positions
     */
    function highlightMatches(el, originalText, matches) {
        if (matches.length === 0) return;
        
        // Build highlighted HTML
        let html = '';
        let lastIndex = 0;
        
        matches.forEach((match, idx) => {
            // Add text before match
            html += escapeHtml(originalText.substring(lastIndex, match.start));
            // Add highlighted match
            const matchText = originalText.substring(match.start, match.end);
            html += `<mark class="message-search-highlight" data-match-index="${idx}">${escapeHtml(matchText)}</mark>`;
            lastIndex = match.end;
        });
        
        // Add remaining text
        html += escapeHtml(originalText.substring(lastIndex));
        
        el.innerHTML = html;
    }
    
    /**
     * Navigate to a specific result
     * @param {number} index - Result index
     */
    function navigateTo(index) {
        if (searchResults.length === 0) return;
        
        // Clear current highlight
        if (currentIndex >= 0 && currentIndex < searchResults.length) {
            const prevResult = searchResults[currentIndex];
            prevResult.element.classList.remove('current-match');
            const prevHighlights = prevResult.element.querySelectorAll('.message-search-highlight.current');
            prevHighlights.forEach(h => h.classList.remove('current'));
        }
        
        // Update index with wrapping
        currentIndex = ((index % searchResults.length) + searchResults.length) % searchResults.length;
        
        // Highlight current result
        const result = searchResults[currentIndex];
        result.element.classList.add('current-match');
        
        // Mark first highlight in this message as current
        const highlight = result.element.querySelector('.message-search-highlight');
        if (highlight) {
            highlight.classList.add('current');
        }
        
        // Scroll into view
        result.element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
        });
        
        updateUI();
    }
    
    /**
     * Navigate to previous result
     */
    function prev() {
        if (searchResults.length > 0) {
            navigateTo(currentIndex - 1);
        }
    }
    
    /**
     * Navigate to next result
     */
    function next() {
        if (searchResults.length > 0) {
            navigateTo(currentIndex + 1);
        }
    }
    
    /**
     * Clear all search highlights and restore original content
     */
    function clearHighlights() {
        const { messagesContainer } = getElements();
        if (!messagesContainer) return;
        
        // Remove highlight classes
        messagesContainer.querySelectorAll('.has-search-match, .current-match').forEach(el => {
            el.classList.remove('has-search-match', 'current-match');
        });
        
        // Restore original content
        searchResults.forEach(result => {
            const originalHtml = originalContent.get(result.messageId);
            if (originalHtml && result.contentEl) {
                result.contentEl.innerHTML = originalHtml;
            }
        });
    }
    
    /**
     * Clear search state
     */
    function clearSearch() {
        clearHighlights();
        searchResults = [];
        currentIndex = -1;
        searchQuery = '';
    }
    
    /**
     * Update the UI with current state
     */
    function updateUI() {
        const { countEl, positionEl, prevBtn, nextBtn } = getElements();
        
        if (countEl) {
            if (searchQuery.length < 2) {
                countEl.innerHTML = '';
            } else if (searchResults.length === 0) {
                countEl.innerHTML = '<span class="message-search-empty-text">Aucun résultat</span>';
            } else {
                countEl.innerHTML = `<strong>${searchResults.length}</strong> message${searchResults.length > 1 ? 's' : ''}`;
            }
        }
        
        if (positionEl) {
            if (searchResults.length > 0 && currentIndex >= 0) {
                positionEl.textContent = `${currentIndex + 1} / ${searchResults.length}`;
            } else {
                positionEl.textContent = '';
            }
        }
        
        // Update nav button states
        const hasResults = searchResults.length > 0;
        if (prevBtn) prevBtn.disabled = !hasResults;
        if (nextBtn) nextBtn.disabled = !hasResults;
    }
    
    // ============================================
    // Event Handlers
    // ============================================
    
    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Use event delegation for dynamic elements
        document.addEventListener('click', (e) => {
            // Search button
            if (e.target.closest('#chat-search-btn')) {
                toggle();
                return;
            }
            
            // Clear button
            if (e.target.closest('#message-search-clear')) {
                const { input } = getElements();
                if (input) {
                    input.value = '';
                    input.focus();
                }
                clearSearch();
                updateUI();
                return;
            }
            
            // Previous button
            if (e.target.closest('#message-search-prev')) {
                prev();
                return;
            }
            
            // Next button
            if (e.target.closest('#message-search-next')) {
                next();
                return;
            }
        });
        
        // Input handling
        document.addEventListener('input', (e) => {
            if (e.target.id === 'message-search-input') {
                search(e.target.value);
            }
        });
        
        // Keyboard navigation in input
        document.addEventListener('keydown', (e) => {
            if (e.target.id === 'message-search-input') {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) {
                        prev();
                    } else {
                        next();
                    }
                } else if (e.key === 'Escape') {
                    close();
                }
            }
        });
    }
    
    /**
     * Bind global keyboard shortcuts
     */
    function bindKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + F to open search (when chat is open)
            if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                const chatPanel = document.getElementById('chat-panel');
                if (chatPanel && !chatPanel.hasAttribute('aria-hidden')) {
                    e.preventDefault();
                    open();
                }
            }
            
            // F3 or Ctrl+G for next result
            if (e.key === 'F3' || ((e.ctrlKey || e.metaKey) && e.key === 'g')) {
                if (isOpen && searchResults.length > 0) {
                    e.preventDefault();
                    if (e.shiftKey) {
                        prev();
                    } else {
                        next();
                    }
                }
            }
        });
    }
    
    // ============================================
    // Utilities
    // ============================================
    
    /**
     * Escape HTML special characters
     * @param {string} str - String to escape
     * @returns {string} Escaped string
     */
    function escapeHtml(str) {
        if (window.Cinq && window.Cinq.escapeHtml) {
            return window.Cinq.escapeHtml(str);
        }
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    
    /**
     * Generate a temporary unique ID
     * @returns {string} Unique ID
     */
    function generateTempId() {
        return 'msg-search-' + Math.random().toString(36).substring(2, 11);
    }
    
    /**
     * Announce message for screen readers
     * @param {string} message - Message to announce
     */
    function announceToScreenReader(message) {
        if (window.Cinq && window.Cinq.announce) {
            window.Cinq.announce(message);
        } else {
            // Fallback: create live region
            let liveRegion = document.getElementById('sr-announcer');
            if (!liveRegion) {
                liveRegion = document.createElement('div');
                liveRegion.id = 'sr-announcer';
                liveRegion.setAttribute('aria-live', 'polite');
                liveRegion.setAttribute('aria-atomic', 'true');
                liveRegion.className = 'sr-only';
                document.body.appendChild(liveRegion);
            }
            liveRegion.textContent = message;
        }
    }
    
    /**
     * Refresh search when messages change
     * Call this after new messages are loaded/added
     */
    function refresh() {
        if (isOpen && searchQuery.length >= 2) {
            // Clear cache for updated content
            originalContent.clear();
            performSearch();
        }
    }
    
    /**
     * Reset when chat changes
     */
    function reset() {
        close();
        originalContent.clear();
    }
    
    // ============================================
    // Initialize
    // ============================================
    
    // Auto-init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ============================================
    // Public API
    // ============================================
    
    return {
        open,
        close,
        toggle,
        search,
        prev,
        next,
        refresh,
        reset,
        isOpen: () => isOpen,
        getResultCount: () => searchResults.length,
        getCurrentIndex: () => currentIndex
    };
    
})();

// Expose globally
window.CinqMessageSearch = CinqMessageSearch;
