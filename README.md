# Cinq — L'anti-réseau social

> **5 proches. Pas de likes. Pas d'algorithme. Juste les gens qui comptent vraiment.**

[![Netlify Status](https://api.netlify.com/api/v1/badges/YOUR-BADGE/deploy-status)](https://app.netlify.com/sites/cinq-network/deploys)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
├── index.html              # Landing page
├── gift.html               # Flow achat cadeau (4 écrans)
├── redeem.html             # Activation code + création compte
├── login.html              # Page de connexion
├── app.html                # Dashboard utilisateur (5 contacts)
├── 404.html                # Page d'erreur personnalisée
├── error.html              # Page d'erreur générique
│
├── netlify/
│   └── functions/          # API serverless
│       ├── waitlist.js     # Inscriptions waitlist
│       ├── gift-create.js  # Création codes cadeaux
│       ├── gift-verify.js  # Vérification codes
│       ├── gift-redeem.js  # Activation codes
│       ├── auth-register.js # Inscription avec code
│       ├── auth-login.js   # Connexion
│       ├── user-profile.js # Profil & contacts
│       ├── contacts.js     # API contacts (CRUD)
│       ├── messages.js     # API messages
│       └── btcpay-webhook.js # Webhook paiements
│
├── supabase/
│   ├── FULL_SCHEMA.sql     # Schema complet (à exécuter)
│   └── migrations/         # Migrations individuelles
│
├── infra/
│   └── docker-compose.yml  # BTCPay Server config
│
├── design/
│   └── app-design.md       # Specs UX anti-addiction
│
├── docs/
│   ├── API.md              # Documentation API
│   ├── DEPLOYMENT.md       # Guide de déploiement
│   ├── AUTH-SYSTEM.md      # Système d'authentification
│   └── security-audit.md   # Audit de sécurité
│
├── netlify.toml            # Configuration Netlify
├── package.json            # Dépendances Node.js
├── .env.example            # Template variables d'environnement
├── SPEC.md                 # Spécifications produit
└── PROGRESS.md             # Journal de bord
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
4. Copier-coller le contenu de `supabase/FULL_SCHEMA.sql`
5. Exécuter

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

| Document | Description |
|----------|-------------|
| [docs/API.md](docs/API.md) | Documentation complète de l'API |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Guide de déploiement Netlify + Supabase |
| [docs/AUTH-SYSTEM.md](docs/AUTH-SYSTEM.md) | Système d'authentification |
| [docs/security-audit.md](docs/security-audit.md) | Audit de sécurité |
| [docs/launch-checklist.md](docs/launch-checklist.md) | Checklist pré-lancement |
| [SPEC.md](SPEC.md) | Spécifications produit |
| [PROGRESS.md](PROGRESS.md) | Journal de développement |

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

```bash
# Test des webhooks BTCPay (mode simulation)
node netlify/functions/test-btcpay-webhook.js

# Tests API manuels
curl -X GET http://localhost:8888/api/waitlist
curl -X POST http://localhost:8888/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

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

### 🔲 Phase 4 — Polish
- [ ] Apps mobiles (React Native ou Flutter)
- [ ] Vault chiffré (premium)
- [ ] Fédération multi-pods
- [ ] Chiffrement E2E (Signal Protocol)

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
