# 🚀 Guide de Déploiement Cinq

> Guide complet pour déployer Cinq en production

---

## 📋 Table des matières

1. [Prérequis](#prérequis)
2. [Netlify Setup](#netlify-setup)
3. [Supabase Setup](#supabase-setup)
4. [BTCPay Server Setup](#btcpay-server-setup)
5. [Variables d'environnement](#variables-denvironnement)
6. [DNS & Domaine](#dns--domaine)
7. [Vérifications post-déploiement](#vérifications-post-déploiement)
8. [Troubleshooting](#troubleshooting)

---

## Prérequis

### Comptes nécessaires

| Service | Usage | Coût |
|---------|-------|------|
| [Netlify](https://netlify.com) | Hébergement + Functions | Gratuit (démarrage) |
| [Supabase](https://supabase.com) | Base de données + Auth | Gratuit (500MB) |
| [GitHub](https://github.com) | Repository | Gratuit |
| BTCPay Server | Paiements crypto | Self-hosted |

### Outils locaux

```bash
# Node.js 18+
node --version  # v18.x ou plus

# Netlify CLI
npm install -g netlify-cli
netlify --version

# Git
git --version
```

---

## Netlify Setup

### 1. Créer un nouveau site

#### Option A : Via CLI (recommandé)

```bash
# Se connecter à Netlify
netlify login

# Dans le dossier du projet
cd cinq

# Initialiser le site
netlify init

# Choisir :
# - Create & configure a new site
# - Team: ton équipe
# - Site name: cinq-network (ou autre)
```

#### Option B : Via Dashboard

1. Aller sur [app.netlify.com](https://app.netlify.com)
2. Cliquer "New site from Git"
3. Connecter GitHub
4. Sélectionner le repo `cinq`
5. Build settings :
   - Build command: *(laisser vide)*
   - Publish directory: `.`
   - Functions directory: `netlify/functions`

### 2. Configuration build

Le fichier `netlify.toml` est déjà configuré :

```toml
[build]
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
```

### 3. Configurer les variables d'environnement

```bash
# Via CLI
netlify env:set SUPABASE_URL "https://xxxxx.supabase.co"
netlify env:set SUPABASE_ANON_KEY "eyJhbGciOi..."
netlify env:set SUPABASE_SERVICE_ROLE_KEY "eyJhbGciOi..."
netlify env:set GIFT_CODE_SALT "your-random-32-char-secret"
netlify env:set ALLOWED_ORIGIN "https://cinq.app"

# BTCPay (quand prêt)
netlify env:set BTCPAY_URL "https://btcpay.cinq.app"
netlify env:set BTCPAY_API_KEY "your-api-key"
netlify env:set BTCPAY_STORE_ID "your-store-id"
netlify env:set BTCPAY_WEBHOOK_SECRET "your-webhook-secret"
```

Ou via Dashboard : Site settings > Environment variables

### 4. Déployer

```bash
# Preview (test)
netlify deploy

# Production
netlify deploy --prod
```

---

## Supabase Setup

### 1. Créer un projet

1. Aller sur [supabase.com](https://supabase.com)
2. "New Project"
3. Choisir :
   - Organization: (créer si besoin)
   - Name: `cinq`
   - Database Password: *générer un mot de passe fort*
   - Region: `eu-west-1` (Europe)
4. Attendre la création (~2 minutes)

### 2. Récupérer les clés API

Dans le Dashboard Supabase :

1. Aller dans **Settings** (engrenage)
2. Cliquer sur **API**
3. Copier :
   - **Project URL** → `SUPABASE_URL`
   - **anon public** → `SUPABASE_ANON_KEY`
   - **service_role** → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **Sécurité** :
- `anon` key = utilisable côté client
- `service_role` key = **JAMAIS** côté client, uniquement serveur

### 3. Exécuter le schema

1. Aller dans **SQL Editor**
2. Cliquer "New query"
3. Copier-coller tout le contenu de `supabase/FULL_SCHEMA.sql`
4. Cliquer "Run"

Le script crée :
- 10 tables
- 9 fonctions
- 5 triggers
- Toutes les policies RLS

### 4. Vérifier les tables

Dans **Table Editor**, tu devrais voir :

| Table | Description |
|-------|-------------|
| `waitlist` | Inscriptions landing page |
| `users` | Utilisateurs Cinq |
| `contacts` | Relations (max 5) |
| `messages` | Messages entre contacts |
| `gift_codes` | Codes cadeaux |
| `gift_code_attempts` | Anti-bruteforce |
| `gift_code_rate_limits` | Rate limiting |
| `btcpay_webhook_logs` | Audit webhooks |
| `email_queue` | Emails à envoyer |
| `login_attempts` | Sécurité login |

### 5. Activer Realtime (optionnel)

Pour les messages en temps réel :

```sql
-- Dans SQL Editor
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

### 6. Configurer l'Auth

Dans **Authentication** > **Settings** :

1. **Site URL** : `https://cinq.app`
2. **Redirect URLs** : 
   - `https://cinq.app/login.html`
   - `https://cinq.app/app.html`
3. Désactiver "Enable email confirmations" (les gift codes valident)

---

## BTCPay Server Setup

> 📝 Cette section est pour quand tu veux activer les paiements crypto.

### Option 1 : BTCPay Cloud (plus simple)

Utiliser un service hébergé comme [BTCPay Server Demo](https://mainnet.demo.btcpayserver.org/) pour tester, puis migrer vers self-hosted.

### Option 2 : Self-Hosted (recommandé pour prod)

#### Prérequis serveur

- VPS avec 2GB RAM minimum
- Docker + Docker Compose
- Domaine (ex: `btcpay.cinq.app`)

#### Installation

```bash
# Sur ton serveur
git clone https://github.com/btcpayserver/btcpayserver-docker.git
cd btcpayserver-docker

# Configuration
export BTCPAY_HOST="btcpay.cinq.app"
export NBITCOIN_NETWORK="mainnet"  # ou "testnet" pour tester
export BTCPAYGEN_CRYPTO1="btc"
export BTCPAYGEN_CRYPTO2="ltc"  # optionnel
export BTCPAYGEN_LIGHTNING="clightning"
export BTCPAYGEN_REVERSEPROXY="nginx"
export LETSENCRYPT_EMAIL="admin@cinq.app"

# Lancer
./btcpay-setup.sh -i
```

Le fichier `infra/docker-compose.yml` du repo contient une config de base.

### Configuration BTCPay

Une fois BTCPay installé :

1. **Créer un store**
   - Settings > Stores > Create Store
   - Nom : "Cinq"

2. **Configurer les paiements**
   - Store Settings > Rates
   - Default currency : EUR
   
3. **Générer l'API Key**
   - Account > Manage Account > API Keys
   - Permissions : 
     - `btcpay.store.canviewinvoices`
     - `btcpay.store.cancreateinvoice`
   - Copier la clé → `BTCPAY_API_KEY`

4. **Configurer le Webhook**
   - Store Settings > Webhooks
   - URL : `https://cinq.app/api/btcpay-webhook`
   - Events : `InvoiceSettled`, `InvoicePaymentSettled`
   - Secret : générer → `BTCPAY_WEBHOOK_SECRET`

5. **Récupérer le Store ID**
   - Dans l'URL du store : `/stores/<STORE_ID>/`
   - Copier → `BTCPAY_STORE_ID`

---

## Variables d'environnement

### Liste complète

```env
# === SUPABASE ===
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# === GIFT CODES ===
GIFT_CODE_SALT=random-string-minimum-32-characters-here

# === BTCPAY SERVER ===
BTCPAY_URL=https://btcpay.cinq.app
BTCPAY_API_KEY=your-api-key-from-btcpay
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=random-secret-for-webhook-validation

# === ADMIN ===
GIFT_ADMIN_SECRET=secret-for-manual-code-creation
GIFT_API_KEY=api-key-for-service-to-service

# === CORS ===
ALLOWED_ORIGIN=https://cinq.app
```

### Génération des secrets

```bash
# Générer un secret aléatoire (macOS/Linux)
openssl rand -hex 32

# Ou avec Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Configuration par environnement

| Variable | Dev | Staging | Production |
|----------|-----|---------|------------|
| `SUPABASE_URL` | Local/Dev project | Staging project | Prod project |
| `ALLOWED_ORIGIN` | `*` | `https://staging.cinq.app` | `https://cinq.app` |
| `BTCPAY_URL` | Testnet | Testnet | Mainnet |

---

## DNS & Domaine

### 1. Acheter le domaine

Recommandé : [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) ou [Gandi](https://www.gandi.net/)

### 2. Configurer Netlify

Dans Netlify Dashboard :

1. Site settings > Domain management
2. "Add custom domain"
3. Entrer `cinq.app`

### 3. Configurer les DNS

Chez ton registrar, ajouter :

```
# Option A : Netlify DNS (recommandé)
Type: ALIAS ou ANAME
Name: @
Value: [ton-site].netlify.app

Type: CNAME
Name: www
Value: [ton-site].netlify.app

# Option B : Cloudflare (avec proxy)
Type: CNAME
Name: @
Value: [ton-site].netlify.app
Proxy: ON (orange cloud)
```

### 4. SSL/HTTPS

Netlify gère automatiquement Let's Encrypt. Vérifier dans :
- Site settings > Domain management > HTTPS

### 5. Sous-domaine BTCPay

Si tu self-host BTCPay :

```
Type: A
Name: btcpay
Value: [IP-de-ton-serveur]
```

---

## Vérifications post-déploiement

### Checklist ✅

```bash
# 1. Site accessible
curl -I https://cinq.app
# → 200 OK

# 2. API fonctionne
curl https://cinq.app/api/waitlist
# → {"count": ...}

# 3. CORS OK
curl -I -X OPTIONS https://cinq.app/api/waitlist \
  -H "Origin: https://cinq.app"
# → Access-Control-Allow-Origin: *

# 4. Headers sécurité
curl -I https://cinq.app
# → X-Frame-Options: DENY
# → X-Content-Type-Options: nosniff

# 5. HTTPS forcé
curl -I http://cinq.app
# → 301 Redirect to https://
```

### Tests manuels

1. **Landing page** : `https://cinq.app`
   - Design correct
   - Counter waitlist visible
   
2. **Inscription waitlist** :
   - Entrer un email
   - Vérifier succès
   - Vérifier dans Supabase > Table Editor > waitlist

3. **Gift flow** : `https://cinq.app/gift.html`
   - Parcourir les écrans
   - (Tester avec SIMULATION_MODE si pas de BTCPay)

4. **Redeem** : `https://cinq.app/redeem.html`
   - Créer un code test via API
   - L'activer

5. **App** : `https://cinq.app/app.html`
   - Se connecter
   - Voir les 5 slots

### Monitoring

Configurer des alertes :

1. **Uptime** : [UptimeRobot](https://uptimerobot.com/) (gratuit)
   - Monitor : `https://cinq.app`
   - Check interval : 5 minutes
   - Alert : email/SMS

2. **Netlify** : Site settings > Notifications
   - Deploy succeeded/failed

3. **Supabase** : Settings > Reports
   - Usage alerts

---

## Troubleshooting

### Fonction API ne répond pas

```bash
# Vérifier les logs
netlify logs:function waitlist

# Vérifier le déploiement des functions
netlify functions:list
```

**Causes fréquentes :**
- Variables d'environnement manquantes
- Import de module manquant (`package.json`)
- Timeout (augmenter dans `netlify.toml`)

### Erreur Supabase "PGRST"

```
{"code":"PGRST301","message":"..."}
```

**Solution :** Vérifier que :
- Le schema SQL a été exécuté
- Les policies RLS sont créées
- La clé utilisée est correcte (anon vs service_role)

### CORS bloqué

```
Access to fetch at '...' has been blocked by CORS policy
```

**Solutions :**
1. Vérifier `ALLOWED_ORIGIN` dans les env vars
2. Vérifier les headers dans le code des functions
3. En dev, utiliser `*` temporairement

### Webhook BTCPay échoue

```bash
# Tester manuellement
curl -X POST https://cinq.app/api/btcpay-webhook \
  -H "Content-Type: application/json" \
  -H "BTCPay-Sig: sha256=INVALID" \
  -d '{"type":"test"}'
# → 401 Invalid signature (normal)
```

**Vérifier :**
- `BTCPAY_WEBHOOK_SECRET` identique des deux côtés
- Format du header : `sha256=xxx` (pas juste `xxx`)
- Payload JSON valide

### Base de données pleine

Supabase gratuit = 500MB

```sql
-- Vérifier l'usage
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

**Solutions :**
- Purger les vieilles données (`gift_code_attempts`, `login_attempts`)
- Upgrader le plan Supabase
- Archiver les logs webhook

---

## Scripts utiles

### Création manuelle de code cadeau

```bash
# Avec GIFT_ADMIN_SECRET configuré
curl -X POST https://cinq.app/api/gift-create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -d '{
    "amount_cents": 1500,
    "currency": "EUR",
    "purchaser_email": "admin@cinq.app"
  }'
```

### Vérifier un code

```bash
curl -X POST https://cinq.app/api/gift-verify \
  -H "Content-Type: application/json" \
  -d '{"code": "CINQ-XXXX-XXXX-XXXX"}'
```

### Reset rate limit (en cas de blocage légitime)

```sql
-- Dans Supabase SQL Editor
DELETE FROM gift_code_rate_limits 
WHERE ip_address = 'X.X.X.X';
```

---

## Contacts

- **Support technique** : tech@cinq.app
- **GitHub Issues** : [github.com/Whitemarmot/cinq/issues](https://github.com/Whitemarmot/cinq/issues)

---

*Guide de déploiement Cinq — v1.0*
