/**
 * 🥚 CINQ Easter Eggs Collection
 * ===============================
 * Hidden gems for the curious ones.
 * 
 * - Konami Code: Special pentagon animation
 * - Double-tap logo: Demo mode toggle
 * - Shake device: Surprise effect
 */

(function() {
    'use strict';

    // ========================================
    // 🛡️ UTILITIES
    // ========================================
    
    const isMobile = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    
    // Toast notification helper
    function showToast(message, duration = 3000) {
        if (typeof window.showToast === 'function') {
            return window.showToast(message, duration);
        }
        
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:10001;pointer-events:none;';
            document.body.appendChild(container);
        }
        
        const toast = document.createElement('div');
        toast.style.cssText = `
            background: linear-gradient(135deg, #ff6b4a 0%, #ff8a6a 100%);
            color: white;
            padding: 14px 28px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 8px 32px rgba(255, 107, 74, 0.4);
            backdrop-filter: blur(10px);
            animation: easterToastIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
            margin-top: 8px;
            text-align: center;
        `;
        toast.textContent = message;
        container.appendChild(toast);
        
        if (!document.getElementById('easter-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'easter-toast-styles';
            style.textContent = `
                @keyframes easterToastIn {
                    from { opacity: 0; transform: translateY(30px) scale(0.8); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                @keyframes easterToastOut {
                    from { opacity: 1; transform: translateY(0) scale(1); }
                    to { opacity: 0; transform: translateY(-20px) scale(0.8); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            toast.style.animation = 'easterToastOut 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // ========================================
    // 🎮 KONAMI CODE - PENTAGON EXPLOSION
    // ========================================
    
    const konamiSequence = [
        'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
        'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
        'KeyB', 'KeyA'
    ];
    let konamiIndex = 0;
    let konamiActivated = false;
    
    function initKonamiCode() {
        document.addEventListener('keydown', handleKonamiKey);
        console.log('%c🎮 Hint: ↑↑↓↓←→←→BA', 'color: #ff6b4a; font-size: 10px;');
    }
    
    function handleKonamiKey(e) {
        const key = e.code || e.key;
        const expectedKey = konamiSequence[konamiIndex];
        
        // Match either code or key
        if (key === expectedKey || 
            (expectedKey === 'KeyB' && e.key.toLowerCase() === 'b') ||
            (expectedKey === 'KeyA' && e.key.toLowerCase() === 'a')) {
            konamiIndex++;
            
            // Visual feedback - subtle screen pulse
            if (konamiIndex > 0) {
                pulseScreen(konamiIndex / konamiSequence.length);
            }
            
            if (konamiIndex === konamiSequence.length) {
                konamiIndex = 0;
                triggerKonamiEffect();
            }
        } else if (key.startsWith('Arrow') || e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'b') {
            konamiIndex = 0;
        }
    }
    
    function pulseScreen(progress) {
        if (isReducedMotion()) return;
        
        const pulse = document.createElement('div');
        pulse.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9998;
            background: radial-gradient(circle at center, rgba(255, 107, 74, ${0.05 * progress}) 0%, transparent 70%);
            animation: konamiPulse 0.3s ease-out forwards;
        `;
        document.body.appendChild(pulse);
        
        if (!document.getElementById('konami-pulse-style')) {
            const style = document.createElement('style');
            style.id = 'konami-pulse-style';
            style.textContent = `
                @keyframes konamiPulse {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => pulse.remove(), 300);
    }
    
    function triggerKonamiEffect() {
        if (konamiActivated) return;
        konamiActivated = true;
        
        console.log('%c🎮 KONAMI CODE ACTIVÉ!', 'color: #22c55e; font-size: 24px; font-weight: bold;');
        showToast('🎮 You found it! ↑↑↓↓←→←→BA');
        
        // Create the pentagon explosion
        createPentagonExplosion();
        
        // Reset after animation
        setTimeout(() => {
            konamiActivated = false;
        }, 5000);
    }
    
    function createPentagonExplosion() {
        if (isReducedMotion()) {
            // Simple confetti fallback
            if (typeof window.launchConfetti === 'function') {
                window.launchConfetti({ particleCount: 100 });
            }
            return;
        }
        
        const canvas = document.createElement('canvas');
        canvas.id = 'konami-canvas';
        canvas.style.cssText = `
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(canvas);
        
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        
        const pentagons = [];
        const colors = ['#ff6b4a', '#ff8a6a', '#fbbf24', '#a78bfa', '#22c55e'];
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Create 50 pentagons
        for (let i = 0; i < 50; i++) {
            const angle = (Math.random() * Math.PI * 2);
            const speed = 3 + Math.random() * 8;
            
            pentagons.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 10 + Math.random() * 30,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2,
                color: colors[Math.floor(Math.random() * colors.length)],
                opacity: 1,
                gravity: 0.15,
                friction: 0.98
            });
        }
        
        // Draw pentagon
        function drawPentagon(ctx, x, y, size, rotation) {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - Math.PI / 2 + rotation;
                const px = x + size * Math.cos(angle);
                const py = y + size * Math.sin(angle);
                if (i === 0) {
                    ctx.moveTo(px, py);
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.closePath();
        }
        
        let frameCount = 0;
        const maxFrames = 180;
        
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw big "5" in center that fades
            const fadeProgress = Math.min(frameCount / 30, 1);
            if (fadeProgress < 1) {
                ctx.save();
                ctx.globalAlpha = 1 - fadeProgress;
                ctx.font = `bold ${200 + fadeProgress * 100}px "Space Grotesk", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = '#ff6b4a';
                ctx.shadowColor = 'rgba(255, 107, 74, 0.5)';
                ctx.shadowBlur = 50;
                ctx.fillText('5', centerX, centerY);
                ctx.restore();
            }
            
            // Animate pentagons
            pentagons.forEach(p => {
                if (p.opacity <= 0) return;
                
                // Physics
                p.vy += p.gravity;
                p.vx *= p.friction;
                p.vy *= p.friction;
                p.x += p.vx;
                p.y += p.vy;
                p.rotation += p.rotationSpeed;
                
                // Fade out after halfway
                if (frameCount > maxFrames / 2) {
                    p.opacity -= 0.02;
                }
                
                // Draw
                ctx.save();
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 10;
                
                drawPentagon(ctx, p.x, p.y, p.size, p.rotation);
                ctx.fill();
                
                // Inner glow
                ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                drawPentagon(ctx, p.x, p.y, p.size * 0.6, p.rotation);
                ctx.fill();
                
                ctx.restore();
            });
            
            frameCount++;
            
            if (frameCount < maxFrames) {
                requestAnimationFrame(animate);
            } else {
                canvas.remove();
            }
        }
        
        animate();
    }
    
    // ========================================
    // 👆 DOUBLE-TAP LOGO - DEMO MODE
    // ========================================
    
    let lastTapTime = 0;
    let tapCount = 0;
    let demoModeActive = false;
    const DOUBLE_TAP_DELAY = 300;
    
    function initDoubleTapLogo() {
        // Find logo elements
        const logoSelectors = [
            '.header-logo',
            '.five',
            '.five-core',
            '.header-logo-icon',
            '[class*="logo"]'
        ];
        
        logoSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach(el => {
                el.addEventListener('touchstart', handleLogoTap, { passive: true });
                el.addEventListener('click', handleLogoClick);
            });
        });
        
        // Also observe for dynamically added logos
        const observer = new MutationObserver(() => {
            logoSelectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    if (!el._doubleTapInit) {
                        el._doubleTapInit = true;
                        el.addEventListener('touchstart', handleLogoTap, { passive: true });
                        el.addEventListener('click', handleLogoClick);
                    }
                });
            });
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }
    
    function handleLogoTap(e) {
        const now = Date.now();
        
        if (now - lastTapTime < DOUBLE_TAP_DELAY) {
            tapCount++;
            if (tapCount >= 2) {
                e.preventDefault();
                toggleDemoMode();
                tapCount = 0;
            }
        } else {
            tapCount = 1;
        }
        
        lastTapTime = now;
    }
    
    function handleLogoClick(e) {
        // For desktop: detect double-click
        if (!isMobile()) {
            const now = Date.now();
            if (now - lastTapTime < DOUBLE_TAP_DELAY) {
                toggleDemoMode();
            }
            lastTapTime = now;
        }
    }
    
    function toggleDemoMode() {
        demoModeActive = !demoModeActive;
        
        if (demoModeActive) {
            enableDemoMode();
        } else {
            disableDemoMode();
        }
    }
    
    function enableDemoMode() {
        console.log('%c🎭 DEMO MODE ACTIVATED', 'color: #fbbf24; font-size: 16px; font-weight: bold;');
        showToast('🎭 Mode démo activé!');
        
        // Add demo mode indicator
        let indicator = document.getElementById('demo-mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'demo-mode-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 80px;
                right: 16px;
                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                color: #000;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                z-index: 10000;
                box-shadow: 0 4px 20px rgba(251, 191, 36, 0.4);
                animation: demoBadgePulse 2s ease-in-out infinite;
                cursor: pointer;
            `;
            indicator.textContent = '🎭 DEMO';
            indicator.onclick = toggleDemoMode;
            document.body.appendChild(indicator);
            
            if (!document.getElementById('demo-mode-styles')) {
                const style = document.createElement('style');
                style.id = 'demo-mode-styles';
                style.textContent = `
                    @keyframes demoBadgePulse {
                        0%, 100% { transform: scale(1); }
                        50% { transform: scale(1.05); }
                    }
                    
                    .demo-highlight {
                        position: relative;
                    }
                    
                    .demo-highlight::after {
                        content: '';
                        position: absolute;
                        inset: -4px;
                        border: 2px dashed #fbbf24;
                        border-radius: inherit;
                        pointer-events: none;
                        animation: demoHighlightPulse 1.5s ease-in-out infinite;
                    }
                    
                    @keyframes demoHighlightPulse {
                        0%, 100% { opacity: 0.5; }
                        50% { opacity: 1; }
                    }
                    
                    .demo-tooltip {
                        position: absolute;
                        background: #1a1a2e;
                        color: #fbbf24;
                        padding: 8px 12px;
                        border-radius: 8px;
                        font-size: 11px;
                        white-space: nowrap;
                        z-index: 10001;
                        pointer-events: none;
                        animation: tooltipFade 0.3s ease-out;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    }
                    
                    @keyframes tooltipFade {
                        from { opacity: 0; transform: translateY(5px); }
                        to { opacity: 1; transform: translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
        
        // Highlight interactive elements with tooltips
        highlightDemoElements();
        
        // Fill in demo data
        fillDemoData();
    }
    
    function disableDemoMode() {
        console.log('%c🎭 DEMO MODE DEACTIVATED', 'color: #71717a; font-size: 16px;');
        showToast('Mode démo désactivé');
        
        // Remove indicator
        const indicator = document.getElementById('demo-mode-indicator');
        if (indicator) indicator.remove();
        
        // Remove highlights
        document.querySelectorAll('.demo-highlight').forEach(el => {
            el.classList.remove('demo-highlight');
        });
        
        // Remove tooltips
        document.querySelectorAll('.demo-tooltip').forEach(el => el.remove());
    }
    
    function highlightDemoElements() {
        const interactiveElements = [
            { selector: '.cta-button', tip: 'CTA principal' },
            { selector: '.contact-slot', tip: 'Slot contact' },
            { selector: '.header-login-btn', tip: 'Connexion' },
            { selector: '.feature-pill', tip: 'Feature tag' },
            { selector: '.step', tip: 'Étape onboarding' },
            { selector: '.faq-question', tip: 'FAQ accordéon' },
            { selector: '.waitlist-form', tip: 'Waitlist form' }
        ];
        
        interactiveElements.forEach(({ selector, tip }) => {
            document.querySelectorAll(selector).forEach((el, i) => {
                if (i < 3) { // Limit highlights
                    el.classList.add('demo-highlight');
                    
                    // Add tooltip on hover
                    el.addEventListener('mouseenter', function showTip() {
                        if (!demoModeActive) return;
                        
                        const tooltip = document.createElement('div');
                        tooltip.className = 'demo-tooltip';
                        tooltip.textContent = tip;
                        
                        const rect = el.getBoundingClientRect();
                        tooltip.style.left = `${rect.left}px`;
                        tooltip.style.top = `${rect.top - 30}px`;
                        
                        document.body.appendChild(tooltip);
                        el._demoTooltip = tooltip;
                    });
                    
                    el.addEventListener('mouseleave', function hideTip() {
                        if (el._demoTooltip) {
                            el._demoTooltip.remove();
                            el._demoTooltip = null;
                        }
                    });
                }
            });
        });
    }
    
    function fillDemoData() {
        // Auto-fill demo values in inputs
        const demoValues = {
            'email': 'demo@cinq.app',
            'username': 'DemoUser',
            'name': 'Marie Demo'
        };
        
        document.querySelectorAll('input').forEach(input => {
            const type = input.type.toLowerCase();
            const name = input.name?.toLowerCase() || '';
            const placeholder = input.placeholder?.toLowerCase() || '';
            
            if (type === 'email' || name.includes('email') || placeholder.includes('email')) {
                input.value = demoValues.email;
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    }
    
    // ========================================
    // 📱 SHAKE DEVICE - SURPRISE EFFECT
    // ========================================
    
    let shakeThreshold = 15;
    let lastX = 0, lastY = 0, lastZ = 0;
    let shakeTimeout = null;
    let shakeCount = 0;
    let lastShakeTime = 0;
    let shakeEffectCooldown = false;
    
    function initShakeDetection() {
        if (!window.DeviceMotionEvent) {
            console.log('Device motion not supported');
            return;
        }
        
        // Request permission on iOS 13+
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            // We'll request permission on first user interaction
            document.addEventListener('click', requestMotionPermission, { once: true });
            document.addEventListener('touchstart', requestMotionPermission, { once: true });
        } else {
            // Non-iOS or older iOS
            window.addEventListener('devicemotion', handleMotion);
        }
    }
    
    async function requestMotionPermission() {
        try {
            const permission = await DeviceMotionEvent.requestPermission();
            if (permission === 'granted') {
                window.addEventListener('devicemotion', handleMotion);
                console.log('%c📱 Shake detection enabled', 'color: #22c55e;');
            }
        } catch (e) {
            console.log('Motion permission denied or error:', e);
        }
    }
    
    function handleMotion(event) {
        const { x, y, z } = event.accelerationIncludingGravity || {};
        
        if (x === null || y === null || z === null) return;
        
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);
        
        const acceleration = deltaX + deltaY + deltaZ;
        
        if (acceleration > shakeThreshold) {
            const now = Date.now();
            
            if (now - lastShakeTime < 500) {
                shakeCount++;
            } else {
                shakeCount = 1;
            }
            
            lastShakeTime = now;
            
            // Require 3 shakes in quick succession
            if (shakeCount >= 3 && !shakeEffectCooldown) {
                triggerShakeEffect();
                shakeCount = 0;
            }
        }
        
        lastX = x;
        lastY = y;
        lastZ = z;
    }
    
    function triggerShakeEffect() {
        shakeEffectCooldown = true;
        
        console.log('%c📱 SHAKE DETECTED!', 'color: #ec4899; font-size: 16px; font-weight: bold;');
        
        // Random surprise effect
        const effects = [
            surpriseConfetti,
            surpriseEmojiBurst,
            surpriseGravityFlip,
            surpriseColorWave,
            surpriseSecretMessage
        ];
        
        const effect = effects[Math.floor(Math.random() * effects.length)];
        effect();
        
        // Haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
        }
        
        setTimeout(() => {
            shakeEffectCooldown = false;
        }, 3000);
    }
    
    function surpriseConfetti() {
        showToast('🎊 Shake shake shake!');
        
        if (typeof window.launchConfetti === 'function') {
            // Multi-burst confetti
            window.launchConfetti({ particleCount: 50, origin: { x: 0.2, y: 0.5 } });
            setTimeout(() => {
                window.launchConfetti({ particleCount: 50, origin: { x: 0.8, y: 0.5 } });
            }, 200);
            setTimeout(() => {
                window.launchConfetti({ particleCount: 100, origin: { x: 0.5, y: 0.7 } });
            }, 400);
        } else {
            createSimpleConfetti();
        }
    }
    
    function surpriseEmojiBurst() {
        showToast('✨ Magical shake!');
        
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
            overflow: hidden;
        `;
        document.body.appendChild(container);
        
        const emojis = ['💜', '✨', '🎯', '5️⃣', '🌟', '💫', '🔮', '🎪', '🎭', '🎪'];
        
        for (let i = 0; i < 20; i++) {
            const emoji = document.createElement('div');
            emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            emoji.style.cssText = `
                position: absolute;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                font-size: ${20 + Math.random() * 40}px;
                animation: emojiBurst 1.5s ease-out forwards;
                transform-origin: center;
            `;
            container.appendChild(emoji);
        }
        
        if (!document.getElementById('emoji-burst-style')) {
            const style = document.createElement('style');
            style.id = 'emoji-burst-style';
            style.textContent = `
                @keyframes emojiBurst {
                    0% {
                        opacity: 1;
                        transform: scale(0) rotate(0deg);
                    }
                    50% {
                        opacity: 1;
                        transform: scale(1.5) rotate(180deg);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(0.5) rotate(360deg) translateY(-100px);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => container.remove(), 2000);
    }
    
    function surpriseGravityFlip() {
        if (isReducedMotion()) {
            showToast('🙃 Upside down!');
            return;
        }
        
        showToast('🙃 Gravity flip!');
        
        document.body.style.transition = 'transform 0.5s ease-in-out';
        document.body.style.transform = 'rotate(180deg)';
        document.body.style.transformOrigin = 'center center';
        
        setTimeout(() => {
            document.body.style.transform = '';
            setTimeout(() => {
                document.body.style.transition = '';
            }, 500);
        }, 1500);
    }
    
    function surpriseColorWave() {
        showToast('🌈 Color wave!');
        
        const wave = document.createElement('div');
        wave.style.cssText = `
            position: fixed;
            left: -100%;
            top: 0;
            width: 200%;
            height: 100%;
            background: linear-gradient(90deg, 
                transparent 0%, 
                rgba(255, 107, 74, 0.3) 25%,
                rgba(251, 191, 36, 0.3) 50%,
                rgba(167, 139, 250, 0.3) 75%,
                transparent 100%
            );
            z-index: 9999;
            pointer-events: none;
            animation: colorWaveSweep 1.5s ease-in-out forwards;
        `;
        document.body.appendChild(wave);
        
        if (!document.getElementById('color-wave-style')) {
            const style = document.createElement('style');
            style.id = 'color-wave-style';
            style.textContent = `
                @keyframes colorWaveSweep {
                    from { transform: translateX(0); }
                    to { transform: translateX(100%); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => wave.remove(), 1500);
    }
    
    function surpriseSecretMessage() {
        const messages = [
            "Tu secoues comme un pro! 📱",
            "5 contacts suffisent. Vraiment. 💜",
            "Les vrais amis t'appellent à 3h du mat'",
            "Quality over quantity ✨",
            "Tu viens de débloquer... rien. Mais bravo! 🏆"
        ];
        
        const msg = messages[Math.floor(Math.random() * messages.length)];
        showToast(msg, 4000);
    }
    
    function createSimpleConfetti() {
        const container = document.createElement('div');
        container.style.cssText = `
            position: fixed;
            inset: 0;
            pointer-events: none;
            z-index: 9999;
            overflow: hidden;
        `;
        document.body.appendChild(container);
        
        const colors = ['#ff6b4a', '#ff8a6a', '#fbbf24', '#a78bfa', '#22c55e'];
        
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.style.cssText = `
                position: absolute;
                left: ${50 + (Math.random() - 0.5) * 20}%;
                bottom: 0;
                width: ${5 + Math.random() * 10}px;
                height: ${5 + Math.random() * 10}px;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
                animation: confettiFall ${1 + Math.random() * 2}s ease-out forwards;
                animation-delay: ${Math.random() * 0.3}s;
            `;
            container.appendChild(confetti);
        }
        
        if (!document.getElementById('simple-confetti-style')) {
            const style = document.createElement('style');
            style.id = 'simple-confetti-style';
            style.textContent = `
                @keyframes confettiFall {
                    0% {
                        transform: translateY(0) rotate(0deg);
                        opacity: 1;
                    }
                    100% {
                        transform: translateY(-100vh) translateX(${Math.random() * 200 - 100}px) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => container.remove(), 3000);
    }
    
    // ========================================
    // 🚀 INITIALIZE
    // ========================================
    
    function init() {
        initKonamiCode();
        initDoubleTapLogo();
        initShakeDetection();
        
        console.log('%c🥚 Easter eggs loaded!', 'color: #a78bfa; font-size: 12px;');
        console.log('%c   • Konami: ↑↑↓↓←→←→BA', 'color: #71717a; font-size: 10px;');
        console.log('%c   • Double-tap logo: Demo mode', 'color: #71717a; font-size: 10px;');
        console.log('%c   • Shake device: Surprise!', 'color: #71717a; font-size: 10px;');
    }
    
    // Run on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Expose for debugging
    window.CinqEasterEggs = {
        triggerKonami: triggerKonamiEffect,
        toggleDemo: toggleDemoMode,
        triggerShake: triggerShakeEffect,
        isDemoMode: () => demoModeActive
    };
    
})();
