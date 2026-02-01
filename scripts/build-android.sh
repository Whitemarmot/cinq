#!/bin/bash

# Script de génération APK Android pour Cinq PWA
# Usage: ./scripts/build-android.sh [method]
# Methods: pwa, capacitor, twa

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_DIR/android-builds"
METHOD="${1:-pwa}"

echo "🚀 Génération APK Android pour Cinq - Méthode: $METHOD"
echo "📁 Répertoire projet: $PROJECT_DIR"

# Créer le répertoire de build
mkdir -p "$BUILD_DIR"

case $METHOD in
  "pwa"|"pwabuilder")
    echo "📱 Génération via PWABuilder..."
    
    # Vérifier si PWABuilder CLI est disponible
    if command -v pwa-builder &> /dev/null; then
      echo "✅ PWABuilder CLI trouvé"
      cd "$PROJECT_DIR"
      pwa-builder package --platform android --dir "$BUILD_DIR"
    else
      echo "❌ PWABuilder CLI non trouvé"
      echo "📋 Instructions manuelles:"
      echo "1. Aller sur https://www.pwabuilder.com/"
      echo "2. Entrer l'URL: https://cinq.app"
      echo "3. Cliquer sur 'Build My PWA'"
      echo "4. Choisir Android > Trusted Web Activity"
      echo "5. Télécharger le package"
    fi
    ;;
    
  "capacitor"|"cap")
    echo "⚡ Génération via Capacitor..."
    
    cd "$PROJECT_DIR"
    
    # Vérifier si Capacitor CLI est disponible
    if command -v cap &> /dev/null || [ -f "node_modules/.bin/cap" ]; then
      echo "✅ Capacitor CLI trouvé"
      
      # Initialiser Capacitor si pas déjà fait
      if [ ! -f "capacitor.config.ts" ]; then
        echo "🔧 Configuration Capacitor manquante, créée automatiquement"
      fi
      
      # Ajouter platform Android si pas déjà fait
      if [ ! -d "android" ]; then
        echo "📱 Ajout de la plateforme Android..."
        npx cap add android
      fi
      
      # Synchroniser les assets
      echo "🔄 Synchronisation des assets..."
      npx cap sync android
      
      # Builder l'APK
      echo "🔨 Construction de l'APK..."
      cd android
      chmod +x gradlew
      ./gradlew assembleDebug
      
      # Copier l'APK généré
      APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
      if [ -f "$APK_PATH" ]; then
        cp "$APK_PATH" "$BUILD_DIR/cinq-debug.apk"
        echo "✅ APK généré: $BUILD_DIR/cinq-debug.apk"
      else
        echo "❌ Erreur: APK non trouvé"
        exit 1
      fi
      
    else
      echo "❌ Capacitor CLI non trouvé"
      echo "📋 Installation requise:"
      echo "npm install -g @capacitor/cli"
    fi
    ;;
    
  "twa")
    echo "🔗 Configuration TWA manuelle..."
    
    TWA_CONFIG="$BUILD_DIR/twa-config.json"
    
    cat > "$TWA_CONFIG" << EOF
{
  "packageId": "app.cinq.twa",
  "name": "Cinq",
  "launcherName": "Cinq",
  "displayName": "Cinq — L'anti-réseau social",
  "themeColor": "#0a0a0b",
  "navigationColor": "#0a0a0b", 
  "backgroundColor": "#0a0a0b",
  "enableNotifications": true,
  "startUrl": "/app.html?source=twa",
  "iconUrl": "https://cinq.app/assets/icons/icon-512x512.png",
  "maskableIconUrl": "https://cinq.app/assets/icons/icon-512x512.png",
  "monochromeIconUrl": "https://cinq.app/assets/icons/icon.svg",
  "splashScreenFadeOutDuration": 300,
  "enableSiteSettings": false,
  "orientation": "portrait",
  "display": "standalone",
  "shortcuts": [
    {
      "name": "Envoyer un Ping",
      "short_name": "Ping",
      "url": "/app.html?action=ping",
      "icon": "https://cinq.app/assets/icons/icon-ping.svg"
    },
    {
      "name": "Écrire un message",
      "short_name": "Message", 
      "url": "/app.html?action=compose",
      "icon": "https://cinq.app/assets/icons/icon-96x96.png"
    },
    {
      "name": "Chat avec mes proches",
      "short_name": "Chat",
      "url": "/app.html?view=chat", 
      "icon": "https://cinq.app/assets/icons/icon-96x96.png"
    }
  ],
  "features": {
    "playBilling": false,
    "locationDelegation": false,
    "googlePlayInstantApps": false
  },
  "androidPackage": {
    "minSdkVersion": 21,
    "targetSdkVersion": 33
  }
}
EOF
    
    echo "✅ Configuration TWA créée: $TWA_CONFIG"
    echo "📋 Utiliser cette config avec Android Studio ou PWABuilder"
    ;;
    
  *)
    echo "❌ Méthode inconnue: $METHOD"
    echo "🔧 Méthodes disponibles: pwa, capacitor, twa"
    exit 1
    ;;
esac

echo ""
echo "🎉 Génération terminée!"
echo "📁 Fichiers dans: $BUILD_DIR"
echo "📖 Documentation: ANDROID-BUILD.md"

# Vérifications finales
echo ""
echo "🔍 Vérifications à faire:"
echo "- [ ] Tester l'installation de l'APK"
echo "- [ ] Vérifier les notifications push"
echo "- [ ] Tester les raccourcis Android"
echo "- [ ] Valider le partage vers l'app"
echo "- [ ] Configurer la signature de release"