import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  name: 'Zenith Studio',
  slug: config.slug || 'zenith-studio',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/app_icon.jpeg',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/zenith_logo_rounded.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.zenithstudio.app', // ⚠️ TODO: Change this to your unique Bundle Identifier (e.g. com.yourname.zenith)
    buildNumber: '5',
    supportsTablet: true,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    ...config.android,
    package: 'com.zenithstudio.app', // ⚠️ TODO: Change this to match ios.bundleIdentifier
    adaptiveIcon: {
      foregroundImage: './assets/app_icon.jpeg',
      backgroundColor: '#ffffff'
    }
  },
  extra: {
    ...config.extra,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    eas: {
      projectId: "d7b5a634-7217-4b45-87ed-014353391df5"
    }
  }
});
