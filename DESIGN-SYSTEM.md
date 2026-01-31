# CINQ Design System v3.1

> **"The Rule of Five"** — L'anti-réseau social  
> Design intime, intentionnel et accessible

---

## 📋 Table des matières

1. [Philosophie](#-philosophie)
2. [Couleurs](#-couleurs)
3. [Typographie](#-typographie)
4. [Espacement](#-espacement)
5. [Composants](#-composants)
6. [Accessibilité](#-accessibilité)
7. [Thèmes](#-thèmes-dark--light)
8. [Animations](#-animations)
9. [Usage](#-usage)

---

## 🎯 Philosophie

### Signature visuelle
- **Géométrie du pentagone** — Motif à 5 points omniprésent
- **Échelle basée sur 5** — Espacements multiples de 5px
- **Dégradés corail chauds** — Avec nuances dorées
- **Compositions asymétriques** — Équilibre intentionnel
- **Transitions fluides** — Entre thèmes clair/sombre

### Principes
1. **Intimité** — 5 personnes, pas 500
2. **Calme** — Respiration vs anxiété
3. **Premium** — Qualité sur quantité
4. **Accessible** — WCAG AA minimum

---

## 🎨 Couleurs

### Couleurs de marque (invariables)

```css
--cinq-coral: #ff6b4a;        /* Primary brand */
--cinq-coral-light: #ff8a6a;  /* Hover state */
--cinq-coral-dark: #e85a3a;   /* Pressed state */
--cinq-gold: #fbbf24;         /* Accent */
--cinq-lavender: #a78bfa;     /* Secondary accent */
--cinq-mint: #34d399;         /* Success */
```

### Gradients signature

| Nom | CSS | Usage |
|-----|-----|-------|
| `--cinq-gradient` | `linear-gradient(135deg, #ff6b4a, #ff8a6a, #ffb08c)` | CTAs, logos |
| `--cinq-gradient-hover` | `linear-gradient(135deg, #ff7d5c, #ff9b7c, #ffc09c)` | Hover state |
| `--cinq-gradient-subtle` | Corail à 12% → 8% opacity | Backgrounds subtils |
| `--cinq-pentagon-gradient` | Conic gradient 5 couleurs | Signature unique |

### Couleurs sémantiques

| Token | Dark Mode | Light Mode | Usage |
|-------|-----------|------------|-------|
| `--color-success` | `#34d399` | `#059669` | Confirmations |
| `--color-warning` | `#fbbf24` | `#d97706` | Alertes |
| `--color-error` | `#f87171` | `#dc2626` | Erreurs |

### Contraste WCAG AA ✓

| Élément | Dark Mode | Light Mode | Ratio |
|---------|-----------|------------|-------|
| Text Primary | `#fafaf9` | `#1a1918` | ~17:1 ✓ |
| Text Secondary | 85% opacity | 80% opacity | ~7:1 ✓ |
| Text Tertiary | 70% opacity | 65% opacity | ~5:1 ✓ |
| Text Muted | 55% opacity | 58% opacity | ~4.5:1 ✓ |

---

## ✍️ Typographie

### Familles de polices

```css
--font-display: 'Space Grotesk', sans-serif;  /* Titres, UI */
--font-body: 'Inter', sans-serif;              /* Corps de texte */
--font-mono: 'JetBrains Mono', monospace;      /* Code */
```

### Échelle de tailles (basée sur 5)

| Token | Taille | Équivalent |
|-------|--------|------------|
| `--text-xs` | 0.6875rem | 11px |
| `--text-sm` | 0.8125rem | 13px |
| `--text-base` | 0.9375rem | **15px** (base) |
| `--text-lg` | 1.0625rem | 17px |
| `--text-xl` | 1.25rem | 20px (4×5) |
| `--text-2xl` | 1.5625rem | 25px (5×5) |
| `--text-3xl` | 1.875rem | 30px (6×5) |
| `--text-4xl` | 2.5rem | 40px (8×5) |
| `--text-5xl` | 3.125rem | 50px (10×5) |
| `--text-hero` | clamp(2.5rem, 8vw, 4.5rem) | Responsive |

### Line Heights

```css
--leading-none: 1;       /* Titres compacts */
--leading-tight: 1.2;    /* Titres */
--leading-snug: 1.375;   /* Sous-titres */
--leading-normal: 1.5;   /* Corps */
--leading-relaxed: 1.625;/* Lecture longue */
--leading-loose: 2;      /* Aéré */
```

### Letter Spacing

```css
--tracking-tighter: -0.04em;  /* Titres hero */
--tracking-tight: -0.02em;    /* Titres */
--tracking-normal: 0;         /* Corps */
--tracking-wide: 0.02em;      /* Boutons */
--tracking-wider: 0.05em;     /* Labels */
```

---

## 📐 Espacement

### Échelle 5-based

| Token | Valeur | Pixels |
|-------|--------|--------|
| `--space-1` | 0.3125rem | 5px |
| `--space-2` | 0.625rem | 10px |
| `--space-3` | 0.9375rem | 15px |
| `--space-4` | 1.25rem | 20px |
| `--space-5` | 1.5625rem | 25px |
| `--space-6` | 1.875rem | 30px |
| `--space-8` | 2.5rem | 40px |
| `--space-10` | 3.125rem | 50px |
| `--space-12` | 3.75rem | 60px |
| `--space-16` | 5rem | 80px |
| `--space-20` | 6.25rem | 100px |

### Border Radius

| Token | Valeur | Usage |
|-------|--------|-------|
| `--radius-xs` | 4px | Éléments fins |
| `--radius-sm` | 6px | Tags, badges |
| `--radius-md` | 10px | Inputs |
| `--radius-lg` | 15px | Boutons, cards |
| `--radius-xl` | 20px | Grandes cards |
| `--radius-2xl` | 25px | Modales |
| `--radius-3xl` | 32px | Sections |
| `--radius-full` | 9999px | Pills, cercles |

### Largeurs de contenu

```css
--content-xs: 20rem;     /* 320px */
--content-sm: 33.75rem;  /* 540px */
--content-md: 45rem;     /* 720px */
--content-lg: 60rem;     /* 960px */
--content-xl: 75rem;     /* 1200px */
--content-prose: 65ch;   /* Lecture optimale */
```

---

## 🧩 Composants

### Boutons

```html
<button class="btn btn-primary">Action principale</button>
<button class="btn btn-secondary">Action secondaire</button>
<button class="btn btn-ghost">Action subtile</button>
```

| Classe | Style | Usage |
|--------|-------|-------|
| `.btn-primary` | Gradient corail + glow | CTAs principales |
| `.btn-secondary` | Fond + bordure | Actions secondaires |
| `.btn-ghost` | Transparent | Actions subtiles |
| `.btn-sm` | Petit | Inline actions |
| `.btn-lg` | Grand | Hero sections |
| `.btn-xl` | Très grand | Landing pages |
| `.btn-icon` | Carré 1:1 | Icônes seules |

**Accessibilité:** Tous les boutons ont un `min-height: 44px` (WCAG 2.2).

### Inputs

```html
<label class="label" for="email">Email</label>
<input class="input" type="email" id="email" placeholder="ton@email.fr">
```

- Focus: bordure corail + ombre glow
- Min-height: 44px
- Placeholder: couleur muted

### Cards

```html
<article class="card">Contenu...</article>
<article class="card card-interactive">Cliquable</article>
<article class="card card-glow">Avec bordure gradient au hover</article>
```

### Glass Morphism

```html
<div class="glass">Effet verre dépoli</div>
<div class="glass-subtle">Version subtile</div>
```

### Badges

```html
<span class="badge">Neutre</span>
<span class="badge badge-brand">Marque</span>
<span class="badge badge-success">Succès</span>
```

---

## ♿ Accessibilité

### Standards appliqués
- **WCAG 2.1 AA** — Minimum requis
- **WCAG 2.2** — Touch targets 44px

### Tokens d'accessibilité

```css
/* Touch targets */
--touch-target-min: 44px;
--touch-target-comfortable: 48px;

/* Focus ring */
--focus-ring-width: 2px;
--focus-ring-offset: 3px;
--focus-ring-color: var(--cinq-coral);
```

### Classes utilitaires

| Classe | Usage |
|--------|-------|
| `.sr-only` | Caché visuellement, accessible aux lecteurs d'écran |
| `.sr-only-focusable` | Caché sauf au focus (skip links) |
| `.skip-link` | Lien d'évitement clavier |
| `.touch-target` | Garantit 44×44px minimum |
| `.focus-visible-ring` | Force l'anneau de focus |

### Media Queries supportées

```css
@media (prefers-reduced-motion: reduce) { ... }
@media (prefers-contrast: more) { ... }
@media (forced-colors: active) { ... }
@media (prefers-color-scheme: light) { ... }
```

### Checklist

- [x] Contraste texte ≥ 4.5:1 (AA)
- [x] Contraste grands textes ≥ 3:1 (AA)
- [x] Touch targets ≥ 44px
- [x] Focus visible sur tous les interactifs
- [x] Skip link disponible
- [x] Reduced motion respecté
- [x] High contrast mode supporté
- [x] Forced colors mode supporté

---

## 🌓 Thèmes (Dark & Light)

### Changement de thème

```html
<html data-theme="dark">  <!-- ou "light" -->
```

```javascript
// Script de détection (à mettre dans <head>)
(function() {
  const saved = localStorage.getItem('cinq_theme');
  if (saved) {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
```

### Variables par thème

| Variable | Dark | Light |
|----------|------|-------|
| `--color-bg-primary` | `#0e0e12` | `#faf9f7` |
| `--color-bg-secondary` | `#16161c` | `#ffffff` |
| `--color-bg-tertiary` | `#1e1e26` | `#f5f4f2` |
| `--color-text-primary` | `#fafaf9` | `#1a1918` |
| `--color-brand` | `#ff6b4a` | `#e85a3a` |

### Transition fluide

```css
transition: 
  background-color var(--transition-theme),
  color var(--transition-theme);
```

Durée: `350ms` avec `ease-smooth`.

---

## 🎬 Animations

### Courbes d'easing

```css
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
```

### Durées standards

| Token | Durée | Usage |
|-------|-------|-------|
| `--transition-fast` | 150ms | Hover states |
| `--transition-base` | 250ms | Interactions |
| `--transition-slow` | 400ms | Entrées/sorties |
| `--transition-spring` | 500ms | Bouncy effects |
| `--transition-theme` | 350ms | Changement de thème |

### Classes d'animation

```html
<div class="animate-fade-in-up">Fade in + slide up</div>
<div class="animate-scale-in">Scale in</div>
<div class="animate-shimmer">Loading skeleton</div>
<div class="animate-message">Message bubble</div>
```

### Stagger delay

```html
<div class="animate-fade-in-up animate-delay-1">Premier</div>
<div class="animate-fade-in-up animate-delay-2">Deuxième</div>
<div class="animate-fade-in-up animate-delay-3">Troisième</div>
```

Intervalle: `50ms` entre chaque élément.

---

## 📦 Usage

### Import du Design System

```html
<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

<!-- Design System -->
<link rel="stylesheet" href="/design/styles.min.css">
```

### Structure HTML recommandée

```html
<!DOCTYPE html>
<html lang="fr" data-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- Theme detection script here -->
  <!-- Fonts + CSS imports here -->
</head>
<body>
  <a href="#main" class="skip-link">Aller au contenu</a>
  
  <!-- Decorative background -->
  <div class="gradient-orb gradient-orb-1"></div>
  <div class="gradient-orb gradient-orb-2"></div>
  <div class="noise-overlay"></div>
  
  <main id="main">
    <!-- Contenu -->
  </main>
</body>
</html>
```

### Z-Index Scale

| Token | Valeur | Usage |
|-------|--------|-------|
| `--z-base` | 0 | Contenu normal |
| `--z-elevated` | 10 | Cards surélevées |
| `--z-sticky` | 100 | Headers fixes |
| `--z-overlay` | 200 | Overlays |
| `--z-modal` | 300 | Modales |
| `--z-toast` | 400 | Notifications |
| `--z-max` | 9999 | Skip links, critiques |

---

## 📁 Structure des fichiers

```
/design/
├── styles.css          # Design System complet (source)
├── styles.min.css      # Version minifiée (production)
├── brand.md            # Guidelines de marque
└── app-design.md       # Spécifications d'app

/css/
├── mobile-responsive.min.css  # Responsive overrides
├── a11y.min.css              # Accessibilité additionnelle
└── wow-effects.css           # Effets spéciaux
```

---

## 🔄 Changelog

### v3.1 (2025-02-01)
- ✅ Amélioration contraste WCAG AA pour `--color-text-muted` en light mode
- ✅ Ajout tokens d'accessibilité (`--touch-target-*`, `--focus-ring-*`)
- ✅ Ajout tokens de line-height (`--leading-*`)
- ✅ Ajout tokens de border-width (`--border-width-*`)
- ✅ Ajout tokens de content max-width (`--content-*`)
- ✅ Support `@media (forced-colors: active)` pour high contrast mode
- ✅ Support `@media (prefers-contrast: more)`
- ✅ Classe `.sr-only-focusable` pour skip links améliorés
- ✅ Classe `.touch-target` utilitaire

### v3.0
- Design System initial avec thème pentagon/corail
- Support Dark/Light mode
- Animations et glassmorphism

---

*Conçu avec intention. 5 personnes max. C'est le concept.*
