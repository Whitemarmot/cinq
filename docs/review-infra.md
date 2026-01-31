# Infrastructure Review - BTCPay Server Cinq

**Date**: 2025-01-20  
**Reviewer**: Architecte Senior  
**Scope**: `/projects/cinq/infra/docker-compose.yml`  
**Verdict**: ⚠️ **NON PRODUCTION-READY** - Failles critiques identifiées

---

## Executive Summary

L'infrastructure présente une bonne structure de base mais contient **5 failles critiques**, **4 problèmes moyens** et **plusieurs améliorations recommandées** avant déploiement production.

| Sévérité | Count | Status |
|----------|-------|--------|
| 🔴 CRITIQUE | 5 | Bloquant |
| 🟠 MOYEN | 4 | À corriger |
| 🟡 RECOMMANDÉ | 5 | Best practices |

---

## 🔴 FAILLES CRITIQUES

### 1. Bitcoin RPC ouvert au monde (`rpcallowip=0.0.0.0/0`)

**Fichier**: `docker-compose.yml` ligne ~47  
**Impact**: Accès RPC Bitcoin depuis n'importe quelle IP  
**Risque**: Vol de fonds, manipulation du nœud

```yaml
# ❌ ACTUEL - CATASTROPHIQUE
rpcallowip=0.0.0.0/0
whitelist=0.0.0.0/0

# ✅ FIX - Limiter au réseau Docker interne
rpcallowip=10.0.0.0/8
rpcallowip=172.16.0.0/12
rpcallowip=192.168.0.0/16
# Supprimer whitelist=0.0.0.0/0
```

### 2. Mots de passe par défaut exposés

**Fichier**: `docker-compose.yml` lignes 17, 44, 45  
**Impact**: Credentials devinables en cas d'oubli de configuration  
**Risque**: Compromission totale

```yaml
# ❌ ACTUEL
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-btcpay_secret_change_me}
rpcuser=${BITCOIN_RPC_USER:-btcrpc}
rpcpassword=${BITCOIN_RPC_PASSWORD:-btcrpc_secret_change_me}

# ✅ FIX - Aucune valeur par défaut, fail if missing
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
```

**Action complémentaire**: Utiliser Docker Secrets au lieu de variables d'environnement:

```yaml
services:
  postgres:
    secrets:
      - postgres_password
    environment:
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password

secrets:
  postgres_password:
    file: ./secrets/postgres_password.txt
```

### 3. Port BTCPay exposé directement (`49392:49392`)

**Impact**: Bypass du reverse proxy possible  
**Risque**: Attaque directe sans TLS, contournement WAF

```yaml
# ❌ ACTUEL
ports:
  - "49392:49392"

# ✅ FIX - Exposer uniquement sur localhost ou supprimer
ports:
  - "127.0.0.1:49392:49392"  # Ou supprimer complètement si Traefik gère
```

### 4. LND REST/RPC binds sur 0.0.0.0

**Impact**: API Lightning accessible depuis l'extérieur si firewall mal configuré  
**Risque**: Vol de fonds Lightning, channels forcés

```yaml
# ❌ ACTUEL
restlisten=0.0.0.0:8080
rpclisten=0.0.0.0:10009

# ✅ FIX
restlisten=lnd:8080
rpclisten=lnd:10009
```

### 5. Pas de vérification d'intégrité des images

**Impact**: Vulnérable aux attaques supply-chain  
**Risque**: Image Docker compromise

```yaml
# ❌ ACTUEL
image: btcpayserver/btcpayserver:1.12.5

# ✅ FIX - Pinning avec digest
image: btcpayserver/btcpayserver:1.12.5@sha256:<digest>

# Obtenir le digest:
# docker pull btcpayserver/btcpayserver:1.12.5
# docker inspect --format='{{index .RepoDigests 0}}' btcpayserver/btcpayserver:1.12.5
```

---

## 🟠 PROBLÈMES MOYENS

### 6. Aucune limite de ressources

```yaml
# ✅ AJOUTER à chaque service
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
    reservations:
      cpus: '0.5'
      memory: 1G
```

**Recommandations par service**:
| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| bitcoind | 4 | 8G |
| lnd | 2 | 4G |
| postgres | 2 | 2G |
| nbxplorer | 1 | 2G |
| btcpayserver | 2 | 2G |

### 7. Healthchecks manquants

Seul `postgres` a un healthcheck. Ajouter pour tous:

```yaml
# bitcoind
healthcheck:
  test: ["CMD", "bitcoin-cli", "-rpcuser=${BITCOIN_RPC_USER}", "-rpcpassword=${BITCOIN_RPC_PASSWORD}", "getblockchaininfo"]
  interval: 30s
  timeout: 10s
  retries: 3

# lnd
healthcheck:
  test: ["CMD", "lncli", "getinfo"]
  interval: 30s
  timeout: 10s
  retries: 3

# btcpayserver
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:49392/api/v1/health"]
  interval: 30s
  timeout: 10s
  retries: 3

# nbxplorer
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:32838/health"]
  interval: 30s
  timeout: 10s
  retries: 3
```

### 8. Logging non configuré

```yaml
# ✅ AJOUTER à chaque service
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"
    compress: "true"
```

### 9. Containers en root

```yaml
# ✅ AJOUTER où possible
user: "1000:1000"
security_opt:
  - no-new-privileges:true
read_only: true  # Si le service le permet
tmpfs:
  - /tmp
```

---

## 🟡 RECOMMANDATIONS

### 10. Version directive deprecated

```yaml
# ❌ ACTUEL
version: "3.9"

# ✅ FIX - Supprimer la ligne (Docker Compose v2+ l'ignore)
# Ou mettre: version: "3"
```

### 11. Ajouter un reverse proxy explicite

Traefik est référencé dans les labels mais pas défini:

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: cinq-traefik
    restart: unless-stopped
    security_opt:
      - no-new-privileges:true
    command:
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    networks:
      - btcpay_network
```

### 12. Network segmentation

Séparer en réseaux distincts:

```yaml
networks:
  frontend:  # Traefik + BTCPay
    internal: false
  backend:   # DB + NBXplorer
    internal: true
  bitcoin:   # bitcoind + LND
    internal: true
```

### 13. Backup automatique

Ajouter un service de backup:

```yaml
backup:
  image: prodrigestivill/postgres-backup-local
  environment:
    POSTGRES_HOST: postgres
    POSTGRES_DB: btcpayserver,nbxplorer
    BACKUP_KEEP_DAYS: 30
  volumes:
    - ./backups:/backups
```

### 14. Monitoring

Ajouter Prometheus + Grafana ou au minimum un healthcheck endpoint externe.

---

## Checklist Pre-Production

- [ ] Fixer les 5 failles critiques
- [ ] Créer fichier `.env` avec secrets générés (`openssl rand -base64 32`)
- [ ] Activer Docker Secrets pour les credentials
- [ ] Configurer firewall (ufw/iptables) pour bloquer ports internes
- [ ] Ajouter le reverse proxy Traefik
- [ ] Tester backup/restore procedure
- [ ] Configurer monitoring/alerting
- [ ] Documenter le runbook de déploiement
- [ ] Scanner les images avec Trivy/Snyk

---

## Template .env Sécurisé

```bash
# Générer avec: openssl rand -base64 32
POSTGRES_PASSWORD=<généré>
BITCOIN_RPC_USER=btcrpc
BITCOIN_RPC_PASSWORD=<généré>
BITCOIN_NETWORK=mainnet
BTCPAY_HOST=pay.cinq.example.com
BTCPAY_PROTOCOL=https
LND_ALIAS=CinqLightning
LND_EXTERNAL_IP=<IP publique du serveur>
ACME_EMAIL=admin@cinq.example.com
```

---

## Conclusion

Cette infrastructure **ne doit pas être déployée en l'état**. Les failles critiques #1 (RPC ouvert) et #2 (credentials par défaut) permettraient un vol de fonds en quelques minutes sur un serveur exposé.

**Priorité**: Corriger les 5 critiques → Ajouter Traefik → Tester → Deploy.

Temps estimé pour mise en conformité: **4-8 heures**.
