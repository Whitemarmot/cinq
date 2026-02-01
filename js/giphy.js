/**
 * ==========================================================================
 * CINQ - GIPHY Integration Module
 * ==========================================================================
 * 
 * Provides GIF search, preview, and selection functionality
 * Uses GIPHY API through our proxy endpoint
 * 
 * Features:
 * - GIF search with debounce
 * - Trending GIFs
 * - Preview on hover
 * - Infinite scroll
 * - Keyboard navigation
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

const CinqGiphy = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const API_ENDPOINT = '/.netlify/functions/giphy';
    const DEBOUNCE_MS = 300;
    const PAGE_SIZE = 20;
    const PREVIEW_DELAY = 200;
    
    // ============================================
    // State
    // ============================================
    
    let currentPicker = null;
    let searchTimeout = null;
    let currentOffset = 0;
    let isLoading = false;
    let hasMore = true;
    let currentQuery = '';
    let previewTimeout = null;
    let selectedCallback = null;
    
    // ============================================
    // Utilities
    // ============================================
    
    const { getAccessToken, escapeHtml } = window.Cinq || {};
    
    /**
     * Fetch GIFs from API
     */
    async function fetchGifs(params = {}) {
        const token = await getAccessToken?.();
        if (!token) {
            console.error('[Giphy] No auth token');
            return { gifs: [], pagination: { total: 0 } };
        }
        
        const url = new URL(API_ENDPOINT, window.location.origin);
        Object.entries(params).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
                url.searchParams.append(key, val);
            }
        });
        
        try {
            const response = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return await response.json();
        } catch (err) {
            console.error('[Giphy] Fetch error:', err);
            return { gifs: [], pagination: { total: 0 } };
        }
    }
    
    // ============================================
    // Picker UI
    // ============================================
    
    /**
     * Create the GIF picker element
     */
    function createPickerElement() {
        const picker = document.createElement('div');
        picker.className = 'giphy-picker';
        picker.innerHTML = `
            <div class="giphy-picker-content">
                <div class="giphy-picker-header">
                    <div class="giphy-search-container">
                        <svg class="giphy-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" 
                               class="giphy-search-input" 
                               placeholder="Rechercher des GIFs..."
                               autocomplete="off"
                               spellcheck="false">
                        <button class="giphy-search-clear hidden" aria-label="Effacer">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <button class="giphy-close-btn" aria-label="Fermer">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                
                <div class="giphy-tabs">
                    <button class="giphy-tab active" data-tab="trending">🔥 Tendances</button>
                    <button class="giphy-tab" data-tab="search">🔍 Recherche</button>
                </div>
                
                <div class="giphy-grid-container">
                    <div class="giphy-grid" role="listbox" aria-label="GIFs">
                        <!-- GIFs will be rendered here -->
                    </div>
                    <div class="giphy-loading hidden">
                        <div class="giphy-spinner"></div>
                        <span>Chargement...</span>
                    </div>
                    <div class="giphy-empty hidden">
                        <span class="giphy-empty-icon">🔍</span>
                        <p>Aucun GIF trouvé</p>
                        <p class="giphy-empty-hint">Essaie un autre terme de recherche</p>
                    </div>
                </div>
                
                <div class="giphy-footer">
                    <img src="https://media.giphy.com/media/2hfsBRaIUMJW6MH4Q9/giphy.gif" 
                         alt="Powered by GIPHY" 
                         class="giphy-attribution"
                         loading="lazy">
                </div>
            </div>
            
            <div class="giphy-preview hidden">
                <img src="" alt="Aperçu GIF" class="giphy-preview-img">
            </div>
        `;
        
        return picker;
    }
    
    /**
     * Initialize picker event handlers
     */
    function initPickerEvents(picker, onSelect) {
        const searchInput = picker.querySelector('.giphy-search-input');
        const searchClear = picker.querySelector('.giphy-search-clear');
        const closeBtn = picker.querySelector('.giphy-close-btn');
        const grid = picker.querySelector('.giphy-grid');
        const gridContainer = picker.querySelector('.giphy-grid-container');
        const tabs = picker.querySelectorAll('.giphy-tab');
        const previewEl = picker.querySelector('.giphy-preview');
        const previewImg = picker.querySelector('.giphy-preview-img');
        
        // Close button
        closeBtn.addEventListener('click', () => closePicker());
        
        // Click outside to close
        picker.addEventListener('click', (e) => {
            if (e.target === picker) closePicker();
        });
        
        // Escape to close
        const handleKeydown = (e) => {
            if (e.key === 'Escape') closePicker();
        };
        document.addEventListener('keydown', handleKeydown);
        picker._cleanup = () => document.removeEventListener('keydown', handleKeydown);
        
        // Search input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            searchClear.classList.toggle('hidden', !query);
            
            // Switch to search tab if typing
            if (query) {
                tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'search'));
            }
            
            // Debounced search
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (query) {
                    searchGifs(query, picker);
                } else {
                    loadTrending(picker);
                }
            }, DEBOUNCE_MS);
        });
        
        // Clear search
        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.classList.add('hidden');
            searchInput.focus();
            loadTrending(picker);
            tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'trending'));
        });
        
        // Tabs
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                if (tab.dataset.tab === 'trending') {
                    searchInput.value = '';
                    searchClear.classList.add('hidden');
                    loadTrending(picker);
                } else {
                    searchInput.focus();
                    if (searchInput.value.trim()) {
                        searchGifs(searchInput.value.trim(), picker);
                    }
                }
            });
        });
        
        // Infinite scroll
        gridContainer.addEventListener('scroll', () => {
            if (isLoading || !hasMore) return;
            
            const { scrollTop, scrollHeight, clientHeight } = gridContainer;
            if (scrollHeight - scrollTop - clientHeight < 200) {
                loadMore(picker);
            }
        });
        
        // GIF selection
        grid.addEventListener('click', (e) => {
            const gifItem = e.target.closest('.giphy-item');
            if (gifItem) {
                const gifData = JSON.parse(gifItem.dataset.gif);
                onSelect(gifData);
                closePicker();
            }
        });
        
        // Preview on hover
        grid.addEventListener('mouseover', (e) => {
            const gifItem = e.target.closest('.giphy-item');
            if (gifItem) {
                clearTimeout(previewTimeout);
                previewTimeout = setTimeout(() => {
                    const gifData = JSON.parse(gifItem.dataset.gif);
                    previewImg.src = gifData.images.standard.url;
                    previewEl.classList.remove('hidden');
                    
                    // Position preview
                    const rect = gifItem.getBoundingClientRect();
                    const pickerRect = picker.getBoundingClientRect();
                    previewEl.style.left = `${rect.right - pickerRect.left + 10}px`;
                    previewEl.style.top = `${rect.top - pickerRect.top}px`;
                }, PREVIEW_DELAY);
            }
        });
        
        grid.addEventListener('mouseout', (e) => {
            const gifItem = e.target.closest('.giphy-item');
            if (gifItem || e.relatedTarget?.closest('.giphy-preview')) {
                clearTimeout(previewTimeout);
                previewEl.classList.add('hidden');
            }
        });
    }
    
    /**
     * Render GIFs in grid
     */
    function renderGifs(gifs, picker, append = false) {
        const grid = picker.querySelector('.giphy-grid');
        const empty = picker.querySelector('.giphy-empty');
        const loading = picker.querySelector('.giphy-loading');
        
        loading.classList.add('hidden');
        
        if (!append) {
            grid.innerHTML = '';
        }
        
        if (gifs.length === 0 && !append) {
            empty.classList.remove('hidden');
            return;
        }
        
        empty.classList.add('hidden');
        
        const fragment = document.createDocumentFragment();
        
        gifs.forEach(gif => {
            const item = document.createElement('div');
            item.className = 'giphy-item';
            item.role = 'option';
            item.tabIndex = 0;
            item.dataset.gif = JSON.stringify(gif);
            item.innerHTML = `
                <img src="${escapeHtml(gif.images.preview.url)}" 
                     alt="${escapeHtml(gif.title)}"
                     loading="lazy"
                     width="${gif.images.preview.width}"
                     height="${gif.images.preview.height}">
            `;
            fragment.appendChild(item);
        });
        
        grid.appendChild(fragment);
    }
    
    /**
     * Show loading state
     */
    function showLoading(picker) {
        const loading = picker.querySelector('.giphy-loading');
        const empty = picker.querySelector('.giphy-empty');
        loading.classList.remove('hidden');
        empty.classList.add('hidden');
        isLoading = true;
    }
    
    /**
     * Load trending GIFs
     */
    async function loadTrending(picker) {
        currentQuery = '';
        currentOffset = 0;
        hasMore = true;
        
        showLoading(picker);
        
        const result = await fetchGifs({ trending: '1', limit: PAGE_SIZE, offset: 0 });
        
        isLoading = false;
        hasMore = result.gifs?.length === PAGE_SIZE;
        
        renderGifs(result.gifs || [], picker);
    }
    
    /**
     * Search GIFs
     */
    async function searchGifs(query, picker) {
        currentQuery = query;
        currentOffset = 0;
        hasMore = true;
        
        showLoading(picker);
        
        const result = await fetchGifs({ q: query, limit: PAGE_SIZE, offset: 0 });
        
        isLoading = false;
        hasMore = result.gifs?.length === PAGE_SIZE;
        
        renderGifs(result.gifs || [], picker);
    }
    
    /**
     * Load more GIFs (infinite scroll)
     */
    async function loadMore(picker) {
        if (isLoading || !hasMore) return;
        
        currentOffset += PAGE_SIZE;
        isLoading = true;
        
        const params = currentQuery 
            ? { q: currentQuery, limit: PAGE_SIZE, offset: currentOffset }
            : { trending: '1', limit: PAGE_SIZE, offset: currentOffset };
        
        const result = await fetchGifs(params);
        
        isLoading = false;
        hasMore = result.gifs?.length === PAGE_SIZE;
        
        if (result.gifs?.length) {
            renderGifs(result.gifs, picker, true);
        }
    }
    
    // ============================================
    // Public API
    // ============================================
    
    /**
     * Open GIF picker
     * @param {Function} onSelect - Callback when GIF is selected
     * @param {HTMLElement} anchorEl - Element to position picker near (optional)
     */
    function openPicker(onSelect, anchorEl = null) {
        // Close existing picker
        if (currentPicker) {
            closePicker();
        }
        
        selectedCallback = onSelect;
        currentPicker = createPickerElement();
        
        // Position picker
        if (anchorEl) {
            const rect = anchorEl.getBoundingClientRect();
            currentPicker.style.setProperty('--anchor-top', `${rect.bottom + 8}px`);
            currentPicker.style.setProperty('--anchor-left', `${rect.left}px`);
        }
        
        document.body.appendChild(currentPicker);
        
        // Prevent body scroll
        document.body.style.overflow = 'hidden';
        
        // Init events
        initPickerEvents(currentPicker, onSelect);
        
        // Load trending
        loadTrending(currentPicker);
        
        // Focus search
        requestAnimationFrame(() => {
            currentPicker.querySelector('.giphy-search-input')?.focus();
        });
        
        return currentPicker;
    }
    
    /**
     * Close GIF picker
     */
    function closePicker() {
        if (!currentPicker) return;
        
        // Cleanup
        currentPicker._cleanup?.();
        currentPicker.remove();
        currentPicker = null;
        selectedCallback = null;
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        // Reset state
        currentQuery = '';
        currentOffset = 0;
        hasMore = true;
        isLoading = false;
        clearTimeout(searchTimeout);
        clearTimeout(previewTimeout);
    }
    
    /**
     * Check if picker is open
     */
    function isOpen() {
        return currentPicker !== null;
    }
    
    /**
     * Create GIF button for composer/chat
     * @param {Function} onSelect - Callback when GIF is selected
     * @returns {HTMLElement}
     */
    function createGifButton(onSelect) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'giphy-trigger-btn';
        btn.innerHTML = `
            <span class="giphy-btn-text">GIF</span>
        `;
        btn.title = 'Ajouter un GIF';
        btn.setAttribute('aria-label', 'Ajouter un GIF');
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (isOpen()) {
                closePicker();
            } else {
                openPicker(onSelect, btn);
            }
        });
        
        return btn;
    }
    
    /**
     * Create GIF preview element for display
     * @param {Object} gif - GIF data object
     * @param {Object} options - Display options
     * @returns {HTMLElement}
     */
    function createGifPreview(gif, options = {}) {
        const { removable = true, size = 'standard' } = options;
        
        const preview = document.createElement('div');
        preview.className = 'giphy-selected-preview';
        preview.dataset.gifUrl = gif.images[size]?.url || gif.images.standard.url;
        preview.dataset.gifId = gif.id;
        
        preview.innerHTML = `
            <img src="${escapeHtml(gif.images[size]?.url || gif.images.standard.url)}" 
                 alt="${escapeHtml(gif.title)}"
                 class="giphy-selected-img"
                 loading="lazy">
            ${removable ? `
                <button type="button" class="giphy-preview-remove" aria-label="Retirer le GIF">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            ` : ''}
            <span class="giphy-badge">GIF</span>
        `;
        
        if (removable) {
            preview.querySelector('.giphy-preview-remove').addEventListener('click', () => {
                preview.remove();
                // Dispatch custom event
                preview.dispatchEvent(new CustomEvent('gif-removed', { bubbles: true }));
            });
        }
        
        return preview;
    }
    
    /**
     * Render a GIF in a message/post
     * @param {string} gifUrl - GIF URL
     * @param {string} gifId - GIF ID (optional)
     * @returns {string} HTML string
     */
    function renderGifInContent(gifUrl, gifId = '') {
        return `
            <div class="giphy-content-gif" ${gifId ? `data-gif-id="${escapeHtml(gifId)}"` : ''}>
                <img src="${escapeHtml(gifUrl)}" 
                     alt="GIF" 
                     class="giphy-content-img"
                     loading="lazy">
                <span class="giphy-badge">GIF</span>
            </div>
        `;
    }
    
    // ============================================
    // Export
    // ============================================
    
    return {
        openPicker,
        closePicker,
        isOpen,
        createGifButton,
        createGifPreview,
        renderGifInContent,
        fetchGifs
    };
    
})();

// Export to window
window.CinqGiphy = CinqGiphy;
