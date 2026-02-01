# Tests E2E — Cinq

Suite de tests end-to-end avec [Playwright](https://playwright.dev/) pour valider les flux critiques de l'application Cinq.

## 🎯 Flux testés

### Login (`login.spec.js`)
- Affichage du formulaire de connexion
- Validation des champs (email, mot de passe)
- Toggle visibilité mot de passe
- Gestion des erreurs (identifiants invalides)
- Lien "Mot de passe oublié"
- Redirection après connexion réussie
- Accessibilité (skip links, labels, ARIA)

### Register (`register.spec.js`)
- Affichage du loading initial
- Validation du code cadeau
- Formulaire d'inscription (email, mot de passe, confirmation)
- Indicateur de force du mot de passe
- Affichage du nom du parrain
- Accessibilité

### Contacts (`contacts.spec.js`)
- Navigation vers l'onglet Contacts
- État vide (aucun contact)
- Modal d'ajout de contact
- Validation de l'ID contact
- Ajout d'un contact valide
- Fermeture modal (backdrop, Escape)
- Limite des 5 contacts
- Accessibilité (dialog, focus trap)

### Messages (`messages.spec.js`)
- Affichage des contacts avec chat
- Ouverture du chat
- Champ de saisie des messages
- État du bouton Envoyer
- Envoi de message (clic et Enter)
- Affichage des messages existants
- Gestion des erreurs d'envoi
- Accessibilité

### Posts (`posts.spec.js`)
- Onglet Feed par défaut
- Affichage du composer
- Avatar utilisateur
- Saisie de texte
- Bouton Publier
- Création de post réussie
- État vide du feed
- Upload de photo
- Gestion des erreurs
- Navigation clavier
- Accessibilité

## 🚀 Usage

```bash
# Installer les dépendances (mode développement)
NODE_ENV=development npm install

# Installer les navigateurs Playwright
npx playwright install

# Lancer tous les tests
npm run test:e2e

# Lancer avec interface graphique
npm run test:e2e:ui

# Lancer en mode headed (voir le navigateur)
npm run test:e2e:headed

# Lancer en mode debug
npm run test:e2e:debug

# Lancer uniquement sur Chromium
npm run test:e2e:chromium

# Lancer uniquement sur Firefox
npm run test:e2e:firefox

# Lancer uniquement sur WebKit (Safari)
npm run test:e2e:webkit

# Lancer les tests mobile
npm run test:e2e:mobile

# Voir le rapport HTML
npm run test:e2e:report
```

## 🧪 Structure

```
tests/e2e/
├── fixtures.js       # Helpers, selectors, mock data
├── login.spec.js     # Tests login flow
├── register.spec.js  # Tests register flow
├── contacts.spec.js  # Tests add contact flow
├── messages.spec.js  # Tests send message flow
├── posts.spec.js     # Tests create post flow
└── README.md         # This file
```

## 🔧 Configuration

La configuration Playwright se trouve dans `playwright.config.js` à la racine du projet.

### Projets de test
- `chromium` — Desktop Chrome
- `firefox` — Desktop Firefox
- `webkit` — Desktop Safari
- `mobile-chrome` — Pixel 5
- `mobile-safari` — iPhone 12

### Serveur local
Les tests lancent automatiquement un serveur local avec `serve` sur le port 3000.

### Variables d'environnement
- `BASE_URL` — URL de base pour les tests (défaut: `http://localhost:3000`)
- `CI` — Mode CI (active les retries, désactive le serveur local)

## 📝 Écrire de nouveaux tests

```javascript
import { test, expect } from '@playwright/test';
import { SELECTORS, navigateTo, mockAuth } from './fixtures.js';

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuth(page);  // Si auth requise
    await navigateTo(page, '/my-page.html');
  });

  test('should do something', async ({ page }) => {
    await expect(page.locator('#my-element')).toBeVisible();
  });
});
```

## 🎭 Mocking des APIs

Les tests utilisent `page.route()` pour mocker les appels Supabase :

```javascript
await page.route('**/rest/v1/posts**', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([{ id: 'post-1', content: 'Test' }])
  });
});
```

## ✅ Bonnes pratiques

1. **Utilisez les sélecteurs de `fixtures.js`** pour la maintenabilité
2. **Mockez les APIs** pour des tests déterministes
3. **Testez l'accessibilité** (ARIA, labels, focus)
4. **Testez les erreurs** pas seulement les cas nominaux
5. **Gardez les tests indépendants** (pas de dépendances entre tests)

## 📊 Rapport

Après l'exécution, consultez le rapport HTML :

```bash
npm run test:e2e:report
```

Les screenshots et traces sont conservés en cas d'échec pour faciliter le debug.
