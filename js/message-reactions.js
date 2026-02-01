/**
 * Message Reactions - Client-side emoji reactions on messages
 * Integrates with the message-reactions API
 */

class MessageReactions {
    constructor() {
        this.allowedEmojis = ['❤️', '😂', '😮', '😢', '👏', '🔥', '👍', '👎'];
        this.reactions = new Map(); // messageId -> reactions data
        this.init();
    }

    init() {
        // Add reaction buttons to existing messages
        this.addReactionButtons();
        
        // Listen for new messages
        document.addEventListener('messageAdded', (e) => {
            this.addReactionButtonToMessage(e.detail.messageElement);
        });
    }

    addReactionButtons() {
        const messages = document.querySelectorAll('.message');
        messages.forEach(msg => this.addReactionButtonToMessage(msg));
    }

    addReactionButtonToMessage(messageElement) {
        if (messageElement.querySelector('.reaction-trigger')) {
            return; // Already has reactions
        }

        const messageId = messageElement.dataset.messageId;
        if (!messageId) return;

        // Create reaction trigger (small emoji button)
        const reactionTrigger = document.createElement('button');
        reactionTrigger.className = 'reaction-trigger';
        reactionTrigger.innerHTML = '<span class="emoji">😊</span>';
        reactionTrigger.title = 'Réagir à ce message';
        reactionTrigger.setAttribute('aria-label', 'Ajouter une réaction');

        // Create reactions container
        const reactionsContainer = document.createElement('div');
        reactionsContainer.className = 'message-reactions-container';
        
        // Add click handler for trigger
        reactionTrigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showReactionPicker(messageId, reactionTrigger);
        });

        // Insert after message content
        const messageContent = messageElement.querySelector('.message-content, .message-text');
        if (messageContent) {
            messageContent.parentNode.insertBefore(reactionTrigger, messageContent.nextSibling);
            messageContent.parentNode.insertBefore(reactionsContainer, reactionTrigger.nextSibling);
        }

        // Load existing reactions
        this.loadReactions(messageId);
    }

    showReactionPicker(messageId, triggerElement) {
        // Remove existing picker
        const existingPicker = document.querySelector('.reaction-picker');
        if (existingPicker) {
            existingPicker.remove();
        }

        // Create reaction picker
        const picker = document.createElement('div');
        picker.className = 'reaction-picker';
        picker.innerHTML = this.allowedEmojis.map(emoji => 
            `<button class="reaction-option" data-emoji="${emoji}">${emoji}</button>`
        ).join('');

        // Position picker
        const rect = triggerElement.getBoundingClientRect();
        picker.style.position = 'absolute';
        picker.style.top = `${rect.bottom + 5}px`;
        picker.style.left = `${rect.left}px`;
        picker.style.zIndex = '1000';

        document.body.appendChild(picker);

        // Add click handlers for emoji options
        picker.addEventListener('click', (e) => {
            if (e.target.classList.contains('reaction-option')) {
                const emoji = e.target.dataset.emoji;
                this.addReaction(messageId, emoji);
                picker.remove();
            }
        });

        // Remove picker when clicking outside
        const removePickerOnClick = (e) => {
            if (!picker.contains(e.target) && e.target !== triggerElement) {
                picker.remove();
                document.removeEventListener('click', removePickerOnClick);
            }
        };
        setTimeout(() => document.addEventListener('click', removePickerOnClick), 100);
    }

    async loadReactions(messageId) {
        try {
            const response = await fetch(`/api/message-reactions?message_id=${messageId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.reactions.set(messageId, data.reactions);
                this.renderReactions(messageId);
            }
        } catch (error) {
            console.error('Failed to load reactions:', error);
        }
    }

    async addReaction(messageId, emoji) {
        try {
            // Optimistic UI update
            this.updateReactionOptimistic(messageId, emoji, true);

            const response = await fetch('/api/message-reactions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    message_id: messageId,
                    emoji
                })
            });

            if (response.ok) {
                // Reload actual reactions to ensure consistency
                this.loadReactions(messageId);
                
                // Show subtle feedback
                this.showReactionFeedback(emoji, 'added');
            } else {
                // Revert optimistic update
                this.updateReactionOptimistic(messageId, emoji, false);
                throw new Error('Failed to add reaction');
            }
        } catch (error) {
            console.error('Failed to add reaction:', error);
            this.showError('Impossible d\'ajouter la réaction');
        }
    }

    async removeReaction(messageId, emoji) {
        try {
            // Optimistic UI update
            this.updateReactionOptimistic(messageId, emoji, false);

            const response = await fetch(`/api/message-reactions?message_id=${messageId}&emoji=${encodeURIComponent(emoji)}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                this.loadReactions(messageId);
                this.showReactionFeedback(emoji, 'removed');
            } else {
                this.updateReactionOptimistic(messageId, emoji, true);
                throw new Error('Failed to remove reaction');
            }
        } catch (error) {
            console.error('Failed to remove reaction:', error);
            this.showError('Impossible de supprimer la réaction');
        }
    }

    updateReactionOptimistic(messageId, emoji, added) {
        const reactions = this.reactions.get(messageId) || [];
        const currentUserId = window.currentUser?.id;

        if (added) {
            // Add reaction
            let emojiReaction = reactions.find(r => r.emoji === emoji);
            if (!emojiReaction) {
                emojiReaction = {
                    emoji,
                    count: 0,
                    users: [],
                    user_reacted: false
                };
                reactions.push(emojiReaction);
            }
            emojiReaction.count++;
            emojiReaction.user_reacted = true;
            emojiReaction.users.push({
                id: currentUserId,
                display_name: window.currentUser?.display_name || 'Vous'
            });
        } else {
            // Remove reaction
            const emojiReaction = reactions.find(r => r.emoji === emoji);
            if (emojiReaction) {
                emojiReaction.count = Math.max(0, emojiReaction.count - 1);
                emojiReaction.user_reacted = false;
                emojiReaction.users = emojiReaction.users.filter(u => u.id !== currentUserId);
                
                if (emojiReaction.count === 0) {
                    const index = reactions.indexOf(emojiReaction);
                    reactions.splice(index, 1);
                }
            }
        }

        this.reactions.set(messageId, reactions);
        this.renderReactions(messageId);
    }

    renderReactions(messageId) {
        const reactions = this.reactions.get(messageId) || [];
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (!messageElement) return;

        const container = messageElement.querySelector('.message-reactions-container');
        if (!container) return;

        if (reactions.length === 0) {
            container.innerHTML = '';
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = reactions.map(reaction => {
            const userReacted = reaction.user_reacted;
            const title = reaction.users.map(u => u.display_name).join(', ');
            
            return `
                <button class="message-reaction ${userReacted ? 'user-reacted' : ''}" 
                        data-emoji="${reaction.emoji}"
                        data-message-id="${messageId}"
                        title="${title}">
                    <span class="emoji">${reaction.emoji}</span>
                    <span class="count">${reaction.count}</span>
                </button>
            `;
        }).join('');

        // Add click handlers for toggling reactions
        container.addEventListener('click', (e) => {
            const reactionBtn = e.target.closest('.message-reaction');
            if (reactionBtn) {
                const emoji = reactionBtn.dataset.emoji;
                const userReacted = reactionBtn.classList.contains('user-reacted');
                
                if (userReacted) {
                    this.removeReaction(messageId, emoji);
                } else {
                    this.addReaction(messageId, emoji);
                }
            }
        });
    }

    showReactionFeedback(emoji, action) {
        const feedback = document.createElement('div');
        feedback.className = 'reaction-feedback';
        feedback.textContent = action === 'added' ? `Réaction ${emoji} ajoutée` : `Réaction ${emoji} supprimée`;
        
        document.body.appendChild(feedback);
        feedback.style.position = 'fixed';
        feedback.style.bottom = '20px';
        feedback.style.right = '20px';
        feedback.style.background = 'var(--color-success)';
        feedback.style.color = 'white';
        feedback.style.padding = '10px 15px';
        feedback.style.borderRadius = '8px';
        feedback.style.zIndex = '9999';
        feedback.style.opacity = '0';
        feedback.style.transform = 'translateY(20px)';
        feedback.style.transition = 'all 0.3s ease';

        setTimeout(() => {
            feedback.style.opacity = '1';
            feedback.style.transform = 'translateY(0)';
        }, 10);

        setTimeout(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateY(-20px)';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
    }

    showError(message) {
        // Use existing error notification system or create simple one
        if (window.showNotification) {
            window.showNotification(message, 'error');
        } else {
            console.error(message);
        }
    }
}

// Initialize message reactions when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('/app') || window.location.pathname.includes('/messages')) {
        new MessageReactions();
    }
});

// CSS for message reactions (inline for simplicity)
const reactionStyles = `
    .reaction-trigger {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        border-radius: 50%;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.2s ease;
        margin-left: 8px;
        margin-top: 4px;
    }

    .reaction-trigger:hover {
        opacity: 1;
        background: var(--color-surface-3);
        transform: scale(1.1);
    }

    .reaction-picker {
        display: flex;
        gap: 4px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 20px;
        padding: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        animation: reactionPickerIn 0.2s ease;
    }

    .reaction-option {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s ease;
    }

    .reaction-option:hover {
        background: var(--color-surface-2);
        transform: scale(1.2);
    }

    .message-reactions-container {
        display: none;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
    }

    .message-reaction {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 4px 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 14px;
    }

    .message-reaction:hover {
        background: var(--color-surface-3);
        transform: translateY(-1px);
    }

    .message-reaction.user-reacted {
        background: var(--color-primary-alpha);
        border-color: var(--color-primary);
        color: var(--color-primary);
    }

    .message-reaction .emoji {
        font-size: 14px;
    }

    .message-reaction .count {
        font-size: 12px;
        font-weight: 500;
    }

    @keyframes reactionPickerIn {
        from { opacity: 0; transform: scale(0.9) translateY(-5px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
    }

    .reaction-feedback {
        font-size: 14px;
        font-weight: 500;
    }
`;

// Inject styles
const styleElement = document.createElement('style');
styleElement.textContent = reactionStyles;
document.head.appendChild(styleElement);