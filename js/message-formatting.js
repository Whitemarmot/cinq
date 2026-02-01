/**
 * ==========================================================================
 * CINQ - Message Formatting System
 * ==========================================================================
 * 
 * Advanced text formatting for posts:
 * - Text sizes (small, normal, large, huge)
 * - Text colors (12 color palette)
 * - Text alignment (left, center, right)
 * 
 * The formatting is stored as JSON metadata in the post and applied
 * via CSS classes when rendering.
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

const CinqFormatting = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const SIZES = ['small', 'normal', 'large', 'huge'];
    const COLORS = ['default', 'brand', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'indigo', 'purple', 'pink', 'rose'];
    const ALIGNMENTS = ['left', 'center', 'right'];
    
    // Default formatting
    const DEFAULT_FORMAT = {
        size: 'normal',
        color: 'default',
        align: 'left'
    };
    
    // ============================================
    // State
    // ============================================
    
    let currentFormat = { ...DEFAULT_FORMAT };
    let toolbarVisible = false;
    let colorPaletteOpen = false;
    
    // ============================================
    // DOM References
    // ============================================
    
    let toolbar = null;
    let textarea = null;
    let toggleBtn = null;
    let colorPalette = null;
    let formatDataInput = null;
    
    // ============================================
    // Initialization
    // ============================================
    
    /**
     * Initialize the formatting system
     * Should be called after DOM is ready
     */
    function init() {
        // Find composer textarea
        textarea = document.getElementById('post-content');
        if (!textarea) {
            console.warn('[CinqFormatting] Composer textarea not found');
            return;
        }
        
        // Create hidden input for format data
        createFormatDataInput();
        
        // Create toolbar
        createToolbar();
        
        // Create toggle button
        createToggleButton();
        
        // Setup event listeners
        setupEventListeners();
        
        // Apply default format to textarea
        applyFormatToTextarea();
        
        console.log('[CinqFormatting] Initialized');
    }
    
    /**
     * Create hidden input to store format data
     */
    function createFormatDataInput() {
        formatDataInput = document.createElement('input');
        formatDataInput.type = 'hidden';
        formatDataInput.id = 'post-format-data';
        formatDataInput.name = 'format';
        formatDataInput.value = JSON.stringify(DEFAULT_FORMAT);
        textarea.parentNode.insertBefore(formatDataInput, textarea);
    }
    
    /**
     * Create the formatting toolbar
     */
    function createToolbar() {
        toolbar = document.createElement('div');
        toolbar.className = 'formatting-toolbar';
        toolbar.id = 'formatting-toolbar';
        toolbar.setAttribute('role', 'toolbar');
        toolbar.setAttribute('aria-label', 'Options de formatage du texte');
        toolbar.style.display = 'none';
        
        toolbar.innerHTML = `
            <!-- Size Group -->
            <div class="formatting-group" role="group" aria-label="Taille du texte">
                <span class="formatting-label">Taille</span>
                <button type="button" class="formatting-btn" data-size="small" data-action="size" title="Petit texte" aria-label="Petit texte">
                    <span style="font-size:10px">A</span>
                </button>
                <button type="button" class="formatting-btn active" data-size="normal" data-action="size" title="Texte normal" aria-label="Texte normal">
                    <span style="font-size:12px">A</span>
                </button>
                <button type="button" class="formatting-btn" data-size="large" data-action="size" title="Grand texte" aria-label="Grand texte">
                    <span style="font-size:14px">A</span>
                </button>
                <button type="button" class="formatting-btn" data-size="huge" data-action="size" title="Très grand texte" aria-label="Très grand texte">
                    <span style="font-size:16px;font-weight:700">A</span>
                </button>
            </div>
            
            <!-- Color Group -->
            <div class="formatting-group" role="group" aria-label="Couleur du texte">
                <span class="formatting-label">Couleur</span>
                <div class="color-picker-dropdown">
                    <button type="button" class="color-btn" id="color-picker-btn" title="Choisir une couleur" aria-label="Choisir une couleur" aria-haspopup="true" aria-expanded="false">
                        <span class="formatting-sr-only">Couleur actuelle: par défaut</span>
                    </button>
                    <div class="color-palette" id="color-palette" role="listbox" aria-label="Palette de couleurs">
                        ${COLORS.map(color => `
                            <button type="button" class="color-swatch ${color === 'default' ? 'active' : ''}" 
                                    data-color="${color}" 
                                    data-action="color" 
                                    role="option"
                                    aria-selected="${color === 'default'}"
                                    title="${getColorName(color)}"
                                    aria-label="${getColorName(color)}">
                            </button>
                        `).join('')}
                    </div>
                </div>
            </div>
            
            <!-- Alignment Group -->
            <div class="formatting-group" role="group" aria-label="Alignement du texte">
                <span class="formatting-label">Align</span>
                <button type="button" class="formatting-btn active" data-align="left" data-action="align" title="Aligner à gauche" aria-label="Aligner à gauche">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>
                    </svg>
                </button>
                <button type="button" class="formatting-btn" data-align="center" data-action="align" title="Centrer" aria-label="Centrer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>
                    </svg>
                </button>
                <button type="button" class="formatting-btn" data-align="right" data-action="align" title="Aligner à droite" aria-label="Aligner à droite">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>
                    </svg>
                </button>
            </div>
            
            <!-- Reset Button -->
            <div class="formatting-group">
                <button type="button" class="formatting-btn" data-action="reset" title="Réinitialiser le formatage" aria-label="Réinitialiser le formatage">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                    </svg>
                </button>
            </div>
        `;
        
        // Insert before textarea
        textarea.parentNode.insertBefore(toolbar, textarea);
    }
    
    /**
     * Create toggle button for toolbar
     */
    function createToggleButton() {
        const composerActions = document.querySelector('.composer-actions');
        if (!composerActions) return;
        
        toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'composer-btn formatting-toggle-btn';
        toggleBtn.id = 'formatting-toggle';
        toggleBtn.setAttribute('aria-label', 'Ouvrir les options de formatage');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-controls', 'formatting-toolbar');
        
        toggleBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 7V4h16v3"/>
                <path d="M9 20h6"/>
                <path d="M12 4v16"/>
            </svg>
            <span>Format</span>
        `;
        
        // Insert after photo button
        const photoBtn = composerActions.querySelector('.composer-btn');
        if (photoBtn && photoBtn.nextSibling) {
            composerActions.insertBefore(toggleBtn, photoBtn.nextSibling);
        } else {
            composerActions.appendChild(toggleBtn);
        }
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Toggle button click
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleToolbar);
        }
        
        // Toolbar button clicks
        if (toolbar) {
            toolbar.addEventListener('click', handleToolbarClick);
        }
        
        // Color picker
        const colorPickerBtn = document.getElementById('color-picker-btn');
        if (colorPickerBtn) {
            colorPickerBtn.addEventListener('click', toggleColorPalette);
        }
        
        // Close color palette on outside click
        document.addEventListener('click', (e) => {
            if (colorPaletteOpen && !e.target.closest('.color-picker-dropdown')) {
                closeColorPalette();
            }
        });
        
        // Keyboard navigation
        if (toolbar) {
            toolbar.addEventListener('keydown', handleKeyboardNav);
        }
    }
    
    // ============================================
    // Toolbar Actions
    // ============================================
    
    /**
     * Toggle toolbar visibility
     */
    function toggleToolbar() {
        toolbarVisible = !toolbarVisible;
        
        if (toolbar) {
            toolbar.style.display = toolbarVisible ? 'flex' : 'none';
        }
        
        if (toggleBtn) {
            toggleBtn.classList.toggle('active', toolbarVisible);
            toggleBtn.setAttribute('aria-expanded', toolbarVisible);
        }
        
        if (textarea) {
            textarea.classList.toggle('has-formatting', toolbarVisible);
        }
        
        // Announce for screen readers
        if (window.announce) {
            window.announce(toolbarVisible ? 'Barre de formatage ouverte' : 'Barre de formatage fermée');
        }
    }
    
    /**
     * Handle toolbar button clicks
     */
    function handleToolbarClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        
        switch (action) {
            case 'size':
                setSize(btn.dataset.size);
                break;
            case 'color':
                setColor(btn.dataset.color);
                closeColorPalette();
                break;
            case 'align':
                setAlignment(btn.dataset.align);
                break;
            case 'reset':
                resetFormat();
                break;
        }
    }
    
    /**
     * Set text size
     */
    function setSize(size) {
        if (!SIZES.includes(size)) return;
        
        currentFormat.size = size;
        updateFormatData();
        updateToolbarState();
        applyFormatToTextarea();
        
        if (window.announce) {
            const sizeNames = { small: 'petit', normal: 'normal', large: 'grand', huge: 'très grand' };
            window.announce(`Taille de texte: ${sizeNames[size]}`);
        }
    }
    
    /**
     * Set text color
     */
    function setColor(color) {
        if (!COLORS.includes(color)) return;
        
        currentFormat.color = color;
        updateFormatData();
        updateToolbarState();
        applyFormatToTextarea();
        updateColorButton();
        
        if (window.announce) {
            window.announce(`Couleur de texte: ${getColorName(color)}`);
        }
    }
    
    /**
     * Set text alignment
     */
    function setAlignment(align) {
        if (!ALIGNMENTS.includes(align)) return;
        
        currentFormat.align = align;
        updateFormatData();
        updateToolbarState();
        applyFormatToTextarea();
        
        if (window.announce) {
            const alignNames = { left: 'gauche', center: 'centré', right: 'droite' };
            window.announce(`Alignement: ${alignNames[align]}`);
        }
    }
    
    /**
     * Reset format to defaults
     */
    function resetFormat() {
        currentFormat = { ...DEFAULT_FORMAT };
        updateFormatData();
        updateToolbarState();
        applyFormatToTextarea();
        updateColorButton();
        
        if (window.announce) {
            window.announce('Formatage réinitialisé');
        }
    }
    
    // ============================================
    // Color Palette
    // ============================================
    
    /**
     * Toggle color palette
     */
    function toggleColorPalette(e) {
        e.stopPropagation();
        colorPaletteOpen = !colorPaletteOpen;
        
        colorPalette = document.getElementById('color-palette');
        const colorBtn = document.getElementById('color-picker-btn');
        
        if (colorPalette) {
            colorPalette.classList.toggle('open', colorPaletteOpen);
        }
        
        if (colorBtn) {
            colorBtn.setAttribute('aria-expanded', colorPaletteOpen);
        }
    }
    
    /**
     * Close color palette
     */
    function closeColorPalette() {
        colorPaletteOpen = false;
        
        colorPalette = document.getElementById('color-palette');
        const colorBtn = document.getElementById('color-picker-btn');
        
        if (colorPalette) {
            colorPalette.classList.remove('open');
        }
        
        if (colorBtn) {
            colorBtn.setAttribute('aria-expanded', 'false');
        }
    }
    
    /**
     * Update color button appearance
     */
    function updateColorButton() {
        const colorBtn = document.getElementById('color-picker-btn');
        if (!colorBtn) return;
        
        // Update button color based on current selection
        const colorMap = {
            'default': 'var(--color-text-primary)',
            'brand': 'var(--color-brand)',
            'red': '#ef4444',
            'orange': '#f97316',
            'amber': '#f59e0b',
            'green': '#22c55e',
            'teal': '#14b8a6',
            'blue': '#3b82f6',
            'indigo': '#6366f1',
            'purple': '#a855f7',
            'pink': '#ec4899',
            'rose': '#f43f5e'
        };
        
        colorBtn.style.background = colorMap[currentFormat.color] || colorMap.default;
    }
    
    // ============================================
    // UI Updates
    // ============================================
    
    /**
     * Update hidden format data input
     */
    function updateFormatData() {
        if (formatDataInput) {
            formatDataInput.value = JSON.stringify(currentFormat);
        }
    }
    
    /**
     * Update toolbar button states
     */
    function updateToolbarState() {
        if (!toolbar) return;
        
        // Update size buttons
        toolbar.querySelectorAll('[data-action="size"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.size === currentFormat.size);
        });
        
        // Update color swatches
        toolbar.querySelectorAll('[data-action="color"]').forEach(btn => {
            const isActive = btn.dataset.color === currentFormat.color;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive);
        });
        
        // Update alignment buttons
        toolbar.querySelectorAll('[data-action="align"]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.align === currentFormat.align);
        });
    }
    
    /**
     * Apply current format to textarea for preview
     */
    function applyFormatToTextarea() {
        if (!textarea) return;
        
        // Remove all format classes
        SIZES.forEach(s => textarea.classList.remove(`text-${s}`));
        COLORS.forEach(c => textarea.classList.remove(`color-${c}`));
        ALIGNMENTS.forEach(a => textarea.classList.remove(`align-${a}`));
        
        // Apply current format
        textarea.classList.add(`text-${currentFormat.size}`);
        textarea.classList.add(`color-${currentFormat.color}`);
        textarea.classList.add(`align-${currentFormat.align}`);
    }
    
    // ============================================
    // Keyboard Navigation
    // ============================================
    
    /**
     * Handle keyboard navigation in toolbar
     */
    function handleKeyboardNav(e) {
        const btns = toolbar.querySelectorAll('.formatting-btn, .color-btn, .color-swatch');
        const currentIndex = Array.from(btns).indexOf(document.activeElement);
        
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                if (currentIndex < btns.length - 1) {
                    btns[currentIndex + 1].focus();
                } else {
                    btns[0].focus();
                }
                break;
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                if (currentIndex > 0) {
                    btns[currentIndex - 1].focus();
                } else {
                    btns[btns.length - 1].focus();
                }
                break;
            case 'Escape':
                closeColorPalette();
                break;
        }
    }
    
    // ============================================
    // Helpers
    // ============================================
    
    /**
     * Get human-readable color name
     */
    function getColorName(color) {
        const names = {
            'default': 'Par défaut',
            'brand': 'Cinq',
            'red': 'Rouge',
            'orange': 'Orange',
            'amber': 'Ambre',
            'green': 'Vert',
            'teal': 'Turquoise',
            'blue': 'Bleu',
            'indigo': 'Indigo',
            'purple': 'Violet',
            'pink': 'Rose',
            'rose': 'Rosé'
        };
        return names[color] || color;
    }
    
    /**
     * Get current format
     */
    function getFormat() {
        return { ...currentFormat };
    }
    
    /**
     * Set format (e.g., when editing a post)
     */
    function setFormat(format) {
        if (!format) return;
        
        if (format.size && SIZES.includes(format.size)) {
            currentFormat.size = format.size;
        }
        if (format.color && COLORS.includes(format.color)) {
            currentFormat.color = format.color;
        }
        if (format.align && ALIGNMENTS.includes(format.align)) {
            currentFormat.align = format.align;
        }
        
        updateFormatData();
        updateToolbarState();
        applyFormatToTextarea();
        updateColorButton();
    }
    
    /**
     * Apply format classes to a post element
     */
    function applyToPost(postContentEl, format) {
        if (!postContentEl || !format) return;
        
        // Remove existing format classes
        SIZES.forEach(s => postContentEl.classList.remove(`text-${s}`));
        COLORS.forEach(c => postContentEl.classList.remove(`color-${c}`));
        ALIGNMENTS.forEach(a => postContentEl.classList.remove(`align-${a}`));
        
        // Apply format
        if (format.size) postContentEl.classList.add(`text-${format.size}`);
        if (format.color) postContentEl.classList.add(`color-${format.color}`);
        if (format.align) postContentEl.classList.add(`align-${format.align}`);
    }
    
    /**
     * Parse format from JSON string
     */
    function parseFormat(formatStr) {
        if (!formatStr) return null;
        
        try {
            const format = JSON.parse(formatStr);
            return {
                size: SIZES.includes(format.size) ? format.size : 'normal',
                color: COLORS.includes(format.color) ? format.color : 'default',
                align: ALIGNMENTS.includes(format.align) ? format.align : 'left'
            };
        } catch (e) {
            return null;
        }
    }
    
    /**
     * Reset for new post
     */
    function reset() {
        currentFormat = { ...DEFAULT_FORMAT };
        updateFormatData();
        updateToolbarState();
        applyFormatToTextarea();
        updateColorButton();
    }
    
    // ============================================
    // Public API
    // ============================================
    
    return {
        init,
        getFormat,
        setFormat,
        applyToPost,
        parseFormat,
        reset,
        toggleToolbar,
        
        // Constants for external use
        SIZES,
        COLORS,
        ALIGNMENTS,
        DEFAULT_FORMAT
    };
    
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', CinqFormatting.init);
} else {
    // DOM already loaded
    setTimeout(CinqFormatting.init, 0);
}

// Export globally
window.CinqFormatting = CinqFormatting;
