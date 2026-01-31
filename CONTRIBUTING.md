# 🤝 Guide de Contribution — CINQ

> **Tolérance zéro pour le code pourri.**

Ce guide définit les règles pour contribuer à Cinq. Un junior doit pouvoir contribuer sans foutre le bordel.

---

## 📋 Checklist Avant de Coder

- [ ] J'ai lu ce fichier en entier
- [ ] J'ai compris l'architecture (voir README.md)
- [ ] J'ai créé une branche depuis `main`
- [ ] Je sais quel problème je résous

---

## 🏗️ Architecture Obligatoire

```
cinq/
├── index.html                 # Pages statiques
├── app.html
├── *.html
│
├── assets/                    # Ressources statiques
│   ├── css/                   # Styles (animations.css)
│   ├── js/                    # Scripts front (fun.js)
│   └── img/                   # Images
│
├── netlify/functions/         # API Backend (serverless)
│   ├── gift-*.js              # Gift code endpoints
│   ├── auth-*.js              # Authentication
│   ├── *-utils.js             # Helpers partagés
│   └── *.js
│
├── supabase/                  # Base de données
│   └── migrations/            # Migrations SQL
│
├── design/                    # Design system & specs
├── docs/                      # Documentation technique
├── infra/                     # Config infrastructure
└── tests/                     # Tests
```

### Règles de Placement

| Type de fichier | Emplacement | Exemple |
|-----------------|-------------|---------|
| Page HTML | Racine `/` | `app.html`, `login.html` |
| CSS global | `/assets/css/` ou inline si <50 lignes | `animations.css` |
| JS front | `/assets/js/` ou inline si <100 lignes | `fun.js` |
| API endpoint | `/netlify/functions/` | `contacts.js` |
| Helper partagé | `/netlify/functions/*-utils.js` | `gift-utils.js` |
| Migration SQL | `/supabase/migrations/` | `001_create_users.sql` |
| Documentation | `/docs/` | `API.md` |

---

## 📝 Conventions de Nommage

### Fichiers

| Type | Convention | Exemple |
|------|------------|---------|
| Page HTML | `kebab-case.html` | `gift-flow.html` |
| Netlify function | `kebab-case.js` | `auth-login.js` |
| CSS | `kebab-case.css` | `animations.css` |
| JS front | `kebab-case.js` | `fun.js` |
| Documentation | `UPPER-CASE.md` | `API.md`, `README.md` |

### Code JavaScript

```javascript
// ✅ BON
const userProfile = await fetchUser(userId);
const MAX_CONTACTS = 5;
function handleLoginSubmit(event) { }

// ❌ MAUVAIS  
const user_profile = await fetch_user(user_id);  // snake_case interdit
const maxContacts = 5;                            // constantes en UPPER_CASE
function HandleLoginSubmit(event) { }             // pas de PascalCase pour fonctions
```

| Type | Convention | Exemple |
|------|------------|---------|
| Variables | `camelCase` | `userName`, `isValid` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_CONTACTS`, `API_URL` |
| Fonctions | `camelCase` | `fetchUser()`, `handleClick()` |
| Classes | `PascalCase` | `UserService`, `GiftCode` |
| Fichiers | `kebab-case` | `gift-utils.js` |

### CSS

```css
/* ✅ BON - BEM-inspired */
.contact-slot { }
.contact-slot--empty { }
.contact-slot__avatar { }

/* ❌ MAUVAIS */
.contactSlot { }          /* pas de camelCase */
.contact_slot { }         /* pas de snake_case */
.slot { }                 /* trop générique */
```

---

## 🚫 Code Interdit

### Fonctions > 50 lignes

```javascript
// ❌ INTERDIT - Trop long
async function handleEverything(event) {
  // 80 lignes de code...
}

// ✅ OBLIGATOIRE - Découper
async function handleSubmit(event) {
  const data = validateInput(event);
  const result = await processData(data);
  return formatResponse(result);
}
```

### Code Dupliqué

```javascript
// ❌ INTERDIT - Copier-coller
// Dans auth-login.js:
const supabase = createClient(url, key, { auth: { persistSession: false } });
// Dans auth-register.js:
const supabase = createClient(url, key, { auth: { persistSession: false } });

// ✅ OBLIGATOIRE - Factoriser dans gift-utils.js
const { createSupabaseClient } = require('./gift-utils');
const supabase = createSupabaseClient();
```

### Magic Numbers

```javascript
// ❌ INTERDIT
if (contacts.length >= 5) { }
setTimeout(callback, 3000);

// ✅ OBLIGATOIRE
const MAX_CONTACTS = 5;
const TOAST_DURATION_MS = 3000;

if (contacts.length >= MAX_CONTACTS) { }
setTimeout(callback, TOAST_DURATION_MS);
```

### Console.log en Production

```javascript
// ❌ INTERDIT
console.log('user:', user);

// ✅ OK - Erreurs seulement
console.error('Auth error:', error);
```

---

## ✅ Règles ESLint

Le projet utilise ESLint. **Tout code doit passer `npm run lint`.**

Règles clés :
- `no-unused-vars` — Pas de variables inutilisées
- `no-console` — Seulement `console.error` et `console.warn`
- `max-lines-per-function` — 50 lignes max
- `eqeqeq` — Toujours `===`, jamais `==`
- `curly` — Toujours des accolades, même pour 1 ligne

---

## 🔄 Workflow Git

### Branches

```bash
# Feature
git checkout -b feat/add-ping-animation

# Bugfix
git checkout -b fix/login-error-handling

# Documentation
git checkout -b docs/update-api-reference
```

### Commits

Format: `type: description courte`

```bash
# ✅ BON
git commit -m "feat: add ping animation on contact card"
git commit -m "fix: handle expired session in auth"
git commit -m "docs: update API endpoints"
git commit -m "refactor: extract supabase client to utils"

# ❌ MAUVAIS
git commit -m "update code"
git commit -m "fix stuff"
git commit -m "WIP"
```

Types autorisés :
- `feat` — Nouvelle fonctionnalité
- `fix` — Correction de bug
- `docs` — Documentation
- `refactor` — Refactoring (pas de changement fonctionnel)
- `style` — Formatage, linting
- `test` — Ajout/modification de tests
- `chore` — Maintenance (deps, config)

### Pull Requests

1. Créer une branche
2. Coder + tester localement
3. Exécuter `npm run lint`
4. Créer PR avec description claire
5. Attendre review

---

## 🧪 Tests

### Avant de Push

```bash
# Linter
npm run lint

# Test webhook BTCPay
npm run test:webhook

# Test manuel local
npm run dev
# Puis tester manuellement dans le navigateur
```

### Tests Manuels Obligatoires

Avant de merger une PR qui touche à :

| Composant | Test manuel |
|-----------|-------------|
| Auth | Login + logout + session expirée |
| Contacts | Add + remove + limite 5 |
| Gift codes | Verify + redeem + invalid code |
| Messages | Send + receive + ping |

---

## 📚 Comment Ajouter une Feature

### Étape 1 : Créer la Branche

```bash
git checkout main
git pull
git checkout -b feat/ma-feature
```

### Étape 2 : Coder le Backend (si nécessaire)

1. Créer `/netlify/functions/ma-feature.js`
2. Importer les utils : `const { success, error } = require('./gift-utils');`
3. Exporter le handler
4. Ajouter le redirect dans `netlify.toml` si besoin

### Étape 3 : Coder le Frontend

1. Ajouter le HTML dans la page concernée
2. Ajouter le CSS dans `animations.css` ou inline si <50 lignes
3. Ajouter le JS inline ou dans `fun.js` si réutilisable

### Étape 4 : Tester

```bash
npm run dev
# Tester manuellement
npm run lint
```

### Étape 5 : Commit + PR

```bash
git add .
git commit -m "feat: add ma feature"
git push -u origin feat/ma-feature
# Créer PR sur GitHub
```

---

## 🆘 Aide

Questions ? Problèmes ?

1. Lire la doc dans `/docs/`
2. Chercher dans les issues GitHub
3. Créer une issue avec label `question`

---

*Dernière mise à jour : Janvier 2025*
