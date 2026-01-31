# Variables d'Environnement — Cinq

> Guide complet des variables d'environnement requises pour le déploiement de Cinq.

---

## 📋 Vue d'ensemble

| Variable | Requis | Description |
|----------|--------|-------------|
| `SUPABASE_URL` | ✅ | URL de votre instance Supabase |
| `SUPABASE_ANON_KEY` | ✅ | Clé publique anonyme Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Clé service admin Supabase |
| `GIFT_CODE_SALT` | ✅ | Sel pour le hachage des codes cadeaux |
| `BTCPAY_URL` | ⚠️ | URL du serveur BTCPay (prod) |
| `BTCPAY_API_KEY` | ⚠️ | Clé API BTCPay |
| `BTCPAY_STORE_ID` | ⚠️ | ID du store BTCPay |
| `BTCPAY_WEBHOOK_SECRET` | ⚠️ | Secret pour valider les webhooks |
| `ADMIN_SECRET` | 🔐 | Clé admin pour opérations manuelles |
| `ADMIN_EMAILS` | 🔐 | Liste des emails admin |
| `VAPID_PUBLIC_KEY` | 📱 | Clé publique VAPID (push notifications) |
| `VAPID_PRIVATE_KEY` | 📱 | Clé privée VAPID |
| `VAPID_EMAIL` | 📱 | Email de contact pour VAPID |
| `ALLOWED_ORIGIN` | 🌐 | Origine autorisée pour CORS |
| `INTERNAL_API_KEY` | 🔗 | Clé pour appels inter-fonctions |

**Légende :** ✅ Obligatoire | ⚠️ Requis en production | 🔐 Admin | 📱 Push notifications | 🌐 Optionnel

---

## 🔧 Configuration détaillée

### Supabase (Base de données)

```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

| Variable | Description | Comment l'obtenir |
|----------|-------------|-------------------|
| `SUPABASE_URL` | URL de votre projet Supabase | Dashboard Supabase → Settings → API |
| `SUPABASE_ANON_KEY` | Clé publique pour le client-side | Dashboard Supabase → Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé admin (⚠️ jamais côté client) | Dashboard Supabase → Settings → API → `service_role` `secret` |

> ⚠️ **Sécurité :** La `SERVICE_ROLE_KEY` bypass les RLS (Row Level Security). Ne jamais l'exposer côté client.

---

### BTCPay Server (Paiements crypto)

```env
BTCPAY_URL=https://btcpay.cinq.app
BTCPAY_API_KEY=your-api-key
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=your-webhook-secret
```

| Variable | Description | Comment l'obtenir |
|----------|-------------|-------------------|
| `BTCPAY_URL` | URL de votre instance BTCPay | Self-hosted ou service tiers |
| `BTCPAY_API_KEY` | Clé API avec droits sur le store | BTCPay → Account → API Keys → Generate |
| `BTCPAY_STORE_ID` | Identifiant unique du store | BTCPay → Stores → Settings |
| `BTCPAY_WEBHOOK_SECRET` | Secret pour valider les callbacks | BTCPay → Stores → Webhooks → Add |

#### Permissions API requises

L'API Key BTCPay doit avoir ces permissions :
- `btcpay.store.cancreateinvoice`
- `btcpay.store.canviewinvoices`
- `btcpay.store.webhooks.canmodifywebhooks`

---

### Codes Cadeaux

```env
GIFT_CODE_SALT=change-me-random-32-chars-minimum
```

| Variable | Description | Exemple |
|----------|-------------|---------|
| `GIFT_CODE_SALT` | Sel cryptographique pour le hachage des codes | `a7b8c9d0e1f2g3h4i5j6k7l8m9n0o1p2` |

#### Génération d'un salt sécurisé

```bash
# Option 1 : OpenSSL
openssl rand -hex 32

# Option 2 : Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3 : /dev/urandom (Linux/Mac)
head -c 32 /dev/urandom | xxd -p -c 64
```

> 🔒 **Important :** Le salt doit être :
> - Au minimum 32 caractères
> - Unique par environnement (dev ≠ staging ≠ prod)
> - Jamais versionné dans Git

---

### Administration

```env
ADMIN_SECRET=your-admin-secret-for-manual-operations
ADMIN_EMAILS=admin@example.com,other-admin@example.com
```

| Variable | Description | Usage |
|----------|-------------|-------|
| `ADMIN_SECRET` | Token pour les opérations admin | Header `Authorization: Bearer <ADMIN_SECRET>` |
| `ADMIN_EMAILS` | Liste des emails admin (séparés par `,`) | Création manuelle de codes cadeaux |

---

### Push Notifications (VAPID)

```env
VAPID_PUBLIC_KEY=BFvUbvZkUNjbCf...
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_EMAIL=mailto:hello@cinq.app
```

#### Génération des clés VAPID

```bash
npx web-push generate-vapid-keys --json
```

Résultat :
```json
{
  "publicKey": "BFvUbvZkUNjbCf...",
  "privateKey": "..."
}
```

| Variable | Description | Notes |
|----------|-------------|-------|
| `VAPID_PUBLIC_KEY` | Clé publique (peut être exposée) | Utilisée côté client |
| `VAPID_PRIVATE_KEY` | Clé privée (secrète) | Côté serveur uniquement |
| `VAPID_EMAIL` | Email de contact | Format `mailto:email@domain.com` |

---

### CORS & Sécurité

```env
ALLOWED_ORIGIN=https://cinq-network.netlify.app
INTERNAL_API_KEY=your-random-internal-key
```

| Variable | Description | Valeur recommandée |
|----------|-------------|-------------------|
| `ALLOWED_ORIGIN` | Domaine autorisé pour les requêtes | URL de production |
| `INTERNAL_API_KEY` | Clé pour appels entre fonctions Netlify | String aléatoire 32+ chars |

---

## 🌍 Configuration par environnement

### Développement local

```env
# .env.local
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GIFT_CODE_SALT=dev-only-salt-32-characters-min
ALLOWED_ORIGIN=http://localhost:8888
```

### Production

```env
# Netlify Environment Variables
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GIFT_CODE_SALT=<strong-production-salt>
BTCPAY_URL=https://btcpay.cinq.app
BTCPAY_API_KEY=<production-api-key>
BTCPAY_STORE_ID=<production-store-id>
BTCPAY_WEBHOOK_SECRET=<production-webhook-secret>
ALLOWED_ORIGIN=https://cinq.app
VAPID_PUBLIC_KEY=<production-vapid-public>
VAPID_PRIVATE_KEY=<production-vapid-private>
VAPID_EMAIL=mailto:hello@cinq.app
ADMIN_SECRET=<production-admin-secret>
ADMIN_EMAILS=admin@cinq.app
INTERNAL_API_KEY=<production-internal-key>
```

---

## 🔐 Bonnes pratiques

### ✅ À faire

- Utiliser des valeurs différentes entre dev/staging/prod
- Stocker les secrets dans un gestionnaire sécurisé (1Password, Vault)
- Faire des rotations régulières des clés API
- Limiter les permissions au strict nécessaire

### ❌ À éviter

- Ne jamais commit les fichiers `.env` dans Git
- Ne jamais exposer `SUPABASE_SERVICE_ROLE_KEY` côté client
- Ne pas réutiliser les mêmes secrets entre environnements
- Ne pas partager les secrets par Slack/Discord/Email

---

## 🆘 Dépannage

### Erreur `Missing SUPABASE_URL`

```
Error: Missing required environment variable: SUPABASE_URL
```

**Solution :** Vérifier que le fichier `.env` est bien chargé ou que les variables sont définies dans Netlify.

### Erreur `Invalid API key`

```
Error: Invalid BTCPay API key
```

**Solution :** Régénérer la clé API dans BTCPay et vérifier les permissions.

### Erreur CORS

```
Access to fetch blocked by CORS policy
```

**Solution :** Vérifier que `ALLOWED_ORIGIN` correspond exactement à l'origine de la requête.

---

*Dernière mise à jour : 2025-01-31*
