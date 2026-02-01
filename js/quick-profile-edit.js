/**
 * ==========================================================================
 * CINQ - Quick Profile Edit
 * ==========================================================================
 * 
 * Fast profile editing modal accessible from anywhere in the app.
 * Allows users to edit their name, bio, and avatar without navigating
 * to the full settings page.
 * 
 * Features:
 * - Inline avatar emoji picker
 * - Character count for bio
 * - Optimistic UI updates
 * - Haptic feedback on mobile
 * - Accessible keyboard navigation
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * QuickProfileEdit - Profile editing modal module
 */
const QuickProfileEdit = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const CONFIG = {
        /** Maximum length for display name */
        maxNameLength: 50,
        
        /** Maximum length for bio */
        maxBioLength: 160,
        
        /** Available avatar emojis */
        avatarEmojis: ['😊', '😎', '🤖', '👻', '🦊', '🐱', '🐶', '🦁', '🐼', '🦄', '🌟', '🔥', '💜', '🌈', '🎮', '🎸', '📚', '☕', '🌙', '✨'],
        
        /** Auto-close delay after success (ms) */
        successCloseDelay: 1500,
        
        /** Enable haptic feedback */
        enableHaptics: true
    };
    
    // ============================================
    // State
    // ============================================
    
    /** @type {HTMLElement|null} Modal overlay element */
    let overlay = null;
    
    /** @type {HTMLElement|null} Modal container element */
    let modal = null;
    
    /** @type {Object|null} Current profile data */
    let currentProfile = null;
    
    /** @type {boolean} Is currently saving */
    let isSaving = false;
    
    /** @type {Function|null} Callback on profile update */
    let onUpdateCallback = null;
    
    // ============================================
    // Haptic Feedback
    // ============================================
    
    /**
     * Trigger haptic feedback if available
     * @param {string} type - 'light', 'medium', 'heavy', 'success'
     */
    function haptic(type = 'medium') {
        if (!CONFIG.enableHaptics) return;
        
        try {
            if (window.navigator && window.navigator.vibrate) {
                const patterns = {
                    light: [10],
                    medium: [20],
                    heavy: [30],
                    success: [20, 50, 20]
                };
                window.navigator.vibrate(patterns[type] || [20]);
            }
        } catch (e) {
            // Haptics not supported, ignore
        }
    }
    
    // ============================================
    // DOM Creation
    // ============================================
    
    /**
     * Create the modal HTML structure
     */
    function createModal() {
        // Create overlay
        overlay = document.createElement('div');
        overlay.className = 'quick-profile-overlay';
        overlay.setAttribute('aria-hidden', 'true');
        
        // Create modal
        modal = document.createElement('div');
        modal.className = 'quick-profile-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'quick-profile-title');
        
        modal.innerHTML = `
            <!-- Form View -->
            <div class="quick-profile-form-view">
                <header class="quick-profile-header">
                    <h2 class="quick-profile-title" id="quick-profile-title">
                        <span class="quick-profile-title-icon">✏️</span>
                        Modifier le profil
                    </h2>
                    <button class="quick-profile-close" aria-label="Fermer" data-action="close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </header>
                
                <div class="quick-profile-content">
                    <!-- Avatar Section -->
                    <div class="quick-profile-avatar-section">
                        <div class="quick-profile-avatar-wrapper">
                            <div class="quick-profile-avatar" id="qpe-avatar" data-action="toggle-emoji-picker">
                                <span id="qpe-avatar-display">?</span>
                            </div>
                            <button class="quick-profile-avatar-edit" data-action="toggle-emoji-picker" aria-label="Changer l'avatar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                            </button>
                        </div>
                        <span class="quick-profile-avatar-hint">Clique pour changer</span>
                        
                        <!-- Emoji Picker -->
                        <div class="quick-profile-emoji-picker" id="qpe-emoji-picker" role="listbox" aria-label="Choisir un emoji">
                            ${CONFIG.avatarEmojis.map(emoji => `
                                <button class="quick-profile-emoji-btn" data-emoji="${emoji}" role="option" aria-label="${emoji}">
                                    ${emoji}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                    
                    <!-- Name Field -->
                    <div class="quick-profile-field">
                        <label class="quick-profile-label" for="qpe-name">Nom d'affichage</label>
                        <input 
                            type="text" 
                            class="quick-profile-input" 
                            id="qpe-name" 
                            name="display_name"
                            placeholder="Comment veux-tu t'appeler ?"
                            maxlength="${CONFIG.maxNameLength}"
                            autocomplete="nickname"
                        >
                        <span class="quick-profile-char-count" id="qpe-name-count">0/${CONFIG.maxNameLength}</span>
                    </div>
                    
                    <!-- Bio Field -->
                    <div class="quick-profile-field">
                        <label class="quick-profile-label" for="qpe-bio">Bio</label>
                        <textarea 
                            class="quick-profile-input quick-profile-textarea" 
                            id="qpe-bio" 
                            name="bio"
                            placeholder="Décris-toi en quelques mots..."
                            maxlength="${CONFIG.maxBioLength}"
                        ></textarea>
                        <span class="quick-profile-char-count" id="qpe-bio-count">0/${CONFIG.maxBioLength}</span>
                    </div>
                </div>
                
                <footer class="quick-profile-footer">
                    <button class="quick-profile-btn quick-profile-btn-cancel" data-action="close">
                        Annuler
                    </button>
                    <button class="quick-profile-btn quick-profile-btn-save" id="qpe-save" data-action="save">
                        <span class="btn-text">Enregistrer</span>
                    </button>
                </footer>
            </div>
            
            <!-- Success View -->
            <div class="quick-profile-success" id="qpe-success">
                <div class="quick-profile-success-icon">✓</div>
                <p class="quick-profile-success-text">Profil mis à jour !</p>
                <p class="quick-profile-success-subtext">Tes modifications sont enregistrées.</p>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // Bind events
        bindEvents();
    }
    
    /**
     * Bind event listeners
     */
    function bindEvents() {
        // Close on overlay click
        overlay.addEventListener('click', close);
        
        // Button actions
        modal.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.getAttribute('data-action');
            
            switch(action) {
                case 'close':
                    close();
                    break;
                case 'toggle-emoji-picker':
                    toggleEmojiPicker();
                    break;
                case 'save':
                    save();
                    break;
            }
            
            // Emoji selection
            const emoji = e.target.closest('[data-emoji]')?.getAttribute('data-emoji');
            if (emoji) {
                selectEmoji(emoji);
            }
        });
        
        // Character counting
        const nameInput = modal.querySelector('#qpe-name');
        const bioInput = modal.querySelector('#qpe-bio');
        
        nameInput.addEventListener('input', () => updateCharCount('name', nameInput.value.length));
        bioInput.addEventListener('input', () => updateCharCount('bio', bioInput.value.length));
        
        // Keyboard navigation
        document.addEventListener('keydown', handleKeydown);
    }
    
    /**
     * Handle keyboard events
     * @param {KeyboardEvent} e
     */
    function handleKeydown(e) {
        if (!modal || !modal.classList.contains('active')) return;
        
        if (e.key === 'Escape') {
            e.preventDefault();
            close();
        }
        
        // Submit on Ctrl/Cmd + Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            save();
        }
    }
    
    // ============================================
    // UI Updates
    // ============================================
    
    /**
     * Toggle emoji picker visibility
     */
    function toggleEmojiPicker() {
        const picker = modal.querySelector('#qpe-emoji-picker');
        picker.classList.toggle('active');
        haptic('light');
    }
    
    /**
     * Select an emoji as avatar
     * @param {string} emoji
     */
    function selectEmoji(emoji) {
        const display = modal.querySelector('#qpe-avatar-display');
        display.textContent = emoji;
        
        // Update selection state
        modal.querySelectorAll('.quick-profile-emoji-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.getAttribute('data-emoji') === emoji);
        });
        
        // Hide picker
        const picker = modal.querySelector('#qpe-emoji-picker');
        picker.classList.remove('active');
        
        haptic('medium');
    }
    
    /**
     * Update character count display
     * @param {string} field - 'name' or 'bio'
     * @param {number} count
     */
    function updateCharCount(field, count) {
        const max = field === 'name' ? CONFIG.maxNameLength : CONFIG.maxBioLength;
        const countEl = modal.querySelector(`#qpe-${field}-count`);
        
        countEl.textContent = `${count}/${max}`;
        countEl.classList.remove('warning', 'error');
        
        if (count >= max) {
            countEl.classList.add('error');
        } else if (count >= max * 0.9) {
            countEl.classList.add('warning');
        }
    }
    
    /**
     * Show success state
     */
    function showSuccess() {
        const formView = modal.querySelector('.quick-profile-form-view');
        const successView = modal.querySelector('#qpe-success');
        
        formView.style.display = 'none';
        successView.classList.add('active');
        
        haptic('success');
        
        // Auto-close after delay
        setTimeout(() => {
            close();
        }, CONFIG.successCloseDelay);
    }
    
    /**
     * Reset modal to initial form state
     */
    function resetModal() {
        const formView = modal.querySelector('.quick-profile-form-view');
        const successView = modal.querySelector('#qpe-success');
        
        formView.style.display = '';
        successView.classList.remove('active');
        
        // Reset emoji picker
        modal.querySelector('#qpe-emoji-picker').classList.remove('active');
    }
    
    /**
     * Set loading state on save button
     * @param {boolean} loading
     */
    function setLoading(loading) {
        const saveBtn = modal.querySelector('#qpe-save');
        const btnText = saveBtn.querySelector('.btn-text');
        
        isSaving = loading;
        saveBtn.disabled = loading;
        
        if (loading) {
            btnText.innerHTML = '<span class="spinner"></span>';
        } else {
            btnText.textContent = 'Enregistrer';
        }
    }
    
    // ============================================
    // API Integration
    // ============================================
    
    /**
     * Save profile changes
     */
    async function save() {
        if (isSaving) return;
        
        const nameInput = modal.querySelector('#qpe-name');
        const bioInput = modal.querySelector('#qpe-bio');
        const avatarDisplay = modal.querySelector('#qpe-avatar-display');
        
        const updates = {
            display_name: nameInput.value.trim(),
            bio: bioInput.value.trim(),
            avatar_emoji: avatarDisplay.textContent.trim()
        };
        
        // Validate
        if (!updates.display_name) {
            nameInput.focus();
            nameInput.classList.add('error');
            setTimeout(() => nameInput.classList.remove('error'), 1000);
            return;
        }
        
        setLoading(true);
        
        try {
            // Try using UserProfile module if available
            if (typeof UserProfile !== 'undefined' && UserProfile.updateProfile) {
                await UserProfile.updateProfile(updates);
            } else {
                // Fallback: direct API call
                const token = await getAccessToken();
                
                if (!token) {
                    throw new Error('Non authentifié');
                }
                
                const response = await fetch('/.netlify/functions/user-profile', {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify(updates)
                });
                
                const data = await response.json();
                
                if (!response.ok || !data.success) {
                    throw new Error(data.error || 'Erreur lors de la sauvegarde');
                }
            }
            
            // Update current profile state
            currentProfile = { ...currentProfile, ...updates };
            
            // Notify callback
            if (onUpdateCallback) {
                onUpdateCallback(currentProfile);
            }
            
            // Update any visible avatar in the page
            updatePageAvatars(updates);
            
            showSuccess();
            
        } catch (err) {
            console.error('Quick Profile Edit error:', err);
            
            // Show error (could use a toast here)
            const footer = modal.querySelector('.quick-profile-footer');
            const existingError = footer.querySelector('.error-msg');
            if (existingError) existingError.remove();
            
            const errorEl = document.createElement('p');
            errorEl.className = 'error-msg';
            errorEl.style.cssText = 'color: var(--color-error, #ef4444); font-size: 0.875rem; text-align: center; width: 100%; margin-bottom: 0.5rem;';
            errorEl.textContent = err.message || 'Erreur lors de la sauvegarde';
            footer.prepend(errorEl);
            
            setTimeout(() => errorEl.remove(), 3000);
        } finally {
            setLoading(false);
        }
    }
    
    /**
     * Get access token from Supabase session
     * @returns {Promise<string|null>}
     */
    async function getAccessToken() {
        // Try UserProfile module first
        if (typeof UserProfile !== 'undefined' && UserProfile.getSession) {
            const session = UserProfile.getSession();
            return session?.access_token || null;
        }
        
        // Try window.Cinq
        if (typeof window.Cinq !== 'undefined' && window.Cinq.getAccessToken) {
            return await window.Cinq.getAccessToken();
        }
        
        // Fallback: try localStorage directly
        try {
            const storageKey = 'sb-guioxfulihyehrwytxce-auth-token';
            const stored = localStorage.getItem(storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return parsed?.access_token || null;
            }
        } catch (e) {
            // Ignore
        }
        
        return null;
    }
    
    /**
     * Update avatars visible on the page
     * @param {Object} updates - Profile updates with avatar_emoji, display_name
     */
    function updatePageAvatars(updates) {
        // Update header avatar
        const headerAvatar = document.querySelector('.header-profile-avatar');
        if (headerAvatar && updates.avatar_emoji) {
            const display = headerAvatar.querySelector('span:not(.edit-hint)') || headerAvatar;
            if (!headerAvatar.querySelector('img')) {
                display.textContent = updates.avatar_emoji;
            }
        }
        
        // Update composer avatar
        const composerAvatar = document.querySelector('.composer-avatar');
        if (composerAvatar && updates.avatar_emoji) {
            composerAvatar.textContent = updates.avatar_emoji;
        }
        
        // Update user name displays
        if (updates.display_name) {
            document.querySelectorAll('.composer-user, .current-user-name').forEach(el => {
                el.textContent = updates.display_name;
            });
        }
    }
    
    // ============================================
    // Public API
    // ============================================
    
    /**
     * Open the quick profile edit modal
     * @param {Object} profile - Current profile data
     * @param {Object} options - Options
     * @param {Function} options.onUpdate - Callback when profile is updated
     */
    function open(profile = {}, options = {}) {
        if (!modal) {
            createModal();
        }
        
        resetModal();
        
        currentProfile = profile;
        onUpdateCallback = options.onUpdate || null;
        
        // Populate fields
        const nameInput = modal.querySelector('#qpe-name');
        const bioInput = modal.querySelector('#qpe-bio');
        const avatarDisplay = modal.querySelector('#qpe-avatar-display');
        
        nameInput.value = profile.display_name || '';
        bioInput.value = profile.bio || '';
        avatarDisplay.textContent = profile.avatar_emoji || getInitial(profile.display_name || profile.email || '?');
        
        // Update char counts
        updateCharCount('name', nameInput.value.length);
        updateCharCount('bio', bioInput.value.length);
        
        // Update emoji selection
        modal.querySelectorAll('.quick-profile-emoji-btn').forEach(btn => {
            btn.classList.toggle('selected', btn.getAttribute('data-emoji') === profile.avatar_emoji);
        });
        
        // Show modal
        overlay.classList.add('active');
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Focus name input
        setTimeout(() => nameInput.focus(), 100);
        
        haptic('light');
    }
    
    /**
     * Close the modal
     */
    function close() {
        if (!modal) return;
        
        overlay.classList.remove('active');
        modal.classList.remove('active');
        document.body.style.overflow = '';
        
        haptic('light');
    }
    
    /**
     * Get initial from name or email
     * @param {string} str
     * @returns {string}
     */
    function getInitial(str) {
        if (!str) return '?';
        return str.charAt(0).toUpperCase();
    }
    
    /**
     * Initialize - add trigger to header avatars
     */
    function init() {
        // Add click handler to header profile avatars
        document.querySelectorAll('.header-profile-avatar').forEach(avatar => {
            avatar.addEventListener('click', async (e) => {
                e.preventDefault();
                
                // Try to load current profile
                let profile = {};
                
                if (typeof UserProfile !== 'undefined') {
                    try {
                        profile = await UserProfile.loadProfile();
                    } catch (err) {
                        // Use cached or empty profile
                        profile = UserProfile.profile || {};
                    }
                }
                
                open(profile);
            });
        });
    }
    
    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // ============================================
    // Expose Public API
    // ============================================
    
    return {
        open,
        close,
        init
    };
    
})();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuickProfileEdit;
}
