import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Alert,
  TextInput,
  Modal,
  FlatList,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomInput, CustomButton, GlassContainer, BackgroundBlob, Divider } from '../components/UI';
import { colors } from '../constants/colors';
import { registerUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const COUNTRY_OPTIONS = [
  { code: 'TR', name: 'Türkiye', dialCode: '+90', flag: '🇹🇷', example: '5XX XXX XX XX' },
  { code: 'US', name: 'United States', dialCode: '+1', flag: '🇺🇸', example: '555 123 4567' },
  { code: 'GB', name: 'United Kingdom', dialCode: '+44', flag: '🇬🇧', example: '7712 345678' },
  { code: 'DE', name: 'Deutschland', dialCode: '+49', flag: '🇩🇪', example: '1512 3456789' },
  { code: 'FR', name: 'France', dialCode: '+33', flag: '🇫🇷', example: '6 12 34 56 78' },
];

export default function RegisterScreen({ navigation }) {
  const { t } = useI18n();
  const { setUserData, setApprovalStatus } = useAuth();
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_OPTIONS[0]);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);
  const [isCountryModalVisible, setCountryModalVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  const handleOpenTerms = () => navigation.navigate('Terms');
  const handleOpenPrivacy = () => navigation.navigate('Privacy');

  const updateFormData = (field, value) => {
    let processedValue = value;
    if (field === 'phone') {
      processedValue = value.replace(/[^0-9]/g, '');
    }
    setFormData(prev => ({ ...prev, [field]: processedValue }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.firstName.trim()) {
      newErrors.firstName = t('auth.firstNameRequired');
    }
    
    if (!formData.lastName.trim()) {
      newErrors.lastName = t('auth.lastNameRequired');
    }
    
    if (!formData.email) {
      newErrors.email = t('auth.emailRequired');
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('auth.invalidEmail');
    }
    
    if (!formData.phone) {
      newErrors.phone = t('auth.phoneRequired');
    } else if (formData.phone.length < 7) {
      newErrors.phone = t('auth.invalidPhone');
    }
    
    if (!formData.password) {
      newErrors.password = t('auth.passwordRequired');
    } else if (formData.password.length < 6) {
      newErrors.password = t('auth.passwordMinLength');
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.confirmPasswordRequired');
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = t('auth.passwordsNotMatch');
    }
    
    if (!agreeToTerms) {
      newErrors.terms = t('auth.termsRequired');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const result = await registerUser(
        formData.email, 
        formData.password, 
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: `${selectedCountry.dialCode}${formData.phone}`,
        }
      );
      
      if (result.success) {
        if (result.userData) {
          setUserData(result.userData);
          setApprovalStatus('pending');
        }
        
        Alert.alert(
          t('success'), 
          result.messageKey ? t(result.messageKey) : result.message,
          [
            {
              text: t('confirm')
            }
          ]
        );
      } else {
        Alert.alert(t('error'), result.messageKey ? t(result.messageKey) : result.message);
      }
    } catch (error) {
      Alert.alert(t('error'), t('general.unexpectedError') || 'Beklenmeyen bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Design */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={[colors.primary, colors.primaryLight]}
          style={styles.topGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <BackgroundBlob 
          style={{ top: -30, left: -30, width: 180, height: 180, backgroundColor: 'rgba(255,255,255,0.08)' }} 
        />
        <BackgroundBlob 
          style={{ top: 80, right: -40, width: 140, height: 140, backgroundColor: 'rgba(255,255,255,0.05)' }} 
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
            {/* Header Section */}
            <Animated.View 
              style={[
                styles.headerSection,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}
            >
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Ionicons name="arrow-back" size={24} color={colors.primary} />
              </TouchableOpacity>
              
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>{t('auth.createAccount')}</Text>
                <Text style={styles.subtitle}>
                  {t('auth.registerSubtitle')}
                </Text>
              </View>
            </Animated.View>

            {/* Form Section */}
            <Animated.View 
              style={[
                styles.formSection,
                { opacity: fadeAnim, transform: [{ translateY: Animated.multiply(slideAnim, 1.5) }] }
              ]}
            >
              <GlassContainer style={styles.formCard}>
                <View style={styles.nameRow}>
                  <View style={styles.nameInput}>
                    <CustomInput
                      label={t('auth.firstName')}
                      value={formData.firstName}
                      onChangeText={(value) => updateFormData('firstName', value)}
                      placeholder={t('auth.firstNamePlaceholder')}
                      error={errors.firstName}
                      icon="person-outline"
                    />
                  </View>
                  <View style={styles.nameInput}>
                    <CustomInput
                      label={t('auth.lastName')}
                      value={formData.lastName}
                      onChangeText={(value) => updateFormData('lastName', value)}
                      placeholder={t('auth.lastNamePlaceholder')}
                      error={errors.lastName}
                    />
                  </View>
                </View>
                
                <CustomInput
                  label={t('auth.email')}
                  value={formData.email}
                  onChangeText={(value) => updateFormData('email', value)}
                  placeholder={t('auth.emailPlaceholder')}
                  keyboardType="email-address"
                  error={errors.email}
                  icon="mail-outline"
                />
                
                <View style={styles.phoneContainer}>
                  <Text style={styles.label}>{t('auth.phone')}</Text>
                  <View style={[styles.phoneInputWrapper, errors.phone && styles.inputErrorBorder]}>
                    <TouchableOpacity
                      style={styles.countrySelector}
                      onPress={() => setCountryModalVisible(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                      <Text style={styles.countryDial}>{selectedCountry.dialCode}</Text>
                      <Ionicons name="chevron-down" size={14} color={colors.textSecondary} />
                    </TouchableOpacity>
                    <TextInput
                      style={styles.phoneInput}
                      value={formData.phone}
                      onChangeText={(value) => updateFormData('phone', value)}
                      placeholder={selectedCountry.example || t('auth.phoneNumberPlaceholder')}
                      placeholderTextColor={colors.textLight}
                      keyboardType="number-pad"
                      maxLength={15}
                    />
                  </View>
                  {errors.phone && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                      <Text style={styles.errorText}>{errors.phone}</Text>
                    </View>
                  )}
                </View>
                
                <CustomInput
                  label={t('auth.password')}
                  value={formData.password}
                  onChangeText={(value) => updateFormData('password', value)}
                  placeholder={t('auth.createPasswordPlaceholder')}
                  secureTextEntry={!showPassword}
                  error={errors.password}
                  icon="lock-closed-outline"
                  rightIcon={showPassword ? "eye-off-outline" : "eye-outline"}
                  onRightIconPress={() => setShowPassword(!showPassword)}
                />
                
                <CustomInput
                  label={t('auth.confirmPassword')}
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  secureTextEntry={!showConfirmPassword}
                  error={errors.confirmPassword}
                  icon="lock-closed-outline"
                  rightIcon={showConfirmPassword ? "eye-off-outline" : "eye-outline"}
                  onRightIconPress={() => setShowConfirmPassword(!showConfirmPassword)}
                />
                
                {/* Terms and Conditions */}
                <View style={styles.termsContainer}>
                  <TouchableOpacity
                    style={styles.checkboxTouchable}
                    onPress={() => setAgreeToTerms(!agreeToTerms)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                      {agreeToTerms && <Ionicons name="checkmark" size={14} color={colors.white} />}
                    </View>
                  </TouchableOpacity>
                  <View style={styles.termsTextWrapper}>
                    <Text style={styles.termsText}>
                      {t('auth.termsAgreementPrefix')}
                      <Text style={styles.termsLink} onPress={handleOpenTerms}>
                        {t('auth.termsOfService')}
                      </Text>
                      {t('auth.termsAgreementMiddle')}
                      <Text style={styles.termsLink} onPress={handleOpenPrivacy}>
                        {t('auth.privacyPolicy')}
                      </Text>
                      {t('auth.termsAgreementSuffix')}
                    </Text>
                  </View>
                </View>
                {errors.terms && (
                  <Text style={[styles.errorText, { marginLeft: 32, marginTop: -8, marginBottom: 16 }]}>
                    {errors.terms}
                  </Text>
                )}

                <CustomButton
                  title={loading ? t('auth.creatingAccount') : t('auth.createAccountButton')}
                  onPress={handleRegister}
                  disabled={loading}
                  loading={loading}
                  style={styles.registerButton}
                  icon="person-add-outline"
                />

                <View style={styles.loginSection}>
                  <Text style={styles.loginText}>
                    {t('auth.alreadyHaveAccount')}
                  </Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                    <Text style={styles.loginLink}>{t('auth.loginLinkText')}</Text>
                  </TouchableOpacity>
                </View>
              </GlassContainer>
            </Animated.View>
          </ScrollView>

          <Modal
            visible={isCountryModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setCountryModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableWithoutFeedback onPress={() => setCountryModalVisible(false)} >
                <View style={styles.modalBackdrop} />
              </TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('auth.selectCountry')}</Text>
                  <TouchableOpacity onPress={() => setCountryModalVisible(false)}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={COUNTRY_OPTIONS}
                  keyExtractor={(item) => item.code}
                  ItemSeparatorComponent={() => <View style={styles.countryOptionDivider} />}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }) => {
                    const isSelected = item.code === selectedCountry.code;
                    return (
                      <TouchableOpacity
                        style={[styles.countryOption, isSelected && styles.countryOptionActive]}
                        onPress={() => {
                          setSelectedCountry(item);
                          setCountryModalVisible(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.countryOptionFlag}>{item.flag}</Text>
                        <View style={styles.countryOptionTextWrapper}>
                          <Text style={styles.countryOptionName}>{item.name}</Text>
                          <Text style={styles.countryOptionDial}>
                            {item.dialCode}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

        </KeyboardAvoidingView>
      </SafeAreaView>
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
    bottom: -60,
    left: -width * 0.25,
    width: width * 1.5,
    height: 120,
    backgroundColor: colors.background,
    borderTopLeftRadius: width * 0.75,
    borderTopRightRadius: width * 0.75,
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
  headerSection: {
    marginTop: height * 0.05,
    marginBottom: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  headerTextContainer: {
    paddingLeft: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  formSection: {
    flex: 1,
  },
  formCard: {
    // Styles handled by GlassContainer default + overrides
    padding: 20,
  },
  nameRow: {
    flexDirection: 'row',
    marginHorizontal: -6,
  },
  nameInput: {
    flex: 1,
    marginHorizontal: 6,
  },
  phoneContainer: {
    marginVertical: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.gray,
    height: 56,
    overflow: 'hidden',
  },
  inputErrorBorder: {
    borderColor: colors.error,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: '100%',
    borderRightWidth: 1,
    borderRightColor: colors.gray,
    backgroundColor: colors.lightGray,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 8,
  },
  countryDial: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 6,
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingHorizontal: 16,
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 20,
    paddingHorizontal: 4,
  },
  checkboxTouchable: {
    marginRight: 12,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
  },
  termsTextWrapper: {
    flex: 1,
  },
  termsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '700',
  },
  registerButton: {
    marginBottom: 20,
  },
  loginSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  loginText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
    marginLeft: 6,
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    width: '100%',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '70%',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  countryOptionActive: {
    backgroundColor: colors.lightGray,
  },
  countryOptionFlag: {
    fontSize: 24,
    marginRight: 16,
  },
  countryOptionTextWrapper: {
    flex: 1,
  },
  countryOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  countryOptionDial: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  countryOptionDivider: {
    height: 1,
    backgroundColor: colors.gray,
    marginLeft: 60,
  },
});

