# Changelog

Toutes les modifications notables de ce projet sont documentées ici.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/),
et ce projet adhère au [Semantic Versioning](https://semver.org/lang/fr/).

---

## [2.3.0] - 2025-02-01

### ✨ Added (Nouvelles fonctionnalités)

#### Contact Insights (Statistiques de relation)
- **Bouton Insights dans le chat header** — Accédez aux statistiques de votre relation avec un contact
- **Messages échangés** — Nombre total de messages, envoyés et reçus
- **Historique de relation** — Date du premier contact et de la dernière conversation
- **Jours de relation** — Nombre de jours depuis le premier message
- **Statistiques avancées** :
  - Moyenne de messages par jour
  - Record de jours consécutifs avec messages (streak)
  - Série actuelle de jours consécutifs
  - Jour de la semaine le plus actif
  - Taux de réponse (sous 24h)
- API endpoint `/api/contact-insights` pour récupérer les statistiques

---

## [2.2.0] - 2025-02-01

### ✨ Added (Nouvelles fonctionnalités)

#### Quick Share (Partage rapide d'images)
- **Ctrl+V / Cmd+V pour coller une image** — Partagez rapidement une image depuis le presse-papier (captures d'écran, images copiées) dans le composer du feed ou le chat
- Fonctionne avec JPEG, PNG, GIF, WebP (max 5 Mo)
- Indicateur visuel discret "📋 Ctrl+V pour coller une image" apparaît au focus
- Dans le chat : l'image est envoyée comme pièce jointe
- Dans le feed : l'image est uploadée et attachée au post

---

## [2.1.0] - 2025-02-01

### ✨ Added (Nouvelles fonctionnalités)

#### Messagerie
- **Auto-Reply (Mode Occupé)** - Réponse automatique configurable quand on est occupé (différent du mode vacances). Envoie une réponse automatique aux contacts (max 1x/30min par contact). Message personnalisable dans les paramètres.

---

## [2.0.0] - 2025-02-01 🌙 Night Sprint Edition

### ✨ Added (Nouvelles fonctionnalités)

#### UX & Interface
- **Système d'onboarding complet** pour nouveaux utilisateurs (`6db0e2b`)
- **Chat UX WhatsApp-style** avec bulles, timestamps, read receipts, typing indicator (`e970c1b`)
- **Infinite scroll** avec cursor-based pagination (`f2627cf`)
- **Micro-animations** et transitions fluides sur tous les composants (`1e7325a`)
- **Landing page redesign** avec meilleur taux de conversion (`089def9`)
- **Amélioration UX complète du feed** (`e2642fb`)

#### PWA & Mobile
- **Amélioration PWA & mobile experience** (`3a3b3d1`)
- **Push notifications support** + intégration complète (`1c922d4`, `5fd235f`)
- **Mobile UX polish**: keyboard handling, viewport-fit, touch targets (`4a45066`)

#### Design System
- **Design System v3.1** documenté (`5991758`)
- **WOW Animations v2**: Premium effects package (`58776b3`)
- **WOW Effect #1**: Pentagon signature + custom cursor (`25dedb3`)
- **WOW Effect #2**: Orbital particles around the 5 (`074177b`)
- **WOW Effect #3**: Text reveal + Counter animation (`9f3ebd6`)
- **WOW Effect #4**: Gradient mesh background (`50e2952`)
- **Better logo** (pentagon + 'cinq' text), transparent header on scroll (`a12899c`)

#### Documentation
- **Accessibility documentation** complète (`2e4209d`)
- **Mobile audit report** (`6a4e6c1`)
- **ARCHITECTURE-REVIEW.md** - Analyse architecture complète
- **DESIGN-SYSTEM.md** - Documentation design system v3.1
- **API-IMPROVEMENTS.md** - Documentation optimisations backend
- **SECURITY-AUDIT.md** - Audit sécurité complet
- **ERROR-HANDLING.md** - Documentation gestion erreurs
- **ONBOARDING-IMPROVEMENTS.md** - Améliorations UX onboarding

### ⚡ Changed (Améliorations)

#### Performance
- **Optimisation queries API** + cursor-based pagination (`48791d2`)
- **Élimination N+1 queries** dans contacts.js
- **Rate limiting corrigé** dans upload-avatar.js et upload-image.js

#### Pages Refactorisées vers le Design System
- **settings.html** refactorisé (`a49e1e9`)
- **redeem.html** refactorisé (`48fe432`)
- **register.html** amélioré (onboarding + UX) (`ae59e8c`)
- **login.html** amélioré (micro-interactions + UX) (`240bfee`)
- **gift.html** amélioré (micro-interactions + feedback) (`3b991f9`)

#### Accessibilité
- **WCAG AA compliance** améliorée
- **Contraste couleurs** corrigé
- **Touch targets** 44px minimum
- **Skip links** et navigation clavier
- **Support reduced motion**

### 🐛 Fixed (Corrections)

#### Thème & UI
- **Theme toggle** sur toutes les pages (FAQ, privacy, terms, error, settings, offline) (`2a41d2f`, `8fc865e`, `e745632`)
- **Early theme init script** pour éviter FOUC (`542169c`)
- **Typography**: Space Grotesk utilisé partout (`e8e5ea2`)
- **Replace emojis with SVG icons** sur toutes les pages (`c00c1b9`, `12d5478`, `954580d`)
- **Composer avatar image overflow** (`cb77eca`)
- **Footer overlap** + solid background (`c84d4e8`)

#### Configuration
- **Vercel.json** simplifié - fix invalid route source pattern (`f48ab3a`)
- **ESLint 9 flat config** format (`366bf51`)
- **Build command** removed for static site deployment (`0b30014`)

### 🔒 Security
- **XSS Prevention** améliorée dans showToast()
- **Input validation** renforcée (password, content, dates)
- **Security audit** complet réalisé

### 📝 Documentation

- Architecture review complète
- Design system v3.1 documenté
- API improvements documentées
- Error handling guidelines
- Accessibility audit WCAG

---

## [1.1.0] - 2025-01-31

### ✨ Added
- **Light/dark mode** toggle
- **SVG icons** (remplacement des emojis)
- **Rule of Five** signature design elements

### 🐛 Fixed
- Theme toggle sur landing
- Fonts Space Grotesk
- Footer overlap

---

## [1.0.0] - 2025-01-30

### ✨ Added
- **Gift Model** — Système de codes cadeaux
- **Auth System** — Inscription par code uniquement
- **Contacts** — Limite de 5 contacts max
- **Messaging** — Chat basique entre contacts
- **Feed & Posts** — Partage avec les 5 contacts
- **PWA** — Progressive Web App fonctionnelle
- **Push Notifications** — Notifications pour proposals

### 🏗️ Architecture
- Netlify Functions (serverless)
- Supabase (PostgreSQL + Auth)
- BTCPay Server (paiements crypto)

---

## Night Sprint Stats (2025-02-01)

| Métrique | Valeur |
|----------|--------|
| **Commits** | 50+ |
| **Fichiers modifiés** | 60+ |
| **Lignes ajoutées** | +15,000 |
| **Batches** | 14 |
| **Agents déployés** | 18 |

### Commits de la nuit (chronologique)

```
a3658e4 🌙 Night Sprint: Batch 14 - More app enhancements
5fd235f 🌙 feat(app): Add notifications integration
3a696b0 🌙 Night Sprint: Batch 13 - App polish
571fb21 🌙 Night Sprint: Batch 12 - Notifications & cleanup
6e2853e 🌙 Night Sprint: Batch 11 - Multi-page improvements
62608fe 🌙 Night Sprint: Batch 10 - Cleanup
1c922d4 🔔 feat(notifications): Add push notifications support + theme fixes
48fe432 ♻️ redeem.html: Refactorise vers le design system
d3be4b8 🌙 Night Sprint: Batch 9 - Settings improvements
2e4209d docs(a11y): add comprehensive accessibility documentation
b2a304d 🌙 Night Sprint: Batch 8 - Continuous improvements
6db0e2b ✨ feat(UX): Système d'onboarding complet pour nouveaux utilisateurs
3b991f9 ✨ gift.html: Améliore micro-interactions et feedback
d08825e 🌙 Night Sprint: Batch 7 - Major improvements
f2627cf ✨ Infinite scroll avec cursor-based pagination
2c80ed3 🌙 Night Sprint: Batch 6 - Continuous polish
e970c1b ✨ UX chat: bulles WhatsApp-style avec timestamps, read receipts
a49e1e9 ♻️ settings.html: Refactorise vers le design system
3a3b3d1 ✨ feat(pwa): improve PWA & mobile experience
5e11151 🌙 Night Sprint: Batch 5 - Continuous improvements
089def9 ✨ Landing page redesign: better conversion
48791d2 🔧 perf(api): optimize queries + cursor pagination
8dae6b5 🌙 Night Sprint: Batch 4 - More polish
1e7325a ✨ feat(animations): ajout micro-animations et transitions fluides
ae59e8c ✨ register.html: Améliore l'onboarding et UX
5991758 📚 docs: Design System v3.1 documentation
e2642fb ✨ feat(feed): amélioration UX complète
2791158 🌙 Night Sprint: Batch 2
240bfee ✨ login.html: Améliore micro-interactions et UX
646a2a9 🌙 Night Sprint: Batch 1
```

---

*Changelog généré avec ❤️ pour Cinq — L'anti-réseau social*
