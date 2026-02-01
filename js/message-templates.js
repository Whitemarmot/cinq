/**
 * ==========================================================================
 * CINQ - Message Templates Module
 * ==========================================================================
 * 
 * Provides predefined message templates for recurring messages
 * (birthday wishes, welcome messages, thank you notes, etc.)
 * 
 * Features:
 * - Default templates included
 * - Custom user templates (stored in localStorage)
 * - Category-based organization
 * - Quick insertion in chat
 * - Settings UI for managing templates
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

const CinqTemplates = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const STORAGE_KEY = 'cinq_message_templates';
    const MAX_TEMPLATES = 50;
    const MAX_TEMPLATE_LENGTH = 280;
    
    // ============================================
    // Default Templates
    // ============================================
    
    const DEFAULT_TEMPLATES = [
        // Anniversaire
        {
            id: 'birthday-1',
            category: 'birthday',
            emoji: '🎂',
            name: 'Anniversaire simple',
            content: 'Joyeux anniversaire ! 🎂🎉 Passe une merveilleuse journée !',
            isDefault: true
        },
        {
            id: 'birthday-2',
            category: 'birthday',
            emoji: '🎁',
            name: 'Anniversaire avec vœux',
            content: 'Joyeux anniversaire ! 🎈 Je te souhaite bonheur, santé et plein de belles surprises cette année ! 🎁✨',
            isDefault: true
        },
        {
            id: 'birthday-3',
            category: 'birthday',
            emoji: '🥳',
            name: 'Anniversaire festif',
            content: 'C\'est ton jour ! 🥳🎉 Que cette nouvelle année t\'apporte tout ce que tu mérites. Je pense fort à toi ! ❤️',
            isDefault: true
        },
        
        // Bienvenue
        {
            id: 'welcome-1',
            category: 'welcome',
            emoji: '👋',
            name: 'Bienvenue simple',
            content: 'Bienvenue ! 👋 Ravi de te compter parmi nous !',
            isDefault: true
        },
        {
            id: 'welcome-2',
            category: 'welcome',
            emoji: '🎊',
            name: 'Bienvenue chaleureux',
            content: 'Bienvenue dans le groupe ! 🎊 On est super contents de t\'avoir. N\'hésite pas si tu as des questions ! 💜',
            isDefault: true
        },
        
        // Merci
        {
            id: 'thanks-1',
            category: 'thanks',
            emoji: '🙏',
            name: 'Merci simple',
            content: 'Merci beaucoup ! 🙏 Ça me touche vraiment.',
            isDefault: true
        },
        {
            id: 'thanks-2',
            category: 'thanks',
            emoji: '❤️',
            name: 'Merci chaleureux',
            content: 'Un grand merci du fond du cœur ! ❤️ Tu es vraiment génial(e) !',
            isDefault: true
        },
        {
            id: 'thanks-3',
            category: 'thanks',
            emoji: '🌟',
            name: 'Merci pour l\'aide',
            content: 'Merci infiniment pour ton aide ! 🌟 Je ne sais pas ce que je ferais sans toi.',
            isDefault: true
        },
        
        // Encouragement
        {
            id: 'encourage-1',
            category: 'encourage',
            emoji: '💪',
            name: 'Courage',
            content: 'Courage ! 💪 Tu vas y arriver, je crois en toi !',
            isDefault: true
        },
        {
            id: 'encourage-2',
            category: 'encourage',
            emoji: '✨',
            name: 'Tu peux le faire',
            content: 'Tu es capable de grandes choses ! ✨ Ne lâche rien, tu es sur la bonne voie.',
            isDefault: true
        },
        {
            id: 'encourage-3',
            category: 'encourage',
            emoji: '🌈',
            name: 'Après la pluie',
            content: 'Les moments difficiles passent toujours. 🌈 Je suis là pour toi si tu as besoin.',
            isDefault: true
        },
        
        // Bonne nuit / Bonjour
        {
            id: 'greet-1',
            category: 'greetings',
            emoji: '☀️',
            name: 'Bonjour',
            content: 'Bonjour ! ☀️ J\'espère que tu passes une belle journée !',
            isDefault: true
        },
        {
            id: 'greet-2',
            category: 'greetings',
            emoji: '🌙',
            name: 'Bonne nuit',
            content: 'Bonne nuit ! 🌙 Fais de beaux rêves. À demain ! 💤',
            isDefault: true
        },
        {
            id: 'greet-3',
            category: 'greetings',
            emoji: '🍀',
            name: 'Bonne chance',
            content: 'Bonne chance ! 🍀 Je croise les doigts pour toi ! 🤞',
            isDefault: true
        },
        
        // Divers
        {
            id: 'misc-1',
            category: 'misc',
            emoji: '🤗',
            name: 'Je pense à toi',
            content: 'Je pense fort à toi ! 🤗 J\'espère que tu vas bien.',
            isDefault: true
        },
        {
            id: 'misc-2',
            category: 'misc',
            emoji: '😢',
            name: 'Condoléances',
            content: 'Je suis vraiment désolé(e) pour ta perte. 💐 Mes pensées sont avec toi. Je suis là si tu as besoin.',
            isDefault: true
        },
        {
            id: 'misc-3',
            category: 'misc',
            emoji: '🎉',
            name: 'Félicitations',
            content: 'Félicitations ! 🎉🎊 Tu le mérites vraiment ! Trop fier(e) de toi !',
            isDefault: true
        }
    ];
    
    // Category definitions
    const CATEGORIES = {
        birthday: { name: 'Anniversaire', emoji: '🎂' },
        welcome: { name: 'Bienvenue', emoji: '👋' },
        thanks: { name: 'Remerciements', emoji: '🙏' },
        encourage: { name: 'Encouragement', emoji: '💪' },
        greetings: { name: 'Salutations', emoji: '👋' },
        misc: { name: 'Divers', emoji: '📝' },
        custom: { name: 'Personnalisés', emoji: '⭐' }
    };
    
    // ============================================
    // State
    // ============================================
    
    let userTemplates = [];
    let isPickerOpen = false;
    
    // ============================================
    // Storage
    // ============================================
    
    /**
     * Load user templates from localStorage
     */
    function loadTemplates() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                userTemplates = JSON.parse(stored);
            }
        } catch (e) {
            console.error('[Templates] Error loading templates:', e);
            userTemplates = [];
        }
    }
    
    /**
     * Save user templates to localStorage
     */
    function saveTemplates() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(userTemplates));
        } catch (e) {
            console.error('[Templates] Error saving templates:', e);
        }
    }
    
    /**
     * Get all templates (default + user)
     */
    function getAllTemplates() {
        return [...DEFAULT_TEMPLATES, ...userTemplates];
    }
    
    /**
     * Get templates by category
     */
    function getTemplatesByCategory(category) {
        return getAllTemplates().filter(t => t.category === category);
    }
    
    /**
     * Get user templates only
     */
    function getUserTemplates() {
        return userTemplates;
    }
    
    // ============================================
    // Template CRUD
    // ============================================
    
    /**
     * Add a new user template
     */
    function addTemplate(name, content, category = 'custom', emoji = '📝') {
        if (userTemplates.length >= MAX_TEMPLATES) {
            throw new Error('Limite de templates atteinte (max ' + MAX_TEMPLATES + ')');
        }
        
        if (!name || !content) {
            throw new Error('Nom et contenu requis');
        }
        
        if (content.length > MAX_TEMPLATE_LENGTH) {
            throw new Error('Le message est trop long (max ' + MAX_TEMPLATE_LENGTH + ' caractères)');
        }
        
        const template = {
            id: 'custom-' + Date.now(),
            category: category,
            emoji: emoji,
            name: name.trim(),
            content: content.trim(),
            isDefault: false,
            createdAt: new Date().toISOString()
        };
        
        userTemplates.push(template);
        saveTemplates();
        
        return template;
    }
    
    /**
     * Update an existing user template
     */
    function updateTemplate(id, updates) {
        const index = userTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error('Template non trouvé');
        }
        
        if (updates.content && updates.content.length > MAX_TEMPLATE_LENGTH) {
            throw new Error('Le message est trop long (max ' + MAX_TEMPLATE_LENGTH + ' caractères)');
        }
        
        userTemplates[index] = {
            ...userTemplates[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        
        saveTemplates();
        return userTemplates[index];
    }
    
    /**
     * Delete a user template
     */
    function deleteTemplate(id) {
        const index = userTemplates.findIndex(t => t.id === id);
        if (index === -1) {
            throw new Error('Template non trouvé');
        }
        
        userTemplates.splice(index, 1);
        saveTemplates();
    }
    
    // ============================================
    // Template Picker UI
    // ============================================
    
    /**
     * Toggle the template picker
     */
    function togglePicker() {
        if (isPickerOpen) {
            closePicker();
        } else {
            openPicker();
        }
    }
    
    /**
     * Open the template picker
     */
    function openPicker() {
        const picker = document.getElementById('template-picker');
        if (!picker) return;
        
        renderPicker();
        picker.classList.add('open');
        isPickerOpen = true;
        
        const btn = document.getElementById('template-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', 'true');
            btn.classList.add('active');
        }
    }
    
    /**
     * Close the template picker
     */
    function closePicker() {
        const picker = document.getElementById('template-picker');
        if (!picker) return;
        
        picker.classList.remove('open');
        isPickerOpen = false;
        
        const btn = document.getElementById('template-btn');
        if (btn) {
            btn.setAttribute('aria-expanded', 'false');
            btn.classList.remove('active');
        }
    }
    
    /**
     * Render the template picker content
     */
    function renderPicker(filterCategory = null) {
        const grid = document.getElementById('template-grid');
        if (!grid) return;
        
        const templates = filterCategory 
            ? getTemplatesByCategory(filterCategory)
            : getAllTemplates();
        
        if (templates.length === 0) {
            grid.innerHTML = `
                <div class="template-empty">
                    <span>Aucun template</span>
                </div>
            `;
            return;
        }
        
        grid.innerHTML = templates.map(t => `
            <button class="template-item" onclick="CinqTemplates.insertTemplate('${t.id}')" type="button" title="${escapeHtml(t.name)}">
                <span class="template-emoji">${t.emoji}</span>
                <div class="template-info">
                    <span class="template-name">${escapeHtml(t.name)}</span>
                    <span class="template-preview">${escapeHtml(t.content.substring(0, 50))}${t.content.length > 50 ? '...' : ''}</span>
                </div>
            </button>
        `).join('');
    }
    
    /**
     * Filter templates by category
     */
    function filterByCategory(category) {
        // Update active tab
        document.querySelectorAll('.template-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === (category || 'all'));
        });
        
        renderPicker(category);
    }
    
    /**
     * Insert a template into the chat input
     */
    function insertTemplate(templateId) {
        const templates = getAllTemplates();
        const template = templates.find(t => t.id === templateId);
        
        if (!template) return;
        
        const input = document.getElementById('chat-input');
        if (!input) return;
        
        input.value = template.content;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        
        // Enable send button
        const sendBtn = document.getElementById('send-btn');
        if (sendBtn) {
            sendBtn.disabled = false;
        }
        
        closePicker();
        
        // Show toast
        if (typeof showToast === 'function') {
            showToast('Template inséré !', 'success');
        }
    }
    
    // ============================================
    // Settings UI
    // ============================================
    
    /**
     * Render the templates list in settings
     */
    function renderSettingsList() {
        const container = document.getElementById('templates-list');
        if (!container) return;
        
        const allTemplates = getAllTemplates();
        
        if (allTemplates.length === 0) {
            container.innerHTML = `
                <div class="settings-item" style="justify-content: center;">
                    <span style="color: var(--color-text-muted); font-size: var(--text-sm);">Aucun template</span>
                </div>
            `;
            return;
        }
        
        // Group by category
        const grouped = {};
        allTemplates.forEach(t => {
            if (!grouped[t.category]) {
                grouped[t.category] = [];
            }
            grouped[t.category].push(t);
        });
        
        let html = '';
        
        Object.keys(grouped).forEach(category => {
            const cat = CATEGORIES[category] || { name: category, emoji: '📝' };
            html += `
                <div class="template-category-group">
                    <div class="template-category-header">
                        <span>${cat.emoji} ${cat.name}</span>
                        <span class="template-count">${grouped[category].length}</span>
                    </div>
                    ${grouped[category].map(t => `
                        <div class="template-list-item ${t.isDefault ? 'is-default' : ''}" data-id="${t.id}">
                            <div class="template-list-content">
                                <span class="template-list-emoji">${t.emoji}</span>
                                <div class="template-list-info">
                                    <span class="template-list-name">${escapeHtml(t.name)}</span>
                                    <span class="template-list-preview">${escapeHtml(t.content.substring(0, 60))}${t.content.length > 60 ? '...' : ''}</span>
                                </div>
                            </div>
                            ${!t.isDefault ? `
                                <div class="template-list-actions">
                                    <button class="template-action-btn" onclick="CinqTemplates.editTemplateModal('${t.id}')" title="Modifier" aria-label="Modifier le template">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                        </svg>
                                    </button>
                                    <button class="template-action-btn delete" onclick="CinqTemplates.confirmDelete('${t.id}')" title="Supprimer" aria-label="Supprimer le template">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                            <polyline points="3 6 5 6 21 6"/>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                        </svg>
                                    </button>
                                </div>
                            ` : `
                                <span class="template-default-badge">Par défaut</span>
                            `}
                        </div>
                    `).join('')}
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    /**
     * Open the add template modal
     */
    function openAddModal() {
        const modal = document.getElementById('template-modal');
        if (!modal) return;
        
        // Reset form
        document.getElementById('template-modal-title').textContent = 'Nouveau template';
        document.getElementById('template-form').reset();
        document.getElementById('template-id').value = '';
        document.getElementById('template-char-count').textContent = '0/' + MAX_TEMPLATE_LENGTH;
        
        modal.classList.add('open');
        document.getElementById('template-name-input').focus();
    }
    
    /**
     * Open edit modal for a template
     */
    function editTemplateModal(id) {
        const template = userTemplates.find(t => t.id === id);
        if (!template) return;
        
        const modal = document.getElementById('template-modal');
        if (!modal) return;
        
        document.getElementById('template-modal-title').textContent = 'Modifier le template';
        document.getElementById('template-id').value = id;
        document.getElementById('template-name-input').value = template.name;
        document.getElementById('template-content-input').value = template.content;
        document.getElementById('template-emoji-input').value = template.emoji;
        document.getElementById('template-category-input').value = template.category;
        document.getElementById('template-char-count').textContent = template.content.length + '/' + MAX_TEMPLATE_LENGTH;
        
        modal.classList.add('open');
    }
    
    /**
     * Close the template modal
     */
    function closeModal() {
        const modal = document.getElementById('template-modal');
        if (modal) {
            modal.classList.remove('open');
        }
    }
    
    /**
     * Handle form submission
     */
    function handleFormSubmit(e) {
        e.preventDefault();
        
        const id = document.getElementById('template-id').value;
        const name = document.getElementById('template-name-input').value.trim();
        const content = document.getElementById('template-content-input').value.trim();
        const emoji = document.getElementById('template-emoji-input').value || '📝';
        const category = document.getElementById('template-category-input').value || 'custom';
        
        try {
            if (id) {
                // Update existing
                updateTemplate(id, { name, content, emoji, category });
                if (typeof showToast === 'function') {
                    showToast('Template modifié !', 'success');
                }
            } else {
                // Add new
                addTemplate(name, content, category, emoji);
                if (typeof showToast === 'function') {
                    showToast('Template créé !', 'success');
                }
            }
            
            closeModal();
            renderSettingsList();
        } catch (error) {
            if (typeof showToast === 'function') {
                showToast(error.message, 'error');
            }
        }
    }
    
    /**
     * Confirm delete template
     */
    function confirmDelete(id) {
        const template = userTemplates.find(t => t.id === id);
        if (!template) return;
        
        if (confirm(`Supprimer le template "${template.name}" ?`)) {
            try {
                deleteTemplate(id);
                renderSettingsList();
                if (typeof showToast === 'function') {
                    showToast('Template supprimé', 'success');
                }
            } catch (error) {
                if (typeof showToast === 'function') {
                    showToast(error.message, 'error');
                }
            }
        }
    }
    
    // ============================================
    // Utilities
    // ============================================
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (typeof window.Cinq !== 'undefined' && window.Cinq.escapeHtml) {
            return window.Cinq.escapeHtml(text);
        }
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ============================================
    // Initialization
    // ============================================
    
    /**
     * Initialize the templates module
     */
    function init() {
        loadTemplates();
        
        // Bind event listeners
        const form = document.getElementById('template-form');
        if (form) {
            form.addEventListener('submit', handleFormSubmit);
        }
        
        // Content input character count
        const contentInput = document.getElementById('template-content-input');
        if (contentInput) {
            contentInput.addEventListener('input', function() {
                const count = document.getElementById('template-char-count');
                if (count) {
                    count.textContent = this.value.length + '/' + MAX_TEMPLATE_LENGTH;
                }
            });
        }
        
        // Close picker on outside click
        document.addEventListener('click', function(e) {
            if (isPickerOpen && !e.target.closest('#template-picker') && !e.target.closest('#template-btn')) {
                closePicker();
            }
        });
        
        // Escape key closes picker
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && isPickerOpen) {
                closePicker();
            }
        });
        
        console.log('[Templates] Module initialized');
    }
    
    // ============================================
    // Public API
    // ============================================
    
    return {
        init,
        
        // Template management
        getAllTemplates,
        getTemplatesByCategory,
        getUserTemplates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        
        // Picker
        togglePicker,
        openPicker,
        closePicker,
        filterByCategory,
        insertTemplate,
        
        // Settings
        renderSettingsList,
        openAddModal,
        editTemplateModal,
        closeModal,
        confirmDelete,
        
        // Constants
        CATEGORIES,
        MAX_TEMPLATES,
        MAX_TEMPLATE_LENGTH
    };
    
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CinqTemplates.init());
} else {
    CinqTemplates.init();
}

// Global access
window.CinqTemplates = CinqTemplates;
