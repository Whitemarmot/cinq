# 📊 Cinq Analytics - Documentation

## Overview

Cinq utilise **Plausible Analytics** pour le tracking privacy-friendly.

### Pourquoi Plausible ?

- ✅ **RGPD compliant** - Pas de cookies, pas de consentement requis
- ✅ **Léger** - Script < 1KB
- ✅ **Pas de données personnelles** - Pas d'IP, pas de fingerprinting
- ✅ **Dashboard public** optionnel
- ✅ **Open source** - Self-hosting possible

## Configuration

### 1. Créer un compte Plausible

**Option A - Cloud (recommandé pour commencer)**
1. Aller sur [plausible.io](https://plausible.io)
2. S'inscrire (30 jours gratuits)
3. Ajouter le site `cinq.app`

**Option B - Self-hosted**
1. Déployer Plausible sur votre serveur
2. Modifier `PLAUSIBLE_HOST` dans `/analytics.js`

### 2. Vérifier l'intégration

Le script est déjà intégré sur toutes les pages. Vérifiez simplement dans Plausible que les données arrivent.

## Events trackés

### Pages vues (automatique)
Toutes les pages sont trackées automatiquement par Plausible.

### Events custom

| Event | Déclencheur | Props |
|-------|-------------|-------|
| `Waitlist Signup` | Inscription waitlist | source, medium, campaign |
| `Gift Initiated` | Clic "Payer" sur gift | price, currency |
| `Gift Purchased` | Paiement confirmé | price, currency, method |
| `Gift Redeemed` | Code activé | source |
| `CTA Click` | Clic sur CTA | cta, location |
| `Outbound Link` | Clic lien externe | url |
| `Error` | Erreur JS | type, message |

## Dashboard public (optionnel)

Pour activer un dashboard public :
1. Dans Plausible → Settings → Visibility
2. Cocher "Make stats public"
3. URL publique : `plausible.io/cinq.app`

## API JavaScript

```javascript
// Track un event custom
CinqAnalytics.track('Mon Event', { key: 'value' });

// Events prédéfinis
CinqAnalytics.trackWaitlistSignup({ utm_source: 'twitter' });
CinqAnalytics.trackGiftInitiated({ price: 50 });
CinqAnalytics.trackGiftPurchased({ price: 50, payment_method: 'btc' });
CinqAnalytics.trackGiftRedeemed({ source: 'email' });
CinqAnalytics.trackCTAClick('Buy Now', 'hero');
CinqAnalytics.trackError('payment', 'Timeout');
```

## Debug mode

Pour activer les logs console :

```javascript
// Dans analytics.js, changer :
DEBUG: true
```

## Fichiers modifiés

- `/analytics.js` - Module analytics principal
- `/index.html` - Tracking waitlist
- `/gift.html` - Tracking gifts
- `/redeem.html` - Tracking rédemptions
- `/app.html`, `/login.html`, `/404.html`, `/error.html` - Script inclus

## Conformité RGPD

Plausible est **100% RGPD compliant** :

- ❌ Pas de cookies
- ❌ Pas d'identifiants persistants
- ❌ Pas de tracking cross-site
- ❌ Pas de données personnelles
- ✅ Données agrégées uniquement
- ✅ Serveurs EU (option)

**Pas besoin de** :
- Banner cookie
- Consentement utilisateur
- Mention dans la politique de confidentialité (mais recommandé pour la transparence)

## Coûts

- **Cloud** : €9/mois (jusqu'à 10k visiteurs)
- **Self-hosted** : Gratuit (serveur requis)

## Alternatives considérées

| Solution | Rejeté car |
|----------|------------|
| Google Analytics | Cookies, RGPD complexe |
| Matomo | Plus lourd, config complexe |
| Fathom | Plus cher |
| Simple Analytics | Moins de features |

---

*Docs générés automatiquement • Dernière MAJ: 2025*
