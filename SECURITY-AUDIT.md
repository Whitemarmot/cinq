# 🔒 SECURITY AUDIT - Cinq

**Date:** 2025-01-15  
**Auditeur:** Claude (Expert Sécurité Web)  
**Scope:** Vulnérabilités XSS, CSRF, Headers de sécurité

---

## 📊 Résumé Exécutif

| Catégorie | Statut | Sévérité |
|-----------|--------|----------|
| XSS Prevention | ⚠️ Amélioré | Moyenne |
| CSRF Protection | ✅ OK | N/A |
| Security Headers | ⚠️ Partiel | Moyenne |
| Input Validation | ✅ Excellent | N/A |
| Rate Limiting | ✅ Excellent | N/A |
| CORS | ✅ Excellent | N/A |

---

## ✅ POINTS FORTS (Ce qui est bien fait)

### 1. Fonction `escapeHtml()` implémentée
```javascript
// js/common.js - Excellente implémentation
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```
✓ Utilisée dans `js/app.js` pour les contacts et messages  
✓ Exportée via le namespace `Cinq.escapeHtml`

### 2. CORS correctement configuré
```javascript
// api/_cors.js - Pas de wildcard!
const ALLOWED_ORIGINS = [
    'https://cinq-three.vercel.app',
    'https://cinq.app',
    'https://www.cinq.app',
];
```
✓ Pas de `Access-Control-Allow-Origin: *`  
✓ Validation de l'origine avant réponse

### 3. Validation & Sanitization côté serveur
```javascript
// api/_validation.js
export function sanitizeText(str, options = {}) {
    // ✓ Suppression des null bytes
    // ✓ Suppression des caractères de contrôle
    // ✓ Limitation de longueur
}
```

### 4. Rate Limiting implémenté
- Auth: 30 req/min
- Create: 60 req/min
- Read: 200 req/min
- Gift Create: 10/heure

### 5. Headers de sécurité (vercel.json)
```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
}
```

---

## 🔴 VULNÉRABILITÉS TROUVÉES & CORRIGÉES

### 1. XSS dans `animations.js` - showToast() [CORRIGÉ]

**Fichier:** `animations.js` (ligne 631)  
**Sévérité:** MOYENNE  
**Impact:** Un attaquant pourrait injecter du JavaScript via les paramètres title/message

**Code vulnérable:**
```javascript
toast.innerHTML = `
  <span class="toast-icon">${icon || icons[type] || icons.default}</span>
  <div class="toast-content">
    ${title ? `<div class="toast-title">${title}</div>` : ''}
    ${message ? `<div class="toast-message">${message}</div>` : ''}
  </div>
`;
```

**Correction appliquée:**
```javascript
// Utilisation de textContent au lieu de innerHTML pour title/message
const titleDiv = document.createElement('div');
titleDiv.className = 'toast-title';
titleDiv.textContent = title;  // ✓ Sécurisé

const messageDiv = document.createElement('div');
messageDiv.className = 'toast-message';
messageDiv.textContent = message;  // ✓ Sécurisé
```

### 2. XSS dans `js/common.js` - showToast() [CORRIGÉ]

**Fichier:** `js/common.js` (ligne 260)  
**Sévérité:** MOYENNE  

**Même problème, même correction appliquée.**

---

## ⚠️ RECOMMANDATIONS (Non implémentées - A considérer)

### 1. Content-Security-Policy (CSP) global

Actuellement, seul `redeem.html` a un CSP. Recommandation:

**Ajouter dans `vercel.json`:**
```json
{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://plausible.io; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self' https://guioxfulihyehrwytxce.supabase.co wss://guioxfulihyehrwytxce.supabase.co https://plausible.io; img-src 'self' data: https:; frame-ancestors 'none';"
}
```

**Note:** `'unsafe-inline'` est nécessaire actuellement pour les scripts inline. Migration future vers nonces recommandée.

### 2. CSRF - Analyse

**Statut actuel:** ✅ OK (pas de vulnérabilité)

**Raison:** L'API utilise des JWT Bearer tokens dans le header `Authorization`, pas dans les cookies. Les requêtes CSRF ne peuvent pas forger ce header.

```javascript
// api/_supabase.js
export async function getUser(req) {
    const auth = req.headers.authorization;  // ✓ Pas de cookie
    if (!auth?.startsWith('Bearer ')) return null;
    // ...
}
```

**Cependant**, si dans le futur des cookies sont utilisés pour l'auth, implémenter:
- Double Submit Cookie pattern
- Ou SameSite=Strict sur les cookies

### 3. Subresource Integrity (SRI)

Pour les CDN externes, ajouter des hashes SRI:
```html
<script src="https://cdn.tailwindcss.com" 
        integrity="sha384-..." 
        crossorigin="anonymous"></script>
```

### 4. Permissions-Policy Header

Ajouter dans `vercel.json`:
```json
{
  "key": "Permissions-Policy",
  "value": "camera=(), microphone=(), geolocation=()"
}
```

---

## 📋 CHECKLIST SÉCURITÉ

### XSS
- [x] `escapeHtml()` implémentée et utilisée
- [x] `showToast()` corrigé (animations.js)
- [x] `showToast()` corrigé (js/common.js)
- [x] Rendu des messages utilise escapeHtml()
- [x] Rendu des contacts utilise escapeHtml()
- [ ] Migration innerHTML → textContent/DOM APIs (en cours)

### CSRF
- [x] API utilise Bearer tokens (pas de cookies)
- [x] Pas de vulnérabilité CSRF actuellement
- [ ] Documenter si cookies sont ajoutés à l'avenir

### Headers
- [x] X-Content-Type-Options: nosniff
- [x] X-Frame-Options: DENY
- [x] Strict-Transport-Security
- [x] Referrer-Policy
- [ ] Content-Security-Policy global (recommandé)
- [ ] Permissions-Policy (recommandé)

### Validation
- [x] Validation email côté serveur
- [x] Validation UUID côté serveur
- [x] Sanitization du contenu des messages
- [x] Limites de longueur appliquées

### Rate Limiting
- [x] Endpoints auth protégés
- [x] Endpoints création protégés
- [x] Gift creation très limité (10/h)

---

## 🔧 FICHIERS MODIFIÉS

1. `animations.js` - showToast() sécurisé
2. `js/common.js` - showToast() sécurisé

---

## 📅 PROCHAINES ÉTAPES

1. **Priorité haute:** Ajouter CSP global dans vercel.json
2. **Priorité moyenne:** Ajouter SRI pour CDN externes
3. **Priorité basse:** Migrer scripts inline vers fichiers externes (permet CSP sans unsafe-inline)

---

*Audit réalisé avec ❤️ pour la sécurité des utilisateurs de Cinq*
