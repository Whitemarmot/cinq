import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cinq.mobile',
  appName: 'Cinq',
  webDir: '.',
  server: {
    androidScheme: 'https',
    hostname: 'cinq.app',
    // Pour dev local, décommenter :
    // url: 'http://localhost:3000'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 300,
      launchAutoHide: true,
      backgroundColor: '#0a0a0b',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'small',
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0a0a0b',
      overlaysWebView: false
    },
    App: {
      launchUrl: '/app.html?source=capacitor'
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#0a0a0b'
    }
  },
  android: {
    backgroundColor: '#0a0a0b',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    loggingBehavior: 'none'
  }
};

export default config;