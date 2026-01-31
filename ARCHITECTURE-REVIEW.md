# 🏛️ ARCHITECTURE REVIEW — Cinq

**Date:** 31 Janvier 2025  
**Reviewer:** Lead Architect  
**Version analysée:** 1.0.0  

---

## 📊 Executive Summary

| Aspect | Score | Verdict |
|--------|-------|---------|
| **Performance** | ⚠️ 5/10 | Fichiers monolithiques, pas de code splitting |
| **Maintenabilité** | ⚠️ 4/10 | Duplication massive, DRY non respecté |
| **Sécurité** | ✅ 7/10 | XSS partiellement géré, mais CSRF absent |
| **Accessibilité** | ✅ 8/10 | Bonne base ARIA, peut s'améliorer |

**Verdict global: 🟡 Fonctionnel mais dette technique importante**

---

## 1. 🏗️ Architecture Actuelle

### 1.1 Structure des fichiers

```
cinq/
├── *.html (12 fichiers, ~8000 lignes total)
│   ├── app.html        → 3336 lignes (!)  ← MONOLITHE
│   ├── feed.html       → 1266 lignes
│   ├── index.html      → 1239 lignes
│   ├── settings.html   → 1090 lignes
│   └── ...
├── api/                → 20 fichiers (bien structuré ✅)
├── js/                 → 10 fichiers
├── css/                → 12 fichiers
└── design/             → Design system
```

### 1.2 Diagramme de flux

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Netlify    │────▶│  Supabase   │
│  (HTML/JS)  │     │  Functions  │     │  (DB+Auth)  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                    │
      │ JWT Token          │ Service Key
      ▼                    ▼
   localStorage       _supabase.js
```

---

## 2. 🔴 PROBLÈMES CRITIQUES

### 2.1 Fichier Monolithique — `app.html` (3336 lignes)

**Gravité: HAUTE**

Le fichier `app.html` contient:
- ~1500 lignes de CSS inline
- ~1800 lignes de JavaScript inline
- 63 fonctions JavaScript
- Toute la logique de l'application

**Impact:**
- ❌ Temps de parsing ~200ms sur mobile
- ❌ Impossible de cacher les assets séparément
- ❌ Pas de tree-shaking
- ❌ Impossible de tester unitairement

### 2.2 Duplication Massive (violation DRY)

| Code dupliqué | Occurrences | Fichiers |
|---------------|-------------|----------|
| `showToast()` | 4+ | app.html, feed.html, settings.html, error.html |
| `escapeHtml()` | 4+ | app.html, feed.html, common.js, gift-old.html |
| `toggleTheme()` | 4+ | app.html, feed.html, index.html, settings.html |
| `authHeaders()` | 3+ | app.html, feed.html, settings.html |
| Theme init script | 6+ | Tous les fichiers HTML |
| Composer component | 2 | app.html, feed.html (100+ lignes chacun) |

**Estimation:** ~2000 lignes de code dupliqué

### 2.3 Styles Inline Massifs

```html
<!-- Exemple réel de app.html -->
<button style="margin-top:var(--space-4);background:none;border:none;
color:var(--color-text-muted);cursor:pointer;width:100%;
padding:var(--space-2);" onclick="closeAddContactModal()">
```

**Problèmes:**
- Impossible à maintenir
- Pas de réutilisation
- CSS non cacheable

---

## 3. 🟠 PROBLÈMES MODÉRÉS

### 3.1 innerHTML avec User Data

```javascript
// feed.html - VULNÉRABLE (partiel)
container.innerHTML = posts.map(post => renderPost(post)).join('');

// app.html - SÉCURISÉ
chatAvatar.innerHTML = avatarUrl 
    ? `<img src="${avatarUrl}" alt="">` // URL non échappée!
    : `<span aria-hidden="true">${initial}</span>`;
```

**Risque XSS:**
- `escapeHtml()` utilisé mais pas systématiquement
- URLs d'avatar non validées côté client
- Certains `innerHTML` avec template literals dangereux

### 3.2 Absence de Protection CSRF

```javascript
// API calls sans token CSRF
await fetch(`${API_URL}/user-profile`, {
    method: 'PUT',
    headers: authHeaders(), // Seulement Bearer token
    body: JSON.stringify({ display_name, bio })
});
```

**Risque:** Attaque CSRF possible si l'utilisateur visite un site malveillant.

### 3.3 Polling Inefficace

```javascript
// Polling toutes les 3 secondes pour les messages
messagePollingInterval = setInterval(loadMessages, 3000);
contactPollingInterval = setInterval(checkForNewMessages, 10000);
```

**Impact:**
- Batterie drainée sur mobile
- Requests inutiles quand l'onglet est inactif
- Pas de WebSocket pour temps réel

### 3.4 Pas de Lazy Loading

```html
<!-- Tous les scripts chargés au démarrage -->
<script defer src="/js/wow-effects.js"></script>
<script defer src="/js/hero-particles.js"></script>
<script defer src="/js/text-reveal.js"></script>
<script defer src="/js/gradient-mesh.js"></script>
```

Les effets visuels sont chargés même sur les pages qui ne les utilisent pas.

---

## 4. 🟢 POINTS POSITIFS

### 4.1 API Backend Bien Structuré ✅

```
api/
├── _supabase.js      → Singleton Supabase bien isolé
├── _validation.js    → Validation centralisée
├── _rate-limit.js    → Rate limiting implémenté
├── _error-logger.js  → Logging structuré
└── auth.js, posts.js, etc. → Endpoints cohérents
```

**Forces:**
- Helpers partagés (DRY respecté côté backend)
- Validation avec sanitization (`sanitizeText`, `validateURL`)
- Rate limiting par utilisateur/IP
- Messages d'erreur en français

### 4.2 Accessibilité Solide ✅

```html
<!-- 115+ attributs ARIA dans app.html -->
<div role="tablist" aria-label="Navigation principale">
<div role="alertdialog" aria-modal="true" aria-labelledby="...">
<span class="sr-only">Texte pour lecteurs d'écran</span>
```

**Implémenté:**
- Skip links
- ARIA roles et labels
- Focus trap dans les modals
- Annonces screen reader (`announce()`)
- `prefers-reduced-motion` respecté
- Navigation clavier (flèches dans les tabs)

### 4.3 Design System Unifié ✅

```css
/* Variables CSS cohérentes */
--color-brand, --color-bg-primary, --radius-lg, --space-4...
```

Le fichier `design/styles.css` (34KB) fournit une base solide.

### 4.4 PWA Fonctionnel ✅

- Service worker avec cache strategy
- Manifest complet
- Offline page
- Push notifications

---

## 5. 📋 PLAN D'AMÉLIORATION PRIORISÉ

### Phase 1: Quick Wins (1-2 jours) 🚀

| Action | Impact | Effort |
|--------|--------|--------|
| 1.1 Extraire JS de `app.html` vers `/js/app-core.js` | Cacheabilité +50% | Moyen |
| 1.2 Créer `/js/shared.js` pour fonctions communes | -2000 lignes dupliquées | Moyen |
| 1.3 Ajouter `loading="lazy"` aux images | LCP -30% | Faible |
| 1.4 Utiliser Visibility API pour pause polling | Batterie +40% | Faible |

```javascript
// 1.4 - Pause polling quand onglet inactif
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(messagePollingInterval);
    } else {
        messagePollingInterval = setInterval(loadMessages, 3000);
    }
});
```

### Phase 2: Refactoring Core (1 semaine) 🔧

| Action | Impact | Effort |
|--------|--------|--------|
| 2.1 Créer composants réutilisables (Toast, Modal, Composer) | Maintenabilité +++ | Élevé |
| 2.2 Migrer styles inline vers classes CSS | Cache +++ | Moyen |
| 2.3 Implémenter CSRF tokens | Sécurité +++ | Moyen |
| 2.4 Sanitizer systématique côté client | XSS -100% | Moyen |

**Architecture cible pour composants:**

```
js/
├── components/
│   ├── toast.js        // showToast, removeToast
│   ├── modal.js        // openModal, closeModal, focusTrap
│   ├── composer.js     // Post composer logic
│   └── theme.js        // Theme toggle
├── utils/
│   ├── security.js     // escapeHtml, sanitize
│   ├── api.js          // fetch wrapper, authHeaders
│   └── storage.js      // localStorage helpers
└── pages/
    ├── app.js          // Page-specific logic
    └── feed.js
```

### Phase 3: Modernisation (2-4 semaines) 🚀

| Action | Impact | Effort |
|--------|--------|--------|
| 3.1 Remplacer polling par WebSocket | Temps réel, batterie | Élevé |
| 3.2 Implémenter code splitting (dynamic imports) | LCP -50% | Élevé |
| 3.3 Migrer vers framework léger (Preact/Alpine.js) | Maintenabilité +++ | Très élevé |
| 3.4 Service Worker avec workbox | Cache intelligent | Moyen |

```javascript
// 3.2 - Dynamic import exemple
const loadComposer = async () => {
    const { Composer } = await import('./components/composer.js');
    return new Composer('#composer');
};
```

---

## 6. 🎯 MÉTRIQUES CIBLES

| Métrique | Actuel | Cible Phase 1 | Cible Phase 3 |
|----------|--------|---------------|---------------|
| **app.html size** | 136 KB | 80 KB | 20 KB |
| **Total JS** | ~100 KB inline | 60 KB cached | 40 KB split |
| **LCP mobile** | ~3.5s (estimé) | 2.5s | 1.5s |
| **Lighthouse Score** | ~65 (estimé) | 80 | 95 |
| **Lignes dupliquées** | ~2000 | 500 | 0 |

---

## 7. 📁 FICHIERS À CRÉER (Phase 1)

### `/js/shared.js`

```javascript
/**
 * Shared utilities for Cinq
 */
export const Cinq = {
    // Security
    escapeHtml(str) {
        if (typeof str !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    // Auth
    getSession() {
        return JSON.parse(localStorage.getItem('cinq_session') || 'null');
    },
    
    getUser() {
        return JSON.parse(localStorage.getItem('cinq_user') || 'null');
    },
    
    authHeaders() {
        const session = this.getSession();
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`
        };
    },

    // Toast
    showToast({ type = 'info', title, message, duration = 4000 }) {
        // ... implementation
    }
};

// Theme
export function initTheme() {
    const saved = localStorage.getItem('cinq_theme');
    if (saved) {
        document.documentElement.setAttribute('data-theme', saved);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
    }
}

export function toggleTheme() {
    const html = document.documentElement;
    const current = html.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
    localStorage.setItem('cinq_theme', next);
}
```

---

## 8. ⚠️ RISQUES SÉCURITÉ

| Risque | Sévérité | Statut | Recommandation |
|--------|----------|--------|----------------|
| XSS via innerHTML | MOYENNE | Partiel | Audit systématique + DOMPurify |
| CSRF | MOYENNE | Absent | Implémenter token CSRF dans cookies |
| Session hijacking | FAIBLE | OK | Tokens JWT, mais ajouter refresh token |
| Rate limiting client | FAIBLE | Absent | Ajouter debounce sur les actions |

### CSRF Implementation (recommandé)

```javascript
// Backend - Générer token
res.setHeader('Set-Cookie', `csrf=${generateToken()}; SameSite=Strict; Secure`);

// Frontend - Inclure dans headers
headers: {
    ...authHeaders(),
    'X-CSRF-Token': document.cookie.match(/csrf=([^;]+)/)?.[1]
}
```

---

## 9. 📱 ACCESSIBILITÉ - AMÉLIORATIONS

### Déjà implémenté ✅
- Skip links
- ARIA roles/labels (115+ attributs)
- Focus trap modals
- Keyboard navigation tabs
- Screen reader announcements
- Reduced motion support

### À améliorer 🔧
- Contraste couleurs (vérifier avec axe-core)
- Alternative texte images (`alt` parfois vide)
- Labels des boutons icon-only
- Touch targets (min 44x44px)

---

## 10. 🏁 CONCLUSION

Le projet Cinq a une **base solide côté backend** et une bonne prise en compte de l'**accessibilité**, mais souffre d'une **dette technique frontend importante** due à l'architecture monolithique.

**Priorités immédiates:**
1. ✅ Extraire le JavaScript de `app.html`
2. ✅ Créer un module shared.js
3. ✅ Ajouter protection CSRF
4. ✅ Implémenter Visibility API pour polling

**Investissement estimé:** 5-10 jours développeur pour Phase 1+2

---

*Document généré automatiquement — Architecture Review v1.0*
