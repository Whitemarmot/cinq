#!/bin/bash
# =============================================================================
# Cinq BTCPay Server - Script de déploiement TESTNET rapide
# =============================================================================
# Usage: ./deploy-testnet.sh [--quick|--full|--stop|--logs|--status]
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_NAME="cinq-testnet"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# -----------------------------------------------------------------------------
# Fonctions utilitaires
# -----------------------------------------------------------------------------

check_dependencies() {
    log_info "Vérification des dépendances..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker non installé. Installer avec: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    
    if ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose non disponible"
        exit 1
    fi
    
    log_success "Docker $(docker --version | cut -d' ' -f3)"
}

generate_secrets() {
    log_info "Génération des secrets..."
    
    local env_file="$INFRA_DIR/.env"
    
    if [[ -f "$env_file" ]]; then
        log_warn "Fichier .env existe déjà. Sauvegarde vers .env.backup"
        cp "$env_file" "$env_file.backup.$(date +%s)"
    fi
    
    # Copier le template
    cp "$SCRIPT_DIR/.env.testnet" "$env_file"
    
    # Générer les secrets
    local btc_rpc_pass=$(openssl rand -hex 32)
    local pg_pass=$(openssl rand -base64 32 | tr -d '\n/+=')
    
    # Remplacer les placeholders
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s/CHANGEME_GENERATE_WITH_openssl_rand_hex_32/$btc_rpc_pass/" "$env_file"
        sed -i '' "s/CHANGEME_GENERATE_WITH_openssl_rand_base64_32/$pg_pass/" "$env_file"
    else
        sed -i "s/CHANGEME_GENERATE_WITH_openssl_rand_hex_32/$btc_rpc_pass/" "$env_file"
        sed -i "s/CHANGEME_GENERATE_WITH_openssl_rand_base64_32/$pg_pass/" "$env_file"
    fi
    
    log_success "Secrets générés dans $env_file"
}

configure_host() {
    local host=$1
    local env_file="$INFRA_DIR/.env"
    
    if [[ -n "$host" ]]; then
        log_info "Configuration du host: $host"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/BTCPAY_HOST=.*/BTCPAY_HOST=$host/" "$env_file"
        else
            sed -i "s/BTCPAY_HOST=.*/BTCPAY_HOST=$host/" "$env_file"
        fi
    fi
}

start_services() {
    local mode=$1
    
    log_info "Démarrage des services ($mode)..."
    
    case $mode in
        quick)
            # Mode rapide: utiliser docker-compose-quick.yml
            log_warn "Mode QUICK: BTCPay sans noeud Bitcoin local"
            cd "$SCRIPT_DIR"
            docker compose -f docker-compose-quick.yml -p "$PROJECT_NAME" up -d
            ;;
        full)
            # Mode complet: tous les services avec le compose principal
            cd "$INFRA_DIR"
            log_info "Mode FULL: Stack complète avec Bitcoin Core testnet"
            docker compose -p "$PROJECT_NAME" up -d
            ;;
        *)
            cd "$INFRA_DIR"
            docker compose -p "$PROJECT_NAME" up -d
            ;;
    esac
    
    log_success "Services démarrés!"
}

wait_for_btcpay() {
    log_info "Attente de BTCPay Server..."
    
    local max_attempts=60
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:49392/api/v1/health 2>/dev/null | grep -q "200"; then
            log_success "BTCPay Server est prêt!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    log_error "Timeout: BTCPay n'a pas démarré après $((max_attempts * 2))s"
    return 1
}

show_status() {
    cd "$INFRA_DIR"
    
    echo ""
    log_info "=== STATUS DES SERVICES ==="
    docker compose -p "$PROJECT_NAME" ps
    
    echo ""
    log_info "=== PORTS EXPOSÉS ==="
    echo "  BTCPay Server: http://localhost:49392"
    echo "  Traefik HTTP:  http://localhost:80"
    echo "  Traefik HTTPS: https://localhost:443"
    
    echo ""
    log_info "=== SYNC BITCOIN (si actif) ==="
    docker compose -p "$PROJECT_NAME" exec bitcoind bitcoin-cli -testnet getblockchaininfo 2>/dev/null | grep -E "(chain|blocks|headers|verificationprogress)" || echo "  (Bitcoin Core non disponible)"
}

show_logs() {
    local service=$1
    cd "$INFRA_DIR"
    
    if [[ -n "$service" ]]; then
        docker compose -p "$PROJECT_NAME" logs -f "$service"
    else
        docker compose -p "$PROJECT_NAME" logs -f
    fi
}

stop_services() {
    cd "$INFRA_DIR"
    log_info "Arrêt des services..."
    docker compose -p "$PROJECT_NAME" down
    log_success "Services arrêtés"
}

cleanup() {
    cd "$INFRA_DIR"
    log_warn "Nettoyage complet (données incluses)..."
    read -p "Êtes-vous sûr? Toutes les données seront perdues! [y/N] " confirm
    if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
        docker compose -p "$PROJECT_NAME" down -v
        log_success "Nettoyage terminé"
    else
        log_info "Annulé"
    fi
}

print_quickstart() {
    echo ""
    echo "=============================================="
    echo -e "${GREEN}🎉 BTCPay Server TESTNET est prêt!${NC}"
    echo "=============================================="
    echo ""
    echo "📍 Accès:"
    echo "   http://localhost:49392"
    echo ""
    echo "📋 Prochaines étapes:"
    echo "   1. Ouvrir http://localhost:49392"
    echo "   2. Créer un compte administrateur"
    echo "   3. Créer un Store"
    echo "   4. Configurer un wallet testnet"
    echo ""
    echo "💰 Obtenir des testnet BTC:"
    echo "   https://coinfaucet.eu/en/btc-testnet/"
    echo "   https://testnet-faucet.mempool.co/"
    echo ""
    echo "📖 Documentation:"
    echo "   $SCRIPT_DIR/README.md"
    echo ""
}

# -----------------------------------------------------------------------------
# Main
# -----------------------------------------------------------------------------

usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  quick       Déploiement rapide (BTCPay seul, sans Bitcoin Core)"
    echo "  full        Déploiement complet avec Bitcoin Core testnet"
    echo "  stop        Arrêter tous les services"
    echo "  status      Afficher le statut des services"
    echo "  logs [svc]  Afficher les logs (optionnel: service spécifique)"
    echo "  cleanup     Supprimer tout (données incluses)"
    echo ""
    echo "Options:"
    echo "  --host DOMAIN   Configurer le domaine BTCPay"
    echo ""
    echo "Exemples:"
    echo "  $0 quick                    # Test local rapide"
    echo "  $0 full --host btcpay.example.com"
    echo ""
}

main() {
    local command=${1:-quick}
    shift || true
    
    local host=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --host)
                host="$2"
                shift 2
                ;;
            *)
                shift
                ;;
        esac
    done
    
    case $command in
        quick)
            check_dependencies
            generate_secrets
            [[ -n "$host" ]] && configure_host "$host"
            start_services quick
            wait_for_btcpay
            print_quickstart
            ;;
        full)
            check_dependencies
            generate_secrets
            [[ -n "$host" ]] && configure_host "$host"
            start_services full
            log_warn "Bitcoin Core testnet sync peut prendre plusieurs heures..."
            log_info "Vérifier le status avec: $0 status"
            ;;
        stop)
            stop_services
            ;;
        status)
            show_status
            ;;
        logs)
            show_logs "$1"
            ;;
        cleanup)
            cleanup
            ;;
        help|-h|--help)
            usage
            ;;
        *)
            log_error "Commande inconnue: $command"
            usage
            exit 1
            ;;
    esac
}

main "$@"
