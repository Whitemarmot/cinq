/**
 * 🎉 CINQ FUN ZONE
 * La friction est le feature... mais le fun aussi.
 * 
 * Easter eggs, animations surprises, micro-copy qui tue.
 * Parce que les anti-réseaux sociaux aussi ont le droit de sourire.
 */

(function() {
    'use strict';
    
    // ========================================
    // 🎨 CONSOLE ART & MESSAGES
    // ========================================
    
    const consoleMessages = [
        '%c🎯 CINQ',
        'font-size: 48px; font-weight: bold; color: #6366f1; text-shadow: 2px 2px 0 #1a1a2e;'
    ];
    
    const consoleSubtitle = [
        '%c5 personnes. Pas 500. Pas de bullshit.\n\n' +
        '👀 Si tu regardes ici, tu fais partie des curieux.\n' +
        '🔧 Et si tu veux contribuer: salut@cinq.app\n' +
        '💜 (Mais non, y\'a pas de secret ici. Ou peut-être...)',
        'color: #a5b4fc; font-size: 12px;'
    ];
    
    const secretMessages = [
        "🕵️ Psst... Tu cherches quelque chose ?",
        "🎮 Hint: ↑ ↑ ↓ ↓ ← → ← → B A",
        "🐛 C'est pas un bug, c'est une feature très exclusive.",
        "👋 Salut toi ! T'es du genre à lire les logs ?",
        "🤫 Le vrai cercle est les amis qu'on se fait en chemin.",
        "🧘 Respire. Tu n'as pas besoin de plus de 5 onglets ouverts.",
        "💡 Fun fact: cette app a été codée avec amour et beaucoup de café.",
        "🎁 Tu sais que tu peux offrir Cinq à quelqu'un ? Juste saying.",
        "🌙 Va dormir. Tes 5 seront encore là demain.",
        "🔮 La friction est le feature. Accepte-le."
    ];
    
    // Afficher les messages console au chargement
    console.log(...consoleMessages);
    console.log(...consoleSubtitle);
    
    // Message secret aléatoire après 10 secondes
    setTimeout(() => {
        const msg = secretMessages[Math.floor(Math.random() * secretMessages.length)];
        console.log('%c' + msg, 'color: #818cf8; font-style: italic;');
    }, 10000);
    
    // ========================================
    // 🎮 KONAMI CODE EASTER EGG
    // ========================================
    
    const konamiCode = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let konamiIndex = 0;
    
    const konamiEffects = [
        celebrateKonami,
        invertColors,
        partyMode,
        showSecretMessage,
        matrixRain
    ];
    
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase() === e.key ? e.key : e.key;
        
        if (key === konamiCode[konamiIndex] || key.toLowerCase() === konamiCode[konamiIndex]) {
            konamiIndex++;
            
            if (konamiIndex === konamiCode.length) {
                // 🎉 KONAMI ACTIVÉ!
                konamiIndex = 0;
                const effect = konamiEffects[Math.floor(Math.random() * konamiEffects.length)];
                effect();
                console.log('%c🎮 KONAMI CODE ACTIVÉ! Tu es un·e vrai·e!', 'color: #22c55e; font-size: 16px; font-weight: bold;');
            }
        } else {
            konamiIndex = 0;
        }
    });
    
    function celebrateKonami() {
        launchConfetti();
        showToast("🎮 +30 vies! Oh wait, c'est pas ce jeu...");
    }
    
    function invertColors() {
        document.body.style.filter = 'invert(1) hue-rotate(180deg)';
        showToast("🌓 Mode dimension parallèle activé!");
        setTimeout(() => {
            document.body.style.filter = '';
        }, 3000);
    }
    
    function partyMode() {
        let hue = 0;
        showToast("🪩 PARTY MODE!");
        const interval = setInterval(() => {
            hue = (hue + 10) % 360;
            document.body.style.filter = `hue-rotate(${hue}deg)`;
        }, 50);
        setTimeout(() => {
            clearInterval(interval);
            document.body.style.filter = '';
        }, 5000);
    }
    
    function showSecretMessage() {
        const messages = [
            "Tu mérites tes 5. Vraiment.",
            "La qualité > la quantité. Toujours.",
            "Tu es plus que tes likes.",
            "Quelqu'un pense à toi en ce moment. 💜",
            "Les vrais savent. Tu fais partie des vrais."
        ];
        const msg = messages[Math.floor(Math.random() * messages.length)];
        showBigMessage(msg);
    }
    
    function matrixRain() {
        showToast("🟢 Wake up, Neo...");
        
        const canvas = document.createElement('canvas');
        canvas.id = 'matrix-rain';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;opacity:0.3;';
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const chars = 'CINQ5♡💜🎯';
        const fontSize = 16;
        const columns = canvas.width / fontSize;
        const drops = Array(Math.floor(columns)).fill(1);
        
        const draw = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.fillStyle = '#6366f1';
            ctx.font = `${fontSize}px monospace`;
            
            for (let i = 0; i < drops.length; i++) {
                const char = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillText(char, i * fontSize, drops[i] * fontSize);
                
                if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                drops[i]++;
            }
        };
        
        const interval = setInterval(draw, 50);
        setTimeout(() => {
            clearInterval(interval);
            canvas.remove();
        }, 5000);
    }
    
    // ========================================
    // 🎊 CONFETTI ENGINE
    // ========================================
    
    window.launchConfetti = function(options = {}) {
        const defaults = {
            particleCount: 100,
            spread: 70,
            origin: { x: 0.5, y: 0.6 },
            colors: ['#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#22c55e', '#eab308']
        };
        
        const config = { ...defaults, ...options };
        
        // Créer le canvas confetti
        let canvas = document.getElementById('confetti-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'confetti-canvas';
            canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;pointer-events:none;';
            document.body.appendChild(canvas);
        }
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const particles = [];
        const shapes = ['square', 'circle', 'star'];
        
        for (let i = 0; i < config.particleCount; i++) {
            particles.push({
                x: canvas.width * config.origin.x,
                y: canvas.height * config.origin.y,
                vx: (Math.random() - 0.5) * config.spread * 0.5,
                vy: (Math.random() - 0.7) * config.spread * 0.5 - 10,
                size: Math.random() * 10 + 5,
                color: config.colors[Math.floor(Math.random() * config.colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                gravity: 0.3 + Math.random() * 0.2,
                friction: 0.99,
                opacity: 1
            });
        }
        
        function drawParticle(p) {
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            
            if (p.shape === 'square') {
                ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            } else if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Star
                ctx.beginPath();
                for (let i = 0; i < 5; i++) {
                    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
                    const x = Math.cos(angle) * p.size / 2;
                    const y = Math.sin(angle) * p.size / 2;
                    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                }
                ctx.closePath();
                ctx.fill();
            }
            
            ctx.restore();
        }
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            let stillAlive = false;
            
            particles.forEach(p => {
                if (p.opacity <= 0) return;
                
                p.vy += p.gravity;
                p.vx *= p.friction;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                
                if (p.y > canvas.height) {
                    p.opacity -= 0.02;
                }
                
                if (p.opacity > 0) {
                    stillAlive = true;
                    drawParticle(p);
                }
            });
            
            if (stillAlive) {
                requestAnimationFrame(animate);
            } else {
                canvas.remove();
            }
        }
        
        animate();
    };
    
    // ========================================
    // 🔔 TOAST NOTIFICATIONS
    // ========================================
    
    function showToast(message, duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10000;';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: rgba(99, 102, 241, 0.95);
            color: white;
            padding: 12px 24px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            animation: toastIn 0.3s ease-out;
            margin-top: 8px;
        `;
        toast.textContent = message;
        container.appendChild(toast);
        
        // Injecter l'animation
        if (!document.getElementById('toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes toastIn {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes toastOut {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(-20px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            toast.style.animation = 'toastOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    window.showToast = showToast;
    
    // ========================================
    // 💬 BIG MESSAGE OVERLAY
    // ========================================
    
    function showBigMessage(message) {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(26, 26, 46, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.5s ease-out;
            cursor: pointer;
        `;
        
        const text = document.createElement('div');
        text.style.cssText = `
            font-size: clamp(24px, 5vw, 48px);
            font-weight: bold;
            color: white;
            text-align: center;
            padding: 40px;
            animation: scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        `;
        text.textContent = message;
        
        // Injecter les animations
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.5); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            @keyframes fadeOut { from { opacity: 1; } to { opacity: 0; } }
        `;
        document.head.appendChild(style);
        
        overlay.appendChild(text);
        document.body.appendChild(overlay);
        
        const dismiss = () => {
            overlay.style.animation = 'fadeOut 0.3s ease-in forwards';
            setTimeout(() => overlay.remove(), 300);
        };
        
        overlay.addEventListener('click', dismiss);
        setTimeout(dismiss, 4000);
    }
    
    // ========================================
    // ✨ PING ANIMATION UPGRADE
    // ========================================
    
    // Chercher le bouton ping et améliorer son animation
    const enhancePingButton = () => {
        const pingBtn = document.getElementById('btn-ping');
        if (!pingBtn) return;
        
        const originalClick = pingBtn.onclick;
        
        pingBtn.onclick = async function(e) {
            // Animation satisfaisante
            pingBtn.style.transform = 'scale(1.2)';
            pingBtn.style.transition = 'transform 0.1s ease-out';
            
            // Ripple effect
            const ripple = document.createElement('span');
            ripple.style.cssText = `
                position: absolute;
                inset: 0;
                border-radius: 9999px;
                background: rgba(255,255,255,0.3);
                animation: rippleOut 0.6s ease-out forwards;
            `;
            pingBtn.style.position = 'relative';
            pingBtn.style.overflow = 'hidden';
            pingBtn.appendChild(ripple);
            
            // Injecter l'animation ripple
            if (!document.getElementById('ping-styles')) {
                const style = document.createElement('style');
                style.id = 'ping-styles';
                style.textContent = `
                    @keyframes rippleOut {
                        from { transform: scale(0); opacity: 1; }
                        to { transform: scale(2); opacity: 0; }
                    }
                    @keyframes pingSent {
                        0% { transform: scale(1); }
                        25% { transform: scale(1.3) rotate(-5deg); }
                        50% { transform: scale(1.5); }
                        75% { transform: scale(1.3) rotate(5deg); }
                        100% { transform: scale(1); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            setTimeout(() => {
                pingBtn.style.transform = '';
                ripple.remove();
            }, 600);
            
            // Petit toast de confirmation
            showToast("💫 Ping envoyé ! Genre, vraiment.");
            
            // Appeler le handler original
            if (originalClick) {
                return originalClick.call(this, e);
            }
        };
    };
    
    // ========================================
    // 🎯 5TH CONTACT CELEBRATION
    // ========================================
    
    window.celebrateFifthContact = function() {
        launchConfetti({ particleCount: 200, spread: 100 });
        showBigMessage("🎯 Cercle complet !");
        
        setTimeout(() => {
            showToast("Tu as tes 5. Le reste, c'est du bonus. 💜");
        }, 2000);
        
        console.log('%c🎯 CERCLE COMPLET! Tu as tes 5 personnes!', 'color: #22c55e; font-size: 20px; font-weight: bold;');
    };
    
    // ========================================
    // 🎲 RANDOM MICRO-COPY REPLACEMENTS
    // ========================================
    
    const randomGreetings = [
        "Salut", "Hey", "Yo", "Coucou", "Hello", "Wesh", "Bien le bonjour",
        "Oh tiens", "Re", "Bienvenue", "Ah te voilà", "On t'attendait"
    ];
    
    const randomEmptyStates = [
        "Pas encore de messages.\nLe silence aussi a du sens. 🌙",
        "C'est calme ici.\nParfois, ça fait du bien. ✨",
        "Rien pour l'instant.\nMais la qualité > la quantité. 💜",
        "Vide pour le moment.\nComme le frigo un dimanche soir. 🌚",
        "Pas de messages.\nPeut-être que c'est toi qui devrais écrire ? 🤔",
        "Silence radio.\nC'est pas Instagram ici, on se presse pas. 🧘",
        "Zéro message.\nMais zéro drama aussi, c'est le deal. ✌️"
    ];
    
    const randomLoadingStates = [
        "On compte jusqu'à 5...",
        "Patience, jeune padawan...",
        "Chargement zen en cours...",
        "Un instant de calme...",
        "Les petits cercles tournent...",
        "On réfléchit (pas trop)...",
        "Ça charge, tranquille...",
        "Méditation en cours...",
        "Respire, ça arrive..."
    ];
    
    function injectRandomCopy() {
        // Greeting random
        const greetingEl = document.getElementById('user-greeting');
        if (greetingEl) {
            const currentText = greetingEl.textContent;
            const name = currentText.replace(/^(Salut|Hey|Yo|Coucou|Hello|Wesh|Bien le bonjour|Oh tiens|Re|Bienvenue|Ah te voilà|On t'attendait),?\s*/i, '');
            if (name && Math.random() > 0.5) {
                const randomGreeting = randomGreetings[Math.floor(Math.random() * randomGreetings.length)];
                greetingEl.textContent = `${randomGreeting}, ${name}`;
            }
        }
        
        // Empty state random
        const emptyEl = document.getElementById('messages-empty');
        if (emptyEl && Math.random() > 0.3) {
            const randomEmpty = randomEmptyStates[Math.floor(Math.random() * randomEmptyStates.length)];
            emptyEl.innerHTML = randomEmpty.split('\n').map((line, i) => 
                i === 0 ? line : `<span class="text-white/50">${line}</span>`
            ).join('<br>');
        }
    }
    
    // ========================================
    // 🎭 HOVER EFFECTS JOUEURS
    // ========================================
    
    function injectPlayfulHoverEffects() {
        const style = document.createElement('style');
        style.textContent = `
            /* Contact slots wiggle on hover */
            .contact-slot:hover {
                animation: wiggle 0.3s ease-in-out;
            }
            @keyframes wiggle {
                0%, 100% { transform: rotate(0deg) translateY(-2px); }
                25% { transform: rotate(-1deg) translateY(-2px); }
                75% { transform: rotate(1deg) translateY(-2px); }
            }
            
            /* Empty slots pulse invitingly */
            .contact-slot.empty {
                animation: invitePulse 2s ease-in-out infinite;
            }
            @keyframes invitePulse {
                0%, 100% { opacity: 0.5; border-color: rgba(255,255,255,0.2); }
                50% { opacity: 0.7; border-color: rgba(99, 102, 241, 0.4); }
            }
            
            /* Button press effect */
            button:active:not(:disabled) {
                transform: scale(0.97) !important;
            }
            
            /* Message bubbles subtle entrance */
            .message {
                animation: messageSlide 0.3s ease-out;
            }
            @keyframes messageSlide {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            /* Logo bounce on click */
            .glow:active {
                animation: logoBounce 0.3s ease-out;
            }
            @keyframes logoBounce {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(0.9); }
            }
            
            /* Fun cursor on interactive elements */
            button:not(:disabled), a, .contact-slot {
                cursor: pointer;
            }
            
            /* Subtle glow pulse on CTA buttons */
            .bg-indigo-500:not(:disabled) {
                animation: glowPulse 3s ease-in-out infinite;
            }
            @keyframes glowPulse {
                0%, 100% { box-shadow: 0 0 20px rgba(99, 102, 241, 0.3); }
                50% { box-shadow: 0 0 30px rgba(99, 102, 241, 0.5); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // ========================================
    // 🎉 CELEBRATION MESSAGES
    // ========================================
    
    /**
     * Celebration Messages - Animations spéciales pour les messages
     * Détecte les mots-clés et lance des animations festives
     */
    const CelebrationMessages = {
        // Configuration des célébrations
        triggers: [
            {
                keywords: ['joyeux anniversaire', 'bon anniversaire', 'happy birthday', 'bonne fête', 'anniversaire'],
                animation: 'confetti',
                message: '🎂 Joyeux anniversaire !',
                colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#cc5de8', '#f8b500']
            },
            {
                keywords: ['bravo', 'félicitations', 'félicitation', 'congrats', 'congratulations', 'bien joué', 'bien jouée', 'chapeau', 'excellent', 'super', 'génial'],
                animation: 'applause',
                message: '👏 Bravo !'
            },
            {
                keywords: ['bonne année', 'happy new year', 'nouvel an', 'meilleurs voeux'],
                animation: 'fireworks',
                message: '🎆 Bonne année !'
            },
            {
                keywords: ['je t\'aime', 'i love you', 'love you', 'bisous', '❤️', '💕', '💜', '💙'],
                animation: 'hearts',
                message: '💜'
            },
            {
                keywords: ['merci', 'thanks', 'thank you', 'gracias', 'danke'],
                animation: 'sparkle',
                message: '✨'
            }
        ],
        
        // Vérifie si le texte contient un mot-clé de célébration
        detectCelebration(text) {
            const normalizedText = text.toLowerCase().trim();
            
            for (const trigger of this.triggers) {
                for (const keyword of trigger.keywords) {
                    if (normalizedText.includes(keyword.toLowerCase())) {
                        return trigger;
                    }
                }
            }
            return null;
        },
        
        // Lance l'animation confetti (anniversaires)
        launchBirthdayConfetti(colors) {
            const confettiColors = colors || ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#cc5de8', '#f8b500'];
            
            // Plusieurs vagues de confetti pour un effet spectaculaire
            launchConfetti({ particleCount: 100, spread: 70, origin: { x: 0.5, y: 0.6 }, colors: confettiColors });
            
            setTimeout(() => {
                launchConfetti({ particleCount: 50, spread: 100, origin: { x: 0.2, y: 0.5 }, colors: confettiColors });
                launchConfetti({ particleCount: 50, spread: 100, origin: { x: 0.8, y: 0.5 }, colors: confettiColors });
            }, 300);
            
            setTimeout(() => {
                launchConfetti({ particleCount: 75, spread: 120, origin: { x: 0.5, y: 0.4 }, colors: confettiColors });
            }, 600);
        },
        
        // Lance l'animation applaudissements
        launchApplause() {
            // Créer le conteneur d'applaudissements
            const container = document.createElement('div');
            container.id = 'applause-container';
            container.style.cssText = `
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 9998;
                overflow: hidden;
            `;
            document.body.appendChild(container);
            
            // Injecter les styles d'animation
            if (!document.getElementById('applause-styles')) {
                const style = document.createElement('style');
                style.id = 'applause-styles';
                style.textContent = `
                    @keyframes clap {
                        0%, 100% { transform: scale(1) rotate(0deg); }
                        25% { transform: scale(1.3) rotate(-10deg); }
                        50% { transform: scale(1) rotate(0deg); }
                        75% { transform: scale(1.3) rotate(10deg); }
                    }
                    @keyframes floatUp {
                        0% { opacity: 1; transform: translateY(0) scale(1); }
                        100% { opacity: 0; transform: translateY(-200px) scale(0.5); }
                    }
                    @keyframes pulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.2); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            // Créer les mains qui applaudissent
            const emojis = ['👏', '🙌', '👐', '✨', '🎉'];
            const positions = [];
            
            for (let i = 0; i < 20; i++) {
                const emoji = document.createElement('div');
                const emojiChar = emojis[Math.floor(Math.random() * emojis.length)];
                emoji.textContent = emojiChar;
                emoji.style.cssText = `
                    position: absolute;
                    font-size: ${Math.random() * 30 + 20}px;
                    left: ${Math.random() * 100}%;
                    bottom: -50px;
                    animation: floatUp ${1.5 + Math.random() * 1}s ease-out forwards;
                    animation-delay: ${Math.random() * 0.5}s;
                `;
                container.appendChild(emoji);
            }
            
            // Afficher un gros emoji central qui pulse
            const centerEmoji = document.createElement('div');
            centerEmoji.textContent = '👏';
            centerEmoji.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 100px;
                animation: clap 0.3s ease-in-out 5;
                z-index: 9999;
            `;
            document.body.appendChild(centerEmoji);
            
            // Son d'applaudissements (optionnel - via vibration sur mobile)
            if (navigator.vibrate) {
                navigator.vibrate([100, 50, 100, 50, 100, 50, 100]);
            }
            
            // Nettoyer après l'animation
            setTimeout(() => {
                container.remove();
                centerEmoji.remove();
            }, 3000);
        },
        
        // Lance l'animation feux d'artifice
        launchFireworks() {
            const colors = ['#ff0000', '#ffd700', '#00ff00', '#00bfff', '#ff00ff', '#ffffff'];
            
            // Plusieurs explosions à différents endroits
            const positions = [
                { x: 0.3, y: 0.4 },
                { x: 0.7, y: 0.3 },
                { x: 0.5, y: 0.5 },
                { x: 0.2, y: 0.6 },
                { x: 0.8, y: 0.5 }
            ];
            
            positions.forEach((pos, i) => {
                setTimeout(() => {
                    launchConfetti({
                        particleCount: 80,
                        spread: 360,
                        origin: pos,
                        colors: colors,
                        gravity: 0.8,
                        scalar: 1.2
                    });
                }, i * 400);
            });
        },
        
        // Lance l'animation coeurs
        launchHearts() {
            const container = document.createElement('div');
            container.id = 'hearts-container';
            container.style.cssText = `
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 9998;
                overflow: hidden;
            `;
            document.body.appendChild(container);
            
            // Injecter les styles
            if (!document.getElementById('hearts-styles')) {
                const style = document.createElement('style');
                style.id = 'hearts-styles';
                style.textContent = `
                    @keyframes floatHeart {
                        0% { opacity: 1; transform: translateY(0) scale(1) rotate(0deg); }
                        50% { transform: translateY(-150px) scale(1.2) rotate(15deg); }
                        100% { opacity: 0; transform: translateY(-300px) scale(0.8) rotate(-15deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            const hearts = ['💜', '💕', '❤️', '💙', '💚', '🧡', '💛', '💗', '💖'];
            
            for (let i = 0; i < 30; i++) {
                const heart = document.createElement('div');
                heart.textContent = hearts[Math.floor(Math.random() * hearts.length)];
                heart.style.cssText = `
                    position: absolute;
                    font-size: ${Math.random() * 25 + 15}px;
                    left: ${Math.random() * 100}%;
                    bottom: -50px;
                    animation: floatHeart ${2 + Math.random() * 1.5}s ease-out forwards;
                    animation-delay: ${Math.random() * 0.8}s;
                `;
                container.appendChild(heart);
            }
            
            setTimeout(() => container.remove(), 4000);
        },
        
        // Lance l'animation sparkle/étoiles
        launchSparkle() {
            const container = document.createElement('div');
            container.id = 'sparkle-container';
            container.style.cssText = `
                position: fixed;
                inset: 0;
                pointer-events: none;
                z-index: 9998;
            `;
            document.body.appendChild(container);
            
            if (!document.getElementById('sparkle-styles')) {
                const style = document.createElement('style');
                style.id = 'sparkle-styles';
                style.textContent = `
                    @keyframes sparkle {
                        0% { opacity: 0; transform: scale(0) rotate(0deg); }
                        50% { opacity: 1; transform: scale(1) rotate(180deg); }
                        100% { opacity: 0; transform: scale(0) rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            const sparkles = ['✨', '⭐', '🌟', '💫', '⚡'];
            
            for (let i = 0; i < 15; i++) {
                const sparkle = document.createElement('div');
                sparkle.textContent = sparkles[Math.floor(Math.random() * sparkles.length)];
                sparkle.style.cssText = `
                    position: absolute;
                    font-size: ${Math.random() * 20 + 15}px;
                    left: ${Math.random() * 100}%;
                    top: ${Math.random() * 100}%;
                    animation: sparkle ${0.8 + Math.random() * 0.5}s ease-in-out forwards;
                    animation-delay: ${Math.random() * 0.5}s;
                `;
                container.appendChild(sparkle);
            }
            
            setTimeout(() => container.remove(), 2000);
        },
        
        // Exécute la célébration appropriée
        celebrate(trigger) {
            switch (trigger.animation) {
                case 'confetti':
                    this.launchBirthdayConfetti(trigger.colors);
                    break;
                case 'applause':
                    this.launchApplause();
                    break;
                case 'fireworks':
                    this.launchFireworks();
                    break;
                case 'hearts':
                    this.launchHearts();
                    break;
                case 'sparkle':
                    this.launchSparkle();
                    break;
                default:
                    launchConfetti();
            }
            
            // Afficher un toast discret (sauf pour sparkle qui est subtil)
            if (trigger.message && trigger.animation !== 'sparkle') {
                setTimeout(() => showToast(trigger.message, 2000), 500);
            }
            
            console.log(`%c🎉 Celebration: ${trigger.animation}`, 'color: #22c55e; font-size: 14px;');
        },
        
        // Initialise les listeners pour détecter les messages
        init() {
            // Observer les formulaires de message
            const observeMessageInputs = () => {
                // Trouver tous les textareas et inputs de message
                const inputs = document.querySelectorAll('textarea, input[type="text"]');
                
                inputs.forEach(input => {
                    if (input.dataset.celebrationObserved) return;
                    input.dataset.celebrationObserved = 'true';
                    
                    // Écouter les soumissions de formulaire
                    const form = input.closest('form');
                    if (form && !form.dataset.celebrationObserved) {
                        form.dataset.celebrationObserved = 'true';
                        form.addEventListener('submit', (e) => {
                            const text = input.value;
                            const trigger = this.detectCelebration(text);
                            if (trigger) {
                                // Petit délai pour que le message soit envoyé d'abord
                                setTimeout(() => this.celebrate(trigger), 300);
                            }
                        });
                    }
                    
                    // Écouter Entrée pour les inputs sans formulaire
                    input.addEventListener('keydown', (e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            const trigger = this.detectCelebration(input.value);
                            if (trigger) {
                                setTimeout(() => this.celebrate(trigger), 300);
                            }
                        }
                    });
                });
            };
            
            // Observer les changements du DOM pour les inputs dynamiques
            observeMessageInputs();
            
            const observer = new MutationObserver(() => {
                observeMessageInputs();
            });
            
            observer.observe(document.body, { childList: true, subtree: true });
            
            console.log('%c🎉 Celebration Messages initialized!', 'color: #6366f1; font-size: 12px;');
        }
    };
    
    // Exposer pour usage externe
    window.CelebrationMessages = CelebrationMessages;
    
    // ========================================
    // 🥚 HIDDEN EASTER EGGS
    // ========================================
    
    // Triple click on logo = secret message
    let logoClickCount = 0;
    let logoClickTimer = null;
    
    document.addEventListener('click', (e) => {
        const logo = e.target.closest('.glow, [class*="w-24"][class*="h-24"][class*="rounded-full"]');
        if (!logo) return;
        
        logoClickCount++;
        clearTimeout(logoClickTimer);
        
        logoClickTimer = setTimeout(() => {
            if (logoClickCount >= 3) {
                showBigMessage("5 > 5000 💜");
                launchConfetti({ particleCount: 50 });
            }
            logoClickCount = 0;
        }, 400);
    });
    
    // Type "friendship" anywhere = easter egg
    let secretWord = '';
    document.addEventListener('keypress', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        secretWord += e.key.toLowerCase();
        secretWord = secretWord.slice(-10); // Keep last 10 chars
        
        if (secretWord.includes('friendship')) {
            showToast("🌈 L'amitié vraie > tout le reste");
            launchConfetti({ particleCount: 30, colors: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#cc5de8'] });
            secretWord = '';
        }
        
        if (secretWord.includes('love')) {
            showToast("💜 Spread love, pas des likes");
            secretWord = '';
        }
        
        if (secretWord.includes('cinco')) {
            showToast("🇪🇸 ¡Hola! Sí, cinco = cinq = 5");
            secretWord = '';
        }
    });
    
    // ========================================
    // 🎬 INITIALIZE
    // ========================================
    
    function init() {
        injectPlayfulHoverEffects();
        
        // Attendre que le DOM soit complètement chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                enhancePingButton();
                injectRandomCopy();
                CelebrationMessages.init();
            });
        } else {
            enhancePingButton();
            injectRandomCopy();
            CelebrationMessages.init();
        }
        
        // Observer pour les changements dynamiques (SPA-like)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.addedNodes.length) {
                    enhancePingButton();
                    injectRandomCopy();
                }
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    init();
    
    // Exposer certaines fonctions globalement
    window.CinqFun = {
        confetti: launchConfetti,
        toast: showToast,
        celebrate: celebrateFifthContact,
        showMessage: showBigMessage,
        // Celebration Messages
        celebrations: CelebrationMessages,
        birthdayConfetti: () => CelebrationMessages.launchBirthdayConfetti(),
        applause: () => CelebrationMessages.launchApplause(),
        fireworks: () => CelebrationMessages.launchFireworks(),
        hearts: () => CelebrationMessages.launchHearts(),
        sparkle: () => CelebrationMessages.launchSparkle()
    };
    
})();
