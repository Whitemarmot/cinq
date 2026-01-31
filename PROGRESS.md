# Cinq — Journal de Bord

## 🎯 Statut actuel : MVP Core complet, documentation à jour

---

## 📅 2026-01-31

### 10:30 — Documentation complète ✅

**Tech Writer Sprint :**

Documentation entièrement mise à jour :

| Fichier | Description | Status |
|---------|-------------|--------|
| `README.md` | Refondu complètement | ✅ |
| `docs/API.md` | Doc API exhaustive (tous endpoints) | ✅ |
| `docs/DEPLOYMENT.md` | Guide déploiement complet | ✅ |
| `PROGRESS.md` | Mis à jour | ✅ |

**Contenu README.md :**
- Description projet claire
- Stack technique
- Installation locale
- Déploiement Netlify
- Structure des fichiers
- Variables d'environnement
- Liens vers toute la doc

**Contenu API.md :**
- Tous les 11 endpoints documentés
- Request/Response format complet
- Codes d'erreur
- Exemples curl
- Rate limiting expliqué
- Flow complet d'inscription

**Contenu DEPLOYMENT.md :**
- Netlify setup pas à pas
- Supabase setup complet
- BTCPay Server (quand prêt)
- Variables d'environnement
- DNS & Domaine
- Vérifications post-déploiement
- Troubleshooting

---

### 09:50 — Sprint 5 terminé ✅

**Core App livrée :**
- `app.html` — Dashboard 5 contacts + messaging + Ping 💫
- Auth system complet (register/login/profile)
- Design system anti-addiction (861 lignes de specs)
- Schemas DB (users, contacts, messages)

**Gift System fixé :**
- Webhook BTCPay validé et testé
- Mismatch frontend/backend corrigé
- redeem.html utilise auth-register
- Timing-safe token comparison

**Commits pushés :** 7e49426

---

### 09:14 — Équipe mobilisée

| Agent | Mission | Status |
|-------|---------|--------|
| Sarah | Webhook BTCPay | ✅ Done |
| Alex | Audit redeem + Design system | ✅ Done |
| Marco | Plan lancement | ✅ Done |
| Zoé | Audit sécurité | ✅ Done |
| Dev Principal | app.html | ✅ Done |
| Dev Fix | Bugs critiques | ✅ Done |
| QA | Validation | ✅ Done |
| Tech Writer | Documentation | ✅ Done |

**Total : 8 agents déployés ce sprint**

---

## 📋 TODO Déploiement

### Critique
- [ ] Configurer variables Netlify (SUPABASE_*, BTCPAY_*, GIFT_CODE_SALT)
- [ ] Exécuter migrations Supabase (FULL_SCHEMA.sql)
- [ ] Créer tables dans Supabase via SQL Editor
- [ ] Configurer BTCPay webhook (quand BTCPay ready)

### Haute priorité
- [ ] Test E2E flow complet (gift → paiement → redeem → login → app)
- [ ] DNS cinq.app ou domaine temp
- [ ] Activer Realtime pour messages

### Moyenne
- [ ] Thread Twitter EN
- [ ] Assets visuels (OG image finale)
- [ ] Waitlist email automation
- [ ] Setup monitoring (UptimeRobot)

---

## 📊 Métriques Projet

### Code

| Type | Fichiers | Lignes ~approx |
|------|----------|----------------|
| HTML | 8 | ~2500 |
| JS (Functions) | 12 | ~1500 |
| SQL | 4 | ~800 |
| Markdown (Docs) | 10 | ~2000 |

### API Endpoints

| Endpoint | Méthode | Auth | Status |
|----------|---------|------|--------|
| `/api/waitlist` | GET, POST | ❌ | ✅ |
| `/api/gift-create` | POST | Service | ✅ |
| `/api/gift-verify` | GET, POST | ❌ | ✅ |
| `/api/gift-redeem` | POST | ❌ | ✅ |
| `/api/auth-register` | POST | ❌ | ✅ |
| `/api/auth-login` | POST | ❌ | ✅ |
| `/api/user-profile` | GET, POST | ✅ | ✅ |
| `/api/contacts` | GET, POST, DELETE | ✅ | ✅ |
| `/api/messages` | GET, POST | ✅ | ✅ |
| `/api/btcpay-webhook` | POST | HMAC | ✅ |

### Database Tables

| Table | Records (dev) | RLS |
|-------|---------------|-----|
| waitlist | 0 | ✅ |
| users | 0 | ✅ |
| contacts | 0 | ✅ |
| messages | 0 | ✅ |
| gift_codes | 0 | ✅ |
| gift_code_attempts | 0 | ✅ |
| gift_code_rate_limits | 0 | ✅ |
| btcpay_webhook_logs | 0 | ✅ |
| email_queue | 0 | ✅ |
| login_attempts | 0 | ✅ |

---

## 🔐 Infos Projet

**GitHub:** github.com/Whitemarmot/cinq  
**Supabase:** guioxfulihyehrwytxce.supabase.co  
**Netlify:** cinq-network.netlify.app *(à configurer)*  
**Mode:** SIMULATION_MODE = true (pour tests)

---

## 📦 Livrables

### Pages HTML

| Fichier | Description | Status |
|---------|-------------|--------|
| `index.html` | Landing page avec counter | ✅ |
| `gift.html` | Flow achat cadeau (4 écrans) | ✅ |
| `redeem.html` | Activation code + création compte | ✅ |
| `login.html` | Page de connexion | ✅ |
| `app.html` | Dashboard 5 contacts + messaging | ✅ |
| `404.html` | Page d'erreur personnalisée | ✅ |
| `error.html` | Page d'erreur générique | ✅ |
| `og-preview.html` | Preview Open Graph | ✅ |

### API Functions

| Fichier | Description | Status |
|---------|-------------|--------|
| `waitlist.js` | Inscriptions landing | ✅ |
| `gift-create.js` | Création codes cadeaux | ✅ |
| `gift-verify.js` | Vérification codes | ✅ |
| `gift-redeem.js` | Activation codes | ✅ |
| `gift-utils.js` | Utilitaires partagés | ✅ |
| `auth-register.js` | Inscription avec code | ✅ |
| `auth-login.js` | Connexion | ✅ |
| `user-profile.js` | Profil & contacts | ✅ |
| `contacts.js` | API RESTful contacts | ✅ |
| `messages.js` | API messages | ✅ |
| `btcpay-webhook.js` | Webhook paiements | ✅ |
| `test-btcpay-webhook.js` | Tests webhook | ✅ |

### Documentation

| Fichier | Description | Status |
|---------|-------------|--------|
| `README.md` | Documentation principale | ✅ |
| `SPEC.md` | Spécifications produit | ✅ |
| `PROGRESS.md` | Journal de bord | ✅ |
| `docs/API.md` | Documentation API complète | ✅ |
| `docs/DEPLOYMENT.md` | Guide de déploiement | ✅ |
| `docs/AUTH-SYSTEM.md` | Système d'authentification | ✅ |
| `docs/security-audit.md` | Audit de sécurité | ✅ |
| `docs/launch-checklist.md` | Checklist pré-lancement | ✅ |

### Base de données

| Fichier | Description | Status |
|---------|-------------|--------|
| `supabase/FULL_SCHEMA.sql` | Schema complet (10 tables) | ✅ |
| `supabase/schema.sql` | Schema initial (waitlist) | ✅ |
| `supabase/users.sql` | Schema users + contacts | ✅ |
| `supabase/messages.sql` | Schema messages | ✅ |
| `supabase/gift-codes.sql` | Schema gift codes | ✅ |

### Design & Marketing

| Fichier | Description | Status |
|---------|-------------|--------|
| `design/app-design.md` | Specs UX anti-addiction | ✅ |
| `design/gift-flow.md` | Flow d'achat cadeau | ✅ |
| `marketing/launch-content.md` | Contenu de lancement | ✅ |

---

## 🚀 Roadmap

### Phase 1 — Landing + Waitlist ✅
- [x] Landing page
- [x] Supabase waitlist
- [x] Hosting setup

### Phase 2 — Gift System ✅
- [x] Page "Offrir un accès"
- [x] Génération de codes cadeaux
- [x] Flow d'activation
- [x] Webhook BTCPay
- [ ] BTCPay Server déployé (waiting)

### Phase 3 — App Core ✅
- [x] Auth (code cadeau uniquement)
- [x] Profil + 5 contacts max
- [x] Messagerie basique
- [x] Ping / Présence

### Phase 4 — Polish 🔲
- [ ] Apps mobiles (React Native ou Flutter)
- [ ] Vault chiffré (premium)
- [ ] Fédération multi-pods
- [ ] Chiffrement E2E (Signal Protocol)

---

## 📝 Notes techniques

### Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│   Browser   │────▶│ Netlify (Static │────▶│  Supabase    │
│             │     │   + Functions)  │     │  (PostgreSQL │
│  HTML/JS    │     │                 │     │   + Auth)    │
└─────────────┘     └────────┬────────┘     └──────────────┘
                             │
                             │ (Webhook)
                             ▼
                    ┌─────────────────┐
                    │  BTCPay Server  │
                    │  (Self-hosted)  │
                    └─────────────────┘
```

### Sécurité

- ✅ Rate limiting sur toutes les routes sensibles
- ✅ Row Level Security (RLS) sur toutes les tables
- ✅ HMAC signature pour webhooks
- ✅ Timing-safe comparisons
- ✅ Anti-bruteforce (5 tentatives / 15 min)
- ✅ No secrets in frontend bundle
- ✅ HTTPS enforced

### Contrainte CINQ

La limite de 5 contacts est appliquée à 3 niveaux :
1. **Trigger PostgreSQL** — Bloque INSERT si >= 5
2. **API Validation** — Check avant INSERT
3. **Frontend** — UI affiche les 5 slots

---

*Dernière mise à jour: 2026-01-31 10:30 UTC*
