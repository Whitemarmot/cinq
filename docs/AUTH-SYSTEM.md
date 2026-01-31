# 🔐 CINQ Auth System - Documentation

> **SARAH Backend** - Système d'authentification sécurisé

---

## 📋 Vue d'ensemble

Le système d'auth de CINQ est basé sur:
- **Supabase Auth** pour l'authentification
- **Gift Code** obligatoire pour l'inscription (pas de signup libre)
- **5 contacts max** par utilisateur (contrainte DB)
- **E2E ready** pour les messages chiffrés

---

## 🗄️ Tables Supabase

### `users`
```sql
id            UUID PRIMARY KEY
email         TEXT UNIQUE NOT NULL
created_at    TIMESTAMPTZ
gift_code_used TEXT
```

### `contacts`
```sql
id              UUID PRIMARY KEY
user_id         UUID → users(id)
contact_user_id UUID → users(id)
created_at      TIMESTAMPTZ

-- Constraints:
-- ✅ No self-contact
-- ✅ Unique pairs
-- ✅ MAX 5 contacts (trigger)
```

### `messages`
```sql
id                  UUID PRIMARY KEY
sender_id           UUID → users(id)
recipient_id        UUID → users(id)
encrypted_content   TEXT (E2E encrypted)
message_type        'text'|'image'|'ping'|'location'|'moment'
created_at          TIMESTAMPTZ
read_at             TIMESTAMPTZ
is_ping             BOOLEAN
deleted_by_sender   BOOLEAN
deleted_by_recipient BOOLEAN

-- Constraints:
-- ✅ No self-message
-- ✅ Only contacts can message (trigger)
```

### `login_attempts`
```sql
id          UUID PRIMARY KEY
ip_address  INET
email_hash  TEXT (SHA256)
success     BOOLEAN
user_agent  TEXT
created_at  TIMESTAMPTZ
```

---

## 🔌 API Endpoints

### `POST /api/auth-register`

Inscription avec code cadeau obligatoire.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "giftCode": "CINQ-XXXX-XXXX-XXXX"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Welcome to CINQ! 🎉",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2026-01-31T..."
  },
  "requiresLogin": true
}
```

**Errors:**
- `400` - Invalid input / Invalid gift code
- `409` - Email already exists
- `429` - Rate limited

---

### `POST /api/auth-login`

Connexion avec email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

**Response (200):**
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
    "contact_count": 3,
    "contact_limit": 5,
    "unread_messages": 2
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `429` - Too many attempts (5 per 15 min)

---

### `GET /api/user-profile`

Récupère le profil et les contacts.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "success": true,
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "...",
    "member_since": "..."
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
        "added_at": "..."
      }
    ]
  },
  "messages": {
    "unread_total": 5,
    "conversations": [...]
  }
}
```

---

### `POST /api/user-profile`

Actions sur le profil.

**Add Contact:**
```json
{
  "action": "add_contact",
  "email": "friend@example.com"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Contact added successfully",
  "contact": { "id": "...", "email": "..." },
  "contacts_remaining": 2
}
```

**Remove Contact:**
```json
{
  "action": "remove_contact",
  "contact_id": "uuid"
}
```

---

## 🛡️ Sécurité

### Rate Limiting
- **Gift codes:** 5 tentatives / 15 min, blocage 1h
- **Login:** 5 tentatives / 15 min

### Row Level Security (RLS)
- Users ne voient que leurs propres données
- Contacts isolés par user_id
- Messages visibles sender OU recipient

### Contraintes DB
- `check_contact_limit()` - Max 5 contacts (trigger)
- `check_contact_relationship()` - Seuls les contacts peuvent s'écrire

---

## 📦 Fichiers

```
supabase/
├── users.sql              # Schema users + contacts
├── messages.sql           # Schema messages
├── gift-codes.sql         # Schema gift codes
└── migrations/
    └── 002_auth_system.sql # Migration complète

netlify/functions/
├── auth-register.js       # Inscription
├── auth-login.js          # Connexion
├── user-profile.js        # Profil & contacts
├── gift-utils.js          # Utilitaires partagés
└── gift-*.js              # Système gift codes
```

---

## 🚀 Déploiement

### 1. Variables d'environnement (Netlify)
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
GIFT_CODE_SALT=<random-secret>
```

### 2. Exécuter les migrations
```bash
# Dans Supabase SQL Editor
# 1. gift-codes.sql
# 2. migrations/002_auth_system.sql
```

### 3. Activer Realtime (optionnel)
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
```

---

## 🎯 Contrainte CINQ: 5 Contacts Max

La contrainte est appliquée à 2 niveaux:

1. **Trigger PostgreSQL** (`check_contact_limit`)
   - Bloque INSERT si >= 5 contacts
   - Erreur: `CINQ limit reached: maximum 5 contacts per user`

2. **API Validation** (`user-profile.js`)
   - Check avant INSERT
   - Retourne un message user-friendly

---

*Documentation SARAH Backend - v1.0*
