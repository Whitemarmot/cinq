# 🐛 FIX: Profil utilisateur - Sauvegarde impossible

## Problème identifié
La sauvegarde du profil utilisateur échoue sur `settings.html` à cause de 2 bugs dans `/js/user-profile.js` :

### Bug 1: URL d'API incorrecte
```javascript
// ❌ AVANT (ligne 12)
const API_BASE = '/.netlify/functions';

// ✅ APRÈS (corrigé)
const API_BASE = '/api';
```

### Bug 2: Méthode HTTP + endpoint incorrects
```javascript
// ❌ AVANT (ligne ~182)
const data = await apiCall('user-profile', 'PATCH', filteredUpdates);

// ✅ APRÈS (corrigé)
const data = await apiCall('user-profile', 'PUT', filteredUpdates);
```

### Bug 3: Appels API notifications
Dans `/js/notifications.js`, plusieurs appels utilisent encore `/.netlify/functions` :
- Ligne 199: `/.netlify/functions/push-subscribe` → `/api/push-subscribe`
- Ligne 240: `/.netlify/functions/push-subscribe` → `/api/push-subscribe` 
- Ligne 730: `/.netlify/functions/messages` → `/api/messages`

## Impact
- ❌ Les utilisateurs ne peuvent pas sauvegarder leur profil
- ❌ Les notifications push ne fonctionnent pas
- ❌ Erreurs 404 sur les appels API

## Solution appliquée
✅ Correction des URLs d'API pour Vercel (`/api` au lieu de `/.netlify/functions`)
✅ Correction de la méthode HTTP PUT pour `user-profile` (conforme à l'API backend)
✅ Corrections dans les fichiers notifications pour cohérence

## Test de validation
**Avant**: Appel à `/.netlify/functions/user-profile` (404)
**Après**: Appel à `/api/user-profile` (✅ disponible)

## Statut
🔧 **Corrections appliquées localement**
⏳ **En attente de déploiement sur Vercel**

Les changements sont commitées localement et prêts à être déployés.