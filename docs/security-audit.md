# 🔒 Audit de Sécurité — Cinq

> **Auditeur :** Zoé (Agent Critique/Sécurité)  
> **Date :** 2025-01-31  
> **Version SPEC analysée :** 2026-01-31  
> **Verdict global :** ⚠️ PRÉOCCUPANT — Architecture prometteuse mais sous-spécifiée

---

## 📋 Résumé Exécutif

Le SPEC.md annonce des objectifs de sécurité ambitieux (zero-knowledge, E2E, anti-surveillance) mais reste dangereusement vague sur l'implémentation. Les formulations actuelles relèvent davantage du **marketing sécuritaire** que d'une **architecture cryptographique solide**.

**Score de maturité sécurité : 2/5** — Intentions bonnes, spécifications insuffisantes.

---

## 🚨 Partie 1 : Failles Architecture (3 critiques)

### FAILLE #1 — Zero-Knowledge Illusoire

**Citation SPEC :**
> *"Zero-knowledge sur les graphes sociaux (contacts hashés côté client)"*

**Problème :**  
Le hashing côté client **ne garantit aucun zero-knowledge**. C'est un mythe de sécurité amateur.

- Si le serveur connaît les identifiants de tous les utilisateurs (ce qui est inévitable pour router les messages)
- Il peut hasher ces identifiants lui-même
- Et comparer avec les hashes stockés pour **reconstruire 100% du graphe social**

C'est comme mettre un cadenas sur une porte vitrée. Ça rassure, mais ça ne protège rien.

**Exemple d'attaque :**
```
User A envoie hash(contact_B) au serveur
Serveur connaît tous les user_ids
Serveur calcule : for user in users: if hash(user) == hash_reçu → MATCH
Résultat : Le serveur sait que A connaît B
```

**Impact :** 🔴 CRITIQUE  
Toute l'architecture "anti-surveillance" s'effondre. Un serveur compromis (ou une injonction légale) expose l'intégralité du graphe social.

---

### FAILLE #2 — Signal Protocol Sans Gestion de Clés

**Citation SPEC :**
> *"Signal Protocol (Double Ratchet + X3DH) pour chiffrement E2E"*

**Problème :**  
Le SPEC mentionne Signal Protocol sans spécifier :

- **Génération des clés** — Qui génère les identity keys? Comment sont-elles vérifiées?
- **Distribution des prekeys** — Le serveur les stocke? C'est un vecteur MITM classique
- **Révocation** — Que se passe-t-il si un device est compromis?
- **Multi-device** — Comment synchroniser sans créer de point faible central?

Signal Protocol est un *protocole*, pas une solution clé-en-main. Son implémentation est **la partie difficile** et elle n'est pas documentée.

**Vecteur d'attaque :**
Un serveur malveillant pourrait substituer les prekeys publiques et effectuer une attaque MITM sur la première connexion entre deux users.

**Impact :** 🔴 CRITIQUE  
Sans spécification de la PKI (Public Key Infrastructure), le E2E peut être contourné silencieusement.

---

### FAILLE #3 — Fédération = Surface d'Attaque Multipliée

**Citation SPEC :**
> *"Fédération chiffrée — Pods de ~10K users max"*

**Problème :**  
La fédération est mentionnée comme feature mais c'est un **cauchemar de sécurité** non adressé :

- **Trust inter-pods** — Comment un pod fait-il confiance à un autre? Qui certifie quoi?
- **Routing** — Le routage entre pods révèle des métadonnées (qui parle à qui entre pods)
- **Compromission en cascade** — Un pod compromis peut-il empoisonner les autres?
- **Juridiction** — Pods dans différents pays = différentes obligations légales

**Analogie :** C'est comme dire "on aura plusieurs coffres-forts" sans préciser qui a les clés, qui les fabrique, et comment ils communiquent.

**Impact :** 🟠 ÉLEVÉ  
Chaque pod ajouté multiplie la surface d'attaque. Sans modèle de confiance défini, la fédération est un liability, pas un feature.

---

## 💸 Partie 2 : Vecteurs d'Attaque Gift Model (3 critiques)

### ATTAQUE #1 — Sybil Attacks par Achat Massif

**Le problème :**  
15€ c'est pas cher pour un attaquant motivé. Rien n'empêche de :

- Acheter 100 codes cadeaux
- Créer 100 comptes factices
- Mapper le réseau en se faisant inviter par des vrais users
- Ou simplement spammer/polluer la plateforme

**Scénario concret :**
```
Attaquant : Achète 50 codes (750€)
Attaquant : Crée 50 profils "attractifs"  
Attaquant : Se fait ajouter comme contact par des vrais users
Résultat : Cartographie du réseau, données personnelles, ou juste chaos
```

**Le Gift Model ne vérifie pas QUI offre à QUI.** Il vérifie juste qu'un paiement a eu lieu.

**Impact :** 🔴 CRITIQUE  
Le filtre anti-spam repose sur l'hypothèse que "payer = être de bonne foi". C'est faux.

---

### ATTAQUE #2 — Marché Noir de Codes

**Le problème :**  
Sans liaison cryptographique entre le payeur et le bénéficiaire, les codes sont **fongibles et revendables**.

**Scénarios :**
1. **Arbitrage** — Acheter des codes en promo/hack, revendre moins cher
2. **Blanchiment** — Utiliser des cryptos volées pour acheter des codes "propres"
3. **Scalping** — Si Cinq devient désirable, les codes deviennent un actif spéculatif
4. **Phishing** — "Codes Cinq gratuits ici!" → vol de données

**Conséquence :**  
Le Gift Model perd sa valeur symbolique ("quelqu'un a payé pour toi") si le "quelqu'un" est un bot sur Telegram qui vend des codes volés.

**Impact :** 🟠 ÉLEVÉ  
Destruction de la proposition de valeur + risque réputationnel.

---

### ATTAQUE #3 — Bruteforce de Codes Cadeaux

**Le problème :**  
Le SPEC ne spécifie pas le format des codes cadeaux.

**Si les codes sont :**
- Courts (type `ABCD-1234`) → Bruteforcable
- Prévisibles (timestamp-based) → Devinables
- Sans rate-limiting → Énumérable en masse

**Calcul :**
```
Code alphanumérique 8 caractères = 36^8 = 2.8 trillion combinaisons
MAIS avec 1000 requêtes/seconde et aucun rate limit = problème
MAIS SURTOUT si pattern prévisible = catastrophe
```

**Impact :** 🟠 ÉLEVÉ  
Codes gratuits = effondrement du modèle économique.

---

## ✅ Partie 3 : Recommandations Concrètes

### Pour FAILLE #1 (Zero-Knowledge Illusoire)

| Recommandation | Difficulté | Priorité |
|----------------|------------|----------|
| **Implémenter Private Set Intersection (PSI)** | 🔴 Haute | P0 |
| Utiliser des Bloom Filters chiffrés homomorphiquement | 🔴 Haute | P1 |
| Ou abandonner la prétention "zero-knowledge" (honnêteté > marketing) | 🟢 Facile | P0 |

**Option réaliste :** Adopter le modèle Signal — le serveur connaît les identifiants mais pas le contenu. C'est honnête et ça marche.

---

### Pour FAILLE #2 (Signal Protocol Sans PKI)

| Recommandation | Difficulté | Priorité |
|----------------|------------|----------|
| **Utiliser libsignal directement** (ne pas réinventer) | 🟡 Moyenne | P0 |
| Implémenter Safety Numbers comme Signal | 🟡 Moyenne | P0 |
| Documenter TOUTE la gestion de clés dans un doc séparé | 🟢 Facile | P0 |
| Key transparency log public (à la Google) | 🔴 Haute | P2 |

**Action immédiate :** Créer `/docs/CRYPTO.md` avec :
- Flow de génération de clés
- Stockage des prekeys
- Procédure de vérification
- Plan de révocation

---

### Pour FAILLE #3 (Fédération Non Spécifiée)

| Recommandation | Difficulté | Priorité |
|----------------|------------|----------|
| **Reporter la fédération post-MVP** | 🟢 Facile | P0 |
| Si maintenue : définir modèle de confiance explicite | 🔴 Haute | P1 |
| Étudier les erreurs de Matrix/XMPP | 🟢 Facile | P1 |

**Conseil stratégique :** La fédération est un piège à complexité. Signal a réussi SANS fédération. Commencer centralisé, décentraliser plus tard si vraiment nécessaire.

---

### Pour ATTAQUE #1 (Sybil via Achat Massif)

| Recommandation | Difficulté | Priorité |
|----------------|------------|----------|
| **Rate limiting : 1 achat/wallet/24h** | 🟢 Facile | P0 |
| Prix progressif : 15€ → 30€ → 60€ pour achats multiples | 🟡 Moyenne | P1 |
| Proof of Humanity (optionnel, avec World ID ou Gitcoin Passport) | 🔴 Haute | P2 |
| Graph analysis : détecter patterns de Sybil post-hoc | 🟡 Moyenne | P2 |

---

### Pour ATTAQUE #2 (Marché Noir de Codes)

| Recommandation | Difficulté | Priorité |
|----------------|------------|----------|
| **Code lié cryptographiquement au wallet payeur** | 🟡 Moyenne | P0 |
| Afficher "Offert par [pseudonyme]" dans l'app | 🟢 Facile | P0 |
| Délai d'activation 48h (temps de signaler fraude) | 🟢 Facile | P1 |
| Blacklist de wallets suspects | 🟡 Moyenne | P1 |

**Idée bonus :** Le payeur doit signer cryptographiquement l'invitation avec son wallet. Impossible à revendre sans la clé privée.

---

### Pour ATTAQUE #3 (Bruteforce Codes)

| Recommandation | Difficulté | Priorité |
|----------------|------------|----------|
| **Codes 256 bits (UUID v4 ou mieux)** | 🟢 Facile | P0 |
| Rate limiting brutal : 5 essais/IP/heure | 🟢 Facile | P0 |
| CAPTCHA après 2 échecs | 🟢 Facile | P0 |
| Expiration des codes (7 jours) | 🟢 Facile | P1 |
| Alerting sur patterns de bruteforce | 🟡 Moyenne | P1 |

---

## 🎯 Plan d'Action Prioritaire

```
SEMAINE 1 (Blockers MVP)
├── [ ] Abandonner ou spécifier "zero-knowledge" 
├── [ ] Documenter gestion de clés (CRYPTO.md)
├── [ ] Spécifier format codes cadeaux (256 bits min)
└── [ ] Rate limiting sur génération/activation codes

SEMAINE 2 (Hardening)
├── [ ] Lier codes au wallet payeur
├── [ ] Rate limit achats par wallet
├── [ ] CAPTCHA sur activation
└── [ ] Décider explicitement : fédération oui/non pour MVP

SEMAINE 3+ (Défense en profondeur)
├── [ ] Monitoring patterns Sybil
├── [ ] Safety Numbers (vérification clés)
├── [ ] Audit externe du code crypto
└── [ ] Bug bounty program
```

---

## 💀 Conclusion Impitoyable

Le SPEC.md a le cœur à la bonne place mais la tête dans les nuages.

**Ce qui est bien :**
- Conscience des enjeux (anti-surveillance, anti-addiction)
- Choix de Signal Protocol (bon standard)
- Business model innovant

**Ce qui est dangereux :**
- Promesses de sécurité sans implémentation spécifiée
- "Zero-knowledge" utilisé comme buzzword
- Fédération mentionnée sans modèle de menace
- Gift Model vulnérable aux abus économiques

**Ma recommandation :**
> Réduire les ambitions de sécurité du MVP. Promettre moins, livrer plus. Un système "honnêtement centralisé" avec du vrai E2E est meilleur qu'un système "pseudo-décentralisé zero-knowledge" qui est en fait une passoire.

Le pire scénario : lancer avec des promesses de confidentialité qu'on ne peut pas tenir, subir une breach, et détruire la confiance à jamais.

---

*"La sécurité n'est pas un feature, c'est une propriété émergente d'une architecture bien pensée."*

— Zoé, Agent Critique 🔐
