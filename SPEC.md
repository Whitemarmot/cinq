# Cinq — Spécifications Produit

> *L'anti-réseau social. 5 proches. Zéro bullshit.*

---

## 🎯 Vision

Un réseau social qui combat l'addiction, la superficialité et la course aux likes. Cinq te limite à **5 contacts** — les gens qui comptent vraiment.

**Tagline :** *"L'app qui veut que tu la fermes."*

---

## 🧠 Principes Fondateurs

1. **Anti-viralité** — Pas de "invite tes amis", pas de share-to-unlock
2. **Anti-addiction** — Pas de notifications anxiogènes, pas de métriques visibles
3. **Anti-surveillance** — Chiffrement E2E, zéro tracking, architecture zero-knowledge
4. **Pro-intention** — Chaque interaction doit être consciente et voulue

---

## 💰 Business Model

### Gift Model — 15€ (~16 USDC)

**Tu ne t'inscris pas. On t'offre Cinq.**

- Impossible de créer un compte seul
- Quelqu'un doit payer 15€ pour t'offrir l'accès
- Filtre naturel : chaque user existe parce qu'il compte pour quelqu'un

### Paiement Crypto Only

| Crypto | Réseau | Pourquoi |
|--------|--------|----------|
| USDC | Base | Stablecoin, pas de volatilité |
| BTC | Lightning | Instantané, frais nuls |
| ETH | Base | Le plus connu |

**Infra :** BTCPay Server (self-hosted, open source, zéro KYC)

### Évolutions futures
- **Cinq Vault** (5€/mois) — Coffre-fort chiffré pour documents sensibles
- **API B2B** — Stack crypto en white-label

---

## 🎨 UX/Design (Alex)

### Règles
- **5 contacts max** — Le choix doit être "douloureux" (intentionnel)
- **Zéro notification anxiogène** — Pas de badges rouges, pas de compteurs
- **Limites zen** — Affichées comme un jardin, pas une prison
- **Silence confortable** — L'absence de message n'est pas un problème

### Fonctionnalités Core
- 📸 Partage photo/texte simple
- 🎯 "Ping" — Juste dire "je pense à toi"
- 📍 Localisation ponctuelle ("je suis là si tu veux passer")
- 🗓️ "Moment" — Proposer un RDV à son cercle

### Question clé à résoudre
> Que se passe-t-il quand quelqu'un veut ajouter un 6ème contact ?

---

## 🔐 Backend/Sécurité (Sarah)

### Architecture
- **Signal Protocol** (Double Ratchet + X3DH) pour chiffrement E2E
- **Zero-knowledge** sur les graphes sociaux (contacts hashés côté client)
- **Identifiants éphémères rotatifs** — Même les métadonnées sont toxiques pour un attaquant
- **Fédération chiffrée** — Pods de ~10K users max

### Stack proposée
- **Langage :** Rust ou Go pour le core crypto
- **Base de données :** PostgreSQL + chiffrement au repos
- **Paiements :** BTCPay Server (Docker)

---

## 📈 Growth (Marco)

### Stratégie anti-virale
1. **5 invitations par jour max** — On ne grandit pas vite, on grandit bien
2. **Guérilla IRL** — Affiches minimalistes, pas de QR, ceux qui cherchent trouvent
3. **Déserteurs** — Cibler créateurs épuisés par l'algorithme

### Le paradoxe comme arme
> Moins on pousse, plus ça intrigue.

---

## ⚠️ Risques identifiés (Zoé)

1. **Paradoxe croissance** — Comment acquérir des users sans viralité ?
   → *Réponse : Gift Model = croissance intentionnelle*

2. **Anxiété du choix** — "Pourquoi je suis pas dans tes 5 ?"
   → *Réponse : UX zen, pas de pression sociale visible*

3. **Risque d'ennui** — Zéro boucle de rétention
   → *Réponse : La valeur est dans la qualité, pas la quantité*

### Pièges à éviter
- ❌ "Gratuit parce qu'on est gentils" (cf. Cloak)
- ❌ "Investisseurs éthiques" (cf. Headspace)
- ❌ "Les gens paieront par conviction" (cf. App.net)

---

## 🚀 Roadmap MVP

### Phase 1 — Landing + Waitlist ✅
- [x] Landing page
- [x] Supabase waitlist
- [x] GitHub Pages hosting

### Phase 2 — Gift System
- [ ] BTCPay Server setup
- [ ] Page "Offrir un accès"
- [ ] Génération de codes cadeaux
- [ ] Flow d'activation

### Phase 3 — App Core
- [ ] Auth (code cadeau uniquement)
- [ ] Profil + 5 contacts max
- [ ] Messagerie E2E basique
- [ ] Ping / Présence

### Phase 4 — Polish
- [ ] Apps mobiles (React Native ou Flutter)
- [ ] Vault chiffré (premium)
- [ ] Fédération multi-pods

---

## 👥 L'Équipe

| Agent | Rôle | Focus |
|-------|------|-------|
| **Kempfr** | Lead / Coordination | Vision + Exécution |
| **Alex** | UX/Product Design | Expérience + Contraintes zen |
| **Sarah** | Backend/Sécurité | Crypto + Zero-knowledge |
| **Marco** | Growth/Marketing | Anti-viralité + Guérilla |
| **Zoé** | Critique | Devil's advocate |

---

## 📝 Décisions clés

| Sujet | Décision | Date |
|-------|----------|------|
| Business Model | Gift Model 15€ | 2026-01-31 |
| Paiement | Crypto only (USDC/BTC/ETH) | 2026-01-31 |
| Infra paiement | BTCPay self-hosted | 2026-01-31 |
| Limite contacts | 5 max | 2026-01-31 |

---

*Document vivant. Dernière mise à jour : 2026-01-31*
