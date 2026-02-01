/**
 * Cinq i18n - Internationalization Module
 * Supports FR/EN with automatic language detection
 */

(function(global) {
    'use strict';

    const SUPPORTED_LANGS = ['fr', 'en'];
    const DEFAULT_LANG = 'fr';
    const STORAGE_KEY = 'cinq_lang';

    let currentLang = DEFAULT_LANG;
    let translations = {};
    let isLoaded = false;
    let loadPromise = null;

    /**
     * Detect user's preferred language
     */
    function detectLanguage() {
        // 1. Check localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored && SUPPORTED_LANGS.includes(stored)) {
            return stored;
        }

        // 2. Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlLang = urlParams.get('lang');
        if (urlLang && SUPPORTED_LANGS.includes(urlLang)) {
            return urlLang;
        }

        // 3. Check navigator language
        const browserLang = navigator.language?.split('-')[0];
        if (browserLang && SUPPORTED_LANGS.includes(browserLang)) {
            return browserLang;
        }

        // 4. Default
        return DEFAULT_LANG;
    }

    /**
     * Load translations for a language
     */
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`/locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang} translations`);
            }
            return await response.json();
        } catch (error) {
            console.error(`[i18n] Error loading ${lang}:`, error);
            // Fallback to default if not already
            if (lang !== DEFAULT_LANG) {
                return loadTranslations(DEFAULT_LANG);
            }
            return {};
        }
    }

    /**
     * Get a nested translation value by dot notation key
     * @param {string} key - Dot notation key (e.g., 'auth.login')
     * @param {object} params - Optional parameters for interpolation
     */
    function t(key, params = {}) {
        const keys = key.split('.');
        let value = translations;

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                console.warn(`[i18n] Missing translation: ${key}`);
                return key; // Return key as fallback
            }
        }

        if (typeof value !== 'string') {
            console.warn(`[i18n] Translation is not a string: ${key}`);
            return key;
        }

        // Interpolate parameters: {name} -> value
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
            return params[paramKey] !== undefined ? params[paramKey] : match;
        });
    }

    /**
     * Initialize i18n with detected or specified language
     */
    async function init(forceLang = null) {
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            currentLang = forceLang || detectLanguage();
            translations = await loadTranslations(currentLang);
            isLoaded = true;

            // Update HTML lang attribute
            document.documentElement.lang = currentLang;

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY, currentLang);

            // Dispatch event for components to react
            window.dispatchEvent(new CustomEvent('i18n:loaded', { 
                detail: { lang: currentLang } 
            }));

            return currentLang;
        })();

        return loadPromise;
    }

    /**
     * Change language dynamically
     */
    async function setLanguage(lang) {
        if (!SUPPORTED_LANGS.includes(lang)) {
            console.error(`[i18n] Unsupported language: ${lang}`);
            return false;
        }

        currentLang = lang;
        translations = await loadTranslations(lang);
        
        // Update HTML lang attribute
        document.documentElement.lang = lang;
        
        // Save to localStorage
        localStorage.setItem(STORAGE_KEY, lang);

        // Dispatch event
        window.dispatchEvent(new CustomEvent('i18n:changed', { 
            detail: { lang } 
        }));

        // Auto-translate DOM elements with data-i18n attribute
        translateDOM();

        return true;
    }

    /**
     * Get current language
     */
    function getLang() {
        return currentLang;
    }

    /**
     * Get all supported languages
     */
    function getSupportedLanguages() {
        return [...SUPPORTED_LANGS];
    }

    /**
     * Check if translations are loaded
     */
    function ready() {
        return isLoaded;
    }

    /**
     * Translate all DOM elements with data-i18n attribute
     */
    function translateDOM() {
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : {};
            
            // Check for specific attribute translations
            const attrKey = el.getAttribute('data-i18n-attr');
            if (attrKey) {
                // Format: "placeholder:validation.emailPlaceholder,aria-label:a11y.emailLabel"
                attrKey.split(',').forEach(pair => {
                    const [attr, tKey] = pair.split(':');
                    if (attr && tKey) {
                        el.setAttribute(attr.trim(), t(tKey.trim(), params));
                    }
                });
            }
            
            if (key) {
                el.textContent = t(key, params);
            }
        });

        // Handle data-i18n-html for HTML content
        const htmlElements = document.querySelectorAll('[data-i18n-html]');
        htmlElements.forEach(el => {
            const key = el.getAttribute('data-i18n-html');
            const params = el.dataset.i18nParams ? JSON.parse(el.dataset.i18nParams) : {};
            el.innerHTML = t(key, params);
        });

        // Handle placeholder translations
        const placeholders = document.querySelectorAll('[data-i18n-placeholder]');
        placeholders.forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            el.placeholder = t(key);
        });

        // Handle aria-label translations
        const ariaLabels = document.querySelectorAll('[data-i18n-aria]');
        ariaLabels.forEach(el => {
            const key = el.getAttribute('data-i18n-aria');
            el.setAttribute('aria-label', t(key));
        });

        // Handle title translations
        const titles = document.querySelectorAll('[data-i18n-title]');
        titles.forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            el.title = t(key);
        });
    }

    /**
     * Create a language switcher component
     */
    function createLanguageSwitcher(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return null;

        const { style = 'dropdown', showFlags = false } = options;

        const flags = {
            fr: '🇫🇷',
            en: '🇬🇧'
        };

        const names = {
            fr: 'Français',
            en: 'English'
        };

        if (style === 'buttons') {
            // Button style
            container.innerHTML = SUPPORTED_LANGS.map(lang => `
                <button 
                    class="lang-btn ${lang === currentLang ? 'active' : ''}" 
                    data-lang="${lang}"
                    aria-label="Switch to ${names[lang]}"
                    aria-pressed="${lang === currentLang}"
                >
                    ${showFlags ? flags[lang] + ' ' : ''}${lang.toUpperCase()}
                </button>
            `).join('');

            container.querySelectorAll('.lang-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    setLanguage(btn.dataset.lang);
                    container.querySelectorAll('.lang-btn').forEach(b => {
                        b.classList.remove('active');
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.classList.add('active');
                    btn.setAttribute('aria-pressed', 'true');
                });
            });
        } else {
            // Dropdown style
            container.innerHTML = `
                <select class="lang-select" aria-label="Select language">
                    ${SUPPORTED_LANGS.map(lang => `
                        <option value="${lang}" ${lang === currentLang ? 'selected' : ''}>
                            ${showFlags ? flags[lang] + ' ' : ''}${names[lang]}
                        </option>
                    `).join('')}
                </select>
            `;

            container.querySelector('.lang-select').addEventListener('change', (e) => {
                setLanguage(e.target.value);
            });
        }

        // Update on language change
        window.addEventListener('i18n:changed', () => {
            if (style === 'buttons') {
                container.querySelectorAll('.lang-btn').forEach(btn => {
                    const isActive = btn.dataset.lang === currentLang;
                    btn.classList.toggle('active', isActive);
                    btn.setAttribute('aria-pressed', isActive.toString());
                });
            } else {
                container.querySelector('.lang-select').value = currentLang;
            }
        });

        return container;
    }

    // Auto-init on DOMContentLoaded if not already initialized
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            if (!isLoaded) init().then(translateDOM);
        });
    } else {
        if (!isLoaded) init().then(translateDOM);
    }

    // Export to global
    global.i18n = {
        init,
        t,
        setLanguage,
        getLang,
        getSupportedLanguages,
        ready,
        translateDOM,
        createLanguageSwitcher
    };

})(window);
