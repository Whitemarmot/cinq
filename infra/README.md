# 🔧 BTCPay Server - Infrastructure Cinq

Stack complète pour accepter les paiements Bitcoin, Lightning et USDC.

## 📦 Composants

| Service | Description |
|---------|-------------|
| **BTCPay Server** | Interface de paiement |
| **PostgreSQL** | Base de données |
| **Bitcoin Core** | Nœud Bitcoin complet |
| **NBXplorer** | Indexeur blockchain |
| **LND** | Lightning Network |

---

## 🚀 Déploiement en 5 étapes

### 1️⃣ Configurer l'environnement
```bash
cd /home/node/clawd/projects/cinq/infra
cp .env.example .env
nano .env  # Modifier les mots de passe!
```

### 2️⃣ Lancer la stack
```bash
docker compose up -d
```

### 3️⃣ Vérifier les logs
```bash
docker compose logs -f btcpayserver
# Attendre "Application started" (~5-10 min première fois)
```

### 4️⃣ Accéder à BTCPay
```
https://btcpay.votredomaine.com
# ou http://localhost:49392 en local
```
→ Créer un compte admin au premier accès

### 5️⃣ Activer USDC (plugin)
1. **Server Settings** → **Plugins**
2. Installer **"Tether (USDT/USDC)"**
3. **Store Settings** → **Tokens** → Ajouter USDC
4. Configurer votre wallet ERC-20/Polygon

---

## ⚠️ Prérequis

- **RAM**: 4GB minimum (8GB recommandé)
- **Disque**: 500GB+ pour Bitcoin mainnet
- **Ports**: 8333 (Bitcoin), 9735 (Lightning), 49392 (BTCPay)

## 🔐 Sécurité

- [ ] Changer tous les mots de passe par défaut
- [ ] Configurer HTTPS avec certificat valide
- [ ] Firewall: exposer uniquement les ports nécessaires
- [ ] Backup régulier des volumes Docker

---

*Généré par SARAH (Backend) pour Cinq*
