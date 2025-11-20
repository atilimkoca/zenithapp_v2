import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Image,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../constants/colors';
import { logoutUser } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useNavigation } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

export default function PendingApprovalScreen() {
  const { user, setUserData, setApprovalStatus } = useAuth();
  const { t } = useI18n();
  const navigation = useNavigation();
  const [pulseAnim] = useState(new Animated.Value(1));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    // Pulse animation for the waiting icon
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      t('pendingApproval.logoutPrompt'),
      t('pendingApproval.logoutConfirm'),
      [
        { text: t('pendingApproval.cancel'), style: 'cancel' },
        { 
          text: t('pendingApproval.logout'), 
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutUser();
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const handleNavigateTerms = () => {
    navigation.navigate('Terms');
  };

  const handleNavigatePrivacy = () => {
    navigation.navigate('Privacy');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[colors.primary + '10', colors.background, colors.lightGray]}
        style={styles.gradient}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
            
            {/* Header with Logo */}
            <View style={styles.header}>
              <View style={styles.logoContainer}>
                <Image 
                  source={require('../../assets/zenith_logo_rounded.jpeg')}
                  style={styles.logo}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.studioName}>{t('pendingApproval.studioName')}</Text>
              <Text style={styles.studioSubtitle}>{t('pendingApproval.studioSubtitle')}</Text>
            </View>

            {/* Main Status Card */}
            <View style={styles.statusCard}>
              <Animated.View 
                style={[
                  styles.statusIconContainer,
                  { transform: [{ scale: pulseAnim }] }
                ]}
              >
                <View style={styles.statusIcon}>
                  <Text style={styles.statusEmoji}>⏳</Text>
                </View>
              </Animated.View>
              
              <Text style={styles.statusTitle}>{t('pendingApproval.title')}</Text>
              
              <Text style={styles.statusMessage}>
                {t('pendingApproval.welcomeMessage')}
                {'\n\n'}
                {t('pendingApproval.accountCreated')} {t('pendingApproval.processNote')}
              </Text>

              {/* Info Cards */}
              <View style={styles.infoContainer}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>⚡</Text>
                  <Text style={styles.infoTitle}>{t('pendingApproval.quickProcessing')}</Text>
                  <Text style={styles.infoText}>{t('pendingApproval.quickProcessingDetail')}</Text>
                </View>
                
                <View style={styles.infoCard}>
                  <Text style={styles.infoIcon}>🔔</Text>
                  <Text style={styles.infoTitle}>{t('pendingApproval.autoUpdate')}</Text>
                  <Text style={styles.infoText}>{t('pendingApproval.autoUpdateDetail')}</Text>
                </View>
              </View>

              {/* Steps */}
              <View style={styles.stepsContainer}>
                <View style={styles.step}>
                  <View style={[styles.stepCircle, styles.stepCompleted]}>
                    <Text style={styles.stepNumber}>✓</Text>
                  </View>
                  <Text style={styles.stepText}>{t('pendingApproval.registrationComplete')}</Text>
                </View>
                
                <View style={styles.stepLine} />
                
                <View style={styles.step}>
                  <View style={[styles.stepCircle, styles.stepActive]}>
                    <Text style={styles.stepNumber}>2</Text>
                  </View>
                  <Text style={styles.stepText}>{t('pendingApproval.awaitingApproval')}</Text>
                </View>
                
                <View style={styles.stepLine} />
                
                <View style={styles.step}>
                  <View style={styles.stepCircle}>
                    <Text style={styles.stepNumber}>3</Text>
                  </View>
                  <Text style={styles.stepText}>{t('pendingApproval.appAccess')}</Text>
                </View>
              </View>
            </View>

            {/* Bottom Section */}
            <View style={styles.bottomSection}>
              <Text style={styles.helpText}>
                {t('pendingApproval.supportMessage')}
              </Text>
              
              <TouchableOpacity onPress={handleLogout} style={styles.logoutLink}>
                <Text style={styles.logoutText}>{t('pendingApproval.logout')}</Text>
              </TouchableOpacity>

              <Text style={styles.legalTitle}>{t('pendingApproval.legalTitle')}</Text>
              <View style={styles.legalLinks}>
                <TouchableOpacity
                  style={styles.legalLinkWrapper}
                  onPress={handleNavigateTerms}
                  activeOpacity={0.75}
                >
                  <Text style={styles.legalLinkText}>{t('auth.termsOfService')}</Text>
                </TouchableOpacity>
                <View style={styles.legalDivider} />
                <TouchableOpacity
                  style={styles.legalLinkWrapper}
                  onPress={handleNavigatePrivacy}
                  activeOpacity={0.75}
                >
                  <Text style={styles.legalLinkText}>{t('auth.privacyPolicy')}</Text>
                </TouchableOpacity>
              </View>
            </View>
            
          </Animated.View>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  studioName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  studioSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    opacity: 0.8,
  },
  statusCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 28,
    marginVertical: 20,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  statusIconContainer: {
    marginBottom: 20,
  },
  statusIcon: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary + '30',
  },
  statusEmoji: {
    fontSize: 45,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 32,
  },
  infoCard: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  stepsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  step: {
    alignItems: 'center',
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepCompleted: {
    backgroundColor: colors.success,
  },
  stepActive: {
    backgroundColor: colors.primary,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.white,
  },
  stepText: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 60,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray,
    marginHorizontal: 8,
    marginBottom: 28,
  },
  bottomSection: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingBottom: 40,
  },
  helpText: {
    fontSize: 14,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  logoutLink: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  logoutText: {
    fontSize: 16,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
  },
  legalTitle: {
    marginTop: 28,
    marginBottom: 12,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  legalLinkWrapper: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  legalDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(107, 114, 128, 0.3)',
  },
  legalLinkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
