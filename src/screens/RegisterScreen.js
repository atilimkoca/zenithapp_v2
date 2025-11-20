import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CustomInput, CustomButton } from '../components/UI';
import { colors } from '../constants/colors';
import { registerUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { Ionicons } from '@expo/vector-icons';

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
        // Update context with user data for immediate state change
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
              // App will automatically navigate to pending approval screen
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
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.background, colors.lightGray]}
        style={styles.gradient}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Header Section */}
            <View style={styles.headerSection}>
              <TouchableOpacity 
                style={styles.backButton}
                onPress={() => navigation.goBack()}
              >
                <Text style={styles.backButtonText}>←</Text>
              </TouchableOpacity>
              
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/zenith_logo_rounded.jpeg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              
              <Text style={styles.title}>{t('auth.createAccount')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.registerSubtitle')}
              </Text>
            </View>

            {/* Form Section */}
            <View style={styles.formSection}>
              <View style={styles.formContainer}>
                <View style={styles.nameRow}>
                  <View style={styles.nameInput}>
                    <CustomInput
                      label={t('auth.firstName')}
                      value={formData.firstName}
                      onChangeText={(value) => updateFormData('firstName', value)}
                      placeholder={t('auth.firstNamePlaceholder')}
                      error={errors.firstName}
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
                />
                
                <View style={styles.inputLabelRow}>
                  <Text style={styles.inputLabel}>{t('auth.phone')}</Text>
                  <Text style={styles.countryHint}>{selectedCountry.name}</Text>
                </View>
                <View style={[styles.phoneInputRow, errors.phone && styles.inputErrorBorder]}>
                  <TouchableOpacity
                    style={styles.countrySelector}
                    onPress={() => setCountryModalVisible(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                    <Text style={styles.countryDial}>{selectedCountry.dialCode}</Text>
                    <Ionicons name="chevron-down" size={16} color={colors.textSecondary} style={styles.countryChevron} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.phoneTextInput}
                    value={formData.phone}
                    onChangeText={(value) => updateFormData('phone', value)}
                    placeholder={selectedCountry.example || t('auth.phoneNumberPlaceholder')}
                    placeholderTextColor={colors.textLight}
                    keyboardType="number-pad"
                    maxLength={16}
                  />
                </View>
                {errors.phone && <Text style={styles.phoneErrorText}>{errors.phone}</Text>}
                
                <CustomInput
                  label={t('auth.password')}
                  value={formData.password}
                  onChangeText={(value) => updateFormData('password', value)}
                  placeholder={t('auth.createPasswordPlaceholder')}
                  secureTextEntry
                  error={errors.password}
                />
                
                <CustomInput
                  label={t('auth.confirmPassword')}
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateFormData('confirmPassword', value)}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  secureTextEntry
                  error={errors.confirmPassword}
                />
                
                {/* Terms and Conditions */}
                <View style={styles.termsContainer}>
                  <TouchableOpacity
                    style={styles.checkboxTouchable}
                    onPress={() => setAgreeToTerms(!agreeToTerms)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <View style={[styles.checkbox, agreeToTerms && styles.checkboxChecked]}>
                      {agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
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
                {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}

                <CustomButton
                  title={loading ? t('auth.creatingAccount') : t('auth.createAccountButton')}
                  onPress={handleRegister}
                  disabled={loading}
                  style={styles.registerButton}
                />
              </View>
            </View>

            {/* Login Link Section */}
            <View style={styles.loginSection}>
              <View style={styles.loginTextContainer}>
                <Text style={styles.loginText}>
                  {t('auth.alreadyHaveAccount')}
                </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.loginLink}>{t('auth.loginLinkText')}</Text>
                </TouchableOpacity>
              </View>
            </View>
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
                <Text style={styles.modalTitle}>{t('auth.selectCountry')}</Text>
                <FlatList
                  data={COUNTRY_OPTIONS}
                  keyExtractor={(item) => item.code}
                  ItemSeparatorComponent={() => <View style={styles.countryOptionDivider} />}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const isSelected = item.code === selectedCountry.code;
                    return (
                      <TouchableOpacity
                        style={[styles.countryOption, isSelected && styles.countryOptionActive]}
                        onPress={() => {
                          setSelectedCountry(item);
                          setCountryModalVisible(false);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.countryOptionFlag}>{item.flag}</Text>
                        <View style={styles.countryOptionTextWrapper}>
                          <Text style={styles.countryOptionName}>{item.name}</Text>
                          <Text style={styles.countryOptionDial}>
                            {item.dialCode}
                            {item.example ? ` • ${item.example}` : ''}
                          </Text>
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </Modal>

        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  headerSection: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  backButton: {
    position: 'absolute',
    left: 0,
    top: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  backButtonText: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 40,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  formSection: {
    flex: 1,
  },
  formContainer: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  nameRow: {
    flexDirection: 'row',
    marginHorizontal: -8,
  },
  nameInput: {
    flex: 1,
    marginHorizontal: 8,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 16,
  },
  checkboxTouchable: {
    marginRight: 12,
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.gray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkmark: {
    color: colors.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsTextWrapper: {
    flex: 1,
    paddingRight: 8,
  },
  termsText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  termsLink: {
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  countryHint: {
    marginLeft: 8,
    fontSize: 12,
    color: colors.textLight,
  },
  phoneInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(107, 114, 128, 0.2)',
    backgroundColor: colors.white,
    overflow: 'hidden',
    marginBottom: 8,
  },
  inputErrorBorder: {
    borderColor: colors.error,
  },
  countrySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    borderColor: 'rgba(107, 114, 128, 0.16)',
    marginRight: 12,
  },
  countryFlag: {
    fontSize: 20,
    marginRight: 6,
  },
  countryChevron: {
    marginLeft: 4,
  },

  countryDial: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 4,
  },
  phoneTextInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  phoneErrorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 4,
    marginBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
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
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '60%',
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  countryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  countryOptionActive: {
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  countryOptionFlag: {
    fontSize: 20,
    marginRight: 12,
  },
  countryOptionTextWrapper: {
    flex: 1,
  },
  countryOptionName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  countryOptionDial: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  countryOptionDivider: {
    height: 1,
    backgroundColor: 'rgba(107, 114, 128, 0.12)',
    marginLeft: 44,
    marginRight: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: -8,
    marginBottom: 8,
  },
  registerButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
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
  },
  loginSection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  loginTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  loginLink: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
});
