module.exports = {
  presets: ['babel-preset-expo'],
  // babel-preset-expo (SDK 54+) adds react-native-worklets/plugin automatically
  // when react-native-worklets is installed, so the Reanimated plugin must not
  // be listed here as well (it would process worklets twice).
};
