/**
 * ==========================================================================
 * CINQ - Smart Replies Module
 * ==========================================================================
 * 
 * AI-like smart reply suggestions based on simple pattern matching.
 * Analyzes the last received message and suggests contextual responses.
 * 
 * Features:
 * - Pattern-based message analysis
 * - Contextual reply suggestions
 * - Category-aware responses (greetings, questions, emotions, etc.)
 * - One-click insertion into chat input
 * - Auto-hide on user typing
 * 
 * @author Cinq Team
 * @version 1.0.0
 */

'use strict';

const CinqSmartReplies = (function() {
    
    // ============================================
    // Configuration
    // ============================================
    
    const MAX_SUGGESTIONS = 3;
    const STORAGE_KEY = 'cinq_smart_replies_enabled';
    
    // ============================================
    // Pattern Definitions
    // ============================================
    
    /**
     * Pattern categories with regex patterns and suggested replies
     * Each pattern has: regex, priority (higher = preferred), and replies array
     */
    const PATTERNS = [
        // ========================================
        // Greetings & Salutations
        // ========================================
        {
            category: 'greeting_morning',
            patterns: [/\b(bonjour|bon matin|bonne journ[ée]e)\b/i],
            priority: 10,
            replies: [
                'Bonjour ! ☀️',
                'Hello ! Bonne journée à toi aussi !',
                'Coucou, bien dormi ? 😊'
            ]
        },
        {
            category: 'greeting_evening',
            patterns: [/\b(bonsoir|bonne soir[ée]e)\b/i],
            priority: 10,
            replies: [
                'Bonsoir ! 🌙',
                'Hey, bonne soirée !',
                'Salut, tu vas bien ?'
            ]
        },
        {
            category: 'greeting_night',
            patterns: [/\b(bonne nuit|dors bien|fais de beaux r[êe]ves)\b/i],
            priority: 10,
            replies: [
                'Bonne nuit ! 🌙💤',
                'Dors bien ! À demain 😴',
                'Fais de beaux rêves ✨'
            ]
        },
        {
            category: 'greeting_casual',
            patterns: [/^(salut|coucou|hey|yo|hello|hi)\b/i],
            priority: 8,
            replies: [
                'Hey ! 👋',
                'Salut, ça va ?',
                'Coucou ! 😊'
            ]
        },
        {
            category: 'greeting_whatsup',
            patterns: [/\b(quoi de (neuf|beau|9)|wesh|[çc]a (va|dit|roule))\b/i],
            priority: 9,
            replies: [
                'Ça va tranquille, et toi ?',
                'La forme ! Et de ton côté ?',
                'Rien de spécial, et toi quoi de neuf ?'
            ]
        },
        
        // ========================================
        // Questions - How are you
        // ========================================
        {
            category: 'how_are_you',
            patterns: [
                /\b(comment [çc]a va|[çc]a va|tu vas bien|la forme)\s*\??\s*$/i,
                /\b([çc]a va|t[ue] vas bien)\b.*\?/i
            ],
            priority: 15,
            replies: [
                'Ça va bien, merci ! Et toi ? 😊',
                'Super ! La forme, et toi ?',
                'Tranquille ! Et de ton côté ?'
            ]
        },
        {
            category: 'how_are_you_negative',
            patterns: [/\b(pas tr[èe]s bien|bof|moyen|pas top|pas ouf)\b/i],
            priority: 12,
            replies: [
                'Oh, qu\'est-ce qui se passe ? 💙',
                'Je suis là si tu veux en parler',
                'Courage, ça va aller ❤️'
            ]
        },
        
        // ========================================
        // Questions - What are you doing
        // ========================================
        {
            category: 'what_doing',
            patterns: [
                /\b(tu fais quoi|tu fais koi|quoi de prévu|qu'?est.?ce (que )?tu fais)\b/i,
                /\b(t['']?es o[ùu]|tu es o[ùu]|t'es où)\b/i
            ],
            priority: 12,
            replies: [
                'Pas grand chose, pourquoi ?',
                'Je me détends un peu, et toi ?',
                'Rien de spécial, tu voulais faire quelque chose ?'
            ]
        },
        
        // ========================================
        // Questions - Availability
        // ========================================
        {
            category: 'availability',
            patterns: [
                /\b(tu es (libre|dispo)|t['']?es (libre|dispo)|on se voit|on fait quoi)\b/i,
                /\b(disponible|rdv|rendez-vous)\b/i
            ],
            priority: 14,
            replies: [
                'Oui, je suis dispo ! 👍',
                'Ça dépend quand, tu proposes quoi ?',
                'Peut-être, c\'est pour quoi ?'
            ]
        },
        {
            category: 'when_question',
            patterns: [/\b(quand|[àa] quelle heure|quel jour|c'?est (pour )?quand)\b.*\?/i],
            priority: 11,
            replies: [
                'Je regarde et je te dis !',
                'Ça dépend, tu as une préférence ?',
                'Dis-moi ce qui t\'arrange'
            ]
        },
        
        // ========================================
        // Positive Emotions & Reactions
        // ========================================
        {
            category: 'good_news',
            patterns: [
                /\b(super|génial|trop bien|excellent|parfait|incroyable|magnifique)\b/i,
                /\b(j'?ai (réussi|eu|gagné)|c'?est fait)\b/i
            ],
            priority: 10,
            replies: [
                'Trop bien ! 🎉',
                'Génial, je suis content(e) pour toi !',
                'Super nouvelle ! 🙌'
            ]
        },
        {
            category: 'excitement',
            patterns: [
                /\b(j['']?ai h[âa]te|trop pressé|vivement|impatient)\b/i,
                /(!{2,}|🎉|🥳|😍)/
            ],
            priority: 8,
            replies: [
                'Moi aussi j\'ai hâte ! 🎉',
                'Ça va être génial !',
                'Trop bien, vivement ! 😊'
            ]
        },
        {
            category: 'lol',
            patterns: [
                /\b(lol|mdr|ptdr|haha|hihi|😂|🤣|😆)\b/i,
                /(haha|hihi|ho+ho+|ah+ah+)/i
            ],
            priority: 7,
            replies: [
                '😂',
                'Haha trop drôle !',
                '🤣🤣'
            ]
        },
        
        // ========================================
        // Negative Emotions & Support
        // ========================================
        {
            category: 'sad',
            patterns: [
                /\b(triste|d[ée]prim[ée]|pas (le |la )?moral|mal|malheureux)\b/i,
                /\b(je (vais|suis) pas bien|dur|difficile|compliqu[ée])\b/i,
                /(😢|😭|💔|😔|😞)/
            ],
            priority: 15,
            replies: [
                'Je suis là pour toi ❤️',
                'Courage, ça va aller 💙',
                'Tu veux en parler ? Je suis là'
            ]
        },
        {
            category: 'stressed',
            patterns: [
                /\b(stress[ée]|anxieux|anxi[ée]t[ée]|paniqu|nerv(eux|euse)|tendu)\b/i,
                /\b(trop de (travail|boulot|choses)|d[ée]bord[ée]|submerg[ée])\b/i
            ],
            priority: 14,
            replies: [
                'Respire, tu vas gérer ! 💪',
                'Je suis là si tu as besoin',
                'Courage, une chose à la fois ❤️'
            ]
        },
        {
            category: 'tired',
            patterns: [
                /\b(fatigu[ée]|crev[ée]|[ée]puis[ée]|mort|dead|ko|naze)\b/i,
                /\b(besoin de (dormir|repos)|envie de rien)\b/i
            ],
            priority: 11,
            replies: [
                'Repose-toi bien ! 😴',
                'Fais une pause, tu le mérites',
                'Prends soin de toi ❤️'
            ]
        },
        {
            category: 'angry',
            patterns: [
                /\b([ée]nerv[ée]|en col[èe]re|furieux|ral|agac[ée]|sao[ûu]l[ée])\b/i,
                /\b(pu[t]+ain|merde|fait (chier|iech))\b/i
            ],
            priority: 12,
            replies: [
                'Qu\'est-ce qui s\'est passé ?',
                'Je comprends, c\'est frustrant',
                'Tu veux en parler ? 💙'
            ]
        },
        
        // ========================================
        // Thanks & Politeness
        // ========================================
        {
            category: 'thanks',
            patterns: [/\b(merci|thanks|thx|mrc)\b/i],
            priority: 12,
            replies: [
                'De rien ! 😊',
                'Avec plaisir !',
                'Pas de souci 👍'
            ]
        },
        {
            category: 'sorry',
            patterns: [/\b(d[ée]sol[ée]|pardon|excuse|sry|sorry)\b/i],
            priority: 11,
            replies: [
                'T\'inquiète, pas de souci !',
                'C\'est rien, t\'en fais pas 😊',
                'Pas grave !'
            ]
        },
        {
            category: 'please',
            patterns: [/\b(s'?il (te|vous) pla[iî]t|stp|svp|please|pls)\b/i],
            priority: 8,
            replies: [
                'Bien sûr ! 👍',
                'Oui, pas de problème',
                'Je m\'en occupe !'
            ]
        },
        
        // ========================================
        // Confirmations & Agreements
        // ========================================
        {
            category: 'agreement',
            patterns: [/^(ok|okay|d['']?accord|oui|ouais|yep|yup|ça marche|nickel)\.?!?$/i],
            priority: 6,
            replies: [
                '👍',
                'Super !',
                'Parfait !'
            ]
        },
        {
            category: 'disagreement',
            patterns: [/^(non|nan|nope|pas (vraiment|trop)|bof)\.?!?$/i],
            priority: 6,
            replies: [
                'D\'accord, pas de souci',
                'OK, une autre fois alors ?',
                'Comme tu veux 👍'
            ]
        },
        
        // ========================================
        // Birthday & Celebrations
        // ========================================
        {
            category: 'birthday',
            patterns: [/\b(anniversaire|birthday|anniv)\b/i],
            priority: 15,
            replies: [
                'Joyeux anniversaire ! 🎂🎉',
                'Bon anniv ! 🎈 Plein de bonheur !',
                'Happy birthday ! 🎁✨'
            ]
        },
        {
            category: 'congratulations',
            patterns: [
                /\b(f[ée]licitations|bravo|congrats|chapeau)\b/i,
                /\b(j['']?ai (r[ée]ussi|eu|d[ée]croch[ée]))\b/i
            ],
            priority: 13,
            replies: [
                'Félicitations ! 🎉',
                'Bravo, tu le mérites ! 👏',
                'Trop fier(e) de toi ! 🌟'
            ]
        },
        
        // ========================================
        // Plans & Activities
        // ========================================
        {
            category: 'food_drink',
            patterns: [
                /\b(manger|resto|restaurant|boire|caf[ée]|verre|ap[ée]ro)\b/i,
                /\b(tu veux|on va|on fait)\b.*\b(manger|boire)\b/i
            ],
            priority: 10,
            replies: [
                'Bonne idée ! 🍽️',
                'Je suis partant(e) !',
                'Avec plaisir, quand ?'
            ]
        },
        {
            category: 'movie_activity',
            patterns: [
                /\b(film|cin[ée]|s[ée]rie|netflix|regarder)\b/i,
                /\b(sortir|balade|promenade|activit[ée])\b/i
            ],
            priority: 9,
            replies: [
                'Je suis chaud(e) ! 🎬',
                'Bonne idée ! Tu proposes quoi ?',
                'Oui, ça me dit !'
            ]
        },
        
        // ========================================
        // Love & Affection
        // ========================================
        {
            category: 'love',
            patterns: [
                /\b(je t['']?aime|love you|bisou|câlin|❤️|💕|💗|😘)\b/i,
                /\b(tu me manques|hâte de te voir)\b/i
            ],
            priority: 16,
            replies: [
                '❤️❤️❤️',
                'Moi aussi je t\'aime ! 💕',
                'Tu me manques aussi 😘'
            ]
        },
        {
            category: 'thinking_of_you',
            patterns: [/\b(je pense [àa] toi|dans mes pens[ée]es|tu me manques)\b/i],
            priority: 14,
            replies: [
                'C\'est trop mignon 🥰',
                'Moi aussi je pense à toi !',
                '💕'
            ]
        },
        
        // ========================================
        // Misc
        // ========================================
        {
            category: 'help',
            patterns: [
                /\b(aide|help|besoin (de |d[''])aide|tu peux m['']?aider)\b/i,
                /\b(saurais|pourrais|peux).*(aider|faire)\b/i
            ],
            priority: 13,
            replies: [
                'Bien sûr, dis-moi !',
                'Je t\'écoute, qu\'est-ce qu\'il te faut ?',
                'Je peux essayer ! C\'est quoi ?'
            ]
        },
        {
            category: 'question_what',
            patterns: [/\b(c['']?est quoi|qu['']?est.?ce que?|pourquoi|comment)\b.*\?/i],
            priority: 7,
            replies: [
                'Bonne question !',
                'Hmm, laisse-moi réfléchir...',
                'Je sais pas trop, et toi ?'
            ]
        },
        {
            category: 'ping_received',
            patterns: [/^💫$/],
            priority: 20,
            replies: [
                '💫 Ping reçu !',
                'Hey ! Tu voulais me dire quelque chose ?',
                'Coucou, tout va bien ? 👋'
            ]
        }
    ];
    
    // ============================================
    // State
    // ============================================
    
    let isEnabled = true;
    let lastSuggestions = [];
    let currentContainer = null;
    
    // ============================================
    // Pattern Matching
    // ============================================
    
    /**
     * Analyze a message and find matching patterns
     * @param {string} message - The message to analyze
     * @returns {Array} - Matched patterns sorted by priority
     */
    function analyzeMessage(message) {
        if (!message || typeof message !== 'string') return [];
        
        const text = message.trim().toLowerCase();
        const matches = [];
        
        PATTERNS.forEach(pattern => {
            const hasMatch = pattern.patterns.some(regex => regex.test(text));
            if (hasMatch) {
                matches.push({
                    category: pattern.category,
                    priority: pattern.priority,
                    replies: pattern.replies
                });
            }
        });
        
        // Sort by priority (highest first)
        matches.sort((a, b) => b.priority - a.priority);
        
        return matches;
    }
    
    /**
     * Generate smart reply suggestions for a message
     * @param {string} message - The message to generate replies for
     * @returns {Array} - Array of suggested reply strings
     */
    function generateSuggestions(message) {
        const matches = analyzeMessage(message);
        
        if (matches.length === 0) {
            return [];
        }
        
        // Collect unique suggestions from top matches
        const suggestions = new Set();
        
        for (const match of matches) {
            // Add random replies from this category
            const shuffled = [...match.replies].sort(() => Math.random() - 0.5);
            
            for (const reply of shuffled) {
                if (suggestions.size < MAX_SUGGESTIONS) {
                    suggestions.add(reply);
                }
            }
            
            if (suggestions.size >= MAX_SUGGESTIONS) break;
        }
        
        return Array.from(suggestions);
    }
    
    // ============================================
    // UI Rendering
    // ============================================
    
    /**
     * Render the smart replies container
     * @param {Array} suggestions - Array of suggested replies
     * @param {HTMLElement} inputContainer - The container to insert suggestions into
     */
    function render(suggestions, inputContainer) {
        // Remove existing container
        hide();
        
        if (!isEnabled || !suggestions || suggestions.length === 0) {
            lastSuggestions = [];
            return;
        }
        
        lastSuggestions = suggestions;
        
        // Create container
        const container = document.createElement('div');
        container.id = 'smart-replies-container';
        container.className = 'smart-replies-container';
        container.setAttribute('role', 'listbox');
        container.setAttribute('aria-label', 'Suggestions de réponses');
        
        container.innerHTML = `
            <div class="smart-replies-header">
                <span class="smart-replies-icon">💡</span>
                <span class="smart-replies-label">Réponses suggérées</span>
            </div>
            <div class="smart-replies-list" role="list">
                ${suggestions.map((reply, i) => `
                    <button 
                        class="smart-reply-btn" 
                        data-reply="${escapeHtml(reply)}"
                        data-index="${i}"
                        role="option"
                        tabindex="${i === 0 ? '0' : '-1'}"
                    >
                        ${escapeHtml(reply)}
                    </button>
                `).join('')}
            </div>
        `;
        
        // Insert before the message form
        if (inputContainer) {
            inputContainer.insertBefore(container, inputContainer.firstChild);
            currentContainer = container;
            
            // Bind click handlers
            container.querySelectorAll('.smart-reply-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    insertReply(btn.dataset.reply);
                });
            });
            
            // Keyboard navigation
            container.addEventListener('keydown', handleKeyboard);
        }
    }
    
    /**
     * Hide the smart replies container
     */
    function hide() {
        const existing = document.getElementById('smart-replies-container');
        if (existing) {
            existing.remove();
        }
        currentContainer = null;
        lastSuggestions = [];
    }
    
    /**
     * Insert a reply into the chat input
     * @param {string} reply - The reply text to insert
     */
    function insertReply(reply) {
        const input = document.getElementById('message-input') || document.getElementById('chat-input');
        if (!input) return;
        
        input.value = reply;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        
        // Move cursor to end
        input.setSelectionRange(reply.length, reply.length);
        
        // Hide suggestions after selection
        hide();
        
        // Optional: show toast
        if (typeof showToast === 'function') {
            showToast('Réponse suggérée !', 'success');
        }
    }
    
    /**
     * Handle keyboard navigation in suggestions
     * @param {KeyboardEvent} e 
     */
    function handleKeyboard(e) {
        const buttons = currentContainer?.querySelectorAll('.smart-reply-btn');
        if (!buttons || buttons.length === 0) return;
        
        const current = document.activeElement;
        const currentIndex = Array.from(buttons).indexOf(current);
        
        switch (e.key) {
            case 'ArrowRight':
            case 'ArrowDown':
                e.preventDefault();
                const next = buttons[(currentIndex + 1) % buttons.length];
                next?.focus();
                break;
                
            case 'ArrowLeft':
            case 'ArrowUp':
                e.preventDefault();
                const prev = buttons[(currentIndex - 1 + buttons.length) % buttons.length];
                prev?.focus();
                break;
                
            case 'Escape':
                e.preventDefault();
                hide();
                document.getElementById('message-input')?.focus();
                break;
                
            case 'Enter':
            case ' ':
                e.preventDefault();
                if (current?.dataset?.reply) {
                    insertReply(current.dataset.reply);
                }
                break;
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
    // Settings
    // ============================================
    
    /**
     * Enable smart replies
     */
    function enable() {
        isEnabled = true;
        try {
            localStorage.setItem(STORAGE_KEY, 'true');
        } catch (e) {}
    }
    
    /**
     * Disable smart replies
     */
    function disable() {
        isEnabled = false;
        hide();
        try {
            localStorage.setItem(STORAGE_KEY, 'false');
        } catch (e) {}
    }
    
    /**
     * Toggle smart replies
     */
    function toggle() {
        if (isEnabled) {
            disable();
        } else {
            enable();
        }
        return isEnabled;
    }
    
    /**
     * Check if smart replies are enabled
     */
    function isActive() {
        return isEnabled;
    }
    
    // ============================================
    // Integration with Chat
    // ============================================
    
    /**
     * Process messages and show suggestions for the last received message
     * @param {Array} messages - Array of message objects
     * @param {string} currentUserId - Current user's ID
     * @param {HTMLElement} container - Container to insert suggestions
     */
    function processMessages(messages, currentUserId, container) {
        if (!isEnabled || !messages || messages.length === 0) {
            hide();
            return;
        }
        
        // Find the last message that is NOT from the current user
        const lastReceivedMessage = [...messages]
            .reverse()
            .find(msg => !msg.is_mine && msg.sender_id !== currentUserId);
        
        if (!lastReceivedMessage) {
            hide();
            return;
        }
        
        // Don't suggest for pings
        if (lastReceivedMessage.is_ping) {
            const pingMsg = '💫';
            const suggestions = generateSuggestions(pingMsg);
            render(suggestions, container);
            return;
        }
        
        const content = lastReceivedMessage.content;
        const suggestions = generateSuggestions(content);
        render(suggestions, container);
    }
    
    // ============================================
    // Initialization
    // ============================================
    
    /**
     * Initialize the smart replies module
     */
    function init() {
        // Load saved preference
        try {
            const saved = localStorage.getItem(STORAGE_KEY);
            if (saved === 'false') {
                isEnabled = false;
            }
        } catch (e) {}
        
        // Hide suggestions when user starts typing
        document.addEventListener('input', (e) => {
            if (e.target.id === 'message-input' || e.target.id === 'chat-input') {
                if (e.target.value.trim().length > 0) {
                    hide();
                }
            }
        });
        
        // Inject styles
        injectStyles();
        
        console.log('[SmartReplies] Module initialized');
    }
    
    /**
     * Inject CSS styles for smart replies
     */
    function injectStyles() {
        if (document.getElementById('smart-replies-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'smart-replies-styles';
        style.textContent = `
            .smart-replies-container {
                padding: 12px 16px;
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
                border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                animation: smartRepliesSlideIn 0.2s ease-out;
            }
            
            @keyframes smartRepliesSlideIn {
                from {
                    opacity: 0;
                    transform: translateY(-8px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            .smart-replies-header {
                display: flex;
                align-items: center;
                gap: 6px;
                margin-bottom: 10px;
            }
            
            .smart-replies-icon {
                font-size: 14px;
            }
            
            .smart-replies-label {
                font-size: 11px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: rgba(255, 255, 255, 0.5);
            }
            
            .smart-replies-list {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
            }
            
            .smart-reply-btn {
                display: inline-flex;
                align-items: center;
                padding: 8px 14px;
                background: rgba(255, 255, 255, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.15);
                border-radius: 20px;
                color: rgba(255, 255, 255, 0.9);
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.15s ease;
                white-space: nowrap;
                max-width: 100%;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            
            .smart-reply-btn:hover {
                background: rgba(99, 102, 241, 0.3);
                border-color: rgba(99, 102, 241, 0.5);
                transform: translateY(-1px);
            }
            
            .smart-reply-btn:focus {
                outline: none;
                background: rgba(99, 102, 241, 0.4);
                border-color: rgba(99, 102, 241, 0.6);
                box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
            }
            
            .smart-reply-btn:active {
                transform: translateY(0);
            }
            
            /* Dark mode adjustments */
            @media (prefers-color-scheme: light) {
                .smart-replies-container {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%);
                    border-bottom-color: rgba(0, 0, 0, 0.1);
                }
                
                .smart-replies-label {
                    color: rgba(0, 0, 0, 0.5);
                }
                
                .smart-reply-btn {
                    background: rgba(99, 102, 241, 0.1);
                    border-color: rgba(99, 102, 241, 0.2);
                    color: #4338ca;
                }
                
                .smart-reply-btn:hover {
                    background: rgba(99, 102, 241, 0.2);
                    border-color: rgba(99, 102, 241, 0.4);
                }
            }
            
            /* Mobile adjustments */
            @media (max-width: 480px) {
                .smart-replies-container {
                    padding: 10px 12px;
                }
                
                .smart-replies-list {
                    gap: 6px;
                }
                
                .smart-reply-btn {
                    padding: 6px 12px;
                    font-size: 12px;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // ============================================
    // Public API
    // ============================================
    
    return {
        init,
        
        // Core functions
        analyzeMessage,
        generateSuggestions,
        processMessages,
        
        // UI
        render,
        hide,
        insertReply,
        
        // Settings
        enable,
        disable,
        toggle,
        isActive,
        
        // Constants
        MAX_SUGGESTIONS,
        PATTERNS
    };
    
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CinqSmartReplies.init());
} else {
    CinqSmartReplies.init();
}

// Global access
window.CinqSmartReplies = CinqSmartReplies;
