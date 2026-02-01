/**
 * CINQ Premium 5² — Frontend Module
 * Manages premium status, upgrade prompts, and soft paywalls
 */

const CinqPremium = (function() {
    'use strict';
    
    // Cached premium status
    let cachedStatus = null;
    let statusPromise = null;
    
    // ============================================
    // Premium Status
    // ============================================
    
    async function loadStatus(force = false) {
        if (!force && cachedStatus) {
            return cachedStatus;
        }
        
        if (statusPromise) {
            return statusPromise;
        }
        
        statusPromise = (async () => {
            try {
                const token = getAuthToken();
                if (!token) {
                    return null;
                }
                
                const res = await fetch('/api/premium-status', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!res.ok) {
                    return null;
                }
                
                const data = await res.json();
                cachedStatus = data;
                return data;
            } catch (err) {
                console.error('Error loading premium status:', err);
                return null;
            } finally {
                statusPromise = null;
            }
        })();
        
        return statusPromise;
    }
    
    function isPremium() {
        return cachedStatus?.isPremium || false;
    }
    
    function getContactLimit() {
        return cachedStatus?.contactLimit || 5;
    }
    
    function getContactCount() {
        return cachedStatus?.contactCount || 0;
    }
    
    function canAddContact() {
        const limit = getContactLimit();
        const count = getContactCount();
        return count < limit;
    }
    
    // ============================================
    // Auth Helper
    // ============================================
    
    function getAuthToken() {
        // Try to get token from UserProfile if available
        if (typeof UserProfile !== 'undefined' && UserProfile.getSession) {
            return UserProfile.getSession()?.access_token;
        }
        
        // Fallback to localStorage
        try {
            const session = localStorage.getItem('cinq_session');
            if (session) {
                return JSON.parse(session).access_token;
            }
        } catch (e) {}
        
        return null;
    }
    
    // ============================================
    // Soft Paywall Modal
    // ============================================
    
    function showUpgradeModal(reason = 'limit') {
        // Remove existing modal
        const existing = document.getElementById('premium-upgrade-modal');
        if (existing) existing.remove();
        
        const reasons = {
            'limit': {
                title: 'Tu as atteint tes 5 contacts 🎯',
                subtitle: 'Cinq, c\'est l\'idée que 5 vrais proches suffisent.\n\nMais si tu veux en garder plus, 5² te donne 25 slots pour tes proches.'
            },
            'feature': {
                title: 'Fonctionnalité Premium ✨',
                subtitle: 'Cette fonctionnalité est réservée aux membres 5².'
            },
            'general': {
                title: 'Passe à 5² ✨',
                subtitle: '25 contacts, badge premium, thèmes exclusifs et plus encore.'
            }
        };
        
        const content = reasons[reason] || reasons.general;
        
        const modal = document.createElement('div');
        modal.id = 'premium-upgrade-modal';
        modal.className = 'premium-modal-overlay';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'premium-modal-title');
        
        modal.innerHTML = `
            <div class="premium-modal">
                <button class="premium-modal-close" onclick="CinqPremium.closeModal()" aria-label="Fermer">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                
                <div class="premium-modal-content">
                    <div class="premium-modal-icon">✨</div>
                    <h2 id="premium-modal-title" class="premium-modal-title">${content.title}</h2>
                    <p class="premium-modal-subtitle">${content.subtitle.replace(/\n/g, '<br>')}</p>
                    
                    <div class="premium-modal-price">
                        <span class="premium-modal-price-amount">4,99€</span>
                        <span class="premium-modal-price-period">à vie</span>
                    </div>
                    
                    <ul class="premium-modal-features">
                        <li>25 contacts au lieu de 5</li>
                        <li>Badge ✨ sur ton profil</li>
                        <li>Thèmes exclusifs</li>
                        <li>Soutenir Cinq ❤️</li>
                    </ul>
                    
                    <button class="premium-modal-btn-upgrade" onclick="CinqPremium.startCheckout()">
                        Découvrir 5²
                    </button>
                    
                    <button class="premium-modal-btn-dismiss" onclick="CinqPremium.closeModal()">
                        Non merci, je reste à 5
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus trap
        setTimeout(() => {
            modal.querySelector('.premium-modal-btn-upgrade').focus();
        }, 100);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on escape
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }
    
    function closeModal() {
        const modal = document.getElementById('premium-upgrade-modal');
        if (modal) {
            modal.classList.add('closing');
            setTimeout(() => modal.remove(), 200);
        }
    }
    
    // ============================================
    // Checkout Flow
    // ============================================
    
    async function startCheckout() {
        const btn = document.querySelector('.premium-modal-btn-upgrade');
        if (btn) {
            btn.disabled = true;
            btn.textContent = 'Chargement...';
        }
        
        try {
            const token = getAuthToken();
            if (!token) {
                showToast('Connecte-toi d\'abord', 'error');
                closeModal();
                return;
            }
            
            const res = await fetch('/api/create-checkout', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    successUrl: window.location.origin + '/settings?premium=success',
                    cancelUrl: window.location.href
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                if (data.code === 'ALREADY_PREMIUM') {
                    showToast('Tu es déjà premium ! 🎉', 'success');
                    closeModal();
                    cachedStatus = null; // Force reload
                    return;
                }
                throw new Error(data.error || 'Erreur lors du paiement');
            }
            
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
            
        } catch (err) {
            console.error('Checkout error:', err);
            showToast(err.message || 'Erreur lors du paiement', 'error');
            
            if (btn) {
                btn.disabled = false;
                btn.textContent = 'Découvrir 5²';
            }
        }
    }
    
    // ============================================
    // Toast Helper
    // ============================================
    
    function showToast(message, type = 'info') {
        // Use global showToast if available
        if (typeof window.showToast === 'function') {
            window.showToast(message, type);
            return;
        }
        
        // Fallback
        const container = document.getElementById('toast-container') || document.body;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 24px;
            background: var(--color-bg-secondary, #1a1a2e);
            color: var(--color-text, #fff);
            border-radius: 8px;
            z-index: 10001;
            animation: slideUp 0.3s ease;
        `;
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
    
    // ============================================
    // Premium Badge
    // ============================================
    
    function renderBadge() {
        if (!isPremium()) return '';
        return '<span class="premium-user-badge" title="5² Premium">✨</span>';
    }
    
    // ============================================
    // Inject Premium CSS
    // ============================================
    
    function injectStyles() {
        if (document.getElementById('cinq-premium-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'cinq-premium-styles';
        styles.textContent = `
            .premium-modal-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                animation: fadeIn 0.2s ease;
            }
            
            .premium-modal-overlay.closing {
                animation: fadeOut 0.2s ease forwards;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
            
            .premium-modal {
                background: var(--color-bg, #0a0a0b);
                border: 1px solid var(--color-border, #2a2a3e);
                border-radius: 16px;
                width: 90%;
                max-width: 400px;
                position: relative;
                animation: slideUp 0.3s ease;
            }
            
            @keyframes slideUp {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
            
            .premium-modal-close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 32px;
                height: 32px;
                border: none;
                background: transparent;
                color: var(--color-text-muted, #666);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            }
            
            .premium-modal-close:hover {
                background: var(--color-bg-tertiary, #1a1a2e);
                color: var(--color-text, #fff);
            }
            
            .premium-modal-content {
                padding: 32px 24px;
                text-align: center;
            }
            
            .premium-modal-icon {
                font-size: 48px;
                margin-bottom: 16px;
            }
            
            .premium-modal-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--color-text, #fff);
                margin-bottom: 8px;
            }
            
            .premium-modal-subtitle {
                font-size: 0.875rem;
                color: var(--color-text-secondary, #999);
                line-height: 1.5;
                margin-bottom: 24px;
            }
            
            .premium-modal-price {
                margin-bottom: 20px;
            }
            
            .premium-modal-price-amount {
                font-size: 2rem;
                font-weight: 700;
                background: linear-gradient(135deg, #FFD700 0%, #8B5CF6 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
            }
            
            .premium-modal-price-period {
                font-size: 0.875rem;
                color: var(--color-text-muted, #666);
                margin-left: 4px;
            }
            
            .premium-modal-features {
                list-style: none;
                padding: 0;
                margin: 0 0 24px;
                text-align: left;
                max-width: 240px;
                margin-left: auto;
                margin-right: auto;
            }
            
            .premium-modal-features li {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 0;
                color: var(--color-text-secondary, #999);
                font-size: 0.875rem;
            }
            
            .premium-modal-features li::before {
                content: "✓";
                color: #8B5CF6;
                font-weight: 600;
            }
            
            .premium-modal-btn-upgrade {
                width: 100%;
                padding: 14px 24px;
                background: linear-gradient(135deg, #8B5CF6 0%, #6366f1 100%);
                color: white;
                border: none;
                border-radius: 50px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                margin-bottom: 12px;
            }
            
            .premium-modal-btn-upgrade:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
            }
            
            .premium-modal-btn-upgrade:disabled {
                opacity: 0.6;
                cursor: not-allowed;
                transform: none;
            }
            
            .premium-modal-btn-dismiss {
                background: none;
                border: none;
                color: var(--color-text-muted, #666);
                font-size: 0.875rem;
                cursor: pointer;
                padding: 8px;
            }
            
            .premium-modal-btn-dismiss:hover {
                color: var(--color-text-secondary, #999);
            }
            
            /* Premium User Badge */
            .premium-user-badge {
                font-size: 0.875em;
                margin-left: 4px;
            }
        `;
        
        document.head.appendChild(styles);
    }
    
    // ============================================
    // Init
    // ============================================
    
    function init() {
        injectStyles();
        loadStatus();
    }
    
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
        loadStatus,
        isPremium,
        getContactLimit,
        getContactCount,
        canAddContact,
        showUpgradeModal,
        closeModal,
        startCheckout,
        renderBadge,
        // Expose cache invalidation
        invalidateCache: () => { cachedStatus = null; }
    };
    
})();

// Make globally available
window.CinqPremium = CinqPremium;
