# 🎁 CINQ Gift Codes System

Système de codes cadeaux sécurisé pour Cinq.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CINQ Gift System                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐     │
│  │  CREATE  │  │  VERIFY  │  │  REDEEM  │  │   BTCPAY     │     │
│  │ (Admin)  │  │ (Public) │  │(Checkout)│  │  WEBHOOK     │     │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘     │
│       │             │             │               │              │
│       └─────────────┼─────────────┴───────────────┘              │
│                     │                                            │
│            ┌────────▼────────┐                                   │
│            │   Rate Limiter  │                                   │
│            │  (Anti-brute)   │                                   │
│            └────────┬────────┘                                   │
│                     │                                            │
│            ┌────────▼────────┐                                   │
│            │    Supabase     │                                   │
│            │   (PostgreSQL)  │                                   │
│            └─────────────────┘                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🔐 Sécurité

### Format du Code
- **Format**: `CINQ-XXXX-XXXX-XXXX`
- **Entropie**: 128 bits (crypto.randomBytes)
- **Alphabet**: `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (sans ambiguïté)
- **Stockage**: Hash SHA-256 avec salt (code jamais en clair en DB)

### Anti-Bruteforce
- **5 tentatives max** par IP / 15 minutes
- **Blocage 1 heure** après dépassement
- **Reset automatique** après succès
- **Logging** de toutes les tentatives

### Authentification
- `POST /create` : Admin token ou webhook Stripe
- `GET /verify` : Public avec rate limiting
- `POST /redeem` : Public avec rate limiting strict

## 📡 API Endpoints

### POST `/api/gift/create`
Créer un nouveau code après paiement.

**Headers**:
```
Authorization: Bearer <GIFT_ADMIN_SECRET>
# ou
X-API-Key: <GIFT_API_KEY>
```

**Body**:
```json
{
  "amount_cents": 5000,
  "currency": "EUR",
  "purchaser_email": "buyer@example.com",
  "purchaser_name": "Jean Dupont",
  "purchase_order_id": "order_123",
  "recipient_email": "friend@example.com",
  "recipient_name": "Marie Martin",
  "gift_message": "Joyeux anniversaire !",
  "expires_days": 365
}
```

**Response** (201):
```json
{
  "success": true,
  "code": "CINQ-A2B3-C4D5-E6F7",
  "gift_code": {
    "id": "uuid",
    "prefix": "A2B3",
    "amount": { "cents": 5000, "formatted": "50.00 EUR" },
    "currency": "EUR",
    "expires_at": "2026-01-01T00:00:00Z"
  },
  "message": "Gift code created successfully..."
}
```

---

### GET `/api/gift/verify/:code`
Vérifier un code (avant checkout).

**Request**:
```
GET /api/gift/verify/CINQ-A2B3-C4D5-E6F7
```

**Response** (200):
```json
{
  "success": true,
  "valid": true,
  "code_prefix": "A2B3",
  "status": "active",
  "amount": { "cents": 5000, "formatted": "50.00 EUR" },
  "currency": "EUR",
  "expires_at": "2026-01-01T00:00:00Z",
  "days_until_expiry": 365,
  "message": "Gift code is valid and ready to use"
}
```

---

### POST `/api/gift/redeem`
Utiliser un code lors d'une commande.

**Body**:
```json
{
  "code": "CINQ-A2B3-C4D5-E6F7",
  "order_id": "order_456",
  "user_id": "user_uuid"
}
```

**Response** (200):
```json
{
  "success": true,
  "redemption": {
    "id": "uuid",
    "amount": { "cents": 5000, "formatted": "50.00 EUR" },
    "currency": "EUR",
    "redeemed_at": "2025-01-15T10:30:00Z",
    "order_id": "order_456"
  },
  "discount": {
    "type": "fixed_amount",
    "amount_cents": 5000,
    "currency": "EUR"
  },
  "message": "Gift code successfully redeemed!"
}
```

### POST `/.netlify/functions/btcpay-webhook`
Webhook pour paiements BTCPay (Bitcoin/Lightning).

**Headers** (automatiques par BTCPay):
```
BTCPay-Sig: sha256=XXXXX
Content-Type: application/json
```

**Événements traités**:
- `InvoiceSettled` → Crée et active le code cadeau
- `InvoicePaymentSettled` → Idem (backup event)
- Autres événements → Logged mais pas d'action

**Payload BTCPay** (automatique):
```json
{
  "type": "InvoiceSettled",
  "invoiceId": "ABC123",
  "storeId": "xxx",
  "timestamp": 1704067200,
  "metadata": {
    "buyerEmail": "buyer@example.com",
    "recipientName": "Marie"
  }
}
```

**Response** (200):
```json
{
  "success": true,
  "message": "Gift code created successfully",
  "requestId": "abc123def456",
  "invoiceId": "ABC123",
  "giftCode": {
    "id": "uuid",
    "prefix": "A2B3",
    "amount": { "cents": 5000, "formatted": "50.00 EUR" },
    "expiresAt": "2026-01-01T00:00:00Z"
  },
  "action": "created"
}
```

**Sécurité**:
- Vérification HMAC-SHA256 obligatoire
- Timing-safe comparison (anti timing attacks)
- Idempotent (duplicate invoices = skip)
- Audit log complet en DB

---

## 🗄️ Schema Database

Voir `supabase/gift-codes.sql` pour le schema complet.

**Tables**:
- `gift_codes` - Codes cadeaux
- `gift_code_attempts` - Log des tentatives
- `gift_code_rate_limits` - État du rate limiting

## ⚙️ Variables d'Environnement

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Sécurité Gift Codes
GIFT_CODE_SALT=your-random-salt-32-chars-minimum
GIFT_ADMIN_SECRET=your-admin-secret-token
GIFT_API_KEY=your-service-api-key
GIFT_WEBHOOK_SECRET=whsec_... (Stripe)

# BTCPay Server
BTCPAY_URL=https://btcpay.example.com
BTCPAY_API_KEY=your-api-key
BTCPAY_STORE_ID=your-store-id
BTCPAY_WEBHOOK_SECRET=your-webhook-secret

# CORS
ALLOWED_ORIGIN=https://cinq.shop
```

## 📦 Installation

1. **Database**: Exécuter `supabase/gift-codes.sql` sur votre projet Supabase

2. **Functions**: Déployer les fichiers dans `netlify/functions/`

3. **Config**: Ajouter les redirects de `gift-codes.toml` à votre `netlify.toml`

4. **Env**: Configurer les variables dans Netlify Dashboard

## 🧪 Tests

```bash
# Créer un code (admin)
curl -X POST https://cinq.shop/api/gift/create \
  -H "Authorization: Bearer YOUR_ADMIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"amount_cents": 2500, "currency": "EUR"}'

# Vérifier un code
curl https://cinq.shop/api/gift/verify/CINQ-XXXX-XXXX-XXXX

# Utiliser un code
curl -X POST https://cinq.shop/api/gift/redeem \
  -H "Content-Type: application/json" \
  -d '{"code": "CINQ-XXXX-XXXX-XXXX", "order_id": "test_123"}'
```

---

*SARAH Backend - Cinq Gift Code System v1.0*
