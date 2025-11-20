export default ({ config }) => ({
  ...config,
  name: 'Zenith Studio',
  slug: config.slug || 'zenith-studio',
  ios: {
    ...config.ios,
    bundleIdentifier: 'com.zenithstudio.app', // TODO: Change this to your actual Bundle Identifier
    buildNumber: '1',
    supportsTablet: true,
  },
  android: {
    ...config.android,
  },
  extra: {
    ...config.extra,
    eas: {
      projectId: "d7b5a634-7217-4b45-87ed-014353391df5"
    }
  }
});
