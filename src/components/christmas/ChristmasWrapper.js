import React from 'react';
import { View, StyleSheet } from 'react-native';
import Snowfall from './Snowfall';
import { isChristmasActive } from '../../config/christmasConfig';

/**
 * 🎄 Christmas Wrapper Component
 * 
 * Wrap your app content with this component to add Christmas effects.
 * All effects are controlled by christmasConfig.js
 * 
 * After Christmas, simply set CHRISTMAS_CONFIG.enabled = false
 * in src/config/christmasConfig.js
 */
export default function ChristmasWrapper({ children }) {
  const showChristmas = isChristmasActive();

  return (
    <View style={styles.container}>
      {children}
      {showChristmas && <Snowfall />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
