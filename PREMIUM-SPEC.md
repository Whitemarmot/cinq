# 🔥 PREMIUM-SPEC — Cinq Premium "5²"

> *Le tier premium de l'anti-réseau social. 25 vrais proches au lieu de 5.*

---

## 📋 Table des matières

1. [Brainstorm Créatif](#1-brainstorm-créatif)
2. [Design Technique](#2-design-technique)
3. [Maquettes UX & Flows](#3-maquettes-ux--flows)
4. [Plan d'Implémentation](#4-plan-dimplémentation)

---

# 1. Brainstorm Créatif

## 🏷️ Naming du Tier Premium

### Recommandation : **"5²"** (Cinq au carré)

**Pourquoi c'est le meilleur choix :**
- 🧮 **Mathématiquement élégant** : 5² = 25 (exactement le nombre de slots)
- 🎯 **Mémorable** : Court, unique, intrigant
- 🔗 **Cohérent avec la marque** : Garde l'identité "Cinq"
- 🌍 **International** : Les chiffres sont universels (pas de traduction)
- ✨ **Premium feel** : L'exposant suggère une évolution, pas juste un ajout

**Alternatives considérées :**
| Nom | Pour | Contre |
|-----|------|--------|
| Cinq² | Cohérent | Moins lisible (accent + exposant) |
| Cinq Plus | Simple | Trop générique, pas mémorable |
| Cinq Pro | Familier | Trop corporate, contre l'esprit |
| Vingt-Cinq | Explicite | Long, perd le mystère |
| Cinq∞ | Cool | Trompeur (ce n'est pas illimité) |

**Décision : 5² (prononcé "cinq au carré" ou "five squared")**

---

## 💰 Pricing Strategy

### Marché cible : France & Suisse

| Plan | Prix FR | Prix CH | USD équivalent |
|------|---------|---------|----------------|
| **Mensuel** | 4.99€ | 5.90 CHF | ~$5.49 |
| **Annuel** | 39.99€ | 49.90 CHF | ~$43.99 |
| **Économie annuelle** | 20€ (~33%) | 21 CHF (~30%) | - |

**Rationale :**
- **Prix psychologique** : Sous les 5€/mois = impulsion possible
- **Aligné marché** : Comparable à Spotify (10€), mais moitié prix car valeur perçue différente
- **Suisse** : +18% pour ajuster au pouvoir d'achat local
- **Annuel attractif** : 2 mois gratuits pour encourager l'engagement

### Options de paiement
- 💳 **Carte bancaire** (Stripe)
- 🍎 **Apple Pay** / **Google Pay**
- 🪙 **Crypto** (USDC sur Base, BTC Lightning) — via BTCPay existant
- 📱 **In-App Purchase** (iOS/Android) — requis par les stores

---

## ✨ Avantages Premium (au-delà des slots)

### Tier 1 : Core (inclus dans 5²)

| Feature | Gratuit | 5² |
|---------|---------|-----|
| **Contacts** | 5 | **25** |
| **Stories** | Durée 24h | **Durée 48h** |
| **Messages vocaux** | 1 min max | **5 min max** |
| **Stockage médias** | 100 MB | **1 GB** |
| **Thèmes** | 2 (clair/sombre) | **8 thèmes exclusifs** |
| **Badge profil** | ❌ | **✨ Badge 5²** |
| **Statistiques** | Basiques | **Détaillées (qui m'a vu, etc.)** |

### Tier 2 : Possibles évolutions futures

- **🔒 Cinq Vault** : Coffre-fort chiffré pour documents sensibles (add-on)
- **📅 Anniversaires avancés** : Rappels personnalisés avec suggestions de cadeaux
- **🎨 Personnalisation avancée** : Couleurs custom, animations spéciales
- **📊 Analytics relationnels** : "Tu parles plus avec X ce mois-ci"
- **🔄 Backup E2E** : Sauvegarde chiffrée des conversations

---

## 🎨 Badges & Indicateurs Visuels

### Badge 5² sur le profil

```
┌─────────────────┐
│  ✨ 5²          │  ← Badge discret mais visible
│                 │
│  [Avatar]       │
│  @username      │
│                 │
│  "Bio text..."  │
└─────────────────┘
```

**Design du badge :**
- Couleur : Gradient or/violet subtil (`#FFD700` → `#8B5CF6`)
- Forme : Carré arrondi avec exposant stylisé
- Animation : Léger shimmer au hover (pas agressif)
- Position : À côté du nom ou dans le header profil

### Indicateurs dans l'app

| Élément | Indication Premium |
|---------|-------------------|
| Liste contacts | Compteur "5/25" au lieu de "5/5" |
| Settings | Section "5² Active" avec date de renouvellement |
| Composer message | Indicateur durée vocale étendue |
| Thèmes | Thèmes premium verrouillés avec icône ✨ |

---

## 🧘 UX de l'Upgrade (Non-Pushy)

### Philosophie : **Découverte naturelle, pas de pression**

L'esprit Cinq est anti-addiction. Le premium doit être proposé **quand c'est pertinent**, jamais forcé.

### Moments de proposition (soft triggers)

| Trigger | Contexte | Message |
|---------|----------|---------|
| **6ème contact** | User essaie d'ajouter un 6ème | "Tu veux garder plus de proches ? Découvre 5²" |
| **Fin story 24h** | Story expire | "Avec 5², tes stories durent 48h" |
| **Voice 1min** | Message vocal coupé | "Envie de dire plus ? 5² = 5 min" |
| **Thème verrouillé** | User clique thème premium | "Ce thème est exclusif 5²" |
| **30 jours usage** | User actif depuis 1 mois | Badge discret dans settings |

### Ce qu'on NE FAIT PAS ❌

- ❌ Pop-ups au lancement
- ❌ Notifications push "Upgrade now!"
- ❌ Compteurs "X jours restants" anxiogènes
- ❌ Features dégradées artificiellement
- ❌ Dark patterns (boutons confus, close button caché)

### Ce qu'on FAIT ✅

- ✅ Section premium accessible mais pas intrusive
- ✅ Explication claire des bénéfices
- ✅ Période d'essai gratuite (7 jours, sans CB)
- ✅ Annulation facile et transparente
- ✅ Le gratuit reste entièrement fonctionnel

---

# 2. Design Technique

## 🏗️ Architecture Supabase

### Nouvelle table : `subscriptions`

```sql
-- ============================================
-- SUBSCRIPTIONS (Premium 5²)
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Status
    status TEXT NOT NULL DEFAULT 'inactive' 
        CHECK (status IN ('inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired')),
    
    -- Plan info
    plan_id TEXT NOT NULL DEFAULT 'free'
        CHECK (plan_id IN ('free', '5squared_monthly', '5squared_annual')),
    
    -- Provider info (pour la réconciliation)
    provider TEXT NOT NULL DEFAULT 'none'
        CHECK (provider IN ('none', 'stripe', 'revenuecat', 'btcpay', 'apple', 'google')),
    provider_subscription_id TEXT,
    provider_customer_id TEXT,
    
    -- Dates
    trial_start TIMESTAMPTZ,
    trial_end TIMESTAMPTZ,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    canceled_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Un seul abonnement actif par user
    UNIQUE(user_id)
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_provider ON subscriptions(provider, provider_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period_end ON subscriptions(current_period_end);

-- RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read their own subscription
CREATE POLICY "Users can view own subscription" ON subscriptions 
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can modify subscriptions (API-only)
-- No INSERT/UPDATE/DELETE policies for users = service role only
```

### Nouvelle table : `subscription_events` (Audit log)

```sql
-- ============================================
-- SUBSCRIPTION EVENTS (Audit trail)
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    event_type TEXT NOT NULL
        CHECK (event_type IN (
            'trial_started', 'trial_ended', 'trial_converted',
            'subscription_created', 'subscription_renewed', 
            'subscription_canceled', 'subscription_expired',
            'payment_succeeded', 'payment_failed',
            'plan_changed', 'refunded'
        )),
    
    -- Données de l'événement
    previous_status TEXT,
    new_status TEXT,
    provider TEXT,
    provider_event_id TEXT,
    amount_cents INTEGER,
    currency TEXT DEFAULT 'EUR',
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_sub_events_created ON subscription_events(created_at DESC);

ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own events
CREATE POLICY "Users can view own subscription events" ON subscription_events 
    FOR SELECT USING (auth.uid() = user_id);
```

### Mise à jour de la table `users`

```sql
-- Ajouter colonne pour le contact limit (calculé depuis subscription)
-- Note: On pourrait aussi le calculer à la volée, mais c'est plus performant de le stocker

ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_limit INTEGER DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;

-- Fonction pour mettre à jour le statut premium
CREATE OR REPLACE FUNCTION update_user_premium_status()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET 
        is_premium = (NEW.status IN ('trialing', 'active')),
        contact_limit = CASE 
            WHEN NEW.status IN ('trialing', 'active') THEN 25 
            ELSE 5 
        END,
        updated_at = NOW()
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscription_change ON subscriptions;
CREATE TRIGGER on_subscription_change
    AFTER INSERT OR UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_user_premium_status();
```

### Mise à jour du trigger contact limit

```sql
-- Mise à jour du trigger pour utiliser le contact_limit dynamique
CREATE OR REPLACE FUNCTION check_contact_limit()
RETURNS TRIGGER AS $$
DECLARE
    user_limit INTEGER;
    current_count INTEGER;
BEGIN
    -- Récupérer la limite de l'utilisateur
    SELECT COALESCE(contact_limit, 5) INTO user_limit 
    FROM users WHERE id = NEW.user_id;
    
    -- Compter les contacts non-archivés
    SELECT COUNT(*) INTO current_count 
    FROM contacts 
    WHERE user_id = NEW.user_id 
    AND (archived IS NULL OR archived = FALSE);
    
    IF current_count >= user_limit THEN
        RAISE EXCEPTION 'Maximum % contacts allowed', user_limit;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Helper RPC pour vérifier le statut premium

```sql
-- Fonction pour vérifier si un user est premium (utilisable côté client)
CREATE OR REPLACE FUNCTION is_user_premium(target_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    check_user_id UUID;
    result BOOLEAN;
BEGIN
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    SELECT EXISTS(
        SELECT 1 FROM subscriptions 
        WHERE user_id = check_user_id 
        AND status IN ('trialing', 'active')
        AND (current_period_end IS NULL OR current_period_end > NOW())
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour obtenir les détails du plan
CREATE OR REPLACE FUNCTION get_subscription_info(target_user_id UUID DEFAULT NULL)
RETURNS JSONB AS $$
DECLARE
    check_user_id UUID;
    sub_record RECORD;
BEGIN
    check_user_id := COALESCE(target_user_id, auth.uid());
    
    SELECT * INTO sub_record FROM subscriptions 
    WHERE user_id = check_user_id;
    
    IF sub_record IS NULL THEN
        RETURN jsonb_build_object(
            'plan', 'free',
            'status', 'inactive',
            'contact_limit', 5,
            'is_premium', false
        );
    END IF;
    
    RETURN jsonb_build_object(
        'plan', sub_record.plan_id,
        'status', sub_record.status,
        'contact_limit', CASE WHEN sub_record.status IN ('trialing', 'active') THEN 25 ELSE 5 END,
        'is_premium', sub_record.status IN ('trialing', 'active'),
        'trial_end', sub_record.trial_end,
        'current_period_end', sub_record.current_period_end,
        'canceled_at', sub_record.canceled_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 💳 Intégration Paiement

### Architecture Multi-Provider

```
┌─────────────────────────────────────────────────────────────────┐
│                         CINQ Backend                            │
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   Stripe    │    │ RevenueCat  │    │   BTCPay    │        │
│  │   (Web)     │    │  (Mobile)   │    │  (Crypto)   │        │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘        │
│         │                  │                  │                │
│         └────────────┬─────┴──────────────────┘                │
│                      ▼                                          │
│         ┌────────────────────────┐                              │
│         │   Webhook Handler      │                              │
│         │   /api/webhooks/*      │                              │
│         └───────────┬────────────┘                              │
│                     ▼                                           │
│         ┌────────────────────────┐                              │
│         │   Subscription Service │                              │
│         │   (Unified Logic)      │                              │
│         └───────────┬────────────┘                              │
│                     ▼                                           │
│         ┌────────────────────────┐                              │
│         │   Supabase             │                              │
│         │   subscriptions table  │                              │
│         └────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

### 1. Stripe (Web)

**Configuration requise :**
```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
```

**Produits Stripe à créer :**
```javascript
// Products
const products = {
  '5squared': {
    name: '5² Premium',
    description: '25 contacts, extended stories, premium themes',
    metadata: { app: 'cinq', tier: 'premium' }
  }
};

// Prices
const prices = {
  '5squared_monthly': {
    product: '5squared',
    unit_amount: 499, // 4.99€
    currency: 'eur',
    recurring: { interval: 'month' }
  },
  '5squared_annual': {
    product: '5squared', 
    unit_amount: 3999, // 39.99€
    currency: 'eur',
    recurring: { interval: 'year' }
  }
};
```

**Webhook handler (pseudo-code) :**
```javascript
// /api/webhooks/stripe.js
import Stripe from 'stripe';
import { supabaseAdmin } from '../lib/supabase-admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const subscription = event.data.object;
  const userId = subscription.metadata?.user_id;

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await supabaseAdmin.from('subscriptions').upsert({
        user_id: userId,
        status: mapStripeStatus(subscription.status),
        plan_id: mapStripePriceToplan(subscription.items.data[0].price.id),
        provider: 'stripe',
        provider_subscription_id: subscription.id,
        provider_customer_id: subscription.customer,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        updated_at: new Date()
      }, { onConflict: 'user_id' });
      break;
      
    case 'customer.subscription.deleted':
      await supabaseAdmin.from('subscriptions')
        .update({ status: 'expired', updated_at: new Date() })
        .eq('provider_subscription_id', subscription.id);
      break;
      
    case 'invoice.payment_failed':
      await supabaseAdmin.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date() })
        .eq('provider_subscription_id', subscription.subscription);
      break;
  }

  // Log event
  await supabaseAdmin.from('subscription_events').insert({
    subscription_id: /* lookup */,
    user_id: userId,
    event_type: mapStripeEventType(event.type),
    provider: 'stripe',
    provider_event_id: event.id,
    metadata: { stripe_event: event.type }
  });

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### 2. RevenueCat (Mobile iOS/Android)

**Pourquoi RevenueCat :**
- ✅ Abstrait la complexité iOS/Android
- ✅ Gère les receipts validation
- ✅ Dashboard unifié
- ✅ Webhooks pour sync backend

**Configuration RevenueCat :**
```env
REVENUECAT_API_KEY_IOS=appl_...
REVENUECAT_API_KEY_ANDROID=goog_...
REVENUECAT_WEBHOOK_AUTH_KEY=...
```

**Produits à configurer dans App Store Connect / Google Play Console :**
```
iOS/Android Product IDs:
- com.cinq.5squared.monthly
- com.cinq.5squared.annual
```

**Code mobile (React Native) :**
```typescript
// src/services/purchases.ts
import Purchases, { PurchasesOffering } from 'react-native-purchases';

const REVENUECAT_API_KEY = Platform.select({
  ios: process.env.REVENUECAT_API_KEY_IOS,
  android: process.env.REVENUECAT_API_KEY_ANDROID,
});

export async function initPurchases(userId: string) {
  await Purchases.configure({
    apiKey: REVENUECAT_API_KEY!,
    appUserID: userId,
  });
}

export async function getOfferings(): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current;
}

export async function purchasePackage(packageId: string): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(p => p.identifier === packageId);
    
    if (!pkg) throw new Error('Package not found');
    
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active['5squared'] !== undefined;
  } catch (error) {
    if (error.userCancelled) return false;
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const customerInfo = await Purchases.restorePurchases();
  return customerInfo.entitlements.active['5squared'] !== undefined;
}

export async function checkPremiumStatus(): Promise<boolean> {
  const customerInfo = await Purchases.getCustomerInfo();
  return customerInfo.entitlements.active['5squared'] !== undefined;
}
```

**Webhook RevenueCat → Backend :**
```javascript
// /api/webhooks/revenuecat.js
export async function POST(req) {
  const authKey = req.headers.get('authorization');
  if (authKey !== process.env.REVENUECAT_WEBHOOK_AUTH_KEY) {
    return new Response('Unauthorized', { status: 401 });
  }

  const event = await req.json();
  const { app_user_id, type, product_id, expiration_at_ms } = event;

  const statusMap = {
    'INITIAL_PURCHASE': 'active',
    'RENEWAL': 'active', 
    'CANCELLATION': 'canceled',
    'EXPIRATION': 'expired',
    'BILLING_ISSUE': 'past_due',
  };

  const status = statusMap[type] || 'active';
  const planId = product_id?.includes('annual') ? '5squared_annual' : '5squared_monthly';

  await supabaseAdmin.from('subscriptions').upsert({
    user_id: app_user_id,
    status,
    plan_id: planId,
    provider: event.store === 'APP_STORE' ? 'apple' : 'google',
    provider_subscription_id: event.original_transaction_id,
    current_period_end: expiration_at_ms ? new Date(expiration_at_ms) : null,
    updated_at: new Date()
  }, { onConflict: 'user_id' });

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

### 3. BTCPay (Crypto)

**Déjà en place** dans l'infra Cinq. Adapter pour les subscriptions :

```javascript
// /api/webhooks/btcpay.js
export async function POST(req) {
  const event = await req.json();
  
  if (event.type === 'InvoiceSettled') {
    const { metadata, amount } = event;
    const userId = metadata.user_id;
    const planId = metadata.plan_id; // '5squared_monthly' ou '5squared_annual'
    
    // Calculer la période selon le plan
    const periodEnd = new Date();
    if (planId === '5squared_annual') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    
    await supabaseAdmin.from('subscriptions').upsert({
      user_id: userId,
      status: 'active',
      plan_id: planId,
      provider: 'btcpay',
      provider_subscription_id: event.invoiceId,
      current_period_start: new Date(),
      current_period_end: periodEnd,
      updated_at: new Date()
    }, { onConflict: 'user_id' });
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
}
```

**Note crypto :** Pas de recurring automatique. Pour le renouvellement :
- Notification 7 jours avant expiration
- User doit repayer manuellement
- Ou proposer conversion vers Stripe pour auto-renew

---

## 🔄 Sync Cross-Platform

### Le problème
Un user peut :
1. S'abonner sur iOS → doit être premium sur web
2. S'abonner sur web → doit être premium sur mobile
3. S'abonner via crypto → doit être premium partout

### La solution : Source of Truth = Supabase

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   iOS App   │     │   Web App   │     │ Android App │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  (1) Purchase     │  (2) Check status │
       ▼                   ▼                   ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ RevenueCat  │     │   Stripe    │     │ RevenueCat  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └────────┬──────────┴───────────────────┘
                │ Webhooks
                ▼
       ┌────────────────────┐
       │     Supabase       │  ← Source of Truth
       │   subscriptions    │
       └─────────┬──────────┘
                 │
       ┌─────────┴──────────┐
       │  All clients check │
       │  Supabase status   │
       └────────────────────┘
```

### Client-side check (unifié)

```typescript
// Utilisable sur web ET mobile
async function checkPremiumStatus(): Promise<PremiumStatus> {
  // 1. Check Supabase (source of truth)
  const { data } = await supabase.rpc('get_subscription_info');
  
  return {
    isPremium: data.is_premium,
    plan: data.plan,
    contactLimit: data.contact_limit,
    expiresAt: data.current_period_end,
    isTrial: data.status === 'trialing',
  };
}
```

### Gestion des conflits

Si un user a un abonnement actif sur plusieurs providers (rare mais possible) :
1. **Priorité** : Le plus récent gagne
2. **Alerte** : Notifier l'admin pour investigation
3. **User** : Proposer d'annuler le doublon

---

## 📊 États de Subscription

```
                    ┌─────────────┐
                    │   inactive  │ (jamais abonné)
                    └──────┬──────┘
                           │ start_trial()
                           ▼
                    ┌─────────────┐
           ┌───────►│  trialing   │◄───────┐
           │        └──────┬──────┘        │
           │               │               │
           │    trial_end  │  convert()    │
           │    no_convert │               │
           │               ▼               │
           │        ┌─────────────┐        │
           │        │   active    │────────┘ reactivate()
           │        └──────┬──────┘
           │               │
      reactivate()  ┌──────┴───────┐
           │        │              │
           │   cancel()      payment_failed()
           │        │              │
           │        ▼              ▼
           │ ┌─────────────┐ ┌─────────────┐
           │ │  canceled   │ │  past_due   │
           │ └──────┬──────┘ └──────┬──────┘
           │        │              │
           │   period_end    payment_retry_failed()
           │        │              │
           │        ▼              ▼
           │ ┌─────────────┐      │
           └─┤   expired   │◄─────┘
             └─────────────┘
```

---

# 3. Maquettes UX & Flows

## 🖥️ Flow Web : Upgrade

### Étape 1 : Découverte (Settings ou Trigger)

```
┌────────────────────────────────────────────────────────┐
│  ⚙️ Settings                                      [X]  │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📷 Photo de profil                                   │
│  ✏️ Nom d'affichage                                   │
│  📝 Bio                                               │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │  ✨ Passer à 5²                                │   │
│  │                                                │   │
│  │  25 contacts • Stories 48h • Thèmes exclusifs │   │
│  │                                                │   │
│  │              [Découvrir 5²]                   │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  🔔 Notifications                                     │
│  🎨 Apparence                                         │
│  🔒 Confidentialité                                   │
│  ❓ Aide                                              │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Étape 2 : Page Premium

```
┌────────────────────────────────────────────────────────┐
│  ← Retour                    Cinq Premium              │
├────────────────────────────────────────────────────────┤
│                                                        │
│                      ✨ 5² ✨                          │
│                   Cinq au carré                        │
│                                                        │
│         Plus de proches, pas plus de bruit.           │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  👥  25 contacts           (au lieu de 5)      │  │
│  │                                                  │  │
│  │  📸  Stories 48h           (au lieu de 24h)    │  │
│  │                                                  │  │
│  │  🎤  Vocaux 5 min          (au lieu de 1 min)  │  │
│  │                                                  │  │
│  │  🎨  8 thèmes exclusifs                        │  │
│  │                                                  │  │
│  │  📊  Statistiques détaillées                   │  │
│  │                                                  │  │
│  │  ✨  Badge profil 5²                           │  │
│  │                                                  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────┐  ┌──────────────────┐          │
│  │     Mensuel      │  │      Annuel      │          │
│  │                  │  │   ★ POPULAIRE    │          │
│  │     4,99€/mois   │  │                  │          │
│  │                  │  │   39,99€/an      │          │
│  │                  │  │   (3,33€/mois)   │          │
│  │   [Choisir]     │  │                  │          │
│  │                  │  │  Économisez 20€  │          │
│  │                  │  │                  │          │
│  │                  │  │   [Choisir]     │          │
│  └──────────────────┘  └──────────────────┘          │
│                                                        │
│            Essai gratuit 7 jours inclus               │
│         Annulation facile à tout moment              │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  💳 Modes de paiement acceptés :                      │
│  [Visa] [Mastercard] [Apple Pay] [₿ BTC] [USDC]      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Étape 3 : Checkout (Stripe Elements)

```
┌────────────────────────────────────────────────────────┐
│  ← Retour                      Paiement                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Votre commande                                        │
│  ─────────────────────────────────────────────────    │
│  ✨ 5² Premium - Annuel              39,99€           │
│  7 jours d'essai gratuit             - 0,00€          │
│  ─────────────────────────────────────────────────    │
│  Aujourd'hui                          0,00€           │
│  Puis 39,99€/an à partir du 15 fév.                  │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │  💳 Carte bancaire                              │  │
│  │                                                  │  │
│  │  Numéro de carte                                │  │
│  │  ┌────────────────────────────────────────────┐ │  │
│  │  │ 4242 4242 4242 4242                        │ │  │
│  │  └────────────────────────────────────────────┘ │  │
│  │                                                  │  │
│  │  MM/AA              CVC                         │  │
│  │  ┌──────────┐       ┌──────────┐               │  │
│  │  │ 12/28    │       │ 123      │               │  │
│  │  └──────────┘       └──────────┘               │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│  ☑️ J'accepte les conditions générales de vente       │
│                                                        │
│         [        Démarrer l'essai gratuit        ]    │
│                                                        │
│  🔒 Paiement sécurisé via Stripe                      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Étape 4 : Confirmation

```
┌────────────────────────────────────────────────────────┐
│                                                        │
│                                                        │
│                         🎉                             │
│                                                        │
│               Bienvenue dans 5² !                     │
│                                                        │
│    Ton essai gratuit de 7 jours commence maintenant.  │
│                                                        │
│          Tu peux maintenant ajouter jusqu'à           │
│               25 contacts proches.                    │
│                                                        │
│                                                        │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                  │  │
│  │  📅 Prochain paiement : 15 février 2025        │  │
│  │  💰 Montant : 39,99€                           │  │
│  │                                                  │  │
│  │  Tu recevras un email de rappel 3 jours avant. │  │
│  │                                                  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                        │
│           [    Découvrir mes nouveaux thèmes    ]     │
│                                                        │
│                  [  Retour à l'app  ]                 │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## 📱 Flow Mobile : Upgrade

### Écran Premium (React Native)

```
┌─────────────────────────────┐
│ ←                     5²    │
├─────────────────────────────┤
│                             │
│         ✨ 5² ✨            │
│      Cinq au carré         │
│                             │
│ ┌─────────────────────────┐ │
│ │ 👥 25 contacts          │ │
│ │ 📸 Stories 48h          │ │
│ │ 🎤 Vocaux 5 min         │ │
│ │ 🎨 Thèmes exclusifs     │ │
│ │ ✨ Badge 5²             │ │
│ └─────────────────────────┘ │
│                             │
│  ┌───────────────────────┐  │
│  │      4,99€/mois       │  │
│  │    [  S'abonner  ]    │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │  39,99€/an ★ -33%    │  │
│  │    [  S'abonner  ]    │  │
│  └───────────────────────┘  │
│                             │
│    7 jours d'essai offerts  │
│                             │
│  ─────────────────────────  │
│  Restaurer un achat         │
│                             │
└─────────────────────────────┘
```

### Code React Native

```tsx
// screens/PremiumScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { usePurchases } from '../hooks/usePurchases';
import { useTheme } from '../theme';

export function PremiumScreen({ navigation }) {
  const theme = useTheme();
  const { offerings, purchasePackage, restorePurchases, loading } = usePurchases();
  const [purchasing, setPurchasing] = useState(false);

  const handlePurchase = async (packageId: string) => {
    setPurchasing(true);
    try {
      const success = await purchasePackage(packageId);
      if (success) {
        navigation.navigate('PremiumSuccess');
      }
    } catch (error) {
      Alert.alert('Erreur', error.message);
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    const success = await restorePurchases();
    if (success) {
      Alert.alert('Succès', 'Votre abonnement a été restauré !');
      navigation.goBack();
    } else {
      Alert.alert('Info', 'Aucun abonnement trouvé');
    }
  };

  if (loading) {
    return <ActivityIndicator />;
  }

  const monthlyPackage = offerings?.availablePackages.find(p => 
    p.identifier === '$rc_monthly'
  );
  const annualPackage = offerings?.availablePackages.find(p => 
    p.identifier === '$rc_annual'
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={styles.badge}>✨ 5² ✨</Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          Cinq au carré
        </Text>
      </View>

      <View style={styles.features}>
        <FeatureRow icon="👥" text="25 contacts" />
        <FeatureRow icon="📸" text="Stories 48h" />
        <FeatureRow icon="🎤" text="Vocaux 5 min" />
        <FeatureRow icon="🎨" text="Thèmes exclusifs" />
        <FeatureRow icon="✨" text="Badge 5²" />
      </View>

      <View style={styles.packages}>
        {monthlyPackage && (
          <PackageCard
            price={monthlyPackage.product.priceString}
            period="/mois"
            onPress={() => handlePurchase(monthlyPackage.identifier)}
            disabled={purchasing}
          />
        )}
        
        {annualPackage && (
          <PackageCard
            price={annualPackage.product.priceString}
            period="/an"
            badge="★ -33%"
            onPress={() => handlePurchase(annualPackage.identifier)}
            disabled={purchasing}
            highlighted
          />
        )}
      </View>

      <Text style={styles.trial}>7 jours d'essai offerts</Text>

      <TouchableOpacity onPress={handleRestore} style={styles.restore}>
        <Text style={styles.restoreText}>Restaurer un achat</Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

## 🚧 Paywall Design (Non-Agressif)

### Principes

1. **Jamais bloquant** — L'app reste 100% utilisable en gratuit
2. **Contextuel** — Apparaît quand c'est pertinent
3. **Dismissible** — Toujours un bouton "Non merci" visible
4. **Informatif** — Explique la valeur, ne culpabilise pas

### Soft Paywall (6ème contact)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│            Tu as atteint tes 5 contacts 🎯            │
│                                                         │
│  Cinq, c'est l'idée que 5 vrais proches suffisent.     │
│                                                         │
│  Mais si tu veux en garder plus, 5² te donne           │
│  25 slots pour tes proches.                            │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           [  Découvrir 5²  ]                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│              Non merci, je reste à 5                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Soft Paywall (Thème premium)

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│                  🎨 Thème "Aurore"                     │
│                                                         │
│      [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                │
│      [  Preview du thème avec gradient ]              │
│      [━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]                │
│                                                         │
│         Ce thème est exclusif aux membres 5²          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │     [  Débloquer avec 5²  ]   4,99€/mois      │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│              Voir les thèmes gratuits                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Settings avec statut Premium

### User Gratuit

```
┌────────────────────────────────────────────────────────┐
│  ⚙️ Réglages                                           │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Avatar]  @username                                  │
│            Plan : Gratuit                             │
│            Contacts : 4/5                             │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ ✨ Passer à 5² — 25 contacts, thèmes exclusifs │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  👤 Profil                                       →    │
│  🔔 Notifications                                →    │
│  🎨 Apparence                                    →    │
│  🔒 Confidentialité                              →    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### User Premium

```
┌────────────────────────────────────────────────────────┐
│  ⚙️ Réglages                                           │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Avatar]  @username  ✨                              │
│            Plan : 5² Premium                          │
│            Contacts : 12/25                           │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  ┌────────────────────────────────────────────────┐   │
│  │ ✨ 5² Premium actif                            │   │
│  │                                                │   │
│  │ Prochain renouvellement : 15 mars 2025        │   │
│  │ Plan : Annuel (39,99€/an)                     │   │
│  │                                                │   │
│  │ [Gérer l'abonnement]                          │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  👤 Profil                                       →    │
│  🔔 Notifications                                →    │
│  🎨 Apparence (8 thèmes)                        →    │
│  🔒 Confidentialité                              →    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Gestion de l'abonnement

```
┌────────────────────────────────────────────────────────┐
│  ← Retour              Mon abonnement 5²              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ✨ 5² Premium                                        │
│                                                        │
│  Status : Actif ✓                                     │
│  Plan : Annuel                                        │
│  Prix : 39,99€/an                                     │
│                                                        │
│  Membre depuis : 8 janvier 2025                       │
│  Prochain paiement : 8 janvier 2026                   │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  📧 Reçus envoyés à : email@example.com               │
│                                                        │
│  💳 Moyen de paiement : •••• 4242                     │
│     [Modifier]                                        │
│                                                        │
│  ─────────────────────────────────────────────────    │
│                                                        │
│  [Passer au plan mensuel]                             │
│                                                        │
│  [Annuler l'abonnement]                               │
│  L'accès reste actif jusqu'au 8 janvier 2026         │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

# 4. Plan d'Implémentation

## 📅 Sprint Planning

### Sprint 1 : Foundation (1 semaine)

**Backend :**
- [ ] Créer tables Supabase (`subscriptions`, `subscription_events`)
- [ ] Modifier trigger `check_contact_limit`
- [ ] Créer fonctions RPC (`is_user_premium`, `get_subscription_info`)
- [ ] Tester migrations

**Config :**
- [ ] Créer produits Stripe (test)
- [ ] Créer produits RevenueCat (test)
- [ ] Configurer webhooks (endpoints de test)

### Sprint 2 : Web Integration (1 semaine)

**Frontend Web :**
- [ ] Page `/premium` avec comparaison plans
- [ ] Intégration Stripe Checkout
- [ ] Webhook handler `/api/webhooks/stripe`
- [ ] Section premium dans Settings
- [ ] Soft paywalls (6ème contact, thèmes)

**Tests :**
- [ ] Flow complet en mode test Stripe
- [ ] Upgrade, downgrade, cancel
- [ ] Webhook reliability

### Sprint 3 : Mobile Integration (1 semaine)

**React Native :**
- [ ] Intégrer RevenueCat SDK
- [ ] Écran `PremiumScreen`
- [ ] Hook `usePurchases`
- [ ] Webhook handler `/api/webhooks/revenuecat`
- [ ] Sync avec Supabase

**Tests :**
- [ ] Sandbox iOS
- [ ] Sandbox Android
- [ ] Restore purchases

### Sprint 4 : Polish & Launch (1 semaine)

**UI/UX :**
- [ ] Badge 5² (design final)
- [ ] Animations upgrade
- [ ] Thèmes premium (8 nouveaux)
- [ ] Emails transactionnels (bienvenue, rappel, expiration)

**Ops :**
- [ ] Passage en production Stripe
- [ ] Passage en production RevenueCat
- [ ] Monitoring & alerting
- [ ] Documentation utilisateur

---

## 📁 Structure de fichiers proposée

```
cinq/
├── api/
│   ├── webhooks/
│   │   ├── stripe.js          # Webhook Stripe
│   │   ├── revenuecat.js      # Webhook RevenueCat
│   │   └── btcpay.js          # Webhook BTCPay (existant, à adapter)
│   └── subscription/
│       ├── status.js          # GET /api/subscription/status
│       ├── portal.js          # GET /api/subscription/portal (Stripe portal)
│       └── cancel.js          # POST /api/subscription/cancel
├── js/
│   ├── premium.js             # Logique page premium
│   └── premium-paywall.js     # Soft paywalls
├── premium.html               # Page upgrade
└── sql/
    └── premium-migration.sql  # Migration Supabase

cinq-mobile/
├── src/
│   ├── screens/
│   │   ├── PremiumScreen.tsx
│   │   └── PremiumSuccessScreen.tsx
│   ├── services/
│   │   └── purchases.ts       # RevenueCat service
│   ├── hooks/
│   │   └── usePurchases.ts
│   └── components/
│       ├── PremiumBadge.tsx
│       └── PaywallModal.tsx
```

---

## 🔐 Checklist Sécurité

- [ ] Webhooks signés et vérifiés
- [ ] RLS sur table `subscriptions` (read-only pour users)
- [ ] Pas de logique de billing côté client
- [ ] Logs d'audit pour chaque événement
- [ ] Rate limiting sur endpoints sensibles
- [ ] Validation des prix côté serveur (pas confiance au client)

---

## 📊 Métriques à tracker

| Métrique | Description | Objectif |
|----------|-------------|----------|
| Conversion Rate | % users gratuits → premium | > 5% |
| Trial Conversion | % essais → payants | > 40% |
| Churn Rate | % annulations / mois | < 5% |
| MRR | Revenue mensuel récurrent | Growth |
| LTV | Lifetime Value | > 100€ |
| ARPU | Revenue par user | > 2€ |

---

## ❓ Questions ouvertes

1. **Grandfathering** : Les early adopters gratuits gardent-ils un avantage ?
2. **Referral** : Bonus pour qui invite un premium ?
3. **Family Plan** : 5² pour 2-3 personnes à prix réduit ?
4. **Student Discount** : -50% pour étudiants ?

---

*Document créé le 1er février 2025*
*Auteur : Claude (subagent cinq-premium-brainstorm)*
