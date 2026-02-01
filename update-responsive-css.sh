#!/bin/bash

# ==========================================================================
# Script d'automatisation des corrections responsive iPhone 14
# Ajoute le fichier iphone14-responsive-fixes.css à toutes les pages HTML
# ==========================================================================

echo "🔧 Début de l'application des corrections responsive iPhone 14..."

# Compteurs
updated_count=0
already_updated_count=0
error_count=0

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonction pour logger
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Chercher tous les fichiers HTML (exclure node_modules, emails, tests, etc.)
find_html_files() {
    find . -name "*.html" \
        -not -path "*/node_modules/*" \
        -not -path "*/emails/*" \
        -not -path "*/playwright-report/*" \
        -not -path "*/coverage/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*"
}

# Fonction pour vérifier si le fichier contient déjà les fixes
has_iphone14_fixes() {
    local file="$1"
    grep -q "iphone14-responsive-fixes.css" "$file"
}

# Fonction pour vérifier si le fichier a mobile-responsive.css
has_mobile_responsive() {
    local file="$1"
    grep -q "mobile-responsive" "$file"
}

# Fonction pour ajouter les fixes iPhone 14
add_iphone14_fixes() {
    local file="$1"
    
    # Pattern à rechercher : mobile-responsive.css (min ou pas)
    if grep -q 'mobile-responsive\.min\.css' "$file"; then
        # Ajouter après mobile-responsive.min.css
        sed -i 's|mobile-responsive\.min\.css">|mobile-responsive.min.css">\n    <link rel="stylesheet" href="/css/iphone14-responsive-fixes.css">|g' "$file"
        return $?
    elif grep -q 'mobile-responsive\.css' "$file"; then
        # Ajouter après mobile-responsive.css
        sed -i 's|mobile-responsive\.css">|mobile-responsive.css">\n    <link rel="stylesheet" href="/css/iphone14-responsive-fixes.css">|g' "$file"
        return $?
    else
        return 1
    fi
}

# Traitement principal
main() {
    log_info "Recherche des fichiers HTML..."
    
    local html_files
    html_files=$(find_html_files)
    
    if [ -z "$html_files" ]; then
        log_error "Aucun fichier HTML trouvé!"
        exit 1
    fi
    
    local total_files
    total_files=$(echo "$html_files" | wc -l)
    log_info "Trouvé $total_files fichiers HTML à traiter"
    
    echo ""
    
    while IFS= read -r file; do
        local filename
        filename=$(basename "$file")
        
        log_info "Traitement de: $file"
        
        # Vérifier si le fichier a déjà les fixes
        if has_iphone14_fixes "$file"; then
            log_warning "$filename a déjà les corrections iPhone 14"
            ((already_updated_count++))
            continue
        fi
        
        # Vérifier si le fichier a mobile-responsive.css
        if ! has_mobile_responsive "$file"; then
            log_warning "$filename n'a pas mobile-responsive.css - ignoré"
            continue
        fi
        
        # Créer une sauvegarde
        cp "$file" "$file.bak"
        
        # Ajouter les fixes
        if add_iphone14_fixes "$file"; then
            log_success "$filename mis à jour avec succès"
            ((updated_count++))
            # Supprimer la sauvegarde si succès
            rm "$file.bak"
        else
            log_error "Erreur lors de la mise à jour de $filename"
            # Restaurer la sauvegarde en cas d'erreur
            mv "$file.bak" "$file"
            ((error_count++))
        fi
        
        echo ""
        
    done <<< "$html_files"
    
    # Rapport final
    echo ""
    echo "📊 RAPPORT FINAL"
    echo "================"
    log_success "Fichiers mis à jour: $updated_count"
    log_warning "Fichiers déjà à jour: $already_updated_count"
    log_error "Erreurs: $error_count"
    echo ""
    
    if [ $error_count -eq 0 ]; then
        log_success "🎉 Toutes les corrections responsive iPhone 14 ont été appliquées avec succès!"
    else
        log_warning "⚠️  Des erreurs sont survenues. Vérifiez les fichiers manuellement."
        exit 1
    fi
}

# Vérifier que le fichier CSS existe
if [ ! -f "/home/node/clawd/projects/cinq/css/iphone14-responsive-fixes.css" ]; then
    log_error "Le fichier iphone14-responsive-fixes.css n'existe pas!"
    log_info "Assurez-vous que le fichier est créé avant d'exécuter ce script."
    exit 1
fi

# Changer vers le bon répertoire
cd /home/node/clawd/projects/cinq || {
    log_error "Impossible d'accéder au répertoire du projet!"
    exit 1
}

# Exécuter le traitement principal
main