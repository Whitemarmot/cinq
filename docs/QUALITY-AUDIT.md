# 🔍 Audit Qualité Code — CINQ

> Audit réalisé le 31 janvier 2025

---

## 📊 Métriques Générales

| Métrique | Valeur |
|----------|--------|
| Lignes de JS (hors node_modules) | ~4000 |
| Fichiers JS | 14 |
| Fichiers HTML | 9 |
| Fichiers CSS | 2 |
| Taille totale | 16MB (avec node_modules) |

---

## ⚠️ Problèmes Identifiés

### 1. 🔴 Code Dupliqué

#### Waitlist API (CRITIQUE)
Deux fichiers font la même chose :
- `api/waitlist.js` (Vercel syntax)
- `netlify/functions/waitlist.js` (Netlify syntax)

**Action :** Supprimer `api/waitlist.js` (on utilise Netlify, pas Vercel)

#### Supabase Client Creation
Chaque fichier recrée le client Supabase :
```javascript
// Présent dans : auth-login.js, auth-register.js, contacts.js, messages.js, user-profile.js
function getSupabaseAdmin() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    // ...
}
```

**Action :** Centraliser dans `gift-utils.js` (déjà partiellement fait)

---

### 2. 🟠 Fonctions Trop Longues

| Fichier | Fonction | Lignes |
|---------|----------|--------|
| `btcpay-webhook.js` | `exports.handler` | ~200 |
| `auth-register.js` | `exports.handler` | ~150 |
| `fun.js` | `launchConfetti` | ~80 |
| `fun.js` | `matrixRain` | ~60 |

**Action :** Refactoriser en sous-fonctions de <50 lignes

---

### 3. 🟡 Nommage Incohérent

#### Fichiers
- ✅ `auth-login.js` (kebab-case)
- ✅ `gift-utils.js` (kebab-case)
- ❌ `waitlist.js` vs `user-profile.js` (inconsistant avec/sans prefixe)

#### Variables
```javascript
// Incohérent dans gift-utils.js
const supabaseUrl = process.env.SUPABASE_URL;  // camelCase
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;  // trop court
```

---

### 4. 🟡 Dead Code

| Fichier | Code mort |
|---------|-----------|
| `api/waitlist.js` | Fichier entier (on utilise Netlify) |
| `vercel.json` | Config non utilisée |
| `gift.html` | TODO commenté non résolu |

---

### 5. 🟡 Magic Numbers

```javascript
// fun.js
setTimeout(dismiss, 4000);  // Que représente 4000 ?
for (let i = 0; i < 5; i++) // Pourquoi 5 ?

// gift-utils.js
const expires_days = 365;  // Ok mais devrait être une constante nommée
```

---

### 6. 🟢 Points Positifs

- ✅ `gift-utils.js` bien organisé avec helpers centralisés
- ✅ JSDoc présent sur les fonctions principales
- ✅ Séparation claire backend/frontend
- ✅ README complet
- ✅ Documentation API existante
- ✅ Tests webhook présents

---

## 🛠️ Plan de Remédiation

### Priorité 1 (Critique)
- [x] Créer `.eslintrc.json`
- [x] Créer `CONTRIBUTING.md`
- [x] Ajouter scripts npm (`lint`, `build`, `dev`)
- [ ] Supprimer `api/waitlist.js` (dead code)
- [ ] Supprimer `vercel.json` (dead code)

### Priorité 2 (Important)
- [ ] Centraliser création Supabase client
- [ ] Refactoriser `btcpay-webhook.js` en sous-fonctions
- [ ] Refactoriser `auth-register.js` en sous-fonctions

### Priorité 3 (Nice-to-have)
- [ ] Extraire magic numbers en constantes
- [ ] Normaliser nommage des fichiers
- [ ] Ajouter plus de tests automatisés

---

## 📈 Score Qualité

| Catégorie | Score | Notes |
|-----------|-------|-------|
| Structure | 7/10 | Bonne organisation, quelques fichiers à déplacer |
| Nommage | 6/10 | Globalement ok, quelques incohérences |
| Duplication | 5/10 | Plusieurs duplications à éliminer |
| Documentation | 8/10 | Bonne doc, README clair |
| Tests | 5/10 | Tests webhook présents, reste à faire |
| Maintenabilité | 7/10 | Code lisible, manque de standards enforced |

**Score Global : 6.3/10**

---

## ✅ Actions Complétées

- [x] `.eslintrc.json` créé avec règles strictes
- [x] `CONTRIBUTING.md` créé avec conventions
- [x] `package.json` mis à jour avec scripts npm
- [x] Ce rapport d'audit créé

---

*Prochaine étape : Exécuter `npm run lint` et corriger les erreurs*
