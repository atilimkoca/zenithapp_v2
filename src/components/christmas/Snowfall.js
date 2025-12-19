import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { CHRISTMAS_CONFIG, isEffectEnabled } from '../../config/christmasConfig';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Individual Snowflake Component
const Snowflake = ({ delay, startX, size, duration, swayAmount }) => {
  const translateY = useRef(new Animated.Value(-size)).current;
  const translateX = useRef(new Animated.Value(startX)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const startAnimation = () => {
      // Reset values
      translateY.setValue(-size);
      translateX.setValue(startX);
      rotate.setValue(0);
      opacity.setValue(CHRISTMAS_CONFIG.snowfall.opacity);

      // Animate snowflake falling
      Animated.parallel([
        // Vertical fall
        Animated.timing(translateY, {
          toValue: SCREEN_HEIGHT + size,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Horizontal sway
        Animated.sequence([
          ...Array(Math.floor(duration / 2000)).fill(null).map((_, i) => 
            Animated.timing(translateX, {
              toValue: startX + (i % 2 === 0 ? swayAmount : -swayAmount),
              duration: 2000,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            })
          ),
        ]),
        // Rotation
        Animated.timing(rotate, {
          toValue: 360,
          duration: duration,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        // Fade out near bottom
        Animated.sequence([
          Animated.delay(duration * 0.7),
          Animated.timing(opacity, {
            toValue: 0,
            duration: duration * 0.3,
            useNativeDriver: true,
          }),
        ]),
      ]).start(() => {
        // Restart animation with small random delay
        setTimeout(startAnimation, Math.random() * 1000);
      });
    };

    // Initial delay before starting
    const timer = setTimeout(startAnimation, delay);
    return () => clearTimeout(timer);
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.Text
      style={[
        styles.snowflake,
        {
          fontSize: size,
          transform: [
            { translateX },
            { translateY },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}
    >
      ❄
    </Animated.Text>
  );
};

// Main Snowfall Component
export default function Snowfall() {
  // Check if snowfall effect is enabled
  if (!isEffectEnabled('snowfall')) {
    return null;
  }

  const { snowflakeCount, minSize, maxSize, minDuration, maxDuration } = CHRISTMAS_CONFIG.snowfall;

  // Generate snowflake configurations
  const snowflakes = useMemo(() => {
    return Array.from({ length: snowflakeCount }, (_, index) => ({
      id: index,
      delay: Math.random() * 5000,
      startX: Math.random() * SCREEN_WIDTH,
      size: minSize + Math.random() * (maxSize - minSize),
      duration: minDuration + Math.random() * (maxDuration - minDuration),
      swayAmount: 20 + Math.random() * 30,
    }));
  }, [snowflakeCount]);

  return (
    <View style={styles.container} pointerEvents="none">
      {snowflakes.map((config) => (
        <Snowflake
          key={config.id}
          delay={config.delay}
          startX={config.startX}
          size={config.size}
          duration={config.duration}
          swayAmount={config.swayAmount}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    pointerEvents: 'none',
  },
  snowflake: {
    position: 'absolute',
    color: '#FFFFFF',
    textShadowColor: 'rgba(255, 255, 255, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});
