/**
 * Cinq Embeddable Widget
 * 
 * Usage:
 * <script src="https://cinq.app/widget.js" data-user="username" data-theme="dark"></script>
 * <div id="cinq-widget"></div>
 * 
 * Options (data attributes):
 * - data-user: Username or user ID (required)
 * - data-theme: "dark" | "light" | "auto" (default: "auto")
 * - data-size: "small" | "medium" | "large" (default: "medium")
 * - data-container: Custom container ID (default: "cinq-widget")
 * - data-lang: "fr" | "en" (default: "fr")
 */

(function() {
    'use strict';

    const CINQ_BASE_URL = 'https://cinq.app';
    const API_URL = `${CINQ_BASE_URL}/api/profile`;

    // Translations
    const i18n = {
        fr: {
            joinMe: 'Rejoins-moi sur Cinq',
            contacts: 'contacts',
            posts: 'posts',
            member: 'Membre depuis',
            join: 'Me rejoindre',
            loading: 'Chargement...',
            error: 'Impossible de charger le profil',
            tagline: "L'anti-réseau social"
        },
        en: {
            joinMe: 'Join me on Cinq',
            contacts: 'contacts',
            posts: 'posts',
            member: 'Member since',
            join: 'Join me',
            loading: 'Loading...',
            error: 'Unable to load profile',
            tagline: 'The anti-social network'
        }
    };

    // Inject styles
    function injectStyles() {
        if (document.getElementById('cinq-widget-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'cinq-widget-styles';
        styles.textContent = `
            .cinq-widget {
                --cinq-coral: #ff6b4a;
                --cinq-coral-light: #ff8a6a;
                --cinq-coral-dark: #e85a3a;
                --cinq-gold: #fbbf24;
                --cinq-lavender: #a78bfa;
                --cinq-mint: #34d399;
                --cinq-gradient: linear-gradient(135deg, #ff6b4a, #ff8a6a, #ffb08c);
                --cinq-gradient-hover: linear-gradient(135deg, #ff7d5c, #ff9b7c, #ffc09c);
                
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                box-sizing: border-box;
            }

            .cinq-widget *, .cinq-widget *::before, .cinq-widget *::after {
                box-sizing: inherit;
            }

            /* Dark theme (default) */
            .cinq-widget {
                --bg-primary: #121218;
                --bg-secondary: #1a1a22;
                --bg-tertiary: #22222c;
                --text-primary: #fafaf9;
                --text-secondary: rgba(250, 250, 249, 0.85);
                --text-muted: rgba(250, 250, 249, 0.55);
                --border-color: rgba(255, 255, 255, 0.08);
            }

            /* Light theme */
            .cinq-widget.cinq-light {
                --bg-primary: #fafaf9;
                --bg-secondary: #f5f5f4;
                --bg-tertiary: #e7e5e4;
                --text-primary: #1a1918;
                --text-secondary: rgba(26, 25, 24, 0.8);
                --text-muted: rgba(26, 25, 24, 0.58);
                --border-color: rgba(0, 0, 0, 0.08);
            }

            .cinq-widget-card {
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: 16px;
                overflow: hidden;
                max-width: 320px;
                transition: transform 0.2s ease, box-shadow 0.2s ease;
            }

            .cinq-widget-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(255, 107, 74, 0.15);
            }

            /* Header with gradient */
            .cinq-widget-header {
                background: var(--cinq-gradient);
                padding: 16px;
                text-align: center;
                position: relative;
            }

            .cinq-widget-header::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                height: 40px;
                background: linear-gradient(to top, var(--bg-secondary), transparent);
            }

            .cinq-widget-logo {
                font-family: 'Space Grotesk', sans-serif;
                font-size: 1.25rem;
                font-weight: 700;
                color: #fff;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                position: relative;
                z-index: 1;
            }

            .cinq-widget-logo svg {
                width: 20px;
                height: 20px;
            }

            /* Profile section */
            .cinq-widget-profile {
                padding: 20px;
                text-align: center;
                margin-top: -20px;
                position: relative;
                z-index: 2;
            }

            .cinq-widget-avatar {
                width: 72px;
                height: 72px;
                border-radius: 50%;
                border: 3px solid var(--cinq-coral);
                box-shadow: 0 4px 12px rgba(255, 107, 74, 0.3);
                object-fit: cover;
                background: var(--bg-tertiary);
            }

            .cinq-widget-avatar-placeholder {
                width: 72px;
                height: 72px;
                border-radius: 50%;
                border: 3px solid var(--cinq-coral);
                background: var(--cinq-gradient);
                display: flex;
                align-items: center;
                justify-content: center;
                color: #fff;
                font-size: 28px;
                font-weight: 600;
                margin: 0 auto;
            }

            .cinq-widget-name {
                font-family: 'Space Grotesk', sans-serif;
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--text-primary);
                margin: 12px 0 4px;
            }

            .cinq-widget-bio {
                font-size: 0.875rem;
                color: var(--text-secondary);
                margin: 0 0 12px;
                line-height: 1.5;
                max-height: 3em;
                overflow: hidden;
                text-overflow: ellipsis;
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
            }

            /* Stats */
            .cinq-widget-stats {
                display: flex;
                justify-content: center;
                gap: 24px;
                margin: 16px 0;
            }

            .cinq-widget-stat {
                text-align: center;
            }

            .cinq-widget-stat-value {
                font-family: 'Space Grotesk', sans-serif;
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--cinq-coral);
            }

            .cinq-widget-stat-label {
                font-size: 0.75rem;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.05em;
            }

            /* CTA Button */
            .cinq-widget-cta {
                display: block;
                background: var(--cinq-gradient);
                color: #fff;
                text-decoration: none;
                padding: 12px 24px;
                border-radius: 12px;
                font-weight: 600;
                font-size: 0.9375rem;
                text-align: center;
                margin: 16px 20px 20px;
                transition: all 0.2s ease;
                box-shadow: 0 4px 12px rgba(255, 107, 74, 0.25);
            }

            .cinq-widget-cta:hover {
                background: var(--cinq-gradient-hover);
                transform: translateY(-1px);
                box-shadow: 0 6px 16px rgba(255, 107, 74, 0.35);
            }

            .cinq-widget-cta:active {
                transform: translateY(0);
            }

            /* Footer */
            .cinq-widget-footer {
                padding: 12px 20px;
                border-top: 1px solid var(--border-color);
                text-align: center;
            }

            .cinq-widget-tagline {
                font-size: 0.75rem;
                color: var(--text-muted);
                margin: 0;
            }

            /* Sizes */
            .cinq-widget.cinq-small .cinq-widget-card {
                max-width: 240px;
            }

            .cinq-widget.cinq-small .cinq-widget-avatar,
            .cinq-widget.cinq-small .cinq-widget-avatar-placeholder {
                width: 56px;
                height: 56px;
                font-size: 22px;
            }

            .cinq-widget.cinq-small .cinq-widget-name {
                font-size: 1rem;
            }

            .cinq-widget.cinq-small .cinq-widget-bio {
                font-size: 0.8125rem;
            }

            .cinq-widget.cinq-small .cinq-widget-stats {
                gap: 16px;
            }

            .cinq-widget.cinq-small .cinq-widget-stat-value {
                font-size: 1.25rem;
            }

            .cinq-widget.cinq-large .cinq-widget-card {
                max-width: 400px;
            }

            .cinq-widget.cinq-large .cinq-widget-avatar,
            .cinq-widget.cinq-large .cinq-widget-avatar-placeholder {
                width: 96px;
                height: 96px;
                font-size: 36px;
            }

            .cinq-widget.cinq-large .cinq-widget-name {
                font-size: 1.5rem;
            }

            /* Loading state */
            .cinq-widget-loading {
                padding: 40px;
                text-align: center;
                color: var(--text-muted);
            }

            .cinq-widget-loading::after {
                content: '';
                display: block;
                width: 24px;
                height: 24px;
                margin: 12px auto 0;
                border: 2px solid var(--border-color);
                border-top-color: var(--cinq-coral);
                border-radius: 50%;
                animation: cinq-spin 0.8s linear infinite;
            }

            @keyframes cinq-spin {
                to { transform: rotate(360deg); }
            }

            /* Error state */
            .cinq-widget-error {
                padding: 24px;
                text-align: center;
                color: var(--text-muted);
            }

            .cinq-widget-error a {
                color: var(--cinq-coral);
                text-decoration: none;
            }

            .cinq-widget-error a:hover {
                text-decoration: underline;
            }
        `;
        document.head.appendChild(styles);
    }

    // Load Google Fonts
    function loadFonts() {
        if (document.getElementById('cinq-widget-fonts')) return;

        const link = document.createElement('link');
        link.id = 'cinq-widget-fonts';
        link.rel = 'stylesheet';
        link.href = 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap';
        document.head.appendChild(link);
    }

    // Get theme based on preference
    function getTheme(preference) {
        if (preference === 'light') return 'light';
        if (preference === 'dark') return 'dark';
        // Auto: detect system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    // Format date
    function formatDate(dateStr, lang) {
        const date = new Date(dateStr);
        const options = { year: 'numeric', month: 'short' };
        return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', options);
    }

    // Get initials from name
    function getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }

    // Pentagon SVG icon
    function pentagonIcon() {
        return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 9.27L5.82 21H18.18L22 9.27L12 2Z"/></svg>`;
    }

    // Render widget
    function renderWidget(container, profile, options) {
        const t = i18n[options.lang] || i18n.fr;
        const profileUrl = `${CINQ_BASE_URL}/profile.html?user=${encodeURIComponent(profile.display_name || profile.id)}`;

        const avatarHtml = profile.avatar_url
            ? `<img src="${profile.avatar_url}" alt="${profile.display_name}" class="cinq-widget-avatar" loading="lazy">`
            : `<div class="cinq-widget-avatar-placeholder">${getInitials(profile.display_name)}</div>`;

        container.innerHTML = `
            <div class="cinq-widget-card">
                <div class="cinq-widget-header">
                    <a href="${CINQ_BASE_URL}" target="_blank" rel="noopener" class="cinq-widget-logo">
                        ${pentagonIcon()}
                        Cinq
                    </a>
                </div>
                <div class="cinq-widget-profile">
                    ${avatarHtml}
                    <h3 class="cinq-widget-name">${profile.display_name || 'Anonyme'}</h3>
                    ${profile.bio ? `<p class="cinq-widget-bio">${profile.bio}</p>` : ''}
                    <div class="cinq-widget-stats">
                        <div class="cinq-widget-stat">
                            <div class="cinq-widget-stat-value">${profile.stats?.contactCount ?? 0}/5</div>
                            <div class="cinq-widget-stat-label">${t.contacts}</div>
                        </div>
                        <div class="cinq-widget-stat">
                            <div class="cinq-widget-stat-value">${profile.stats?.postCount ?? 0}</div>
                            <div class="cinq-widget-stat-label">${t.posts}</div>
                        </div>
                    </div>
                </div>
                <a href="${profileUrl}" target="_blank" rel="noopener" class="cinq-widget-cta">
                    ${t.joinMe} →
                </a>
                <div class="cinq-widget-footer">
                    <p class="cinq-widget-tagline">${t.tagline}</p>
                </div>
            </div>
        `;
    }

    // Render loading state
    function renderLoading(container, options) {
        const t = i18n[options.lang] || i18n.fr;
        container.innerHTML = `
            <div class="cinq-widget-card">
                <div class="cinq-widget-loading">${t.loading}</div>
            </div>
        `;
    }

    // Render error state
    function renderError(container, options) {
        const t = i18n[options.lang] || i18n.fr;
        container.innerHTML = `
            <div class="cinq-widget-card">
                <div class="cinq-widget-error">
                    ${t.error}<br>
                    <a href="${CINQ_BASE_URL}" target="_blank" rel="noopener">Visiter Cinq →</a>
                </div>
            </div>
        `;
    }

    // Fetch profile from API
    async function fetchProfile(userIdOrName) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userIdOrName);
        const param = isUUID ? 'id' : 'user';
        const url = `${API_URL}?${param}=${encodeURIComponent(userIdOrName)}`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.profile;
    }

    // Initialize widget
    async function init() {
        // Find script tag
        const scripts = document.querySelectorAll('script[src*="widget.js"]');
        const script = scripts[scripts.length - 1]; // Get the last matching script

        if (!script) {
            console.error('[Cinq Widget] Script tag not found');
            return;
        }

        // Get options from data attributes
        const user = script.dataset.user;
        if (!user) {
            console.error('[Cinq Widget] data-user attribute is required');
            return;
        }

        const options = {
            user,
            theme: script.dataset.theme || 'auto',
            size: script.dataset.size || 'medium',
            container: script.dataset.container || 'cinq-widget',
            lang: script.dataset.lang || 'fr'
        };

        // Find or create container
        let container = document.getElementById(options.container);
        if (!container) {
            // Create container after the script tag
            container = document.createElement('div');
            container.id = options.container;
            script.parentNode.insertBefore(container, script.nextSibling);
        }

        // Apply classes
        const themeClass = getTheme(options.theme) === 'light' ? 'cinq-light' : '';
        const sizeClass = options.size !== 'medium' ? `cinq-${options.size}` : '';
        container.className = `cinq-widget ${themeClass} ${sizeClass}`.trim();

        // Inject resources
        injectStyles();
        loadFonts();

        // Show loading
        renderLoading(container, options);

        // Fetch and render
        try {
            const profile = await fetchProfile(options.user);
            renderWidget(container, profile, options);
        } catch (error) {
            console.error('[Cinq Widget] Error loading profile:', error);
            renderError(container, options);
        }
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for programmatic usage
    window.CinqWidget = {
        init,
        render: async function(containerId, user, options = {}) {
            const container = document.getElementById(containerId);
            if (!container) {
                console.error('[Cinq Widget] Container not found:', containerId);
                return;
            }

            const opts = {
                user,
                theme: options.theme || 'auto',
                size: options.size || 'medium',
                lang: options.lang || 'fr'
            };

            const themeClass = getTheme(opts.theme) === 'light' ? 'cinq-light' : '';
            const sizeClass = opts.size !== 'medium' ? `cinq-${opts.size}` : '';
            container.className = `cinq-widget ${themeClass} ${sizeClass}`.trim();

            injectStyles();
            loadFonts();
            renderLoading(container, opts);

            try {
                const profile = await fetchProfile(user);
                renderWidget(container, profile, opts);
            } catch (error) {
                console.error('[Cinq Widget] Error loading profile:', error);
                renderError(container, opts);
            }
        }
    };
})();
