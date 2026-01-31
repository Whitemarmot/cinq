# Security Review - Projet Cinq

**Date:** 2025-01-31  
**Reviewer:** Clawd (automated)

## 🔴 Failles Critiques

### 1. Injection potentielle dans les requêtes Supabase
**Fichiers:** `api/messages.js`, `api/proposals.js`

Les paramètres `contact_id` sont interpolés directement dans les requêtes `.or()`:
```javascript
.or(`and(sender_id.eq.${user.id},receiver_id.eq.${contact_id}),...`)
```

**Risque:** Si `contact_id` n'est pas validé comme UUID, un attaquant pourrait manipuler la requête.

**Fix:** Valider que `contact_id` est un UUID valide avant utilisation.

---

### 2. Création de gift codes sans authentification
**Fichier:** `api/gift.js`

L'action `create` ne requiert pas d'authentification:
```javascript
// Try to get user if auth provided (optional)
```

**Risque:** N'importe qui peut créer des codes indéfiniment.

**Fix:** Rendre l'authentification obligatoire.

---

## 🟠 Failles Importantes

### 3. Absence totale de rate limiting
**Fichiers:** Tous les endpoints API

Aucun rate limiting n'est implémenté.

**Risques:**
- Brute force sur login
- Spam de la waitlist
- Création massive de gift codes
- DoS par requêtes répétées

**Fix:** Ajouter rate limiting basé sur IP + user ID.

---

### 4. Pas de validation email dans waitlist
**Fichier:** `api/waitlist.js`

L'email n'est pas validé côté serveur:
```javascript
const { email } = req.body;
if (!email) { ... } // Seule vérification
```

**Risque:** Données invalides en base.

**Fix:** Ajouter validation regex email.

---

### 5. Pas de sanitization des entrées utilisateur
**Fichiers:** `api/messages.js`, `api/proposals.js`, `api/user-profile.js`

Les champs `content`, `message`, `display_name`, `bio`, `location` ne sont pas validés/sanitisés.

**Risque:** XSS potentiel si affiché sans échappement côté client.

**Fix:** Valider longueur max et caractères autorisés.

---

## 🟡 Améliorations Recommandées

### 6. CORS trop permissif
**Fichiers:** Tous

```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```

**Recommandation:** Restreindre aux domaines autorisés en production.

---

### 7. Exposition des emails utilisateurs
**Fichier:** `api/contacts.js`

`supabase.auth.admin.listUsers()` charge tous les utilisateurs pour chercher par email.

**Recommandation:** Utiliser une recherche indexée ou limiter les résultats.

---

## ✅ Points Positifs

- Tokens JWT validés via `supabase.auth.getUser()`
- Vérification des relations contact avant actions
- Mots de passe jamais stockés en clair (Supabase Auth)
- Validation format gift code (regex)
- Messages d'erreur non-révélateurs pour login

---

## Fixes Appliqués

- [x] Validation UUID obligatoire pour `contact_id`
- [x] Auth obligatoire pour création de gift codes
- [x] Rate limiting ajouté sur tous les endpoints
- [x] Validation email dans waitlist
- [x] Validation/sanitization des entrées texte
- [x] Longueurs max pour messages et bios
