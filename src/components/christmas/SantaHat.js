import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { isEffectEnabled } from '../../config/christmasConfig';

/**
 * 🎅 Santa Hat Component
 * 
 * Add this component to position a Santa hat emoji on top of logos/icons
 * The hat is positioned relative to its parent container
 */
export default function SantaHat({ 
  size = 20, 
  offsetX = -5, 
  offsetY = -10,
  rotation = -20,
}) {
  if (!isEffectEnabled('santaHat')) {
    return null;
  }

  return (
    <View 
      style={[
        styles.container, 
        { 
          top: offsetY, 
          left: offsetX,
          transform: [{ rotate: `${rotation}deg` }],
        }
      ]}
      pointerEvents="none"
    >
      <Text style={[styles.hat, { fontSize: size }]}>🎅</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 10,
  },
  hat: {
    // Santa emoji serves as the hat
  },
});
