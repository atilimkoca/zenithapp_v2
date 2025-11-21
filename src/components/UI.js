import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { colors } from '../constants/colors';

// Export ModernHeader components
export { default as ModernHeader, GradientHeader, GlassHeader, MinimalHeader } from './ModernHeader';

const { width } = Dimensions.get('window');

export const GlassContainer = ({ children, style, intensity = 80 }) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={intensity} style={[styles.glassContainer, style]} tint="light">
        {children}
      </BlurView>
    );
  }
  return (
    <View style={[styles.glassContainer, styles.glassFallback, style]}>
      {children}
    </View>
  );
};

export const BackgroundBlob = ({ style, color = colors.primary }) => (
  <View style={[styles.blob, { backgroundColor: color }, style]} />
);

export const SocialButton = ({ 
  title, 
  onPress, 
  icon, 
  variant = 'google',
  style 
}) => {
  const isGoogle = variant === 'google';
  const isApple = variant === 'apple';
  
  return (
    <TouchableOpacity
      style={[
        styles.socialButton,
        isGoogle && styles.socialButtonGoogle,
        isApple && styles.socialButtonApple,
        style
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Ionicons 
        name={icon || (isGoogle ? 'logo-google' : 'logo-apple')} 
        size={20} 
        color={isGoogle ? colors.textPrimary : colors.white} 
        style={styles.socialIcon}
      />
      <Text style={[
        styles.socialButtonText,
        isGoogle && styles.socialButtonTextGoogle,
        isApple && styles.socialButtonTextApple
      ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

export const Divider = ({ text }) => (
  <View style={styles.dividerContainer}>
    <View style={styles.dividerLine} />
    {text && <Text style={styles.dividerText}>{text}</Text>}
    <View style={styles.dividerLine} />
  </View>
);

export const CustomInput = ({ 
  label, 
  value, 
  onChangeText, 
  placeholder, 
  secureTextEntry = false,
  keyboardType = 'default',
  error,
  icon,
  rightIcon,
  onRightIconPress
}) => {
  const [isFocused, setIsFocused] = React.useState(false);
  const animatedFocus = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animatedFocus, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused]);

  const borderColor = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.gray, colors.primary],
  });

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <Animated.View style={[
        styles.inputContainer,
        { borderColor },
        error && styles.inputContainerError
      ]}>
        {icon && (
          <View style={styles.iconContainer}>
            <Ionicons name={icon} size={20} color={isFocused ? colors.primary : colors.textLight} />
          </View>
        )}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textLight}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          autoCapitalize="none"
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIconContainer}>
            <Ionicons name={rightIcon} size={20} color={colors.textLight} />
          </TouchableOpacity>
        )}
      </Animated.View>
      {error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
};

export const CustomButton = ({ 
  title, 
  onPress, 
  variant = 'primary',
  disabled = false,
  style,
  icon,
  loading = false
}) => {
  const buttonStyle = [
    styles.button,
    variant === 'outline' && styles.buttonOutline,
    disabled && styles.buttonDisabled,
    style
  ];

  const textStyle = [
    styles.buttonText,
    variant === 'primary' && styles.buttonTextPrimary,
    variant === 'secondary' && styles.buttonTextSecondary,
    variant === 'outline' && styles.buttonTextOutline,
    disabled && styles.buttonTextDisabled
  ];

  const content = (
    <View style={styles.buttonContent}>
      {icon && <Ionicons name={icon} size={20} color={variant === 'outline' ? colors.primary : colors.white} style={styles.buttonIcon} />}
      <Text style={textStyle}>{title}</Text>
    </View>
  );

  if (variant === 'primary' && !disabled && !loading) {
    return (
      <TouchableOpacity
        style={[styles.buttonWrapper, style]}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientButton}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      {content}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.gray,
    paddingHorizontal: 16,
    height: 56,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  iconContainer: {
    marginRight: 12,
  },
  rightIconContainer: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginLeft: 4,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginLeft: 4,
  },
  buttonWrapper: {
    borderRadius: 16,
    marginVertical: 12,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gradientButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonSecondary: {
    backgroundColor: colors.secondary,
  },
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  buttonDisabled: {
    backgroundColor: colors.gray,
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  buttonTextPrimary: {
    color: colors.white,
  },
  buttonTextSecondary: {
    color: colors.white,
  },
  buttonTextOutline: {
    color: colors.primary,
  },
  buttonTextDisabled: {
    color: colors.textLight,
  },
  
  // Glass Container
  glassContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  glassFallback: {
    backgroundColor: colors.white,
  },
  
  // Blobs
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.6,
  },
  
  // Social Buttons
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.gray,
    backgroundColor: colors.white,
    marginVertical: 8,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  socialButtonGoogle: {
    backgroundColor: colors.white,
    borderColor: colors.gray,
  },
  socialButtonApple: {
    backgroundColor: colors.black,
    borderColor: colors.black,
  },
  socialIcon: {
    marginRight: 12,
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  socialButtonTextGoogle: {
    color: colors.textPrimary,
  },
  socialButtonTextApple: {
    color: colors.white,
  },
  
  // Divider
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.gray,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});
