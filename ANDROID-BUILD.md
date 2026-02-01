# Génération APK Android pour Cinq PWA

## ✅ État de la PWA

Le projet Cinq est déjà parfaitement configuré comme PWA :

- ✅ `manifest.json` complet et valide
- ✅ Service Worker configuré (`service-worker.js`)
- ✅ Icônes dans toutes les tailles requises (72x72 à 512x512)
- ✅ Icônes maskable pour Android
- ✅ Screenshots pour les stores
- ✅ Mode standalone configuré
- ✅ Fonctionnalités avancées (shortcuts, share_target, file_handlers)

## Méthode 1: PWABuilder (Recommandée)

PWABuilder génère un TWA (Trusted Web Activity) qui encapsule votre PWA dans une app Android native.

### Étapes via le site web

1. **Aller sur https://www.pwabuilder.com/**

2. **Entrer l'URL de production de Cinq**
   ```
   https://cinq.app
   ```

3. **Analyser la PWA**
   - PWABuilder va analyser votre manifest et détecter les fonctionnalités
   - Score élevé attendu grâce à la config complète

4. **Générer le package Android**
   - Cliquer sur "Build My PWA"
   - Choisir "Android" 
   - Type: "Trusted Web Activity"
   - Télécharger le package généré

5. **Configuration TWA**
   ```json
   {
     "packageId": "app.cinq.twa",
     "name": "Cinq",
     "launcherName": "Cinq",
     "themeColor": "#0a0a0b",
     "navigationColor": "#0a0a0b",
     "backgroundColor": "#0a0a0b",
     "enableNotifications": true,
     "startUrl": "/app.html?source=pwa",
     "iconUrl": "https://cinq.app/assets/icons/icon-512x512.png",
     "maskableIconUrl": "https://cinq.app/assets/icons/icon-512x512.png",
     "splashScreenFadeOutDuration": 300,
     "enableSiteSettings": false,
     "shortcuts": [
       {
         "name": "Ping",
         "short_name": "Ping", 
         "url": "/app.html?action=ping",
         "icon": "https://cinq.app/assets/icons/icon-ping.svg"
       }
     ]
   }
   ```

### Étapes via CLI (si disponible)

Si PWABuilder CLI fonctionne :
```bash
npm install -g @pwabuilder/cli
pwa build --platform android --url https://cinq.app
```

## Méthode 2: Capacitor

Capacitor permet plus de contrôle et d'intégrations natives.

### Configuration manuelle

1. **Créer capacitor.config.ts**
   ```typescript
   import type { CapacitorConfig } from '@capacitor/cli';

   const config: CapacitorConfig = {
     appId: 'app.cinq.mobile',
     appName: 'Cinq',
     webDir: '.',
     server: {
       androidScheme: 'https',
       hostname: 'cinq.app',
       url: 'https://cinq.app'
     },
     plugins: {
       SplashScreen: {
         launchShowDuration: 0,
         backgroundColor: '#0a0a0b'
       },
       StatusBar: {
         backgroundColor: '#0a0a0b',
         style: 'dark'
       }
     }
   };

   export default config;
   ```

2. **Installer les dépendances**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init
   npx cap add android
   ```

3. **Préparer les assets Android**
   ```bash
   # Générer les icônes adaptatives
   npx cap-assets generate --iconBackgroundColor '#0a0a0b' --splashBackgroundColor '#0a0a0b'
   ```

4. **Synchroniser et builder**
   ```bash
   npx cap sync
   npx cap build android
   ```

5. **Générer l'APK**
   ```bash
   cd android
   ./gradlew assembleDebug
   # APK généré dans: android/app/build/outputs/apk/debug/
   ```

## Méthode 3: Configuration manuelle TWA

Si les outils CLI ne fonctionnent pas, vous pouvez créer manuellement un TWA.

### Structure Android Studio

1. **Créer un nouveau projet Android Studio**
   - Template: "Trusted Web Activity"
   - Package: `app.cinq.twa`

2. **Configuration dans build.gradle (app)**
   ```gradle
   dependencies {
       implementation 'androidx.browser:browser:1.4.0'
       implementation 'com.google.androidbrowserhelper:androidbrowserhelper:2.2.0'
   }
   ```

3. **Modifier AndroidManifest.xml**
   ```xml
   <activity
       android:name="com.google.androidbrowserhelper.trusted.LauncherActivity"
       android:exported="true"
       android:theme="@style/LauncherActivityTheme">
       <meta-data
           android:name="android.support.customtabs.trusted.DEFAULT_URL"
           android:value="https://cinq.app/app.html?source=pwa" />
       <meta-data
           android:name="android.support.customtabs.trusted.STATUS_BAR_COLOR"
           android:resource="@color/colorPrimary" />
       <intent-filter android:autoVerify="true">
           <action android:name="android.intent.action.VIEW" />
           <category android:name="android.intent.category.DEFAULT" />
           <category android:name="android.intent.category.BROWSABLE" />
           <data android:scheme="https"
                 android:host="cinq.app" />
       </intent-filter>
   </activity>
   ```

## Ressources nécessaires

### Icônes Android

Les icônes sont déjà présentes dans `/assets/icons/` :
- ✅ icon-72x72.png (ldpi)
- ✅ icon-96x96.png (mdpi)  
- ✅ icon-144x144.png (xhdpi)
- ✅ icon-192x192.png (xxhdpi)
- ✅ icon-384x384.png (xxxhdpi)
- ✅ icon-512x512.png (pour le store)

### Splash Screen

Créer des splash screens basés sur la couleur de fond `#0a0a0b` :
- 1280x720 (landscape)
- 720x1280 (portrait)

## Signature et publication

### Keystore pour signature
```bash
keytool -genkey -v -keystore cinq-release-key.keystore \
  -alias cinq -keyalg RSA -keysize 2048 -validity 10000
```

### Build signed APK
```bash
./gradlew assembleRelease
```

### Play Store
- Upload sur Google Play Console
- Remplir les métadonnées du store
- Utiliser les screenshots existants dans `/assets/screenshots/`

## Vérifications finales

- [ ] Test install APK sur appareil Android
- [ ] Vérification des notifications push
- [ ] Test des shortcuts Android
- [ ] Test du partage vers l'app
- [ ] Validation Digital Asset Links pour TWA

## Notes importantes

- **Domain verification** : Pour un TWA, vous devez prouver que vous contrôlez le domaine cinq.app
- **HTTPS obligatoire** : Le site doit être servi en HTTPS
- **Service Worker** : Obligatoire pour l'installation
- **Add to Homescreen** : Doit fonctionner via le navigateur d'abord

## Prochaines étapes

1. Utiliser PWABuilder.com pour la génération automatique
2. Tester l'APK généré
3. Configurer la signature de release
4. Préparer pour le Play Store

---

*Configuration générée le 1 février 2025 pour Cinq PWA*