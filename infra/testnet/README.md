# 🧪 BTCPay Server Testnet - Cinq

Déploiement rapide de BTCPay Server sur Bitcoin testnet pour tester les paiements.

## ⚡ Quickstart (10 minutes)

### Option A: Ultra-rapide (BTCPay seul)

```bash
cd /home/node/clawd/projects/cinq/infra/testnet
chmod +x deploy-testnet.sh
./deploy-testnet.sh quick
```

**Résultat:** BTCPay accessible sur http://localhost:49392 en ~2 minutes.

> ⚠️ Mode "quick" = pas de noeud Bitcoin local. Parfait pour tester l'interface et l'API.

### Option B: Stack complète

```bash
./deploy-testnet.sh full
```

**Résultat:** Stack complète avec Bitcoin Core testnet + LND Lightning.

> ⏱️ La sync blockchain testnet prend 2-6 heures selon la connexion.

---

## 📋 Étapes détaillées

### 1. Prérequis (2 min)

```bash
# Vérifier Docker
docker --version  # >= 24.0
docker compose version  # >= 2.20

# Si pas installé:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Déconnecter/reconnecter
```

### 2. Déployer (3 min)

```bash
cd /home/node/clawd/projects/cinq/infra/testnet

# Rendre exécutable
chmod +x deploy-testnet.sh

# Lancer (génère automatiquement les secrets)
./deploy-testnet.sh quick
```

### 3. Configuration initiale BTCPay (5 min)

1. **Ouvrir** http://localhost:49392
2. **Créer un compte admin** (premier utilisateur = admin)
3. **Créer un Store:**
   - Settings → Stores → Create Store
   - Nom: "Cinq Test Store"
4. **Configurer le wallet:**
   - Store Settings → Wallets → Bitcoin → Setup
   - Choisir "Create new wallet" ou importer une seed testnet

### 4. Obtenir des testnet BTC

Faucets gratuits:
- https://coinfaucet.eu/en/btc-testnet/
- https://testnet-faucet.mempool.co/
- https://bitcoinfaucet.uo1.net/

### 5. Tester un paiement

```bash
# Créer une invoice via API
curl -X POST http://localhost:49392/api/v1/stores/YOUR_STORE_ID/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n 'admin@email.com:password' | base64)" \
  -d '{"amount": "0.0001", "currency": "BTC"}'
```

Ou via l'interface: Store → Invoices → Create Invoice

---

## 🔧 Commandes utiles

```bash
# Status des services
./deploy-testnet.sh status

# Voir les logs
./deploy-testnet.sh logs
./deploy-testnet.sh logs btcpayserver

# Arrêter
./deploy-testnet.sh stop

# Nettoyer tout (reset complet)
./deploy-testnet.sh cleanup
```

---

## 🌐 Déploiement avec domaine public

Pour exposer BTCPay sur Internet avec HTTPS automatique:

```bash
# Configurer le domaine
./deploy-testnet.sh full --host btcpay-test.votredomaine.com

# S'assurer que le DNS pointe vers votre serveur
# Traefik génère automatiquement le certificat Let's Encrypt
```

Modifier `.env` si besoin:
```bash
BTCPAY_HOST=btcpay-test.votredomaine.com
BTCPAY_PROTOCOL=https
ACME_EMAIL=votre@email.com
```

---

## 🔌 Intégration API

### Authentification

BTCPay supporte plusieurs méthodes:
- **API Key** (recommandé): Store Settings → Access Tokens
- **Basic Auth**: Avec credentials du compte

### Endpoints utiles

```bash
# Health check
curl http://localhost:49392/api/v1/health

# Info serveur
curl http://localhost:49392/api/v1/server/info

# Créer invoice
curl -X POST http://localhost:49392/api/v1/stores/{storeId}/invoices \
  -H "Authorization: token YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"amount": "10", "currency": "USD"}'

# Webhook pour notifications
# Configurer dans Store Settings → Webhooks
```

### SDK disponibles

- **JavaScript:** `btcpay-greenfield-node-client`
- **Python:** `btcpay-python`
- **PHP:** `btcpayserver/btcpayserver-greenfield-php`

---

## 🐛 Troubleshooting

### BTCPay ne démarre pas

```bash
# Vérifier les logs
docker compose -p cinq-testnet logs btcpayserver

# Problème fréquent: PostgreSQL pas prêt
docker compose -p cinq-testnet restart btcpayserver
```

### Erreur de connexion à NBXplorer

```bash
# Vérifier que Bitcoin Core est synced
docker compose -p cinq-testnet exec bitcoind bitcoin-cli -testnet getblockchaininfo

# NBXplorer attend que Bitcoin soit synced
docker compose -p cinq-testnet logs nbxplorer
```

### Reset complet

```bash
./deploy-testnet.sh cleanup  # Supprime tout
./deploy-testnet.sh quick    # Redémarre from scratch
```

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        TESTNET STACK                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌─────────┐    ┌─────────────┐    ┌─────────────────┐   │
│   │ Traefik │───▶│ BTCPay      │───▶│ PostgreSQL      │   │
│   │ :80/443 │    │ Server      │    │ (données)       │   │
│   └─────────┘    └──────┬──────┘    └─────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│                  ┌─────────────┐                           │
│                  │ NBXplorer   │                           │
│                  │ (indexeur)  │                           │
│                  └──────┬──────┘                           │
│                         │                                   │
│            ┌────────────┴────────────┐                     │
│            ▼                         ▼                     │
│     ┌─────────────┐          ┌─────────────┐              │
│     │ Bitcoin     │          │ LND         │              │
│     │ Core        │◀─────────│ Lightning   │              │
│     │ (testnet)   │          │             │              │
│     └─────────────┘          └─────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ Checklist de test

- [ ] BTCPay accessible sur localhost:49392
- [ ] Compte admin créé
- [ ] Store créé
- [ ] Wallet testnet configuré
- [ ] Reçu des testnet BTC du faucet
- [ ] Invoice créée et affichée
- [ ] Paiement test envoyé
- [ ] Webhook reçu (si configuré)

---

## 📚 Ressources

- [BTCPay Server Docs](https://docs.btcpayserver.org/)
- [API Reference](https://docs.btcpayserver.org/API/Greenfield/v1/)
- [Bitcoin Testnet Explorer](https://blockstream.info/testnet/)
- [LND Documentation](https://docs.lightning.engineering/)
