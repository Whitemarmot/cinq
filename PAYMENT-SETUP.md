# Configuration du système de paiement Cinq

Ce document explique comment configurer le système de paiement Stripe pour la vente de packs de codes cadeau.

## 🚀 Vue d'ensemble

Le système permet de vendre des **packs de 5 codes cadeau pour 5€** via Stripe Checkout. Une fois le paiement confirmé, les codes sont automatiquement générés et stockés en base de données.

### Composants

1. **Page d'achat** (`/buy.html`) - Interface utilisateur pour acheter des packs
2. **Stripe Checkout** (`/api/create-checkout`) - Création des sessions de paiement
3. **Webhook Stripe** (`/api/webhook-stripe`) - Traitement des paiements confirmés
4. **Page succès** (`/success.html`) - Affichage des codes générés
5. **Base de données** - Table `purchases` et mise à jour de `gift_codes`

## ⚙️ Configuration Stripe

### 1. Créer un compte Stripe

1. Va sur [stripe.com](https://stripe.com) et crée un compte
2. Active ton compte (vérification d'identité)
3. Configure les moyens de paiement (cartes bancaires)

### 2. Récupérer les clés API

Dans le dashboard Stripe :

**Mode Test (développement) :**
- **Clé publique** : `pk_test_...`
- **Clé secrète** : `sk_test_...`

**Mode Live (production) :**
- **Clé publique** : `pk_live_...`
- **Clé secrète** : `sk_live_...`

### 3. Configurer les webhooks

1. Va dans **Développeurs** > **Webhooks**
2. Clique sur **Ajouter un endpoint**
3. URL : `https://ton-domaine.com/api/webhook-stripe`
4. Événements à écouter :
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. Copie le **secret de signature** (`whsec_...`)

### 4. Variables d'environnement

Ajoute ces variables à ton fichier `.env` :

```env
# === STRIPE ===
STRIPE_SECRET_KEY=sk_test_votre_cle_secrete_ici
STRIPE_WEBHOOK_SECRET=whsec_votre_secret_webhook_ici
STRIPE_PUBLISHABLE_KEY=pk_test_votre_cle_publique_ici

# === SITE ===
SITE_URL=https://votre-domaine.com
```

### 5. Mettre à jour la clé publique

Dans `/buy.html`, remplace la ligne :
```javascript
const stripe = Stripe('{{ STRIPE_PUBLISHABLE_KEY }}');
```

Par ta vraie clé publique :
```javascript
const stripe = Stripe('pk_test_votre_cle_publique');
```

## 🗄️ Configuration Base de Données

### 1. Créer la table purchases

Exécute le script SQL dans Supabase :

```bash
# Dans le SQL Editor de Supabase
cat sql/purchases-table.sql
```

### 2. Vérifier les permissions RLS

La table `purchases` utilise RLS (Row Level Security) avec des politiques strictes :
- Seuls les endpoints API (avec service role) peuvent créer/modifier
- Aucun accès direct utilisateur

### 3. Index et optimisations

Le script SQL crée automatiquement les index nécessaires :
- `stripe_session_id` (unique)
- `customer_email`
- `status`
- `created_at`

## 📱 Flux de paiement

### Étape 1 : Achat
1. L'utilisateur va sur `/buy.html`
2. Clique sur "Acheter avec Stripe"
3. Redirection vers Stripe Checkout

### Étape 2 : Paiement
1. L'utilisateur saisit ses informations de carte
2. Stripe traite le paiement
3. Redirection vers `/success.html?session_id=xxx`

### Étape 3 : Génération des codes
1. Stripe envoie un webhook à `/api/webhook-stripe`
2. L'API génère 5 codes cadeau uniques
3. Stockage en base avec lien vers la session Stripe

### Étape 4 : Affichage
1. `/success.html` récupère les codes via `/api/purchase-codes`
2. Affichage avec boutons copier et partager

## 🧪 Tests

### Mode Test Stripe

Utilise ces cartes de test Stripe :

**Succès :**
- `4242 4242 4242 4242` (Visa)
- `5555 5555 5555 4444` (Mastercard)

**Échec :**
- `4000 0000 0000 0002` (Carte refusée)

**3D Secure :**
- `4000 0025 0000 3155` (Authentification requise)

### Tests locaux

```bash
# Test création checkout
curl -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"pack_type":"5_codes","quantity":1}'

# Test webhook (simulation)
stripe trigger checkout.session.completed
```

### Test rate limiting

Les endpoints ont des limites :
- `create-checkout`: 20/min
- `webhook-stripe`: 100/min
- `purchase-codes`: 10/min

## 🔒 Sécurité

### Validation des webhooks

Les webhooks Stripe sont validés avec la signature :
```javascript
stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
```

### Rate limiting

Protection contre les abus :
- Limite par IP pour les checkouts
- Limite par session pour la récupération de codes

### Données sensibles

- Clés Stripe stockées dans variables d'environnement
- Aucune info carte stockée côté Cinq
- Logs sans données sensibles

## 📊 Monitoring

### Logs importants

```javascript
// Checkout créé
logInfo('Checkout session created', { sessionId, amount, codesCount });

// Paiement confirmé
logInfo('Gift codes generated successfully', { purchaseId, codesCount });

// Codes récupérés
logInfo('Codes retrieved successfully', { sessionId, codesCount });
```

### Métriques Supabase

Surveille les tables :
- `purchases` - Nombre de ventes
- `gift_codes` - Codes créés vs utilisés

### Dashboard Stripe

- Paiements réussis/échoués
- Revenus par période
- Disputes éventuelles

## 🚀 Mise en production

### 1. Changer les clés

Remplace les clés test par les clés live :
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 2. Mettre à jour le webhook

URL de production : `https://cinq.app/api/webhook-stripe`

### 3. Test final

1. Achat test avec vraie carte (puis remboursement)
2. Vérifier génération codes
3. Test affichage page succès

## 💰 Tarification

**Actuel :**
- 1 code = 1€
- Pack de 5 codes = 5€

**Évolutif :**
```javascript
const PRODUCTS = {
    '5_codes': { price: 500, codes_count: 5 },
    '10_codes': { price: 900, codes_count: 10 },  // Réduction
    '20_codes': { price: 1600, codes_count: 20 }  // Réduction
};
```

## 🔧 Maintenance

### Codes expirés

Nettoie périodiquement :
```sql
UPDATE gift_codes 
SET status = 'expired' 
WHERE status = 'active' 
AND expires_at < NOW();
```

### Remboursements

En cas de remboursement Stripe :
1. Marquer les codes comme invalides
2. Mise à jour du statut purchase

### Support client

Dashboard pour voir :
- Achats par email
- Statut des codes
- Historique des paiements

## 📞 Support

- **Stripe** : [support.stripe.com](https://support.stripe.com)
- **Documentation** : [stripe.com/docs](https://stripe.com/docs)
- **Webhook testing** : [stripe.com/docs/webhooks/test](https://stripe.com/docs/webhooks/test)