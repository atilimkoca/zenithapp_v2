export default ({ config }) => ({
  ...config,
  name: 'Zenith Studio',
  slug: config.slug || 'zenith-studio',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    "**/*"
  ],
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.zenithstudio.app', // ⚠️ TODO: Change this to your unique Bundle Identifier (e.g. com.yourname.zenith)
    buildNumber: '1',
    supportsTablet: true,
  },
  android: {
    ...config.android,
    package: 'com.zenithstudio.app', // ⚠️ TODO: Change this to match ios.bundleIdentifier
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    }
  },
  extra: {
    ...config.extra,
    eas: {
      projectId: "d7b5a634-7217-4b45-87ed-014353391df5"
    }
  }
});
