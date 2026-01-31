# 🚀 Checklist de Lancement MVP — Cinq

> **Auditrice :** Zoé (Agent Critique)  
> **Date :** 2025-01-31  
> **Objectif :** Zéro oubli, zéro regret

---

## 📋 Vue d'ensemble

Cette checklist couvre **tout** ce qui doit être vérifié avant, pendant et après le lancement du MVP. Chaque item non coché est un risque potentiel.

**Légende :**
- 🔴 **Bloquant** — Pas de lancement sans ça
- 🟠 **Critique** — À faire dans les 48h post-lancement max
- 🟡 **Important** — Semaine 1
- ⬜ Non commencé | ✅ Fait | ⏳ En cours

---

## 🔧 Partie 1 : Checklist Technique (15 items)

### Infrastructure & Déploiement

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| T1 | **Domaine configuré et SSL actif** | 🔴 | ⬜ | cinq.app avec HTTPS forcé |
| T2 | **DNS propagé et testé** | 🔴 | ⬜ | Vérifier avec `dig` + navigateurs multiples |
| T3 | **Variables d'environnement en production** | 🔴 | ⬜ | Jamais de secrets en clair dans le repo |
| T4 | **Backup Supabase configuré** | 🔴 | ⬜ | Point-in-time recovery activé |
| T5 | **Monitoring uptime actif** | 🟠 | ⬜ | UptimeRobot, Pingdom, ou Better Uptime |

### Backend & API

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| T6 | **Rate limiting sur toutes les routes API** | 🔴 | ⬜ | Particulièrement `/api/waitlist` |
| T7 | **Validation des inputs côté serveur** | 🔴 | ⬜ | Email format, longueur max, sanitization |
| T8 | **Gestion d'erreurs propre** | 🔴 | ⬜ | Pas de stack traces en prod |
| T9 | **CORS configuré correctement** | 🔴 | ⬜ | Whitelist des domaines autorisés |
| T10 | **Headers de sécurité HTTP** | 🟠 | ⬜ | CSP, X-Frame-Options, X-Content-Type-Options |

### Frontend & UX

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| T11 | **Tests cross-browser effectués** | 🟠 | ⬜ | Chrome, Firefox, Safari, Edge + Mobile |
| T12 | **Performance testée (Lighthouse > 90)** | 🟡 | ⬜ | Objectif : score perf > 90 |
| T13 | **Favicon et meta tags OG complets** | 🟡 | ⬜ | Preview correct sur Twitter/Discord |
| T14 | **404 page personnalisée** | 🟡 | ⬜ | Pas de page Vercel/Netlify générique |
| T15 | **Analytics configuré (privacy-first)** | 🟡 | ⬜ | Plausible ou Fathom, PAS Google Analytics |

### Intégrations Critiques (BTCPay - Phase 2)

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| T16 | **BTCPay Server déployé et sécurisé** | 🔴* | ⬜ | *Pour Phase 2 Gift Model |
| T17 | **Webhooks BTCPay → Backend configurés** | 🔴* | ⬜ | Vérification signature HMAC |
| T18 | **Génération codes cadeaux cryptographique** | 🔴* | ⬜ | UUID v4 minimum, idéalement 256 bits |
| T19 | **Test complet du flow d'achat** | 🔴* | ⬜ | Achat → Réception code → Activation |

---

## 🔐 Partie 2 : Checklist Sécurité (10 items)

### Authentification & Accès

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| S1 | **Clés API Supabase : anon vs service role** | 🔴 | ⬜ | anon key côté client UNIQUEMENT |
| S2 | **Row Level Security (RLS) activé** | 🔴 | ⬜ | Chaque table doit avoir des policies |
| S3 | **Pas de secrets dans le frontend** | 🔴 | ⬜ | Audit du code JS bundle |
| S4 | **2FA sur tous les comptes admin** | 🔴 | ⬜ | Supabase, Vercel, GitHub, registrar domaine |
| S5 | **Principe du moindre privilège** | 🟠 | ⬜ | Chaque service = permissions minimales |

### Protection contre les abus

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| S6 | **Anti-bot sur formulaires** | 🟠 | ⬜ | Honeypot field + rate limit |
| S7 | **Logs d'accès et alertes** | 🟠 | ⬜ | Détecter patterns suspects |
| S8 | **Injection SQL impossible** | 🔴 | ⬜ | Utiliser les query builders Supabase |
| S9 | **XSS protection** | 🔴 | ⬜ | Escape tous les outputs utilisateur |
| S10 | **Dependency audit** | 🟡 | ⬜ | `npm audit` sans vulnérabilités critiques |

### Crypto & Chiffrement (Phase 2+)

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| S11 | **Clés privées JAMAIS sur le serveur** | 🔴* | ⬜ | Génération côté client uniquement |
| S12 | **libsignal intégré correctement** | 🔴* | ⬜ | Pas de crypto maison |
| S13 | **Key verification UX** | 🟠* | ⬜ | Safety Numbers à la Signal |

---

## ⚖️ Partie 3 : Checklist Légale (12 items)

### RGPD (Obligatoire en Europe)

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| L1 | **Politique de confidentialité publiée** | 🔴 | ⬜ | URL : `/privacy` |
| L2 | **Base légale définie pour chaque traitement** | 🔴 | ⬜ | Waitlist = consentement explicite |
| L3 | **Registre des traitements documenté** | 🟠 | ⬜ | Même léger, il faut un document |
| L4 | **Durée de conservation définie** | 🔴 | ⬜ | Ex: emails waitlist supprimés après 2 ans |
| L5 | **Mécanisme de désinscription** | 🔴 | ⬜ | Lien dans chaque email + page dédiée |
| L6 | **Mention du transfert hors UE** | 🟠 | ⬜ | Si Vercel US, Supabase US → le mentionner |
| L7 | **Contact DPO ou responsable** | 🟠 | ⬜ | Email de contact obligatoire |

### CGU & Mentions Légales

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| L8 | **Conditions Générales d'Utilisation** | 🔴 | ⬜ | URL : `/terms` |
| L9 | **Mentions légales (éditeur, hébergeur)** | 🔴 | ⬜ | Obligatoire en France |
| L10 | **Âge minimum défini** | 🟠 | ⬜ | 16 ans minimum recommandé (RGPD) |

### Spécifique Crypto (⚠️ Zone grise)

| # | Item | Priorité | Statut | Notes |
|---|------|----------|--------|-------|
| L11 | **Disclaimer "pas un conseil financier"** | 🔴 | ⬜ | Obligatoire dès qu'on parle crypto |
| L12 | **Enregistrement PSAN vérifié** | 🔴 | ⬜ | **ATTENTION** : En France, recevoir des paiements crypto peut nécessiter un enregistrement AMF |
| L13 | **CGU spécifiques aux paiements crypto** | 🔴 | ⬜ | Non-remboursable, volatilité, risques |
| L14 | **Facturation / Reçus** | 🟠 | ⬜ | Même en crypto, obligation comptable |
| L15 | **KYC/AML si seuils dépassés** | 🟡 | ⬜ | Surveiller les seuils réglementaires |

### ⚠️ Alerte PSAN (Prestataire de Services sur Actifs Numériques)

> **ATTENTION CRITIQUE** : En France, toute entreprise qui reçoit des paiements en crypto pour vendre un service peut être qualifiée de PSAN et doit s'enregistrer auprès de l'AMF.
>
> **Recommandation :** Consulter un avocat spécialisé crypto AVANT le lancement du Gift Model.
>
> **Alternatives possibles :**
> - Opérer depuis une juridiction plus souple (Suisse, Portugal)
> - Utiliser un processeur de paiement crypto déjà enregistré
> - Convertir immédiatement en fiat via un exchange régulé

---

## 🚨 Partie 4 : Red Flags Post-Lancement (15 alertes)

### Signaux d'abus à surveiller

| # | Red Flag | Seuil d'alerte | Action |
|---|----------|----------------|--------|
| R1 | **Inscriptions en rafale** | >100/heure | Rate limit + CAPTCHA |
| R2 | **Même IP pour inscriptions multiples** | >5/IP/jour | Bloquer IP temporairement |
| R3 | **Emails jetables (tempmail, etc.)** | >10%/jour | Blacklist domaines jetables |
| R4 | **Échecs de validation codes** | >50/heure | Potentiel bruteforce |
| R5 | **Wallets blacklistés** | Toute transaction | Utiliser Chainalysis ou similaire |

### Signaux techniques

| # | Red Flag | Seuil d'alerte | Action |
|---|----------|----------------|--------|
| R6 | **Latence API > 2s** | P95 > 2s | Investiguer DB/infra |
| R7 | **Taux d'erreur 5xx** | >1% | Alerter on-call |
| R8 | **Certificat SSL expire** | <14 jours | Renouveler immédiatement |
| R9 | **Espace disque/DB** | >80% | Augmenter ou purger |
| R10 | **Dépendances vulnérables** | Critical CVE | Patch dans les 24h |

### Signaux business

| # | Red Flag | Seuil d'alerte | Action |
|---|----------|----------------|--------|
| R11 | **Taux de conversion waitlist → achat < 1%** | Après 1000 inscrits | Revoir le pricing/messaging |
| R12 | **Codes générés mais non activés > 50%** | Après 1 semaine | UX d'activation à revoir |
| R13 | **Plaintes RGPD / Emails abuse** | Toute plainte | Traiter sous 72h |
| R14 | **Mentions négatives sur Twitter/Reddit** | Tendance | Répondre + corriger |
| R15 | **Concurrence copie le modèle** | Détection | Accélérer les features différenciantes |

### Dashboard de monitoring recommandé

```
┌─────────────────────────────────────────────────────┐
│  📊 Cinq — Monitoring Post-Lancement               │
├──────────────┬──────────────┬──────────────────────┤
│ Inscriptions │ 0 today      │ 🟢 Normal            │
│ Erreurs API  │ 0.1%         │ 🟢 OK                │
│ Uptime       │ 99.9%        │ 🟢 OK                │
│ Latence P95  │ 450ms        │ 🟢 OK                │
│ Codes actifs │ 0            │ ⚪ Phase 2           │
│ Alertes sécu │ 0            │ 🟢 RAS               │
└──────────────┴──────────────┴──────────────────────┘
```

---

## ✅ Récapitulatif Pré-Lancement

### Must-Have (🔴 Bloquants)

```
AVANT DE LANCER :
├── [ ] T1-T4   : Infra OK (domaine, SSL, env, backup)
├── [ ] T6-T9   : API sécurisée (rate limit, validation, CORS)
├── [ ] S1-S4   : Accès sécurisés (RLS, secrets, 2FA)
├── [ ] S8-S9   : Injections impossibles (SQL, XSS)
├── [ ] L1, L8  : Légal minimum (privacy, terms)
├── [ ] L11-L13 : Mentions crypto obligatoires
└── [ ] R1-R5   : Monitoring abus en place
```

### Validation finale

| Validation | Responsable | Signature |
|------------|-------------|-----------|
| Technique OK | Sarah | ⬜ |
| Sécurité OK | Zoé | ⬜ |
| Légal OK | Conseil juridique | ⬜ |
| UX OK | Alex | ⬜ |
| Business OK | Marco | ⬜ |
| **GO LAUNCH** | Kempfr | ⬜ |

---

## 📅 Calendrier type

```
J-7   : Tous les items 🔴 doivent être ✅
J-3   : Freeze du code, tests finaux
J-1   : Répétition générale, backup vérifié
J0    : Lancement (heure creuse recommandée)
J+1   : Monitoring intensif, réponse rapide
J+7   : Revue post-mortem, items 🟠 closés
J+30  : Audit sécurité externe si budget
```

---

## 💡 Notes de Zoé

> **Mon avis de critique :**
>
> 1. **Le PSAN est LE risque juridique n°1.** Ne pas le sous-estimer. 750K€ d'amende possible.
>
> 2. **Lancer la landing + waitlist = OK.** C'est low-risk.
>    Lancer le Gift Model crypto = HIGH RISK sans validation juridique.
>
> 3. **Prévoir un "kill switch"** — Si ça part en vrille, pouvoir couper le service en 5 minutes.
>
> 4. **Premier utilisateur ≠ premier client.** Tester le flow complet avec de l'argent réel (le vôtre) avant d'accepter celui des autres.
>
> 5. **Documentation = assurance vie.** Si un dev disparaît, quelqu'un d'autre peut reprendre.

---

*"On ne lance pas une fusée avec un check-list incomplet."*

— Zoé 🔐

---

*Dernière mise à jour : 2025-01-31*
