# Cinq — L'anti-réseau social

> **5 proches. Pas de likes. Pas d'algorithme. Juste les gens qui comptent vraiment.**

[![Tests](https://github.com/Whitemarmot/cinq/actions/workflows/test.yml/badge.svg)](https://github.com/Whitemarmot/cinq/actions/workflows/test.yml)
[![Deploy](https://github.com/Whitemarmot/cinq/actions/workflows/deploy.yml/badge.svg)](https://github.com/Whitemarmot/cinq/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](CHANGELOG.md)

---

## 🆕 What's New in v2.0 (Night Sprint Edition)

### ✨ UX & Interface
- **Chat WhatsApp-style** — Bulles, timestamps, read receipts, typing indicator
- **Infinite scroll** — Pagination cursor-based fluide
- **Micro-animations** — Transitions premium sur tous les composants
- **Onboarding complet** — Parcours guidé pour nouveaux utilisateurs
- **Landing redesign** — Meilleur taux de conversion

### 📱 PWA & Mobile
- **Push notifications** — Notifications temps réel
- **Mobile-first** — Touch targets 44px, viewport-fit, keyboard handling
- **Offline support** — Service worker amélioré

### 🎨 Design System v3.1
- **WOW Effects** — Pentagon signature, particles, text reveal, gradient mesh
- **Dark/Light mode** — Toggle fluide avec persistence
- **WCAG AA** — Accessibilité complète

### ⚡ Performance
- **N+1 queries éliminées** — Backend optimisé
- **Assets minifiés** — CSS/JS compressés
- **Cursor pagination** — Plus de offset/limit

### 📚 Documentation
- Architecture review, Security audit, Design system docs
- Voir [CHANGELOG.md](CHANGELOG.md) pour la liste complète

---

## 🎯 Vision

Cinq est un réseau social qui combat l'addiction, la superficialité et la course aux likes. Tu es limité à **5 contacts** — les gens qui comptent vraiment.

**Tagline :** *"L'app qui veut que tu la fermes."*

### Principes fondateurs

1. **Anti-viralité** — Pas de "invite tes amis", pas de share-to-unlock
2. **Anti-addiction** — Pas de notifications anxiogènes, pas de métriques visibles
3. **Anti-surveillance** — Architecture zero-knowledge, données minimales
4. **Pro-intention** — Chaque interaction doit être consciente et voulue

---

## 💰 Business Model

### Gift Model — 15€ (~16 USDC)

**Tu ne t'inscris pas. On t'offre Cinq.**

- Impossible de créer un compte seul
- Quelqu'un doit payer 15€ pour t'offrir l'accès
- Filtre naturel : chaque user existe parce qu'il compte pour quelqu'un

### Paiement Crypto

| Crypto | Réseau | Pourquoi |
|--------|--------|----------|
| USDC | Base | Stablecoin, pas de volatilité |
| BTC | Lightning | Instantané, frais nuls |
| ETH | Base | Le plus connu |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         UTILISATEUR                               │
│                    (Navigateur / Mobile)                          │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      NETLIFY EDGE                                 │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Pages Statiques                           │ │
│  │  index.html │ app.html │ gift.html │ login.html │ redeem.html │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   Netlify Functions                          │ │
│  │  /api/auth-*     │  /api/contacts  │  /api/messages         │ │
│  │  /api/gift-*     │  /api/user-*    │  /api/waitlist         │ │
│  └─────────────────────────────────────────────────────────────┘ │
└───────────────────────────┬──────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│      SUPABASE         │       │     BTCPAY SERVER     │
│  ┌─────────────────┐  │       │                       │
│  │   PostgreSQL    │  │       │  Bitcoin / Lightning  │
│  │   + Auth        │  │       │  USDC (Base)          │
│  │   + RLS         │  │       │  ETH (Base)           │
│  └─────────────────┘  │       │                       │
└───────────────────────┘       └───────────────────────┘

Tables Supabase:
├── users          (id, email, gift_code_used)
├── contacts       (user_id → contact_user_id, max 5)
├── messages       (sender_id, receiver_id, content)
├── gift_codes     (code_hash, status, amount_cents)
├── gift_code_attempts (rate limiting)
└── waitlist       (email, utm_*)
```

---

## 🛠️ Stack Technique

| Composant | Technologie |
|-----------|-------------|
| **Frontend** | HTML/CSS/JS vanilla (pages statiques) |
| **Backend** | Netlify Functions (serverless) |
| **Base de données** | Supabase (PostgreSQL + Auth) |
| **Paiements** | BTCPay Server (self-hosted) |
| **Hébergement** | Netlify |

---

## 📁 Structure du Projet

```
cinq/
├── 📄 Pages HTML
│   ├── index.html              # Landing page (redesign v2.0)
│   ├── app.html                # Dashboard utilisateur (5 contacts)
│   ├── feed.html               # Feed des posts (infinite scroll)
│   ├── gift.html               # Flow achat cadeau
│   ├── redeem.html             # Activation code + création compte
│   ├── login.html              # Page de connexion
│   ├── register.html           # Inscription (onboarding amélioré)
│   ├── settings.html           # Paramètres utilisateur
│   ├── 404.html, error.html    # Pages d'erreur
│   ├── offline.html            # Page offline PWA
│   ├── FAQ.html                # Questions fréquentes
│   └── privacy.html, terms.html # Pages légales
│
├── 🎨 Assets & Styles
│   ├── css/                    # CSS minifiés
│   ├── js/                     # JavaScript minifiés
│   ├── design/                 # Design system source
│   ├── assets/                 # Images, icônes, splash screens
│   ├── animations.css/.js      # Micro-animations
│   └── styles.css/.min.css     # Styles principaux
│
├── ⚙️ API Backend
│   ├── api/                    # Vercel/Netlify Functions
│   │   ├── auth.js             # Authentification
│   │   ├── posts.js            # Feed & Posts (cursor pagination)
│   │   ├── contacts.js         # Gestion contacts (optimisé)
│   │   ├── messages.js         # Messagerie
│   │   ├── gift.js             # Codes cadeaux
│   │   └── _*.js               # Helpers (validation, rate-limit, etc.)
│   └── netlify/functions/      # Backup Netlify functions
│
├── 🗄️ Database
│   ├── supabase/               # Migrations Supabase
│   └── supabase-schema.sql     # Schema complet
│
├── 📚 Documentation
│   ├── CHANGELOG.md            # 🆕 Historique des versions
│   ├── ARCHITECTURE-REVIEW.md  # 🆕 Analyse architecture
│   ├── DESIGN-SYSTEM.md        # 🆕 Design system v3.1
│   ├── API-IMPROVEMENTS.md     # 🆕 Optimisations backend
│   ├── SECURITY-AUDIT.md       # 🆕 Audit sécurité
│   ├── QA-REPORT.md            # 🆕 Rapport qualité
│   ├── ERROR-HANDLING.md       # 🆕 Gestion erreurs
│   └── docs/                   # Documentation détaillée
│
├── 🔧 Config
│   ├── vercel.json             # Configuration Vercel
│   ├── netlify.toml            # Configuration Netlify
│   ├── manifest.json           # PWA manifest
│   ├── service-worker.js       # Service worker (cache)
│   └── package.json            # Dépendances Node.js
│
└── 🧪 Tests
    └── tests/                  # Tests E2E (35 tests)
```

---

## 🚀 Installation Locale

### Prérequis

- Node.js 18+
- npm ou yarn
- Un compte [Supabase](https://supabase.com) (gratuit)
- Netlify CLI

### 1. Cloner le repo

```bash
git clone https://github.com/Whitemarmot/cinq.git
cd cinq
```

### 2. Installer les dépendances

```bash
npm install
```

### 3. Configurer les variables d'environnement

```bash
cp .env.example .env
```

Remplir les valeurs dans `.env` :

```env
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Gift Codes
GIFT_CODE_SALT=random-string-32-chars-minimum

# BTCPay (optionnel pour dev)
BTCPAY_URL=https://btcpay.cinq.app
BTCPAY_API_KEY=your-api-key
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=your-webhook-secret
```

### 4. Initialiser la base de données

1. Aller dans [Supabase Dashboard](https://supabase.com/dashboard)
2. Créer un nouveau projet
3. Aller dans **SQL Editor**
4. Copier-coller le contenu de `supabase-schema.sql`
5. Exécuter

> **⚠️ Migrations additionnelles** : Si tu mets à jour une base existante, exécute aussi les fichiers dans `supabase/migrations/` (ex: `003_posts_table.sql` pour la fonctionnalité Feed).

### 5. Lancer en développement

```bash
# Installer Netlify CLI (si pas déjà fait)
npm install -g netlify-cli

# Lancer le serveur de dev
netlify dev
```

L'app sera disponible sur `http://localhost:8888`

---

## 🌐 Déploiement

Voir le guide complet : **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

### Déploiement rapide sur Netlify

```bash
# Connecter le repo à Netlify
netlify init

# Configurer les variables d'environnement
netlify env:set SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set SUPABASE_ANON_KEY "eyJ..."
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJ..."
netlify env:set GIFT_CODE_SALT "your-secret-salt"

# Déployer
netlify deploy --prod
```

---

## 📖 Documentation

### Architecture & Code
| Document | Description |
|----------|-------------|
| [ARCHITECTURE-REVIEW.md](ARCHITECTURE-REVIEW.md) | 🆕 Analyse architecture complète |
| [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md) | 🆕 Design System v3.1 |
| [API-IMPROVEMENTS.md](API-IMPROVEMENTS.md) | 🆕 Optimisations backend |
| [ERROR-HANDLING.md](ERROR-HANDLING.md) | 🆕 Gestion des erreurs |
| [CHANGELOG.md](CHANGELOG.md) | 🆕 Historique des changements |

### Sécurité & Qualité
| Document | Description |
|----------|-------------|
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) | 🆕 Audit sécurité XSS/CSRF |
| [QA-REPORT.md](QA-REPORT.md) | 🆕 Rapport qualité code |
| [docs/ACCESSIBILITY.md](docs/ACCESSIBILITY.md) | 🆕 Documentation accessibilité |

### Guides
| Document | Description |
|----------|-------------|
| [FLOW.md](FLOW.md) | Parcours utilisateurs détaillés |
| [docs/ENV.md](docs/ENV.md) | Guide des variables d'environnement |
| [docs/API.md](docs/API.md) | Documentation complète de l'API |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Guide de déploiement Netlify + Supabase |
| [docs/AUTH-SYSTEM.md](docs/AUTH-SYSTEM.md) | Système d'authentification |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Checklist pré-lancement |

### Specs & Références
| Document | Description |
|----------|-------------|
| [FAQ.html](FAQ.html) | Questions fréquentes (utilisateurs) |
| [SPEC.md](SPEC.md) | Spécifications produit |
| [PROGRESS.md](PROGRESS.md) | Journal de développement |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guide de contribution |

---

## 🔐 Sécurité

- **Rate limiting** sur toutes les routes API
- **Row Level Security (RLS)** sur toutes les tables Supabase
- **HMAC signature verification** pour les webhooks BTCPay
- **Timing-safe comparison** pour les tokens et codes
- **Anti-bruteforce** sur les codes cadeaux et login

Voir [docs/security-audit.md](docs/security-audit.md) pour plus de détails.

---

## 🧪 Tests

### Tests E2E Automatisés (Playwright)

Cinq est livré avec une suite complète de **tests E2E** qui couvrent tous les flows critiques :

| Flow Testé | Fichier | Description |
|-----------|---------|-------------|
| **Login/Logout** | `tests/e2e/login.spec.js` | Authentification, validation, redirection |
| **Inscription avec code cadeau** | `tests/e2e/register.spec.js` | Validation du code, création de compte |
| **Ajout d'un contact** | `tests/e2e/contacts.spec.js` | Limite de 5, validation, modal |
| **Envoi d'un message** | `tests/e2e/messages.spec.js` | Chat, temps réel, notification |
| **Création d'un post** | `tests/e2e/posts.spec.js` | Composer, publication, feed |

#### Commandes disponibles

```bash
# Lancer tous les tests E2E
npm run test:e2e

# Avec interface utilisateur (debug)
npm run test:e2e:ui

# Mode visible (non-headless)
npm run test:e2e:headed

# Tests spécifiques par navigateur
npm run test:e2e:chromium
npm run test:e2e:firefox
npm run test:e2e:webkit

# Tests mobile
npm run test:e2e:mobile

# Rapport visuel des tests
npm run test:e2e:report
```

#### Configuration CI/CD

Les tests tournent automatiquement en CI/CD sur :
- **GitHub Actions** — À chaque PR et merge sur `main`
- **Multi-navigateurs** — Chrome, Firefox, Safari, Mobile
- **Retries** — 2 tentatives en cas d'échec réseau
- **Screenshots** — Captures en cas d'erreur
- **Videos** — Enregistrement des échecs

#### Structure des tests

```bash
tests/
├── e2e/                    # Tests bout-en-bout
│   ├── fixtures.js         # Utilitaires et données de test
│   ├── login.spec.js       # Tests de connexion
│   ├── register.spec.js    # Tests d'inscription
│   ├── contacts.spec.js    # Tests d'ajout de contacts
│   ├── messages.spec.js    # Tests de messagerie
│   └── posts.spec.js       # Tests de publication
├── unit/                   # Tests unitaires (Vitest)
│   ├── auth.test.js
│   ├── contacts.test.js
│   ├── messages.test.js
│   └── posts.test.js
└── e2e-flow.js            # Test de flow complet
```

### Tests Unitaires (Vitest)

```bash
# Lancer les tests unitaires
npm run test

# En mode watch
npm run test:watch

# Avec coverage
npm run test:coverage

# Tests spécifiques
npm run test:unit
```

### Tests Manuels

```bash
# Test des webhooks BTCPay (mode simulation)
node netlify/functions/test-btcpay-webhook.js

# Tests API manuels
curl -X GET http://localhost:8888/api/waitlist
curl -X POST http://localhost:8888/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### Tests d'accessibilité

```bash
# Audit automatisé avec axe-core
npm run test:a11y

# Test manuel avec lecteur d'écran
# VoiceOver (Mac), NVDA (Windows), Orca (Linux)
```

---

## 🚀 Comment Ajouter une Feature (5 étapes)

### 1️⃣ Créer la branche

```bash
git checkout main && git pull
git checkout -b feat/nom-de-ma-feature
```

### 2️⃣ Coder le backend (si nécessaire)

Créer `/netlify/functions/ma-feature.js` :

```javascript
const { success, error, headers } = require('./gift-utils');

exports.handler = async (event, context) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }
    
    // Ta logique ici
    return success({ data: 'ok' });
};
```

Ajouter le redirect dans `netlify.toml` :
```toml
[[redirects]]
  from = "/api/ma-feature/*"
  to = "/.netlify/functions/ma-feature/:splat"
  status = 200
```

### 3️⃣ Coder le frontend

- HTML : Ajouter dans la page concernée
- CSS : Dans `animations.css` ou inline si <50 lignes
- JS : Inline ou dans `fun.js` si réutilisable

### 4️⃣ Tester

```bash
npm run dev          # Lancer le serveur local
npm run lint         # Vérifier le code
npm run test         # Tests automatisés
```

### 5️⃣ Commit et PR

```bash
git add .
git commit -m "feat: description courte"
git push -u origin feat/nom-de-ma-feature
# Créer PR sur GitHub
```

---

## 📐 Conventions de Nommage

| Type | Convention | Exemple |
|------|------------|---------|
| **Fichiers** | `kebab-case` | `auth-login.js`, `gift-flow.html` |
| **Variables** | `camelCase` | `userName`, `isValid` |
| **Constantes** | `UPPER_SNAKE_CASE` | `MAX_CONTACTS`, `API_URL` |
| **Fonctions** | `camelCase` | `fetchUser()`, `handleClick()` |
| **Classes CSS** | `kebab-case` (BEM-inspired) | `.contact-slot--empty` |

Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les règles complètes.

---

## 🗺️ Roadmap

### ✅ Phase 1 — Landing + Waitlist
- [x] Landing page
- [x] Supabase waitlist
- [x] Netlify hosting

### ✅ Phase 2 — Gift System
- [x] BTCPay Server setup
- [x] Page "Offrir un accès"
- [x] Génération de codes cadeaux
- [x] Flow d'activation

### ✅ Phase 3 — App Core
- [x] Auth (code cadeau uniquement)
- [x] Profil + 5 contacts max
- [x] Messagerie basique
- [x] Ping / Présence
- [x] **Feed & Posts** — Partage des posts avec tes 5 contacts

### ✅ Phase 4 — Polish (v2.0) 🆕
- [x] **Chat UX** — WhatsApp-style avec read receipts
- [x] **Infinite scroll** — Cursor-based pagination
- [x] **Push notifications** — Temps réel
- [x] **PWA améliorée** — Offline support, install prompt
- [x] **Design System v3.1** — Dark/light mode, animations premium
- [x] **Accessibilité WCAG AA** — Audit complet
- [x] **Performance backend** — N+1 queries éliminées

### 🔲 Phase 5 — Expansion
- [ ] Apps mobiles (React Native ou Flutter)
- [ ] Vault chiffré (premium)
- [ ] Fédération multi-pods
- [ ] Chiffrement E2E (Signal Protocol)
- [ ] WebSockets temps réel (remplacer polling)

---

## 👥 Équipe

| Agent | Rôle | Focus |
|-------|------|-------|
| **Kempfr** | Lead / Coordination | Vision + Exécution |
| **Alex** | UX/Product Design | Expérience + Contraintes zen |
| **Sarah** | Backend/Sécurité | Crypto + Zero-knowledge |
| **Marco** | Growth/Marketing | Anti-viralité + Guérilla |
| **Zoé** | Critique | Devil's advocate |

---

## 📄 Licence

MIT License — voir [LICENSE](LICENSE)

---

## 🔗 Liens

- **Site** : [cinq.app](https://cinq.app) *(à venir)*
- **GitHub** : [github.com/Whitemarmot/cinq](https://github.com/Whitemarmot/cinq)
- **Supabase** : guioxfulihyehrwytxce.supabase.co

---

*Made with ⚡ by l'équipe Cinq*
