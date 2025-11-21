import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CustomInput, CustomButton, GlassContainer, BackgroundBlob } from '../components/UI';
import { colors } from '../constants/colors';
import { loginUser, resetPassword } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';

const { width, height } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  
  // Forgot Password Modal State
  const [forgotPasswordModalVisible, setForgotPasswordModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetEmailError, setResetEmailError] = useState('');

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const validateForm = () => {
    const newErrors = {};
    
    if (!email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    
    if (!password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (password.length < 6) {
      newErrors.password = t('auth.passwordMinLength');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const result = await loginUser(email, password);
      
      if (result.success) {
        if (result.requiresApproval) {
          Alert.alert(t('info'), result.messageKey ? t(result.messageKey) : result.message);
        }
      } else {
        Alert.alert(t('error'), result.messageKey ? t(result.messageKey) : result.message);
      }
    } catch (error) {
      Alert.alert(t('error'), t('general.unexpectedError') || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setResetEmail(email);
    setResetEmailError('');
    setForgotPasswordModalVisible(true);
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      setResetEmailError(t('auth.emailRequired'));
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(resetEmail)) {
      setResetEmailError(t('auth.invalidEmail'));
      return;
    }

    setResetLoading(true);
    setResetEmailError('');

    try {
      const result = await resetPassword(resetEmail);
      if (result.success) {
        setForgotPasswordModalVisible(false);
        Alert.alert(t('success'), result.message || t('auth.resetEmailSent') || 'Şifre sıfırlama e-postası gönderildi.');
        setResetEmail('');
      } else {
        setResetEmailError(result.message || t('auth.resetEmailError') || 'Şifre sıfırlama e-postası gönderilemedi.');
      }
    } catch (error) {
      setResetEmailError(t('auth.resetEmailError') || 'Şifre sıfırlama e-postası gönderilemedi.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setForgotPasswordModalVisible(false);
    setResetEmail('');
    setResetEmailError('');
    setResetLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Design */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[colors.primaryDark, colors.primary]}
          style={styles.topGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <BackgroundBlob 
          style={{ top: -50, right: -50, width: 200, height: 200, backgroundColor: 'rgba(255,255,255,0.1)' }} 
        />
        <BackgroundBlob 
          style={{ top: 100, left: -30, width: 150, height: 150, backgroundColor: 'rgba(255,255,255,0.05)' }} 
        />
        <View style={styles.curveContainer}>
          <View style={styles.curve} />
        </View>
      </View>

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Logo Section */}
            <Animated.View 
              style={[
                styles.logoSection, 
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/zenith_logo_rounded.jpeg')}
                  style={styles.logo}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.welcomeTitle}>{t('auth.welcome')}</Text>
              <Text style={styles.welcomeSubtitle}>
                {t('auth.welcomeSubtitle')}
              </Text>
            </Animated.View>

            {/* Form Section */}
            <Animated.View 
              style={[
                styles.formSection,
                { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, 1.5) }] }
              ]}
            >
              <GlassContainer style={styles.formCard}>
                <CustomInput
                  label={t('auth.email')}
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  keyboardType="email-address"
                  error={errors.email}
                  icon="mail-outline"
                />
                
                <CustomInput
                  label={t('auth.password')}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  secureTextEntry={!showPassword}
                  error={errors.password}
                  icon="lock-closed-outline"
                  rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                />
                
                <TouchableOpacity 
                  style={styles.forgotPassword}
                  onPress={handleForgotPassword}
                >
                  <Text style={styles.forgotPasswordText}>
                    {t('auth.forgotPassword')}
                  </Text>
                </TouchableOpacity>
                
                <CustomButton
                  title={loading ? t('auth.loggingIn') : t('auth.loginButton')}
                  onPress={handleLogin}
                  disabled={loading}
                  loading={loading}
                  style={styles.loginButton}
                  icon="log-in-outline"
                />

                <View style={styles.registerContainer}>
                  <Text style={styles.registerText}>
                    {t('auth.noAccount')}
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                    <Text style={styles.registerLink}>{t('auth.registerLink')}</Text>
                  </TouchableOpacity>
                </View>
              </GlassContainer>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Forgot Password Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={forgotPasswordModalVisible}
        onRequestClose={closeForgotPasswordModal}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeForgotPasswordModal}
          />
          
          <GlassContainer style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIconContainer}>
                <Ionicons name="key-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.modalTitle}>{t('auth.forgotPassword')}</Text>
              <Text style={styles.modalSubtitle}>
                {t('auth.resetPasswordSubtitle') || 'Şifrenizi sıfırlamak için e-posta adresinizi girin'}
              </Text>
            </View>

            <View style={styles.modalBody}>
              <CustomInput
                label={t('auth.email')}
                value={resetEmail}
                onChangeText={(text) => {
                  setResetEmail(text);
                  setResetEmailError('');
                }}
                placeholder={t('auth.emailPlaceholder')}
                keyboardType="email-address"
                icon="mail-outline"
                error={resetEmailError}
              />
              
              <View style={styles.infoContainer}>
                <Ionicons name="information-circle-outline" size={20} color={colors.info} />
                <Text style={styles.infoText}>
                  {t('auth.resetPasswordInfo') || 'Şifre sıfırlama bağlantısı e-posta adresinize gönderilecektir.'}
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={closeForgotPasswordModal}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.resetButton} 
                onPress={handlePasswordReset}
                disabled={resetLoading}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.resetButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {resetLoading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Text style={styles.resetButtonText}>{t('auth.sendButton') || 'Gönder'}</Text>
                      <Ionicons name="arrow-forward" size={20} color={colors.white} style={{ marginLeft: 8 }} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </GlassContainer>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
    overflow: 'hidden',
  },
  topGradient: {
    flex: 1,
  },
  curveContainer: {
    position: 'absolute',
    bottom: -50,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: colors.background,
    borderTopLeftRadius: 50,
    borderTopRightRadius: 50,
    transform: [{ scaleX: 1.5 }],
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  logoSection: {
    alignItems: 'center',
    marginTop: height * 0.08,
    marginBottom: 30,
  },
  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 4,
    borderColor: colors.white,
  },
  logo: {
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },
  formSection: {
    flex: 1,
  },
  formCard: {
    // Styles handled by GlassContainer default + overrides
    padding: 24,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginTop: 8,
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  loginButton: {
    marginBottom: 10,
  },
  registerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  registerLink: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  modalIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalBody: {
    marginBottom: 24,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    padding: 16,
    borderRadius: 16,
    marginTop: 16,
  },
  infoText: {
    fontSize: 13,
    color: colors.info,
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  resetButton: {
    flex: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  resetButtonGradient: {
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resetButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
