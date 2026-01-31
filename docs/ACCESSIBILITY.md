# Cinq — Accessibilité (a11y)

Ce document décrit les fonctionnalités d'accessibilité implémentées dans Cinq.

## 🎯 Conformité WCAG 2.1 AA

### ✅ Critères respectés

#### 1. Perceptible

| Critère | Implémentation |
|---------|----------------|
| **1.1.1 Contenu non textuel** | Alt text sur images, aria-label sur boutons iconiques |
| **1.3.1 Information et relations** | Structure sémantique HTML5, landmarks ARIA |
| **1.3.2 Ordre significatif** | DOM order = visual order |
| **1.4.1 Utilisation de la couleur** | Pas de dépendance unique à la couleur |
| **1.4.3 Contraste** | Ratio 4.5:1 minimum (texte), 3:1 (grands textes) |
| **1.4.10 Reflow** | Responsive jusqu'à 320px |
| **1.4.11 Contraste non-textuel** | Focus visible, bordures distinctes |
| **1.4.12 Espacement du texte** | Supporte les préférences utilisateur |

#### 2. Utilisable

| Critère | Implémentation |
|---------|----------------|
| **2.1.1 Clavier** | Navigation complète au clavier |
| **2.1.2 Pas de piège clavier** | Focus géré, modals fermables |
| **2.3.1 Seuil de flash** | Pas de clignotement |
| **2.4.1 Contourner les blocs** | Skip links sur toutes les pages |
| **2.4.2 Titre de page** | Titres descriptifs uniques |
| **2.4.3 Parcours du focus** | Ordre logique, focus management |
| **2.4.4 Fonction du lien** | Liens descriptifs |
| **2.4.6 En-têtes et étiquettes** | h1/h2/h3 hiérarchiques, labels |
| **2.4.7 Visibilité du focus** | `:focus-visible` styles personnalisés |
| **2.5.3 Étiquette dans le nom** | Labels accessibles sur tous les inputs |

#### 3. Compréhensible

| Critère | Implémentation |
|---------|----------------|
| **3.1.1 Langue de la page** | `lang="fr"` sur `<html>` |
| **3.2.1 Au focus** | Pas de changement de contexte |
| **3.2.2 À la saisie** | Pas de soumission automatique |
| **3.3.1 Identification des erreurs** | Messages d'erreur descriptifs |
| **3.3.2 Étiquettes ou instructions** | Labels, placeholders, hints |
| **3.3.3 Suggestion d'erreur** | Messages avec suggestions de correction |

#### 4. Robuste

| Critère | Implémentation |
|---------|----------------|
| **4.1.1 Analyse syntaxique** | HTML valide |
| **4.1.2 Nom, rôle, valeur** | ARIA attributes corrects |
| **4.1.3 Messages d'état** | `aria-live` regions |

---

## 🛠 Implémentation technique

### Skip Links

```html
<a href="#main-content" class="skip-link">Aller au contenu principal</a>
```

Présent sur: `app.html`, `login.html`, `register.html`, `feed.html`

### Landmarks ARIA

```html
<header class="app-header">...</header>
<main class="app-content" id="main-content">...</main>
<nav class="bottom-nav" role="tablist" aria-label="Navigation principale">...</nav>
```

### Navigation par onglets

```html
<nav role="tablist" aria-label="Navigation principale">
    <button role="tab" aria-selected="true" aria-controls="tab-feed">Feed</button>
    <button role="tab" aria-selected="false" aria-controls="tab-contacts">Tes 5</button>
    <button role="tab" aria-selected="false" aria-controls="tab-profil">Profil</button>
</nav>

<section role="tabpanel" aria-labelledby="nav-feed" tabindex="0">...</section>
```

**Keyboard support:**
- `←` `→` : Naviguer entre onglets
- `Home` : Premier onglet
- `End` : Dernier onglet
- `Enter` / `Space` : Activer l'onglet

### Feed (liste de posts)

```html
<div class="posts-list" role="feed" aria-label="Fil d'actualités" aria-busy="false">
    <article aria-posinset="1" aria-setsize="10">...</article>
    <article aria-posinset="2" aria-setsize="10">...</article>
</div>
```

### Formulaires

```html
<label for="email" class="form-label">Email</label>
<input 
    type="email" 
    id="email" 
    aria-required="true"
    aria-describedby="email-error"
    aria-invalid="false"
>
<div id="email-error" role="alert" class="field-error">...</div>
```

### Modals

```html
<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
    <div class="modal">
        <h2 id="modal-title">Titre</h2>
        <!-- Focus trapped inside -->
    </div>
</div>
```

### Live Regions

```html
<!-- Toast notifications -->
<div class="toast-container" role="status" aria-live="polite" aria-atomic="false">
    <!-- Toasts inserted dynamically -->
</div>

<!-- Chat messages -->
<div class="chat-messages" role="log" aria-live="polite">
    <!-- Messages -->
</div>

<!-- Character count -->
<span class="char-count" aria-live="polite" aria-atomic="true">0/1000</span>
```

### Images

```html
<!-- Images décoratives -->
<img src="..." alt="" aria-hidden="true">

<!-- Images avec contenu -->
<img src="..." alt="Image partagée par Marie">

<!-- Avatars (décoratifs car nom adjacent) -->
<div class="avatar" aria-hidden="true">
    <img src="..." alt="">
</div>
```

### Contenu caché visuellement (screen reader only)

```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

---

## 🎨 CSS Accessibilité

### Focus visible

```css
:focus-visible {
    outline: 2px solid var(--color-brand);
    outline-offset: 2px;
}

:focus:not(:focus-visible) {
    outline: none;
}
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

### High Contrast

```css
@media (prefers-contrast: high) {
    :root {
        --color-border: rgba(255, 255, 255, 0.3);
    }
    .btn, button {
        border: 2px solid currentColor;
    }
}
```

### Touch targets

```css
button, a, [role="button"] {
    min-height: 44px;
    min-width: 44px;
}
```

---

## 🧪 Tests

### Outils recommandés

1. **axe DevTools** - Extension navigateur
2. **WAVE** - Web Accessibility Evaluation Tool
3. **Lighthouse** - Audit accessibilité
4. **NVDA / VoiceOver** - Screen readers
5. **Contrast Checker** - WebAIM

### Checklist manuelle

- [ ] Navigation clavier complète (Tab, Shift+Tab, Arrows, Enter, Escape)
- [ ] Focus visible sur tous les éléments interactifs
- [ ] Screen reader : annonces cohérentes
- [ ] Zoom 200% : pas de perte de contenu
- [ ] Mode contraste élevé : lisibilité
- [ ] Reduced motion : pas d'animations

---

## 📚 Ressources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WAI-ARIA Practices](https://www.w3.org/WAI/ARIA/apg/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project Checklist](https://www.a11yproject.com/checklist/)

---

*Dernière mise à jour: 2025*
