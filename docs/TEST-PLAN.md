# 🧪 TEST-PLAN.md — Cinq E2E Testing

> **QA Lead:** Automated  
> **Date:** 2026-01-31  
> **Version:** 1.0

---

## 📋 Vue d'ensemble

Ce document décrit les tests manuels et automatisés pour valider le flow complet de Cinq.

### Flows à tester
1. **Waitlist Signup** — Inscription à la liste d'attente
2. **Gift Flow** — Achat et génération de code cadeau (simulation)
3. **Redeem + Account Creation** — Activation du code et création de compte
4. **Login** — Connexion utilisateur
5. **Add Contact** — Ajout de contacts (max 5)
6. **Send Message / Ping** — Envoi de messages et pings

---

## 🎯 Test Matrix

| Flow | Priority | Manual | API Test | Browser Test |
|------|----------|--------|----------|--------------|
| Waitlist | P1 | ✅ | ✅ | - |
| Gift Create | P1 | - | ✅ | - |
| Gift Verify | P1 | ✅ | ✅ | - |
| Redeem + Register | P0 | ✅ | ✅ | ✅ |
| Login | P0 | ✅ | ✅ | ✅ |
| Add Contact | P1 | ✅ | ✅ | - |
| Send Message | P1 | ✅ | ✅ | - |
| Send Ping | P1 | ✅ | ✅ | - |

---

## 📝 Manual Test Procedures

### 1. Waitlist Signup

**Preconditions:** None

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `index.html` | Landing page loads |
| 2 | Scroll to waitlist section | Email input visible |
| 3 | Enter valid email | Field accepts input |
| 4 | Click "Rejoins le cercle" | Loading indicator |
| 5 | Wait for response | Success message + confetti |
| 6 | Try same email again | Error: "déjà inscrit" |

**Edge Cases:**
- [ ] Invalid email format → Error message
- [ ] Empty email → Validation error
- [ ] Network error → Retry option

---

### 2. Gift Flow (Simulation)

**Note:** BTCPay webhook tested via `npm run test:webhook`

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Simulate BTCPay webhook | POST to `/api/btcpay-webhook` |
| 2 | Verify signature | 200 OK |
| 3 | Check gift code created | Response contains code prefix |
| 4 | Verify code in DB | Status: active |

---

### 3. Redeem + Account Creation

**Preconditions:** Valid gift code

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `redeem.html` | Page loads |
| 2 | Enter gift code (CINQ-XXXX-XXXX-XXXX) | Auto-format with dashes |
| 3 | Click "Vérifier" | Code validated, amount shown |
| 4 | Enter email | Field validated |
| 5 | Enter password (8+ chars, 1 letter, 1 number) | Strength indicator |
| 6 | Confirm password | Match validated |
| 7 | Click "Créer mon compte" | Account created |
| 8 | Redirect to login | Login page with success message |

**Edge Cases:**
- [ ] Invalid code format → "Code invalide"
- [ ] Expired code → "Code expiré"
- [ ] Already redeemed → "Code déjà utilisé"
- [ ] Weak password → Validation error
- [ ] Password mismatch → Error shown
- [ ] Email already exists → "Email déjà utilisé"

---

### 4. Login

**Preconditions:** Existing user account

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Navigate to `login.html` | Page loads |
| 2 | Enter email | Field accepts input |
| 3 | Enter password | Password masked |
| 4 | Click "Connexion" | Loading state |
| 5 | Wait for auth | Redirect to `app.html` |
| 6 | Verify token stored | localStorage has session |

**Edge Cases:**
- [ ] Wrong password → "Identifiants incorrects"
- [ ] Non-existent email → Same generic error (security)
- [ ] Rate limit (5+ attempts) → "Trop de tentatives"
- [ ] Empty fields → Validation error

---

### 5. Add Contact

**Preconditions:** Logged in user

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Open app | Dashboard visible |
| 2 | Click "Ajouter un contact" | Modal/form opens |
| 3 | Enter contact email | Field validates |
| 4 | Submit | Contact added |
| 5 | Verify in list | New contact visible |
| 6 | Check counter | "X/5 contacts" updated |

**Edge Cases:**
- [ ] Self-add → "Tu ne peux pas t'ajouter toi-même"
- [ ] Already contact → "Déjà dans ton cercle"
- [ ] User not on Cinq → "Utilisateur non trouvé"
- [ ] 5th contact → Last slot message
- [ ] 6th contact → "5 contacts max"

---

### 6. Send Message / Ping

**Preconditions:** Logged in, at least 1 contact

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Select contact | Chat view opens |
| 2 | Type message | Input accepts text |
| 3 | Click send | Message appears |
| 4 | Verify sent | Message marked sent |
| 5 | Click ping button | Ping sent |
| 6 | Verify ping | 💫 appears in chat |

**Edge Cases:**
- [ ] Empty message → No send
- [ ] Message > 500 chars → Truncated/error
- [ ] Network error → Retry option
- [ ] Removed contact → "Plus dans ton cercle"

---

## 🔧 API Test Scenarios

### Waitlist API

```bash
# Success
curl -X POST /api/waitlist -d '{"email":"test@example.com"}'
# Expected: 201 {"success":true,"count":X}

# Duplicate
curl -X POST /api/waitlist -d '{"email":"test@example.com"}'
# Expected: 409 {"success":false,"code":"already_registered"}

# Invalid email
curl -X POST /api/waitlist -d '{"email":"invalid"}'
# Expected: 400 {"success":false}
```

### Gift Code API

```bash
# Verify valid code
curl -X POST /api/gift-verify -d '{"code":"CINQ-XXXX-XXXX-XXXX"}'
# Expected: 200 {"valid":true,"status":"active"}

# Verify invalid code
curl -X POST /api/gift-verify -d '{"code":"CINQ-0000-0000-0000"}'
# Expected: 404 {"valid":false}
```

### Auth API

```bash
# Register with gift code
curl -X POST /api/auth-register -d '{
  "email":"new@example.com",
  "password":"SecurePass123",
  "giftCode":"CINQ-XXXX-XXXX-XXXX"
}'
# Expected: 201 {"success":true,"requiresLogin":true}

# Login
curl -X POST /api/auth-login -d '{
  "email":"new@example.com",
  "password":"SecurePass123"
}'
# Expected: 200 {"success":true,"session":{...}}
```

### Contacts API

```bash
# List contacts
curl -X GET /api/contacts -H "Authorization: Bearer TOKEN"
# Expected: 200 {"contacts":[...],"count":X}

# Add contact
curl -X POST /api/contacts -H "Authorization: Bearer TOKEN" \
  -d '{"email":"friend@example.com"}'
# Expected: 201 {"success":true,"contact":{...}}

# Remove contact
curl -X DELETE "/api/contacts?id=UUID" -H "Authorization: Bearer TOKEN"
# Expected: 200 {"success":true}
```

### Messages API

```bash
# Get messages
curl -X GET "/api/messages?contact_id=UUID" -H "Authorization: Bearer TOKEN"
# Expected: 200 {"messages":[...]}

# Send message
curl -X POST /api/messages -H "Authorization: Bearer TOKEN" \
  -d '{"contact_id":"UUID","content":"Hello!"}'
# Expected: 201 {"message":{...}}

# Send ping
curl -X POST /api/messages -H "Authorization: Bearer TOKEN" \
  -d '{"contact_id":"UUID","is_ping":true}'
# Expected: 201 {"message":{"is_ping":true}}
```

---

## 🚨 Known Issues Tracking

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| - | - | TBD | - |

---

## ✅ Test Execution Checklist

- [ ] All API endpoints return expected responses
- [ ] Rate limiting works (5 attempts / 15 min)
- [ ] Gift code verification/redemption flow complete
- [ ] Account creation with gift code works
- [ ] Login/logout flow works
- [ ] Contact management (add/remove) works
- [ ] 5 contact limit enforced
- [ ] Messaging between contacts works
- [ ] Ping functionality works
- [ ] Error messages are user-friendly
- [ ] Mobile responsive design verified

---

*Document généré automatiquement — QA Lead*
