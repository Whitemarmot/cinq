# 🎉 Premium 5² Implementation Summary

## What's Implemented

### 1. Database Schema (`sql/premium-5squared.sql`)
- ✅ Added `is_premium` and `premium_since` columns to `users` table
- ✅ Created `purchases` table for tracking payments
- ✅ Updated `check_contact_limit()` trigger (5 free → 25 premium)
- ✅ Created `activate_premium()` function
- ✅ Created `get_premium_status()` RPC function

**Run this SQL in Supabase SQL Editor:**
```bash
cat sql/premium-5squared.sql
# Then copy-paste into Supabase → SQL Editor → Run
```

### 2. Backend Endpoints (Netlify Functions)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/create-checkout` | POST | Creates Stripe Checkout session |
| `/api/stripe-webhook` | POST | Handles Stripe payment confirmations |
| `/api/premium-status` | GET | Returns user's premium status |
| `/api/contacts` | ALL | Updated to respect dynamic limits |

### 3. Frontend

- ✅ **Settings page** (`settings.html`):
  - Premium section with status/upgrade card
  - Dynamic contact limit display
  - Checkout flow integration

- ✅ **Premium modal** (`js/premium.js`):
  - Soft paywall for 6th contact attempt
  - Upgrade flow with Stripe redirect
  - Status caching

- ✅ **App page** (`app.html`):
  - Shows premium upgrade modal when limit reached
  - Updated contact add logic

---

## Stripe Configuration

### Step 1: Create Stripe Product & Price

Go to [Stripe Dashboard](https://dashboard.stripe.com/products) → Products → Add product:

```
Name: 5² Premium
Description: 25 contacts à vie — L'upgrade définitif de Cinq
Price: 4.99 EUR (one-time payment)
```

### Step 2: Configure Webhook

Go to Stripe Dashboard → Developers → Webhooks → Add endpoint:

```
Endpoint URL: https://cinq.app/api/stripe-webhook
Events to listen:
  - checkout.session.completed
  - checkout.session.async_payment_succeeded
  - checkout.session.async_payment_failed
  - checkout.session.expired
  - charge.refunded
```

Save the **Webhook signing secret** (starts with `whsec_`).

### Step 3: Environment Variables

Add to Netlify Environment Variables:

```env
STRIPE_SECRET_KEY=sk_live_... (or sk_test_... for testing)
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_... (optional, not currently used)
```

---

## How It Works

### Upgrade Flow
1. User clicks "Passer à 5²" → `startPremiumCheckout()`
2. Frontend calls `/api/create-checkout`
3. Backend creates pending purchase record + Stripe Checkout session
4. User redirected to Stripe hosted checkout page
5. User pays → Stripe sends webhook to `/api/stripe-webhook`
6. Webhook verifies signature, activates premium
7. User redirected back to `/settings?premium=success`

### Contact Limit Logic
```javascript
// In contacts.js
const isPremium = userData?.is_premium || false;
const contactLimit = isPremium ? 25 : 5;
```

### Soft Paywall
When a free user tries to add a 6th contact:
1. API returns `{ code: 'LIMIT_REACHED', isPremium: false }`
2. Frontend shows `CinqPremium.showUpgradeModal('limit')`
3. User can upgrade or dismiss

---

## Testing

### Test Mode
Use Stripe test keys (sk_test_/pk_test_) for development.

Test card: `4242 4242 4242 4242`, any future date, any CVC.

### Manual Premium Activation
For testing without payment:
```sql
UPDATE users SET is_premium = true, premium_since = NOW() WHERE email = 'test@example.com';
```

---

## Files Changed

| File | Changes |
|------|---------|
| `sql/premium-5squared.sql` | New - schema migrations |
| `netlify/functions/create-checkout.js` | New - Stripe checkout |
| `netlify/functions/stripe-webhook.js` | New - webhook handler |
| `netlify/functions/premium-status.js` | New - status endpoint |
| `netlify/functions/contacts.js` | Modified - dynamic limits |
| `js/premium.js` | New - frontend premium module |
| `settings.html` | Modified - premium section |
| `app.html` | Modified - premium modal on limit |

---

## Pricing

- **Free**: 5 contacts
- **5² Premium**: 25 contacts — **4.99€ one-time payment**

No subscription, no recurring charges. Pay once, premium forever.
