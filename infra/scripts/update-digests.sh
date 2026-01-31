#!/bin/bash
# =============================================================================
# Script pour mettre à jour les digests des images Docker
# Usage: ./scripts/update-digests.sh
# =============================================================================
set -euo pipefail

COMPOSE_FILE="docker-compose.yml"

echo "🔍 Récupération des digests des images..."

declare -A IMAGES=(
    ["postgres:15-alpine"]=""
    ["btcpayserver/bitcoin:26.0"]=""
    ["nicolasdorier/nbxplorer:2.5.0"]=""
    ["btcpayserver/lnd:v0.17.4-beta"]=""
    ["btcpayserver/btcpayserver:1.12.5"]=""
    ["traefik:v3.0"]=""
)

for image in "${!IMAGES[@]}"; do
    echo "  → $image"
    digest=$(docker pull "$image" 2>/dev/null | grep -oP 'sha256:[a-f0-9]{64}' || \
             docker inspect --format='{{index .RepoDigests 0}}' "$image" 2>/dev/null | grep -oP 'sha256:[a-f0-9]{64}' || \
             echo "DIGEST_NOT_FOUND")
    IMAGES[$image]="$digest"
    echo "    $digest"
done

echo ""
echo "📝 Mise à jour de $COMPOSE_FILE..."

for image in "${!IMAGES[@]}"; do
    digest="${IMAGES[$image]}"
    if [[ "$digest" != "DIGEST_NOT_FOUND" ]]; then
        # Échapper les caractères spéciaux pour sed
        escaped_image=$(echo "$image" | sed 's/[\/&]/\\&/g')
        sed -i "s|${escaped_image}@sha256:[a-f0-9]\{64\}|${image}@${digest}|g" "$COMPOSE_FILE"
        sed -i "s|${escaped_image}\$|${image}@${digest}|g" "$COMPOSE_FILE"
    fi
done

echo "✅ Digests mis à jour!"
echo ""
echo "⚠️  Vérifiez le fichier et commitez les changements:"
echo "    git diff $COMPOSE_FILE"
