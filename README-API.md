# Cinq API Documentation

Backend API pour l'app Cinq, déployé sur Vercel + Supabase.

## Base URL

```
Production: https://cinq-three.vercel.app/api
```

## Authentification

La plupart des endpoints nécessitent un token JWT dans le header Authorization :

```http
Authorization: Bearer <access_token>
```

Le token est obtenu via `/api/auth?action=login`.

---

## 🔐 Auth (`/api/auth`)

### Register - Créer un compte

```http
POST /api/auth?action=register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "minimum8chars",
  "giftCode": "CINQ-XXXX-XXXX"
}
```

**Réponse succès (200):**
```json
{
  "success": true,
  "message": "Bienvenue sur Cinq ! 🎉",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

**Erreurs possibles:**
| Code | Erreur | Cause |
|------|--------|-------|
| 400 | Format email invalide | Email mal formé |
| 400 | Mot de passe trop court | < 8 caractères |
| 400 | Format de code invalide | Pas au format CINQ-XXXX-XXXX |
| 400 | Code déjà utilisé | Gift code redeemed |
| 400 | Code expiré | Gift code expired |
| 409 | Cet email est déjà inscrit | Duplicate email |

---

### Login - Connexion

```http
POST /api/auth?action=login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Réponse succès (200):**
```json
{
  "success": true,
  "message": "Connexion réussie !",
  "user": { "id": "uuid", "email": "..." },
  "session": {
    "access_token": "jwt...",
    "refresh_token": "...",
    "expires_at": 1234567890
  }
}
```

---

### Me - Infos utilisateur courant

```http
GET /api/auth?action=me
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "user": { "id": "uuid", "email": "..." },
  "profile": { "display_name": "...", "avatar_url": "...", "bio": "..." }
}
```

---

## 👥 Contacts (`/api/contacts`)

### Lister ses contacts

```http
GET /api/contacts
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "contacts": [
    {
      "id": "contact_row_id",
      "contact_user_id": "uuid",
      "created_at": "2024-01-31T10:00:00Z",
      "contact": { "id": "uuid", "email": "...", "display_name": "..." },
      "mutual": true
    }
  ],
  "count": 3,
  "max": 5,
  "slotsAvailable": 2
}
```

---

### 🆕 Chercher un utilisateur par email

```http
GET /api/contacts?action=search&search=ami@example.com
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "user": {
    "id": "uuid",
    "email": "ami@example.com",
    "display_name": "Mon Ami",
    "avatar_url": null
  },
  "alreadyContact": false
}
```

**Erreurs possibles:**
| Code | Erreur | Cause |
|------|--------|-------|
| 400 | Format email invalide | Email mal formé |
| 400 | Tu ne peux pas t'ajouter toi-même ! | Recherche de son propre email |
| 404 | Utilisateur non trouvé | Email pas inscrit sur Cinq |

---

### 🆕 Voir qui t'a ajouté (followers)

```http
GET /api/contacts?action=followers
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "followers": [
    {
      "id": "contact_row_id",
      "user_id": "follower_uuid",
      "created_at": "2024-01-31T10:00:00Z",
      "follower": { 
        "id": "uuid", 
        "email": "fan@example.com", 
        "display_name": "Fan" 
      },
      "youFollowBack": false
    }
  ],
  "count": 2,
  "message": "2 personne(s) t'ont ajouté"
}
```

---

### Ajouter un contact

**Par UUID:**
```http
POST /api/contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "contactId": "user-uuid-here"
}
```

**🆕 Par email (recommandé):**
```http
POST /api/contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "ami@example.com"
}
```

**Réponse succès (201):**
```json
{
  "success": true,
  "contact": { ... },
  "message": "ami@example.com ajouté à tes contacts !",
  "slotsRemaining": 2
}
```

**Erreurs possibles:**
| Code | Erreur | Cause |
|------|--------|-------|
| 400 | contactId ou email requis | Aucun identifiant fourni |
| 400 | Limite atteinte ! | 5 contacts max |
| 404 | Utilisateur non trouvé | UUID/email invalide |
| 409 | Déjà dans tes contacts | Duplicate |

---

### Supprimer un contact

```http
DELETE /api/contacts?id=<contact_row_id>
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "success": true,
  "message": "Contact ami@example.com supprimé",
  "hint": "Tu as maintenant une place libre dans tes contacts"
}
```

---

## 💬 Messages (`/api/messages`)

### Récupérer les messages avec un contact

```http
GET /api/messages?contact_id=<user_uuid>&limit=50&before=<timestamp>
Authorization: Bearer <token>
```

**Réponse (200):**
```json
{
  "messages": [
    {
      "id": "msg_id",
      "sender_id": "uuid",
      "receiver_id": "uuid",
      "content": "Hello !",
      "is_ping": false,
      "created_at": "2024-01-31T10:00:00Z",
      "read_at": null
    }
  ]
}
```

---

### Envoyer un message

```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "contact_id": "user-uuid",
  "content": "Salut !"
}
```

**Réponse (201):**
```json
{
  "success": true,
  "message": { ... }
}
```

---

### Envoyer un ping 👋

```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "contact_id": "user-uuid",
  "is_ping": true
}
```

---

## 📅 Proposals (`/api/proposals`)

### Lister les propositions

```http
GET /api/proposals
GET /api/proposals?contact_id=<uuid>
Authorization: Bearer <token>
```

---

### Créer une proposition

```http
POST /api/proposals
Authorization: Bearer <token>
Content-Type: application/json

{
  "contact_id": "user-uuid",
  "proposed_at": "2024-02-15T18:00:00Z",
  "location": "Café de Flore",
  "message": "On se retrouve ?"
}
```

---

### Accepter/Refuser une proposition

```http
PATCH /api/proposals
Authorization: Bearer <token>
Content-Type: application/json

{
  "proposal_id": "proposal-uuid",
  "action": "accept"  // ou "decline"
}
```

---

## 🎁 Gift Codes (`/api/gift`)

### Créer un code cadeau

```http
POST /api/gift?action=create
Authorization: Bearer <token>  (optionnel)
```

**Réponse (200):**
```json
{
  "success": true,
  "code": "CINQ-AB12-CD34",
  "gift": {
    "code": "CINQ-AB12-CD34",
    "expiresAt": "2024-03-01T00:00:00Z",
    "shareUrl": "https://cinq-three.vercel.app/register.html?code=CINQ-AB12-CD34"
  }
}
```

---

### Vérifier un code

```http
GET /api/gift?action=verify&code=CINQ-AB12-CD34
```

**Réponse (200):**
```json
{
  "valid": true,
  "gifter": "Marie"
}
```

---

### Lister ses codes envoyés

```http
GET /api/gift?action=list
Authorization: Bearer <token>
```

---

## 👤 User Profile (`/api/user-profile`)

### Récupérer son profil

```http
GET /api/user-profile
Authorization: Bearer <token>
```

---

### Mettre à jour son profil

```http
PUT /api/user-profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "Mon Nom",
  "bio": "Ma bio"
}
```

---

## 🔔 Push Notifications (`/api/push-subscribe`)

### S'abonner aux notifications

```http
POST /api/push-subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "subscription": {
    "endpoint": "https://...",
    "keys": { "p256dh": "...", "auth": "..." }
  }
}
```

### Se désabonner

```http
DELETE /api/push-subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
  "endpoint": "https://..."
}
```

---

## 📝 Waitlist (`/api/waitlist`)

### Compter les inscrits

```http
GET /api/waitlist
```

### S'inscrire

```http
POST /api/waitlist
Content-Type: application/json

{
  "email": "curious@example.com"
}
```

---

## Format des erreurs

Toutes les erreurs suivent ce format :

```json
{
  "error": "Message d'erreur principal",
  "hint": "Conseil pour résoudre le problème (optionnel)",
  "field": "nom_du_champ_problématique (optionnel)",
  "details": "Détails techniques (uniquement en dev)"
}
```

### Codes HTTP utilisés

| Code | Signification |
|------|---------------|
| 200 | Succès (GET, PUT, PATCH, DELETE) |
| 201 | Créé avec succès (POST) |
| 400 | Requête invalide (validation) |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Ressource non trouvée |
| 405 | Méthode non autorisée |
| 409 | Conflit (duplicate) |
| 500 | Erreur serveur |

---

## Limites

- **Contacts:** 5 max par utilisateur
- **Gift codes:** 5 actifs max par utilisateur
- **Messages:** Pagination de 50 par défaut
- **Gift codes:** Expiration 30 jours

---

## 📊 Stats (`/api/stats`) - Admin Only

### Récupérer les métriques

```http
GET /api/stats?period=week
Authorization: Bearer <admin_token>
```

Ou avec le secret admin :
```http
GET /api/stats?period=week
X-Admin-Secret: <ADMIN_SECRET>
```

**Périodes disponibles:** `day`, `week`, `month`, `all`

**Réponse (200):**
```json
{
  "period": "week",
  "since": "2024-01-24T12:00:00Z",
  "totals": {
    "users": 42,
    "messages": 156,
    "gift_codes": 28,
    "active_gift_codes": 12,
    "waitlist": 89
  },
  "events": {
    "user_registered": 8,
    "user_login": 45,
    "message_sent": 120,
    "ping_sent": 36,
    "gift_code_created": 15,
    "gift_code_verified": 22,
    "waitlist_signup": 12
  },
  "daily": {
    "2024-01-31": {
      "user_registered": 2,
      "message_sent": 18
    }
  },
  "derived": {
    "messages_per_user": "3.71",
    "gift_redemption_rate": "57.1%",
    "conversion_rate": "32.1%"
  }
}
```

**Configuration admin (variables d'environnement):**
- `ADMIN_EMAILS`: Liste d'emails admin séparés par virgule
- `ADMIN_SECRET`: Token secret pour accès API sans auth

---

## Changelog

### v1.2.0 (2024-01-31)
- 🆕 `GET /api/stats` - Endpoint admin pour les métriques
- 🆕 Système d'analytics côté serveur
- 🆕 Logs structurés JSON dans toutes les APIs
- 🆕 Tracking: inscriptions, messages, pings, gift codes

### v1.1.0 (2024-01-31)
- 🆕 `GET /api/contacts?action=search&search=email` - Recherche par email
- 🆕 `GET /api/contacts?action=followers` - Voir qui t'a ajouté
- 🆕 `POST /api/contacts` accepte `{ email }` en plus de `{ contactId }`
- ✨ Amélioration des messages d'erreur avec hints
- ✨ Validation des emails et UUID
- ✨ Indicateur de contacts mutuels

### v1.0.0
- Version initiale
