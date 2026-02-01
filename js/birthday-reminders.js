/**
 * Birthday Reminders - Client-side birthday reminder system
 * Shows upcoming birthdays and helps users remember important dates
 */

class BirthdayReminders {
    constructor() {
        this.reminders = [];
        this.todaysBirthdays = [];
        this.init();
    }

    init() {
        this.loadTodaysBirthdays();
        this.loadUpcomingReminders();
        this.addBirthdayIndicators();
        this.checkForTodayNotifications();

        // Refresh daily
        this.scheduleDailyRefresh();
    }

    async loadTodaysBirthdays() {
        try {
            const response = await fetch('/api/birthday-reminders/today', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.todaysBirthdays = data.today_birthdays || [];
                this.displayTodaysBirthdays();
            }
        } catch (error) {
            console.error('Failed to load today\'s birthdays:', error);
        }
    }

    async loadUpcomingReminders() {
        try {
            const response = await fetch('/api/birthday-reminders?limit=20', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.reminders = data.reminders || [];
                this.displayUpcomingBirthdays();
            }
        } catch (error) {
            console.error('Failed to load birthday reminders:', error);
        }
    }

    displayTodaysBirthdays() {
        if (this.todaysBirthdays.length === 0) return;

        // Show today's birthdays prominently
        this.showTodaysBirthdayNotification();
        this.addBirthdayBadgesToContacts();
    }

    showTodaysBirthdayNotification() {
        if (this.todaysBirthdays.length === 0) return;

        // Don't show if already shown today
        const lastShown = localStorage.getItem('lastBirthdayNotification');
        const today = new Date().toDateString();
        if (lastShown === today) return;

        const notification = document.createElement('div');
        notification.className = 'birthday-notification-today';
        notification.innerHTML = `
            <div class="birthday-notification-content">
                <div class="birthday-notification-header">
                    <span class="birthday-emoji">🎂</span>
                    <h3>Anniversaire${this.todaysBirthdays.length > 1 ? 's' : ''} aujourd'hui !</h3>
                    <button class="birthday-notification-close">&times;</button>
                </div>
                <div class="birthday-list">
                    ${this.todaysBirthdays.map(birthday => `
                        <div class="birthday-item">
                            <div class="birthday-contact">
                                ${this.getContactAvatar(birthday.contact)}
                                <span class="birthday-name">${birthday.contact.display_name}</span>
                                <span class="birthday-age">${birthday.age} ans</span>
                            </div>
                            <button class="btn-send-birthday-message" data-contact-id="${birthday.contact_user_id}">
                                💌 Souhaiter son anniversaire
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Add event listeners
        const closeBtn = notification.querySelector('.birthday-notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
            localStorage.setItem('lastBirthdayNotification', today);
        });

        const messageButtons = notification.querySelectorAll('.btn-send-birthday-message');
        messageButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const contactId = e.target.dataset.contactId;
                this.openBirthdayMessageComposer(contactId);
            });
        });

        // Auto-hide after 30 seconds if not interacted
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0.8';
            }
        }, 30000);
    }

    displayUpcomingBirthdays() {
        const upcomingContainer = document.querySelector('.upcoming-birthdays, #upcoming-birthdays');
        if (!upcomingContainer && this.reminders.length === 0) return;

        // Create container if it doesn't exist
        let container = upcomingContainer;
        if (!container && this.reminders.length > 0) {
            container = this.createUpcomingBirthdaysWidget();
        }

        if (!container) return;

        const upcomingReminders = this.reminders.filter(r => 
            r.days_until_reminder >= 0 && r.days_until_reminder <= 7
        );

        if (upcomingReminders.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="upcoming-birthdays-header">
                <span class="birthday-icon">🎂</span>
                <h4>Anniversaires à venir</h4>
            </div>
            <div class="upcoming-birthdays-list">
                ${upcomingReminders.map(reminder => this.renderUpcomingBirthday(reminder)).join('')}
            </div>
        `;
    }

    createUpcomingBirthdaysWidget() {
        const sidebar = document.querySelector('.sidebar, .app-sidebar, .dashboard-sidebar');
        if (!sidebar) return null;

        const widget = document.createElement('div');
        widget.className = 'upcoming-birthdays-widget';
        widget.id = 'upcoming-birthdays';
        
        // Insert after contacts or at the end
        const contactsSection = sidebar.querySelector('.contacts-section, .contact-list');
        if (contactsSection) {
            contactsSection.parentNode.insertBefore(widget, contactsSection.nextSibling);
        } else {
            sidebar.appendChild(widget);
        }

        return widget;
    }

    renderUpcomingBirthday(reminder) {
        const daysText = reminder.days_until_reminder === 0 ? 'Demain' : 
                        reminder.days_until_reminder === 1 ? 'Dans 2 jours' :
                        `Dans ${reminder.days_until_reminder + 1} jours`;

        return `
            <div class="upcoming-birthday-item" data-reminder-id="${reminder.id}">
                <div class="birthday-contact-info">
                    ${this.getContactAvatar(reminder.contact)}
                    <div class="birthday-details">
                        <div class="birthday-contact-name">${reminder.contact.display_name}</div>
                        <div class="birthday-timing">${daysText} • ${reminder.age ? `${reminder.age} ans` : 'Anniversaire'}</div>
                    </div>
                </div>
                <button class="btn-birthday-reminder" data-contact-id="${reminder.contact_user_id}" title="Programmer un message">
                    📅
                </button>
            </div>
        `;
    }

    addBirthdayBadgesToContacts() {
        this.todaysBirthdays.forEach(birthday => {
            const contactElements = document.querySelectorAll(`
                [data-contact-id="${birthday.contact_user_id}"],
                [data-user-id="${birthday.contact_user_id}"],
                .contact-card[data-contact-id="${birthday.contact_user_id}"]
            `);

            contactElements.forEach(element => {
                if (!element.querySelector('.birthday-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'birthday-badge birthday-today';
                    badge.innerHTML = '🎂';
                    badge.title = `Anniversaire aujourd'hui ! ${birthday.age} ans`;
                    element.appendChild(badge);
                }
            });
        });
    }

    addBirthdayIndicators() {
        // Add birthday indicators to contact cards for upcoming birthdays
        this.reminders.forEach(reminder => {
            if (reminder.days_until_reminder > 0 && reminder.days_until_reminder <= 3) {
                const contactElements = document.querySelectorAll(`
                    [data-contact-id="${reminder.contact_user_id}"],
                    [data-user-id="${reminder.contact_user_id}"]
                `);

                contactElements.forEach(element => {
                    if (!element.querySelector('.birthday-indicator')) {
                        const indicator = document.createElement('div');
                        indicator.className = 'birthday-indicator birthday-upcoming';
                        indicator.innerHTML = '🎈';
                        indicator.title = `Anniversaire ${reminder.days_until_reminder === 1 ? 'demain' : `dans ${reminder.days_until_reminder} jours`}`;
                        element.appendChild(indicator);
                    }
                });
            }
        });
    }

    checkForTodayNotifications() {
        // Check if we should show a notification for today's birthdays
        if (this.todaysBirthdays.length > 0) {
            // Show browser notification if permission granted
            this.showBrowserNotification();
        }
    }

    showBrowserNotification() {
        if (!('Notification' in window) || Notification.permission !== 'granted') {
            return;
        }

        const count = this.todaysBirthdays.length;
        const names = this.todaysBirthdays.map(b => b.contact.display_name).join(', ');
        
        const notification = new Notification(`🎂 Anniversaire${count > 1 ? 's' : ''} aujourd'hui !`, {
            body: count === 1 ? 
                `C'est l'anniversaire de ${names} aujourd'hui` : 
                `${count} personnes fêtent leur anniversaire : ${names}`,
            icon: '/assets/icons/birthday-icon.png',
            tag: 'birthday-reminder'
        });

        notification.onclick = () => {
            window.focus();
            this.showTodaysBirthdayNotification();
            notification.close();
        };
    }

    openBirthdayMessageComposer(contactId) {
        const contact = this.todaysBirthdays.find(b => b.contact_user_id === contactId);
        if (!contact) return;

        // Create birthday message templates
        const templates = [
            `🎂 Joyeux anniversaire ${contact.contact.display_name} ! 🎉`,
            `🥳 Happy birthday ! J'espère que tu passes une super journée ! 🎂`,
            `🎈 Bon anniversaire ! Profite bien de ta journée spéciale ! 🎁`,
            `🎊 ${contact.age} ans déjà ! Joyeux anniversaire ! 🎂`,
            `🎉 Une année de plus, une année de bonheur ! Bon anniversaire ! 🎂`
        ];

        const modal = document.createElement('div');
        modal.className = 'birthday-message-modal-overlay';
        modal.innerHTML = `
            <div class="birthday-message-modal">
                <div class="birthday-message-header">
                    <h3>💌 Message d'anniversaire pour ${contact.contact.display_name}</h3>
                    <button class="birthday-message-close">&times;</button>
                </div>
                <div class="birthday-message-content">
                    <div class="birthday-templates">
                        <h4>Suggestions de messages :</h4>
                        ${templates.map((template, index) => `
                            <button class="birthday-template" data-template="${template}">
                                ${template}
                            </button>
                        `).join('')}
                    </div>
                    <div class="birthday-message-composer">
                        <textarea placeholder="Ou écris ton propre message..." rows="3">${templates[0]}</textarea>
                        <div class="birthday-message-actions">
                            <button class="btn-cancel">Annuler</button>
                            <button class="btn-send-birthday-message">Envoyer 🎂</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const textarea = modal.querySelector('textarea');
        const templates_buttons = modal.querySelectorAll('.birthday-template');
        const closeBtn = modal.querySelector('.birthday-message-close');
        const cancelBtn = modal.querySelector('.btn-cancel');
        const sendBtn = modal.querySelector('.btn-send-birthday-message');

        // Template selection
        templates_buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                textarea.value = btn.dataset.template;
                textarea.focus();
            });
        });

        // Close handlers
        closeBtn.addEventListener('click', () => modal.remove());
        cancelBtn.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.remove();
        });

        // Send message
        sendBtn.addEventListener('click', () => {
            this.sendBirthdayMessage(contactId, textarea.value);
            modal.remove();
        });

        textarea.focus();
    }

    async sendBirthdayMessage(contactId, message) {
        if (!message.trim()) return;

        try {
            const response = await fetch('/api/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({
                    receiver_id: contactId,
                    content: message.trim()
                })
            });

            if (response.ok) {
                this.showBirthdayFeedback('Message d\'anniversaire envoyé ! 🎉', 'success');
                
                // Mark reminder as sent if exists
                const todayReminder = this.reminders.find(r => 
                    r.contact_user_id === contactId && r.days_until_reminder === 0
                );
                if (todayReminder) {
                    this.markReminderSent(todayReminder.id);
                }
            } else {
                throw new Error('Failed to send message');
            }
        } catch (error) {
            console.error('Failed to send birthday message:', error);
            this.showBirthdayFeedback('Erreur lors de l\'envoi', 'error');
        }
    }

    async markReminderSent(reminderId) {
        try {
            await fetch('/api/birthday-reminders/mark-sent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ reminder_id: reminderId })
            });
        } catch (error) {
            console.error('Failed to mark reminder as sent:', error);
        }
    }

    getContactAvatar(contact) {
        if (contact.avatar_emoji) {
            return `<div class="contact-avatar emoji-avatar">${contact.avatar_emoji}</div>`;
        } else if (contact.avatar_url) {
            return `<img src="${contact.avatar_url}" alt="${contact.display_name}" class="contact-avatar">`;
        } else {
            const initial = contact.display_name?.charAt(0).toUpperCase() || '?';
            return `<div class="contact-avatar initial-avatar">${initial}</div>`;
        }
    }

    showBirthdayFeedback(message, type = 'info') {
        const feedback = document.createElement('div');
        feedback.className = `birthday-feedback birthday-feedback-${type}`;
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

    scheduleDailyRefresh() {
        // Refresh at midnight
        const now = new Date();
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const msUntilMidnight = tomorrow.getTime() - now.getTime();

        setTimeout(() => {
            this.loadTodaysBirthdays();
            this.loadUpcomingReminders();
            
            // Schedule for next day
            setInterval(() => {
                this.loadTodaysBirthdays();
                this.loadUpcomingReminders();
            }, 24 * 60 * 60 * 1000); // Every 24 hours
        }, msUntilMidnight);
    }
}

// Initialize birthday reminders
document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.includes('/app') || window.location.pathname.includes('/dashboard')) {
        new BirthdayReminders();
    }
});

// CSS for birthday reminders
const birthdayStyles = `
    /* Today's birthday notification */
    .birthday-notification-today {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ff6b9d, #c44569);
        color: white;
        border-radius: 16px;
        box-shadow: 0 8px 32px rgba(196, 69, 105, 0.3);
        max-width: 400px;
        z-index: 9999;
        animation: birthdaySlideIn 0.4s ease;
    }

    .birthday-notification-content {
        padding: 20px;
    }

    .birthday-notification-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
    }

    .birthday-notification-header h3 {
        margin: 0;
        flex: 1;
        font-size: 16px;
        font-weight: 600;
    }

    .birthday-emoji {
        font-size: 24px;
    }

    .birthday-notification-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        transition: background 0.2s ease;
    }

    .birthday-notification-close:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    .birthday-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .birthday-item {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 12px;
    }

    .birthday-contact {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
    }

    .birthday-name {
        font-weight: 500;
        flex: 1;
    }

    .birthday-age {
        font-size: 12px;
        opacity: 0.9;
    }

    .btn-send-birthday-message {
        background: rgba(255, 255, 255, 0.2);
        color: white;
        border: 1px solid rgba(255, 255, 255, 0.3);
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s ease;
        width: 100%;
    }

    .btn-send-birthday-message:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
    }

    /* Upcoming birthdays widget */
    .upcoming-birthdays-widget {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
    }

    .upcoming-birthdays-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
    }

    .birthday-icon {
        font-size: 16px;
    }

    .upcoming-birthdays-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--color-text);
    }

    .upcoming-birthday-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--color-border-light);
    }

    .upcoming-birthday-item:last-child {
        border-bottom: none;
    }

    .birthday-contact-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
    }

    .birthday-contact-name {
        font-size: 13px;
        font-weight: 500;
        color: var(--color-text);
    }

    .birthday-timing {
        font-size: 11px;
        color: var(--color-text-secondary);
    }

    .btn-birthday-reminder {
        background: none;
        border: none;
        font-size: 16px;
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: background 0.2s ease;
    }

    .btn-birthday-reminder:hover {
        background: var(--color-surface-2);
    }

    /* Contact avatars */
    .contact-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 500;
    }

    .emoji-avatar {
        background: var(--color-surface-2);
        font-size: 16px;
    }

    .initial-avatar {
        background: var(--color-primary);
        color: white;
    }

    /* Birthday badges */
    .birthday-badge, .birthday-indicator {
        position: absolute;
        top: -8px;
        right: -8px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        z-index: 2;
        animation: birthdayBounce 2s infinite;
    }

    .birthday-today {
        background: linear-gradient(45deg, #ff6b9d, #c44569);
        box-shadow: 0 0 0 2px white, 0 0 12px rgba(255, 107, 157, 0.5);
    }

    .birthday-upcoming {
        background: linear-gradient(45deg, #ffa726, #ff7043);
        box-shadow: 0 0 0 2px white, 0 0 8px rgba(255, 167, 38, 0.3);
    }

    /* Birthday message composer */
    .birthday-message-modal-overlay {
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

    .birthday-message-modal {
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 16px;
        max-width: 500px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        animation: modalSlideIn 0.3s ease;
    }

    .birthday-message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid var(--color-border);
        background: linear-gradient(45deg, #ff6b9d, #c44569);
        color: white;
        border-radius: 16px 16px 0 0;
    }

    .birthday-message-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
    }

    .birthday-message-close {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
    }

    .birthday-message-content {
        padding: 20px;
    }

    .birthday-templates h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: var(--color-text);
    }

    .birthday-template {
        display: block;
        width: 100%;
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 8px;
        cursor: pointer;
        text-align: left;
        transition: all 0.2s ease;
        font-size: 13px;
    }

    .birthday-template:hover {
        background: var(--color-surface-3);
        border-color: var(--color-primary);
    }

    .birthday-message-composer {
        margin-top: 16px;
    }

    .birthday-message-composer textarea {
        width: 100%;
        min-height: 80px;
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        color: var(--color-text);
        resize: vertical;
    }

    .birthday-message-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
        justify-content: flex-end;
    }

    .birthday-message-actions button {
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;
    }

    .btn-cancel {
        background: var(--color-surface-2);
        border: 1px solid var(--color-border);
        color: var(--color-text-secondary);
    }

    .btn-cancel:hover {
        background: var(--color-surface-3);
    }

    .btn-send-birthday-message {
        background: linear-gradient(45deg, #ff6b9d, #c44569);
        border: none;
        color: white;
    }

    .btn-send-birthday-message:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(196, 69, 105, 0.3);
    }

    /* Animations */
    @keyframes birthdaySlideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }

    @keyframes birthdayBounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-6px); }
        60% { transform: translateY(-3px); }
    }

    /* Responsive */
    @media (max-width: 480px) {
        .birthday-notification-today {
            left: 10px;
            right: 10px;
            top: 10px;
            max-width: none;
        }

        .birthday-message-modal {
            width: 95%;
            margin: 20px;
        }
    }
`;

// Inject styles
const birthdayStyleElement = document.createElement('style');
birthdayStyleElement.textContent = birthdayStyles;
document.head.appendChild(birthdayStyleElement);