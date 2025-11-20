import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = Platform.OS === 'ios' ? 110 : 80;

const ModernHeader = ({
  title,
  subtitle,
  variant = 'default', // 'default', 'minimal', 'gradient', 'glass'
  leftIcon,
  rightIcon,
  onLeftPress,
  onRightPress,
  backgroundColor = colors.primary,
  showBackButton = false,
  onBackPress,
  headerRight,
  transparent = false,
  children,
  animated = true,
}) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          delay: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(1);
      fadeAnim.setValue(1);
    }
  }, [animated]);

  const slideTransform = {
    transform: [
      {
        translateY: slideAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-50, 0],
        }),
      },
    ],
  };

  const renderBackButton = () => {
    if (!showBackButton) return null;
    
    return (
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onBackPress}
        activeOpacity={0.7}
      >
        <View style={styles.actionButtonInner}>
          <Ionicons 
            name="chevron-back" 
            size={24} 
            color={variant === 'glass' ? colors.textPrimary : colors.white} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderLeftAction = () => {
    if (showBackButton) return renderBackButton();
    if (!leftIcon) return <View style={styles.actionPlaceholder} />;

    return (
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onLeftPress}
        activeOpacity={0.7}
      >
        <View style={styles.actionButtonInner}>
          <Ionicons 
            name={leftIcon} 
            size={24} 
            color={variant === 'glass' ? colors.textPrimary : colors.white} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderRightAction = () => {
    if (headerRight) return headerRight;
    if (!rightIcon) return <View style={styles.actionPlaceholder} />;

    return (
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onRightPress}
        activeOpacity={0.7}
      >
        <View style={styles.actionButtonInner}>
          <Ionicons 
            name={rightIcon} 
            size={24} 
            color={variant === 'glass' ? colors.textPrimary : colors.white} 
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderContent = () => (
    <View style={styles.content}>
      <StatusBar 
        barStyle={variant === 'glass' ? 'dark-content' : 'light-content'} 
        backgroundColor="transparent" 
        translucent 
      />
      
      <View style={styles.headerContent}>
        <View style={styles.topRow}>
          {renderLeftAction()}
          
          <Animated.View style={[styles.titleContainer, slideTransform]}>
            <Text 
              style={[
                styles.title, 
                { color: variant === 'glass' ? colors.textPrimary : colors.white }
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {subtitle && (
              <Animated.Text 
                style={[
                  styles.subtitle, 
                  { 
                    color: variant === 'glass' 
                      ? colors.textSecondary 
                      : 'rgba(255, 255, 255, 0.8)' 
                  },
                  { opacity: fadeAnim }
                ]}
                numberOfLines={1}
              >
                {subtitle}
              </Animated.Text>
            )}
          </Animated.View>
          
          {renderRightAction()}
        </View>
        
        {children && (
          <Animated.View style={[styles.childrenContainer, { opacity: fadeAnim }]}>
            {children}
          </Animated.View>
        )}
      </View>
    </View>
  );

  if (variant === 'glass') {
    return (
      <View style={[styles.container, { backgroundColor: 'transparent' }]}>
        <BlurView intensity={80} style={styles.blurContainer}>
          {renderContent()}
        </BlurView>
      </View>
    );
  }

  if (variant === 'gradient') {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientContainer}
        >
          {renderContent()}
        </LinearGradient>
      </View>
    );
  }

  if (variant === 'minimal') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.minimalContainer}>
          {renderContent()}
        </View>
      </View>
    );
  }

  // Default variant
  return (
    <View style={[styles.container, { backgroundColor }]}>
      {renderContent()}
    </View>
  );
};

// Header variants for quick use
export const GradientHeader = (props) => (
  <ModernHeader {...props} variant="gradient" />
);

export const GlassHeader = (props) => (
  <ModernHeader {...props} variant="glass" />
);

export const MinimalHeader = (props) => (
  <ModernHeader {...props} variant="minimal" />
);

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 44 : StatusBar.currentHeight || 24,
    minHeight: HEADER_HEIGHT,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  gradientContainer: {
    flex: 1,
  },
  minimalContainer: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.1,
  },
  actionButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionPlaceholder: {
    width: 44,
    height: 44,
  },
  childrenContainer: {
    marginTop: 12,
  },
});

export default ModernHeader;
