/**
 * Conversation Streaks - Client-side streak tracking and display
 * Shows conversation streaks in contact cards and message interface
 */

class ConversationStreaks {
    constructor() {
        this.streaks = new Map(); // contactId -> streak data
        this.init();
    }

    init() {
        this.loadAllStreaks();
        this.addStreakDisplays();
        
        // Refresh streaks when a message is sent
        document.addEventListener('messageSent', () => {
            setTimeout(() => this.loadAllStreaks(), 1000); // Delay for backend processing
        });

        // Add streak info to contact cards
        document.addEventListener('contactCardRendered', () => {
            this.addStreakDisplays();
        });
    }

    async loadAllStreaks() {
        try {
            const response = await fetch('/api/conversation-streaks', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.processStreakData(data);
                this.updateStreakDisplays();
            }
        } catch (error) {
            console.error('Failed to load conversation streaks:', error);
        }
    }

    async loadStreakForContact(contactId) {
        try {
            const response = await fetch(`/api/conversation-streaks?contact_id=${contactId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.streak) {
                    this.streaks.set(contactId, data.streak);
                    this.updateStreakDisplayForContact(contactId);
                }
            }
        } catch (error) {
            console.error('Failed to load streak for contact:', error);
        }
    }

    processStreakData(data) {
        if (data.streaks) {
            data.streaks.forEach(streak => {
                this.streaks.set(streak.contact_user_id, streak);
            });
        }
    }

    addStreakDisplays() {
        // Add streak displays to contact cards
        const contactCards = document.querySelectorAll('.contact-card, .contact-item');
        contactCards.forEach(card => this.addStreakToContactCard(card));

        // Add streak display to chat headers
        const chatHeaders = document.querySelectorAll('.chat-header, .conversation-header');
        chatHeaders.forEach(header => this.addStreakToChatHeader(header));
    }

    addStreakToContactCard(contactCard) {
        if (contactCard.querySelector('.streak-display')) {
            return; // Already has streak display
        }

        const contactId = contactCard.dataset.contactId || contactCard.dataset.userId;
        if (!contactId) return;

        const streakElement = document.createElement('div');
        streakElement.className = 'streak-display contact-streak';
        contactCard.appendChild(streakElement);

        this.updateStreakDisplayForContact(contactId);
    }

    addStreakToChatHeader(chatHeader) {
        if (chatHeader.querySelector('.streak-display')) {
            return;
        }

        const contactId = chatHeader.dataset.contactId;
        if (!contactId) return;

        const streakElement = document.createElement('div');
        streakElement.className = 'streak-display chat-streak';
        streakElement.title = 'Streak de conversation';
        
        const contactName = chatHeader.querySelector('.contact-name, .chat-title');
        if (contactName) {
            contactName.parentNode.insertBefore(streakElement, contactName.nextSibling);
        } else {
            chatHeader.appendChild(streakElement);
        }

        this.updateStreakDisplayForContact(contactId);
    }

    updateStreakDisplays() {
        this.streaks.forEach((streak, contactId) => {
            this.updateStreakDisplayForContact(contactId);
        });
    }

    updateStreakDisplayForContact(contactId) {
        const streak = this.streaks.get(contactId);
        const displays = document.querySelectorAll(`.streak-display[data-contact-id="${contactId}"], [data-contact-id="${contactId}"] .streak-display, [data-user-id="${contactId}"] .streak-display`);
        
        displays.forEach(display => {
            display.dataset.contactId = contactId;
            this.renderStreakDisplay(display, streak);
        });
    }

    renderStreakDisplay(element, streak) {
        if (!streak || streak.current_streak === 0) {
            element.style.display = 'none';
            return;
        }

        element.style.display = 'block';
        
        const emoji = this.getStreakEmoji(streak.current_streak);
        const statusClass = `streak-${streak.status}`;
        
        element.className = `streak-display ${statusClass}`;
        
        let content = `
            <span class="streak-emoji">${emoji}</span>
            <span class="streak-count">${streak.current_streak}</span>
        `;

        // Add warning indicator if at risk
        if (streak.status === 'at_risk') {
            const hoursLeft = Math.floor(streak.time_until_risk / 3600);
            content += `<span class="streak-warning" title="Streak à risque - ${hoursLeft}h restantes">⚠️</span>`;
        }

        element.innerHTML = content;
        
        // Add tooltip with more info
        const tooltip = this.createStreakTooltip(streak);
        element.title = tooltip;

        // Add click handler for detailed view
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showStreakDetails(streak);
        });
    }

    createStreakTooltip(streak) {
        const lines = [
            `Streak actuelle: ${streak.current_streak} jours`,
            `Record personnel: ${streak.longest_streak} jours`
        ];

        if (streak.status === 'active' && streak.is_today) {
            lines.push('✅ Conversation aujourd\'hui');
        } else if (streak.status === 'at_risk') {
            const hoursLeft = Math.floor(streak.time_until_risk / 3600);
            lines.push(`⚠️ ${hoursLeft}h pour maintenir le streak`);
        } else if (streak.status === 'broken') {
            lines.push('💔 Streak interrompue');
        }

        if (streak.streak_start_date) {
            const startDate = new Date(streak.streak_start_date).toLocaleDateString('fr-FR');
            lines.push(`Début: ${startDate}`);
        }

        return lines.join('\n');
    }

    showStreakDetails(streak) {
        // Create detailed modal/popover
        const modal = document.createElement('div');
        modal.className = 'streak-modal-overlay';
        modal.innerHTML = `
            <div class="streak-modal">
                <div class="streak-modal-header">
                    <h3>Streak avec ${streak.contact?.display_name || 'Contact'}</h3>
                    <button class="streak-modal-close">&times;</button>
                </div>
                <div class="streak-modal-content">
                    <div class="streak-main-info">
                        <div class="streak-emoji-large">${this.getStreakEmoji(streak.current_streak)}</div>
                        <div class="streak-numbers">
                            <div class="streak-current">
                                <span class="number">${streak.current_streak}</span>
                                <span class="label">jours actuels</span>
                            </div>
                            <div class="streak-record">
                                <span class="number">${streak.longest_streak}</span>
                                <span class="label">record personnel</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="streak-status">
                        ${this.getStreakStatusHTML(streak)}
                    </div>

                    ${streak.status === 'broken' ? `
                        <div class="streak-actions">
                            <button class="btn-reset-streak" data-contact-id="${streak.contact_user_id}">
                                🔄 Remettre à zéro
                            </button>
                        </div>
                    ` : ''}

                    <div class="streak-tips">
                        <h4>💡 Conseils pour maintenir votre streak</h4>
                        <ul>
                            <li>Envoyez au moins un message par jour</li>
                            <li>Les pings comptent aussi !</li>
                            <li>Activez les notifications pour ne rien rater</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Add event listeners
        const closeBtn = modal.querySelector('.streak-modal-close');
        const resetBtn = modal.querySelector('.btn-reset-streak');

        closeBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetStreak(streak.contact_user_id);
                modal.remove();
            });
        }

        // Add escape key handler
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    getStreakStatusHTML(streak) {
        switch (streak.status) {
            case 'active':
                return `
                    <div class="status-active">
                        <span class="status-icon">🔥</span>
                        <span>Streak actif ! ${streak.is_today ? 'Vous avez parlé aujourd\'hui' : ''}</span>
                    </div>
                `;
            case 'at_risk':
                const hoursLeft = Math.floor(streak.time_until_risk / 3600);
                return `
                    <div class="status-at-risk">
                        <span class="status-icon">⚠️</span>
                        <span>Attention ! Plus que ${hoursLeft}h pour maintenir votre streak</span>
                    </div>
                `;
            case 'broken':
                return `
                    <div class="status-broken">
                        <span class="status-icon">💔</span>
                        <span>Streak interrompu depuis ${streak.days_since_last_message} jour(s)</span>
                    </div>
                `;
            default:
                return '';
        }
    }

    getStreakEmoji(streak) {
        if (streak === 0) return '💔';
        if (streak < 3) return '🌱';
        if (streak < 7) return '🔥';
        if (streak < 14) return '⚡';
        if (streak < 30) return '💎';
        if (streak < 100) return '🏆';
        return '👑';
    }

    async resetStreak(contactId) {
        try {
            const response = await fetch('/api/conversation-streaks/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ contact_id: contactId })
            });

            if (response.ok) {
                this.showStreakFeedback('Streak remis à zéro', 'success');
                this.loadStreakForContact(contactId);
            } else {
                throw new Error('Failed to reset streak');
            }
        } catch (error) {
            console.error('Failed to reset streak:', error);
            this.showStreakFeedback('Erreur lors de la remise à zéro', 'error');
        }
    }

    showStreakFeedback(message, type = 'info') {
        const feedback = document.createElement('div');
        feedback.className = `streak-feedback streak-feedback-${type}`;
        feedback.textContent = message;
        
        document.body.appendChild(feedback);
        feedback.style.position = 'fixed';
        feedback.style.bottom = '20px';
        feedback.style.right = '20px';
        feedback.style.padding = '12px 18px';
        feedback.style.borderRadius = '8px';
        feedback.style.zIndex = '9999';
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(20px)';
        feedback.style.transition = 'all 0.3s ease';

        const colors = {
            success: 'var(--color-success)',
            error: 'var(--color-error)',
            info: 'var(--color-primary)'
        };
        feedback.style.background = colors[type] || colors.info;
        feedback.style.color = 'white';

        setTimeout(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            feedback.style.opacity = '0';
            setTimeout(() => feedback.remove(), 300);
        }, 3000);
    }
}

// Initialize conversation streaks
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('/app') || window.location.pathname.includes('/messages')) {
        new ConversationStreaks();
    }
});

// CSS for conversation streaks
const streakStyles = `
    .streak-display {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 4px 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-left: 8px;
    }

    .streak-display:hover {
        background: var(--color-surface-3);
        transform: translateY(-1px);
    }

    .streak-display.streak-active {
        background: linear-gradient(45deg, #ff6b6b, #ff8e53);
        color: white;
        border-color: transparent;
    }

    .streak-display.streak-at_risk {
        background: linear-gradient(45deg, #ffa726, #ffcc02);
        color: white;
        border-color: transparent;
        animation: streakPulse 2s infinite;
    }

    .streak-display.streak-broken {
        background: var(--color-surface-3);
        opacity: 0.6;
    }

    .streak-emoji {
        font-size: 14px;
    }

    .streak-count {
        font-weight: 600;
    }

    .streak-warning {
        font-size: 10px;
        margin-left: 2px;
    }

    @keyframes streakPulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }

    /* Modal styles */
    .streak-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.3s ease;
    }

    .streak-modal {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        max-width: 400px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        animation: modalSlideIn 0.3s ease;
    }

    .streak-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--color-border);
    }

    .streak-modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
    }

    .streak-modal-close {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: var(--color-text-secondary);
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: all 0.2s ease;
    }

    .streak-modal-close:hover {
        background: var(--color-surface-2);
        color: var(--color-text);
    }

    .streak-modal-content {
        padding: 20px;
    }

    .streak-main-info {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-bottom: 24px;
        padding: 16px;
        background: var(--color-surface-2);
        border-radius: 12px;
    }

    .streak-emoji-large {
        font-size: 48px;
    }

    .streak-numbers {
        display: flex;
        gap: 16px;
    }

    .streak-current, .streak-record {
        text-align: center;
    }

    .streak-numbers .number {
        display: block;
        font-size: 24px;
        font-weight: 700;
        color: var(--color-primary);
    }

    .streak-numbers .label {
        display: block;
        font-size: 12px;
        color: var(--color-text-secondary);
        margin-top: 4px;
    }

    .streak-status {
        margin-bottom: 20px;
        padding: 12px;
        border-radius: 8px;
    }

    .status-active {
        background: linear-gradient(45deg, #4caf50, #81c784);
        color: white;
    }

    .status-at-risk {
        background: linear-gradient(45deg, #ff9800, #ffb74d);
        color: white;
    }

    .status-broken {
        background: var(--color-surface-3);
        color: var(--color-text-secondary);
    }

    .status-icon {
        margin-right: 8px;
    }

    .streak-actions {
        margin-bottom: 20px;
    }

    .btn-reset-streak {
        background: var(--color-error);
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .btn-reset-streak:hover {
        background: var(--color-error-dark);
        transform: translateY(-1px);
    }

    .streak-tips {
        background: var(--color-surface-2);
        padding: 16px;
        border-radius: 8px;
    }

    .streak-tips h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--color-text);
    }

    .streak-tips ul {
        margin: 0;
        padding-left: 20px;
        color: var(--color-text-secondary);
    }

    .streak-tips li {
        margin-bottom: 6px;
        font-size: 13px;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    @keyframes modalSlideIn {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    /* Responsive */
    @media (max-width: 480px) {
        .streak-modal {
            width: 95%;
            margin: 20px;
        }

        .streak-main-info {
            flex-direction: column;
            text-align: center;
            gap: 16px;
        }

        .streak-numbers {
            justify-content: center;
        }
    }
`;

// Inject styles
const streakStyleElement = document.createElement('style');
streakStyleElement.textContent = streakStyles;
document.head.appendChild(streakStyleElement);