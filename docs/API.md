# 📚 Cinq API Documentation

> Documentation complète de l'API Netlify Functions

**Base URL :** `https://cinq.app/api` (ou `/.netlify/functions` en direct)

**Version :** 1.0  
**Dernière mise à jour :** 2026-01-31

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Authentification](#authentification)
3. [Endpoints](#endpoints)
   - [Waitlist](#waitlist)
   - [Gift Codes](#gift-codes)
   - [Auth](#auth)
   - [User Profile](#user-profile)
   - [Contacts](#contacts)
   - [Messages](#messages)
   - [BTCPay Webhook](#btcpay-webhook)
4. [Codes d'erreur](#codes-derreur)
5. [Rate Limiting](#rate-limiting)

---

## Vue d'ensemble

### Format des réponses

Toutes les réponses sont en JSON avec la structure suivante :

**Succès :**
```json
{
  "success": true,
  "data": { ... }
}
```

**Erreur :**
```json
{
  "success": false,
  "error": "Message d'erreur",
  "code": "ERROR_CODE"
}
```

### Headers communs

```http
Content-Type: application/json
```

### CORS

Toutes les routes supportent CORS avec les headers suivants :
- `Access-Control-Allow-Origin: *` (ou domaine spécifique en prod)
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS`

---

## Authentification

### Bearer Token

La plupart des endpoints nécessitent un token JWT Supabase :

```http
Authorization: Bearer <access_token>
```

Le token est obtenu via `/api/auth-login` et est valide 1 heure.

### Service Authentication (Webhooks)

Pour les webhooks BTCPay :
```http
BTCPay-Sig: sha256=<hmac_signature>
```

---

## Endpoints

---

### Waitlist

#### `GET /api/waitlist`

Récupère le nombre total d'inscrits à la waitlist.

**Authentification :** Non requise

**Réponse (200) :**
```json
{
  "count": 1234
}
```

---

#### `POST /api/waitlist`

Inscrit un email à la waitlist.

**Authentification :** Non requise

**Request Body :**
```json
{
  "email": "user@example.com",
  "referrer": "twitter",
  "utm_source": "twitter",
  "utm_medium": "social",
  "utm_campaign": "launch"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| email | string | ✅ | Email valide |
| referrer | string | ❌ | Source de référence |
| utm_source | string | ❌ | UTM source |
| utm_medium | string | ❌ | UTM medium |
| utm_campaign | string | ❌ | UTM campaign |

**Réponse (201) :**
```json
{
  "success": true,
  "message": "Bienvenue dans le cercle !",
  "count": 1235
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Email invalide |
| 409 | Conflict | Email déjà inscrit (`already_registered`) |

**Exemple curl :**
```bash
curl -X POST https://cinq.app/api/waitlist \
  -H "Content-Type: application/json" \
  -d '{"email": "hello@example.com"}'
```

---

### Gift Codes

#### `POST /api/gift-create`

Crée un nouveau code cadeau après paiement confirmé.

**Authentification :** Service (API key ou webhook)

**Headers :**
```http
Authorization: Bearer <admin_token>
# ou
X-API-Key: <api_key>
# ou
Stripe-Signature: <stripe_sig>
```

**Request Body :**
```json
{
  "amount_cents": 1500,
  "currency": "EUR",
  "purchaser_email": "buyer@example.com",
  "purchaser_name": "John Doe",
  "purchase_order_id": "order_123",
  "recipient_email": "friend@example.com",
  "recipient_name": "Jane",
  "gift_message": "Bienvenue dans le cercle !",
  "expires_days": 365
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| amount_cents | integer | ✅ | Montant en centimes (max 50000) |
| currency | string | ❌ | EUR, USD, GBP (défaut: EUR) |
| purchaser_email | string | ❌ | Email de l'acheteur |
| purchaser_name | string | ❌ | Nom de l'acheteur |
| purchase_order_id | string | ❌ | ID de commande externe |
| recipient_email | string | ❌ | Email du destinataire |
| recipient_name | string | ❌ | Nom du destinataire |
| gift_message | string | ❌ | Message personnel (max 500 chars) |
| expires_days | integer | ❌ | Jours avant expiration (1-730, défaut: 365) |

**Réponse (201) :**
```json
{
  "success": true,
  "code": "CINQ-A1B2-C3D4-E5F6",
  "gift_code": {
    "id": "uuid",
    "prefix": "CINQ-A1B2",
    "amount": {
      "cents": 1500,
      "formatted": "15.00 EUR"
    },
    "currency": "EUR",
    "expires_at": "2027-01-31T00:00:00.000Z",
    "created_at": "2026-01-31T10:00:00.000Z"
  },
  "message": "Gift code created successfully. Store this code securely - it cannot be retrieved later."
}
```

⚠️ **Important :** Le code complet n'est retourné qu'une seule fois. Il est hashé en base de données.

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Paramètres invalides |
| 401 | Unauthorized | Authentification manquante/invalide |
| 500 | Server Error | Échec de génération |

---

#### `GET /api/gift-verify/:code`

#### `POST /api/gift-verify`

Vérifie la validité d'un code cadeau sans le consommer.

**Authentification :** Non requise (mais rate limited)

**GET Request :**
```
GET /api/gift-verify/CINQ-A1B2-C3D4-E5F6
```

**POST Request Body :**
```json
{
  "code": "CINQ-A1B2-C3D4-E5F6"
}
```

**Réponse (200) :**
```json
{
  "success": true,
  "valid": true,
  "code_prefix": "CINQ-A1B2",
  "status": "active",
  "amount": {
    "cents": 1500,
    "formatted": "15.00 EUR"
  },
  "currency": "EUR",
  "expires_at": "2027-01-31T00:00:00.000Z",
  "days_until_expiry": 365,
  "message": "Gift code is valid and ready to use"
}
```

**Status possibles :**
| Status | Description |
|--------|-------------|
| `active` | Valide et utilisable |
| `redeemed` | Déjà utilisé |
| `expired` | Expiré |
| `revoked` | Révoqué |

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Format de code invalide |
| 404 | Not Found | Code non trouvé |
| 429 | Too Many Requests | Rate limit atteint |

**Exemple curl :**
```bash
curl -X POST https://cinq.app/api/gift-verify \
  -H "Content-Type: application/json" \
  -d '{"code": "CINQ-A1B2-C3D4-E5F6"}'
```

---

#### `POST /api/gift-redeem`

Active un code cadeau lors de la création de compte.

**Authentification :** Non requise (mais rate limited)

**Request Body :**
```json
{
  "code": "CINQ-A1B2-C3D4-E5F6",
  "email": "user@example.com",
  "order_id": "optional_order_id"
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| code | string | ✅ | Code cadeau |
| email | string | ✅* | Email pour activation (*ou order_id) |
| order_id | string | ✅* | ID de commande (*ou email) |

**Réponse (200) :**
```json
{
  "success": true,
  "redemption": {
    "id": "uuid",
    "amount": {
      "cents": 1500,
      "formatted": "15.00 EUR"
    },
    "currency": "EUR",
    "redeemed_at": "2026-01-31T10:00:00.000Z",
    "email": "user@example.com"
  },
  "discount": {
    "type": "fixed_amount",
    "amount_cents": 1500,
    "currency": "EUR"
  },
  "message": "Gift code successfully redeemed!"
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Code invalide, déjà utilisé, ou expiré |
| 404 | Not Found | Code non trouvé |
| 409 | Conflict | Race condition (code utilisé simultanément) |
| 429 | Too Many Requests | Rate limit atteint |

---

### Auth

#### `POST /api/auth-register`

Crée un nouveau compte avec un code cadeau.

**Authentification :** Non requise

**Request Body :**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "giftCode": "CINQ-A1B2-C3D4-E5F6"
}
```

| Champ | Type | Requis | Validation |
|-------|------|--------|------------|
| email | string | ✅ | Format email valide |
| password | string | ✅ | Min 8 chars, 1 lettre, 1 chiffre |
| giftCode | string | ✅ | Format CINQ-XXXX-XXXX-XXXX |

**Réponse (201) :**
```json
{
  "success": true,
  "message": "Welcome to CINQ! 🎉",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-01-31T10:00:00.000Z"
  },
  "requiresLogin": true
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Paramètres invalides ou code cadeau invalide |
| 409 | Conflict | Email déjà utilisé |
| 429 | Too Many Requests | Rate limit atteint |

**Exemple curl :**
```bash
curl -X POST https://cinq.app/api/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hello@example.com",
    "password": "SecurePass123",
    "giftCode": "CINQ-A1B2-C3D4-E5F6"
  }'
```

---

#### `POST /api/auth-login`

Connexion avec email et mot de passe.

**Authentification :** Non requise

**Request Body :**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Réponse (200) :**
```json
{
  "success": true,
  "session": {
    "access_token": "eyJ...",
    "refresh_token": "...",
    "expires_at": 1234567890,
    "expires_in": 3600,
    "token_type": "bearer"
  },
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-01-31T10:00:00.000Z",
    "contact_count": 3,
    "contact_limit": 5,
    "unread_messages": 2
  }
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Paramètres manquants |
| 401 | Unauthorized | Email ou mot de passe incorrect |
| 429 | Too Many Requests | Trop de tentatives (5/15min) |

---

### User Profile

#### `GET /api/user-profile`

Récupère le profil de l'utilisateur connecté.

**Authentification :** ✅ Bearer Token

**Réponse (200) :**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-01-31T10:00:00.000Z",
    "member_since": "2026-01-31T10:00:00.000Z"
  },
  "contacts": {
    "count": 3,
    "limit": 5,
    "remaining": 2,
    "list": [
      {
        "id": "contact-uuid",
        "user_id": "user-uuid",
        "email": "friend@example.com",
        "added_at": "2026-01-31T12:00:00.000Z"
      }
    ]
  },
  "messages": {
    "total": 42
  }
}
```

---

#### `POST /api/user-profile`

Actions sur le profil (ajouter/supprimer contact).

**Authentification :** ✅ Bearer Token

##### Ajouter un contact

**Request Body :**
```json
{
  "action": "add_contact",
  "email": "friend@example.com"
}
```

**Réponse (201) :**
```json
{
  "success": true,
  "message": "Contact added successfully",
  "contact": {
    "id": "uuid",
    "user_id": "user-uuid",
    "email": "friend@example.com",
    "added_at": "2026-01-31T12:00:00.000Z"
  },
  "contacts_remaining": 1
}
```

**Erreurs spécifiques :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | LIMIT_REACHED (5 contacts max) |
| 404 | Not Found | Utilisateur non trouvé |
| 409 | Conflict | Déjà dans les contacts |

##### Supprimer un contact

**Request Body :**
```json
{
  "action": "remove_contact",
  "contact_id": "uuid"
}
```

**Réponse (200) :**
```json
{
  "success": true,
  "message": "Contact removed",
  "contacts_remaining": 3
}
```

---

### Contacts

API RESTful pour la gestion des contacts.

#### `GET /api/contacts`

Liste les contacts de l'utilisateur.

**Authentification :** ✅ Bearer Token

**Réponse (200) :**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "contact-uuid",
      "user_id": "user-uuid",
      "email": "friend@example.com",
      "added_at": "2026-01-31T12:00:00.000Z"
    }
  ],
  "count": 3,
  "limit": 5,
  "remaining": 2
}
```

---

#### `POST /api/contacts`

Ajoute un nouveau contact.

**Authentification :** ✅ Bearer Token

**Request Body :**
```json
{
  "email": "friend@example.com"
}
```

**Réponse (201) :**
```json
{
  "success": true,
  "message": "Contact ajouté !",
  "contact": {
    "id": "uuid",
    "user_id": "user-uuid",
    "email": "friend@example.com",
    "added_at": "2026-01-31T12:00:00.000Z"
  },
  "count": 4,
  "remaining": 1
}
```

**Erreurs :**
| Code | Error Code | Description |
|------|------------|-------------|
| 400 | SELF_ADD | Tu ne peux pas t'ajouter toi-même |
| 400 | LIMIT_REACHED | 5 contacts max |
| 404 | USER_NOT_FOUND | Utilisateur pas sur Cinq |
| 409 | ALREADY_CONTACT | Déjà dans ton cercle |

---

#### `DELETE /api/contacts?id=<uuid>`

Supprime un contact.

**Authentification :** ✅ Bearer Token

**Query Parameters :**
| Param | Type | Description |
|-------|------|-------------|
| id | uuid | ID du contact à supprimer |

**Réponse (200) :**
```json
{
  "success": true,
  "message": "Contact retiré",
  "removed_id": "uuid",
  "count": 2,
  "remaining": 3
}
```

**Exemple curl :**
```bash
curl -X DELETE "https://cinq.app/api/contacts?id=abc-123" \
  -H "Authorization: Bearer <token>"
```

---

### Messages

#### `GET /api/messages?contact_id=<uuid>`

Récupère les messages avec un contact.

**Authentification :** ✅ Bearer Token

**Query Parameters :**
| Param | Type | Requis | Description |
|-------|------|--------|-------------|
| contact_id | uuid | ✅ | ID de l'utilisateur contact |
| limit | integer | ❌ | Nombre de messages (max 100, défaut 50) |
| before | timestamp | ❌ | Pagination : messages avant cette date |

**Réponse (200) :**
```json
{
  "success": true,
  "messages": [
    {
      "id": "msg-uuid",
      "sender_id": "user-uuid",
      "receiver_id": "contact-uuid",
      "content": "Hello !",
      "is_ping": false,
      "is_mine": true,
      "created_at": "2026-01-31T12:00:00.000Z"
    },
    {
      "id": "msg-uuid-2",
      "sender_id": "contact-uuid",
      "receiver_id": "user-uuid",
      "content": "💫",
      "is_ping": true,
      "is_mine": false,
      "created_at": "2026-01-31T12:05:00.000Z"
    }
  ],
  "contact_id": "contact-uuid",
  "count": 2
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | contact_id invalide |
| 403 | Forbidden | Contact pas dans ton cercle |

---

#### `POST /api/messages`

Envoie un message à un contact.

**Authentification :** ✅ Bearer Token

**Request Body (message texte) :**
```json
{
  "contact_id": "uuid",
  "content": "Hello !"
}
```

**Request Body (ping 💫) :**
```json
{
  "contact_id": "uuid",
  "is_ping": true
}
```

| Champ | Type | Requis | Description |
|-------|------|--------|-------------|
| contact_id | uuid | ✅ | ID du destinataire |
| content | string | ✅* | Texte du message (max 500 chars) |
| is_ping | boolean | ❌ | true pour un ping (*content ignoré) |

**Réponse (201) :**
```json
{
  "success": true,
  "message": {
    "id": "msg-uuid",
    "sender_id": "user-uuid",
    "receiver_id": "contact-uuid",
    "content": "Hello !",
    "is_ping": false,
    "is_mine": true,
    "created_at": "2026-01-31T12:00:00.000Z"
  }
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Paramètres invalides |
| 403 | Forbidden | Contact pas dans ton cercle |
| 503 | Service Unavailable | Messaging non disponible |

**Exemple curl (ping) :**
```bash
curl -X POST https://cinq.app/api/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "uuid", "is_ping": true}'
```

---

### BTCPay Webhook

#### `POST /api/btcpay-webhook`

Reçoit les notifications de paiement BTCPay Server.

**Authentification :** HMAC Signature

**Headers :**
```http
BTCPay-Sig: sha256=<hmac_signature>
Content-Type: application/json
```

**Events traités :**
| Event | Action |
|-------|--------|
| `InvoiceSettled` | Crée le code cadeau |
| `InvoicePaymentSettled` | Crée le code cadeau |
| Autres | Acknowledged, aucune action |

**Payload BTCPay :**
```json
{
  "type": "InvoiceSettled",
  "invoiceId": "inv_123",
  "storeId": "store_456",
  "metadata": {
    "buyerEmail": "buyer@example.com",
    "recipientName": "Jane"
  }
}
```

**Réponse (200) :**
```json
{
  "success": true,
  "message": "Gift code created successfully",
  "requestId": "abc123",
  "invoiceId": "inv_123",
  "giftCode": {
    "id": "uuid",
    "prefix": "CINQ-A1B2",
    "amount": {
      "cents": 1500,
      "formatted": "15.00 EUR"
    },
    "expiresAt": "2027-01-31T00:00:00.000Z"
  },
  "action": "created"
}
```

**Erreurs :**
| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Payload invalide ou invoice non settled |
| 401 | Unauthorized | Signature HMAC invalide |
| 500 | Server Error | Erreur de création du code |

---

## Codes d'erreur

### HTTP Status Codes

| Code | Signification | Utilisation |
|------|---------------|-------------|
| 200 | OK | Requête réussie |
| 201 | Created | Ressource créée |
| 204 | No Content | Succès sans contenu (CORS preflight) |
| 400 | Bad Request | Paramètres invalides |
| 401 | Unauthorized | Authentification requise/invalide |
| 403 | Forbidden | Accès refusé (pas ton contact, etc.) |
| 404 | Not Found | Ressource non trouvée |
| 405 | Method Not Allowed | Méthode HTTP non supportée |
| 409 | Conflict | Conflit (email existant, etc.) |
| 429 | Too Many Requests | Rate limit atteint |
| 500 | Server Error | Erreur serveur |
| 503 | Service Unavailable | Service temporairement indisponible |

### Application Error Codes

| Code | Description |
|------|-------------|
| `SELF_ADD` | Tu ne peux pas t'ajouter toi-même |
| `LIMIT_REACHED` | 5 contacts maximum |
| `USER_NOT_FOUND` | Utilisateur non trouvé sur Cinq |
| `ALREADY_CONTACT` | Déjà dans ton cercle |
| `already_registered` | Email déjà inscrit (waitlist) |

---

## Rate Limiting

### Gift Codes & Login

- **Tentatives max :** 5 par fenêtre
- **Fenêtre :** 15 minutes
- **Blocage :** 1 heure après dépassement

**Réponse 429 :**
```json
{
  "success": false,
  "error": "Too many attempts. Please try again later.",
  "retryAfter": 3600
}
```

**Header :**
```http
Retry-After: 3600
```

### Comment ça fonctionne

1. Chaque IP a un compteur de tentatives
2. Après 5 échecs en 15 min → blocage 1h
3. Un succès réinitialise le compteur
4. Les tentatives sont loggées pour audit

---

## Exemples complets

### Flow d'inscription complet

```bash
# 1. Vérifier le code cadeau
curl -X POST https://cinq.app/api/gift-verify \
  -H "Content-Type: application/json" \
  -d '{"code": "CINQ-A1B2-C3D4-E5F6"}'

# 2. Créer le compte
curl -X POST https://cinq.app/api/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hello@example.com",
    "password": "SecurePass123",
    "giftCode": "CINQ-A1B2-C3D4-E5F6"
  }'

# 3. Se connecter
curl -X POST https://cinq.app/api/auth-login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "hello@example.com",
    "password": "SecurePass123"
  }'

# 4. Récupérer le profil (avec le token)
curl -X GET https://cinq.app/api/user-profile \
  -H "Authorization: Bearer eyJ..."
```

### Ajouter un contact et envoyer un message

```bash
# Token obtenu via login
TOKEN="eyJ..."

# Ajouter un contact
curl -X POST https://cinq.app/api/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "friend@example.com"}'

# Envoyer un ping
curl -X POST https://cinq.app/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "friend-uuid", "is_ping": true}'

# Envoyer un message
curl -X POST https://cinq.app/api/messages \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contact_id": "friend-uuid", "content": "Salut !"}'

# Lire les messages
curl -X GET "https://cinq.app/api/messages?contact_id=friend-uuid" \
  -H "Authorization: Bearer $TOKEN"
```

---

*Documentation API Cinq — v1.0*
