import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { isEffectEnabled, CHRISTMAS_CONFIG } from '../../config/christmasConfig';

/**
 * 🎄 Christmas Greeting Banner
 * 
 * A festive greeting banner that can be shown at the top of screens
 */
export default function ChristmasGreeting({ 
  message = "Mutlu Noeller! 🎄",
  style = {},
}) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Subtle shimmer animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  if (!isEffectEnabled('christmasGreeting')) {
    return null;
  }

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
  });

  const scale = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.02, 1],
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        style,
        { opacity, transform: [{ scale }] }
      ]}
    >
      <View style={styles.decorationLeft}>
        <Text style={styles.decoration}>🎄</Text>
      </View>
      <Text style={styles.greetingText}>{message}</Text>
      <View style={styles.decorationRight}>
        <Text style={styles.decoration}>🎄</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CHRISTMAS_CONFIG.colors.christmasRed,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 8,
    shadowColor: CHRISTMAS_CONFIG.colors.christmasRed,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  greetingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginHorizontal: 8,
  },
  decorationLeft: {
    marginRight: 4,
  },
  decorationRight: {
    marginLeft: 4,
  },
  decoration: {
    fontSize: 16,
  },
});
