/**
 * ==========================================================================
 * CINQ - Post Drafts Module
 * ==========================================================================
 * 
 * Système de brouillons pour les posts:
 * - Sauvegarde automatique pendant la frappe
 * - Liste des brouillons accessibles
 * - Restauration de brouillons
 * - Suppression de brouillons
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

/**
 * CinqDrafts - Post Drafts Module
 */
const CinqDrafts = (function() {
  
  // ============================================
  // Configuration
  // ============================================
  
  const STORAGE_KEY = 'cinq_drafts';
  const AUTOSAVE_DELAY = 1000; // ms
  const MAX_DRAFTS = 10;
  
  // ============================================
  // State
  // ============================================
  
  /** @type {Array} List of drafts */
  let drafts = [];
  
  /** @type {string|null} Currently editing draft ID */
  let currentDraftId = null;
  
  /** @type {number|null} Autosave timeout */
  let autosaveTimeout = null;
  
  /** @type {boolean} Is modal open */
  let isModalOpen = false;
  
  // ============================================
  // Storage
  // ============================================
  
  /**
   * Load drafts from localStorage
   * @returns {Array}
   */
  function loadDrafts() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      drafts = stored ? JSON.parse(stored) : [];
      // Filter out invalid or empty drafts
      drafts = drafts.filter(d => d && d.content && d.content.trim());
      return drafts;
    } catch (e) {
      console.error('[Drafts] Failed to load drafts:', e);
      drafts = [];
      return [];
    }
  }
  
  /**
   * Save drafts to localStorage
   */
  function saveDrafts() {
    try {
      // Limit to MAX_DRAFTS
      if (drafts.length > MAX_DRAFTS) {
        drafts = drafts.slice(0, MAX_DRAFTS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
    } catch (e) {
      console.error('[Drafts] Failed to save drafts:', e);
    }
  }
  
  // ============================================
  // Draft Management
  // ============================================
  
  /**
   * Generate unique ID
   * @returns {string}
   */
  function generateId() {
    return 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  
  /**
   * Create or update a draft
   * @param {Object} data - Draft data
   * @returns {Object} The saved draft
   */
  function saveDraft(data) {
    const now = new Date().toISOString();
    
    if (currentDraftId) {
      // Update existing draft
      const index = drafts.findIndex(d => d.id === currentDraftId);
      if (index >= 0) {
        drafts[index] = {
          ...drafts[index],
          ...data,
          updatedAt: now
        };
        saveDrafts();
        return drafts[index];
      }
    }
    
    // Create new draft
    const draft = {
      id: generateId(),
      content: data.content || '',
      imageUrl: data.imageUrl || null,
      gifUrl: data.gifUrl || null,
      poll: data.poll || null,
      createdAt: now,
      updatedAt: now
    };
    
    // Add to beginning
    drafts.unshift(draft);
    currentDraftId = draft.id;
    saveDrafts();
    updateDraftIndicator();
    
    return draft;
  }
  
  /**
   * Delete a draft
   * @param {string} id - Draft ID
   */
  function deleteDraft(id) {
    drafts = drafts.filter(d => d.id !== id);
    if (currentDraftId === id) {
      currentDraftId = null;
    }
    saveDrafts();
    updateDraftIndicator();
    
    // Re-render modal if open
    if (isModalOpen) {
      renderDraftsList();
    }
  }
  
  /**
   * Get all drafts
   * @returns {Array}
   */
  function getDrafts() {
    return drafts;
  }
  
  /**
   * Get a specific draft
   * @param {string} id - Draft ID
   * @returns {Object|null}
   */
  function getDraft(id) {
    return drafts.find(d => d.id === id) || null;
  }
  
  /**
   * Clear current draft (after posting)
   */
  function clearCurrentDraft() {
    if (currentDraftId) {
      deleteDraft(currentDraftId);
    }
    currentDraftId = null;
  }
  
  // ============================================
  // Autosave
  // ============================================
  
  /**
   * Get current composer state
   * @returns {Object}
   */
  function getComposerState() {
    const content = document.getElementById('post-content')?.value || '';
    const previewImg = document.getElementById('preview-img');
    const gifPreviewImg = document.getElementById('gif-preview-img');
    
    const imageUrl = previewImg?.src && previewImg.src !== window.location.href ? previewImg.src : null;
    const gifUrl = gifPreviewImg?.src && gifPreviewImg.src !== window.location.href ? gifPreviewImg.src : null;
    
    // Get poll data if visible
    let poll = null;
    const pollComposer = document.getElementById('poll-composer');
    if (pollComposer && pollComposer.classList.contains('visible')) {
      const options = [];
      document.querySelectorAll('#poll-options-list .poll-option-input input').forEach(input => {
        if (input.value.trim()) {
          options.push(input.value.trim());
        }
      });
      if (options.length >= 2) {
        poll = { options };
      }
    }
    
    return { content, imageUrl, gifUrl, poll };
  }
  
  /**
   * Set composer state from draft
   * @param {Object} draft - Draft data
   */
  function setComposerState(draft) {
    const textarea = document.getElementById('post-content');
    const imagePreview = document.getElementById('image-preview');
    const previewImg = document.getElementById('preview-img');
    const gifPreview = document.getElementById('gif-preview');
    const gifPreviewImg = document.getElementById('gif-preview-img');
    const charCount = document.getElementById('char-count');
    const postBtn = document.getElementById('post-btn');
    
    // Set content
    if (textarea) {
      textarea.value = draft.content || '';
      textarea.dispatchEvent(new Event('input'));
    }
    
    // Update char count
    if (charCount) {
      const len = (draft.content || '').length;
      charCount.textContent = `${len}/1000`;
      charCount.classList.toggle('warning', len > 900);
      charCount.classList.toggle('error', len > 1000);
    }
    
    // Enable post button if content
    if (postBtn) {
      postBtn.disabled = !(draft.content && draft.content.trim());
    }
    
    // Set image
    if (draft.imageUrl && previewImg && imagePreview) {
      previewImg.src = draft.imageUrl;
      imagePreview.style.display = 'block';
      // Hide gif if showing image
      if (gifPreview) gifPreview.style.display = 'none';
    } else if (imagePreview) {
      imagePreview.style.display = 'none';
    }
    
    // Set GIF
    if (draft.gifUrl && gifPreviewImg && gifPreview) {
      gifPreviewImg.src = draft.gifUrl;
      gifPreview.style.display = 'block';
      // Hide image if showing gif
      if (imagePreview) imagePreview.style.display = 'none';
      // Update global state if available
      if (typeof window.selectedGif !== 'undefined') {
        window.selectedGif = { url: draft.gifUrl };
      }
    } else if (gifPreview) {
      gifPreview.style.display = 'none';
      if (typeof window.selectedGif !== 'undefined') {
        window.selectedGif = null;
      }
    }
    
    // Set poll
    if (draft.poll && draft.poll.options) {
      const pollComposer = document.getElementById('poll-composer');
      const pollBtn = document.getElementById('poll-btn');
      
      if (pollComposer) {
        pollComposer.classList.add('visible');
        if (pollBtn) pollBtn.classList.add('active');
        
        // Clear existing options
        const optionsList = document.getElementById('poll-options-list');
        if (optionsList) {
          optionsList.innerHTML = '';
          
          draft.poll.options.forEach((opt, i) => {
            const div = document.createElement('div');
            div.className = 'poll-option-input';
            div.dataset.index = i;
            div.innerHTML = `
              <span class="poll-option-number">${i + 1}</span>
              <input type="text" placeholder="Option ${i + 1}" maxlength="100" value="${escapeHtmlAttr(opt)}">
              ${i >= 2 ? '<button class="poll-remove-option" onclick="removePollOption(this)" aria-label="Supprimer">×</button>' : ''}
            `;
            optionsList.appendChild(div);
          });
        }
      }
    }
    
    currentDraftId = draft.id;
  }
  
  /**
   * Escape HTML attribute value
   */
  function escapeHtmlAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
  
  /**
   * Schedule autosave
   */
  function scheduleAutosave() {
    if (autosaveTimeout) {
      clearTimeout(autosaveTimeout);
    }
    
    autosaveTimeout = setTimeout(() => {
      const state = getComposerState();
      
      // Only save if there's content
      if (state.content.trim() || state.imageUrl || state.gifUrl || state.poll) {
        saveDraft(state);
        showAutosaveIndicator();
      }
    }, AUTOSAVE_DELAY);
  }
  
  /**
   * Show autosave indicator
   */
  function showAutosaveIndicator() {
    const indicator = document.getElementById('autosave-indicator');
    if (indicator) {
      indicator.classList.add('visible');
      setTimeout(() => {
        indicator.classList.remove('visible');
      }, 1500);
    }
  }
  
  // ============================================
  // UI
  // ============================================
  
  /**
   * Update drafts button indicator
   */
  function updateDraftIndicator() {
    const btn = document.getElementById('drafts-btn');
    const badge = document.getElementById('drafts-count');
    
    if (btn && badge) {
      const count = drafts.length;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  }
  
  /**
   * Open drafts modal
   */
  function openModal() {
    const modal = document.getElementById('drafts-modal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      isModalOpen = true;
      renderDraftsList();
    }
  }
  
  /**
   * Close drafts modal
   */
  function closeModal() {
    const modal = document.getElementById('drafts-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
      isModalOpen = false;
    }
  }
  
  /**
   * Format relative time
   */
  function formatTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `Il y a ${Math.floor(diff / 86400)}j`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }
  
  /**
   * Truncate text
   */
  function truncate(text, maxLength = 100) {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength).trim() + '...';
  }
  
  /**
   * Escape HTML
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
  
  /**
   * Render drafts list in modal
   */
  function renderDraftsList() {
    const list = document.getElementById('drafts-list');
    if (!list) return;
    
    if (drafts.length === 0) {
      list.innerHTML = `
        <div class="drafts-empty">
          <div class="drafts-empty-icon">📝</div>
          <div class="drafts-empty-title">Aucun brouillon</div>
          <div class="drafts-empty-text">
            Tes posts non publiés seront sauvegardés automatiquement ici.
          </div>
        </div>
      `;
      return;
    }
    
    list.innerHTML = drafts.map((draft, index) => {
      const hasMedia = draft.imageUrl || draft.gifUrl;
      const hasPoll = draft.poll && draft.poll.options;
      
      let mediaIndicator = '';
      if (draft.imageUrl) {
        mediaIndicator = '<span class="draft-media-indicator" title="Avec image">📷</span>';
      } else if (draft.gifUrl) {
        mediaIndicator = '<span class="draft-media-indicator" title="Avec GIF">GIF</span>';
      }
      if (hasPoll) {
        mediaIndicator += '<span class="draft-media-indicator" title="Avec sondage">📊</span>';
      }
      
      const isActive = draft.id === currentDraftId;
      
      return `
        <div class="draft-item ${isActive ? 'active' : ''}" data-draft-id="${draft.id}" style="animation-delay: ${index * 0.05}s;">
          <div class="draft-item-content" onclick="CinqDrafts.restoreDraft('${draft.id}')">
            <div class="draft-item-preview">
              ${escapeHtml(truncate(draft.content, 120)) || '<em style="opacity: 0.5;">Post vide</em>'}
            </div>
            <div class="draft-item-meta">
              <span class="draft-item-time">${formatTime(draft.updatedAt)}</span>
              ${mediaIndicator}
              ${isActive ? '<span class="draft-active-badge">En cours</span>' : ''}
            </div>
          </div>
          <button 
            class="draft-item-delete" 
            onclick="event.stopPropagation(); CinqDrafts.deleteDraft('${draft.id}')" 
            aria-label="Supprimer ce brouillon"
            title="Supprimer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }).join('');
  }
  
  /**
   * Restore a draft to composer
   */
  function restoreDraft(id) {
    const draft = getDraft(id);
    if (!draft) return;
    
    setComposerState(draft);
    closeModal();
    
    // Focus textarea
    setTimeout(() => {
      document.getElementById('post-content')?.focus();
    }, 100);
    
    // Show toast
    if (typeof showToast === 'function') {
      showToast({ type: 'success', message: '📝 Brouillon restauré' });
    }
  }
  
  // ============================================
  // Event Binding
  // ============================================
  
  /**
   * Initialize the drafts module
   */
  function init() {
    // Load existing drafts
    loadDrafts();
    updateDraftIndicator();
    
    // Bind autosave to composer
    const textarea = document.getElementById('post-content');
    if (textarea) {
      textarea.addEventListener('input', scheduleAutosave);
    }
    
    // Bind modal events
    const modal = document.getElementById('drafts-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          closeModal();
        }
      });
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Escape to close modal
      if (e.key === 'Escape' && isModalOpen) {
        closeModal();
      }
      // Ctrl+Shift+D to open drafts
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        openModal();
      }
    });
    
    console.log('[Drafts] Module initialized with', drafts.length, 'drafts');
  }
  
  // ============================================
  // Public API
  // ============================================
  
  return {
    init,
    saveDraft,
    deleteDraft,
    getDrafts,
    getDraft,
    clearCurrentDraft,
    openModal,
    closeModal,
    restoreDraft,
    scheduleAutosave,
    getComposerState
  };
  
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CinqDrafts.init());
} else {
  CinqDrafts.init();
}
