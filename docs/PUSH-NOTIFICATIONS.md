# Push Notifications - Documentation

## Overview

Cinq supporte les notifications push via le Web Push API. Les utilisateurs peuvent activer les notifications depuis la page Paramètres.

## Configuration

### Variables d'environnement requises

Ajouter dans Netlify (Site Settings > Environment variables) :

```env
# VAPID Keys (générées le 2025-01-31)
VAPID_PUBLIC_KEY=BFvUbvZkUNjbCf_lea-V2FGiVLhAdyAXaUC5CUWYlwmCkejWxefzR3rvqJI4DOj_M1Gh664VGVYRo0SEJ-94faM
VAPID_PRIVATE_KEY=4bqqERb1lvjQ_ajVCDR3__pKq2r4mO3RX7F0y7m6cSU
VAPID_EMAIL=mailto:hello@cinq.app

# Pour les appels internes entre fonctions (optionnel mais recommandé)
INTERNAL_API_KEY=<générer une clé aléatoire>
```

⚠️ **IMPORTANT**: La clé privée VAPID doit rester secrète ! Ne jamais la commiter dans le code.

### Table Supabase

Créer la table `push_subscriptions` :

```sql
-- Table pour stocker les subscriptions push
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    keys JSONB NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les lookups par user
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- RLS policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs peuvent voir leurs propres subscriptions
CREATE POLICY "Users can view own subscriptions"
    ON push_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Les utilisateurs peuvent insérer leurs propres subscriptions
CREATE POLICY "Users can insert own subscriptions"
    ON push_subscriptions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres subscriptions
CREATE POLICY "Users can delete own subscriptions"
    ON push_subscriptions FOR DELETE
    USING (auth.uid() = user_id);

-- Les utilisateurs peuvent mettre à jour leurs propres subscriptions
CREATE POLICY "Users can update own subscriptions"
    ON push_subscriptions FOR UPDATE
    USING (auth.uid() = user_id);
```

## Architecture

### Fichiers

- `netlify/functions/push-subscribe.js` - Enregistre/supprime les subscriptions
- `netlify/functions/push-send.js` - Envoie des notifications push
- `service-worker.js` - Reçoit et affiche les notifications
- `settings.html` - Interface utilisateur pour activer/désactiver

### Flux d'inscription

1. L'utilisateur clique "Activer" dans Paramètres
2. Le navigateur demande la permission
3. Si accordée, le service worker s'abonne au push
4. La subscription est envoyée au serveur via `push-subscribe`
5. Le serveur stocke la subscription dans Supabase

### Flux d'envoi

1. Un événement se produit (nouveau message, ping, etc.)
2. La fonction concernée appelle `push-send` avec l'ID utilisateur cible
3. `push-send` récupère toutes les subscriptions de l'utilisateur
4. Envoie la notification à chaque appareil
5. Nettoie les subscriptions expirées (410 Gone)

## Intégration

### Envoyer une notification depuis une autre fonction

```javascript
const { sendNotification } = require('./push-send');

// Exemple: notifier d'un nouveau message
await sendNotification(targetUserId, {
    title: 'Nouveau message 💬',
    body: 'Tu as reçu un message de Marie',
    url: '/app.html',
    tag: 'new-message'
});
```

### Via HTTP (pour tests)

```bash
curl -X POST https://cinq.app/.netlify/functions/push-send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <user_token>" \
  -d '{
    "target_user_id": "uuid-here",
    "notification": {
      "title": "Test 🔔",
      "body": "Ceci est un test",
      "url": "/app.html"
    }
  }'
```

## Types de notifications

| Type | Tag | Quand |
|------|-----|-------|
| Nouveau message | `new-message` | Quelqu'un envoie un message |
| Ping | `ping` | Quelqu'un envoie un ping 💫 |
| Nouveau contact | `new-contact` | Quelqu'un t'ajoute à son cercle |
| Cadeau reçu | `gift-received` | Tu reçois un code cadeau |

## Sécurité

- Les clés VAPID permettent d'authentifier les notifications comme venant de Cinq
- La clé privée ne quitte jamais le serveur
- Les subscriptions sont liées à l'utilisateur authentifié
- Les notifications ne peuvent être envoyées qu'entre contacts

## Debugging

### Vérifier si un utilisateur a des subscriptions

```sql
SELECT * FROM push_subscriptions WHERE user_id = 'uuid-here';
```

### Logs Netlify

Les erreurs sont loguées dans Netlify Functions :
- `[SW] Push subscription changed` - Le token a été renouvelé
- `Push subscription error:` - Erreur côté serveur

### Tester localement

1. Lancer `netlify dev`
2. Ouvrir les DevTools > Application > Service Workers
3. Vérifier que le SW est actif
4. Tester avec "Push" dans l'onglet Service Workers
