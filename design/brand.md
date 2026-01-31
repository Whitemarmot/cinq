# Cinq — Brand Guidelines

> **Version:** 1.0  
> **Date:** 2025-01-31  
> **Philosophy:** "L'anti-réseau social"

---

## 🎯 Brand Essence

**Cinq** est l'antithèse des réseaux sociaux modernes. Pas de likes, pas d'algorithme, pas de scroll infini. Juste 5 personnes qui comptent vraiment.

### Personnalité de marque
- **Intentionnel** — Chaque choix de design est délibéré
- **Calme** — Respiration vs anxiété
- **Premium** — Qualité sur quantité
- **Humain** — Chaleur vs tech froide
- **Audacieux** — Assumer de ne pas scaler

### Ton de voix
- Direct, jamais agressif
- Légèrement irrévérencieux
- Honnête, parfois brutal ("C'est le point. Pas le bug.")
- Jamais de FOMO ("Tu n'as rien raté")

---

## 🎨 Palette de couleurs

### Primary — Indigo to Purple Gradient
Notre signature. Mystérieux, premium, différent du bleu tech classique.

```
Primary Gradient:
├── Indigo-500   #6366f1  (start)
├── Violet-500   #8b5cf6  (mid)
└── Purple-500   #a855f7  (end)

Direction: 135deg (diagonal)
CSS: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)
```

### Core Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--cinq-indigo` | `#6366f1` | Primary actions, links |
| `--cinq-violet` | `#8b5cf6` | Hover states, accents |
| `--cinq-purple` | `#a855f7` | Special highlights |

### Dark Theme (Landing, Onboarding)
Immersif, mystérieux, premium.

```
Background Gradient:
├── Slate-950    #0f172a  (darkest)
├── Slate-900    #1e293b  (dark)
└── Indigo-950   #1e1b4b  (tinted)

CSS: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)
```

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-primary` | `#0f172a` | Main background |
| `--bg-elevated` | `#1e293b` | Cards, modals |
| `--bg-glass` | `rgba(255,255,255,0.05)` | Glassmorphism |
| `--text-primary` | `#ffffff` | Headings |
| `--text-secondary` | `rgba(255,255,255,0.7)` | Body |
| `--text-muted` | `rgba(255,255,255,0.4)` | Captions |
| `--border` | `rgba(255,255,255,0.1)` | Dividers |

### Light Theme (App, Content)
Chaleureux, lisible, calme.

```
Stone (Warm Neutrals):
├── Stone-50     #fafaf9   Background
├── Stone-100    #f5f5f4   Cards
├── Stone-200    #e7e5e4   Borders
├── Stone-400    #a8a29e   Muted text
├── Stone-700    #44403c   Secondary text
└── Stone-950    #0c0a09   Primary text
```

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-light` | `#fafaf9` | Main background |
| `--bg-card` | `#f5f5f4` | Cards |
| `--text-dark` | `#0c0a09` | Headings |
| `--text-body` | `#44403c` | Body text |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--success` | `#10b981` | Confirmations |
| `--warning` | `#f59e0b` | Attention |
| `--error` | `#ef4444` | Errors (rare!) |

### Decorative Blurs
Pour les effets de fond animés:

```css
.blur-indigo { background: rgba(99, 102, 241, 0.2); filter: blur(100px); }
.blur-purple { background: rgba(139, 92, 246, 0.15); filter: blur(80px); }
.blur-blue { background: rgba(59, 130, 246, 0.1); filter: blur(60px); }
```

---

## ✍️ Typographie

### Font Stack

**Display & UI:** Inter
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

**Why Inter?**
- Excellente lisibilité sur écran
- Variable font (performance)
- Chiffres tabulaires pour le "5"
- Disponible sur Google Fonts

### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `--text-display` | 48px | 800 | 1.1 | Hero titles |
| `--text-h1` | 36px | 700 | 1.2 | Page titles |
| `--text-h2` | 28px | 700 | 1.3 | Section titles |
| `--text-h3` | 22px | 600 | 1.4 | Subsections |
| `--text-body-lg` | 18px | 400 | 1.6 | Lead text |
| `--text-body` | 16px | 400 | 1.5 | Body text |
| `--text-small` | 14px | 400 | 1.5 | Captions |
| `--text-micro` | 12px | 500 | 1.4 | Labels, badges |

### Letter Spacing
- Display/Headlines: `-0.02em` (tighter)
- Body: `0` (normal)
- All-caps labels: `0.05em` (looser)

---

## 🖼️ Logo

### Variants disponibles

| Fichier | Usage |
|---------|-------|
| `logo-full.svg` | Header sur fond sombre |
| `logo-full-dark.svg` | Header sur fond clair |
| `logo-icon.svg` | Favicon, app icon (cercle) |
| `logo-icon-rounded.svg` | App stores, rounded square |
| `logo-mono-white.svg` | Footer sombre, watermark |
| `logo-mono-dark.svg` | Footer clair |
| `logo-wordmark.svg` | Texte seul avec gradient |

### Construction du logo

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ╭────────╮                                           │
│   │        │                                           │
│   │   5    │    Cinq                                   │
│   │        │                                           │
│   ╰────────╯                                           │
│   └── Icon ──┘  └── Wordmark ──┘                       │
│                                                         │
│   Icon: Cercle gradient + "5" bold                     │
│   Wordmark: Inter Bold, tracking serré                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Clear Space
Minimum 1× la hauteur du "5" autour du logo.

### Minimum Size
- Full logo: 120px de large
- Icon seul: 24px

### Don'ts
- ❌ Ne pas étirer ou déformer
- ❌ Ne pas changer les couleurs du gradient
- ❌ Ne pas ajouter d'ombres ou d'effets
- ❌ Ne pas utiliser sur fonds trop chargés

---

## 🎭 Iconographie

### Style
- Line icons (stroke: 2px)
- Rounded caps et joints
- 24×24 base size
- Monochrome (adapté au contexte)

### Source recommandée
**Lucide Icons** — cohérent, lisible, MIT license.

### Icônes clés

| Action | Icône | Note |
|--------|-------|------|
| Ajouter | `Plus` | Dans un cercle pour "add contact" |
| Message | `MessageCircle` | Bulle ronde, pas carrée |
| Ping | `Sparkles` ou `Heart` | 💭 en emoji acceptable |
| Lieu | `MapPin` | |
| Moment | `Calendar` | |
| Settings | `Settings` | Gear classique |

---

## 🌟 Effets & Motion

### Glow Effect
Signature sur les éléments interactifs:

```css
.glow {
  box-shadow: 
    0 0 20px rgba(99, 102, 241, 0.3),
    0 0 40px rgba(139, 92, 246, 0.2);
}
```

### Glassmorphism
Pour les cartes et surfaces:

```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

### Animations

| Type | Duration | Easing |
|------|----------|--------|
| Hover | 150ms | ease-out |
| Enter | 300ms | ease-out |
| Exit | 200ms | ease-in |
| Loading pulse | 2s | ease-in-out |

### Micro-interactions
- Boutons: scale(0.98) on press
- Cards: subtle lift on hover
- Counter: bouncy entrance (cubic-bezier)

---

## 📱 Applications

### App Icon
- Utiliser `logo-icon-rounded.svg`
- Export PNG: 1024×1024 (iOS), 512×512 (Android)
- Pas de texte dans l'icône

### Favicon
- Utiliser `logo-icon.svg`
- Générer: 16×16, 32×32, 180×180 (Apple Touch)

### Social / OG Images
- Format: 1200×630
- Style: Dark background + centered logo + tagline
- Voir `/assets/og/` pour les templates

### Email
- Logo full sur fond sombre
- Garder le design minimal

---

## 📐 Spacing System

Base unit: `8px`

| Token | Value | Usage |
|-------|-------|-------|
| `--space-1` | 4px | Micro adjustments |
| `--space-2` | 8px | Tight spacing |
| `--space-3` | 12px | Small gaps |
| `--space-4` | 16px | Standard padding |
| `--space-6` | 24px | Section gaps |
| `--space-8` | 32px | Large sections |
| `--space-12` | 48px | Hero spacing |
| `--space-16` | 64px | Page sections |

### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 6px | Small elements |
| `--radius-md` | 12px | Buttons, inputs |
| `--radius-lg` | 16px | Cards |
| `--radius-xl` | 24px | Modals |
| `--radius-full` | 9999px | Pills, circles |

---

## ✅ Quick Reference

### CSS Variables (copy-paste)

```css
:root {
  /* Primary */
  --cinq-indigo: #6366f1;
  --cinq-violet: #8b5cf6;
  --cinq-purple: #a855f7;
  --cinq-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%);
  
  /* Dark theme */
  --bg-dark: #0f172a;
  --bg-dark-elevated: #1e293b;
  --text-white: #ffffff;
  --text-white-70: rgba(255,255,255,0.7);
  --text-white-40: rgba(255,255,255,0.4);
  --border-white-10: rgba(255,255,255,0.1);
  
  /* Light theme */
  --bg-light: #fafaf9;
  --bg-card: #f5f5f4;
  --text-dark: #0c0a09;
  --text-body: #44403c;
  
  /* Semantic */
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
}
```

---

*Créé avec intention. Pas de scale. C'est le point.*
