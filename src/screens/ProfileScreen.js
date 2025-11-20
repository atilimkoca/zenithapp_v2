import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Dimensions,
  Platform,
  Linking,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { profileService } from '../services/profileService';
import { logoutUser } from '../services/authService';
import UniqueHeader from '../components/UniqueHeader';
import { lessonCreditsService } from '../services/lessonCreditsService';

export default function ProfileScreen({ navigation }) {
  const { userData, user, setUserData } = useAuth();
  const { t, language, changeLanguage, getAvailableLanguages } = useI18n();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [userStats, setUserStats] = useState({
    totalLessons: 0,
    completedCount: 0,
    monthlyLessons: 0,
    totalHours: 0
  });
  const [remainingCredits, setRemainingCredits] = useState(0);

  // Function to safely close modal
  const closeModal = () => {
    setModalVisible(false);
    // Also ensure loading is false when closing modal
    setLoading(false);
    // Force a small delay to ensure state update
    setTimeout(() => {
    }, 100);
  };

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    profileImageUrl: null,
    isFrontCamera: false,
  });

  // Default profile avatars
  const defaultProfileImages = [
    { id: 1, name: 'Avatar 1', emoji: '👨‍🦱' },
    { id: 2, name: 'Avatar 2', emoji: '👩‍🦰' },
    { id: 3, name: 'Avatar 3', emoji: '🧔' },
    { id: 4, name: 'Avatar 4', emoji: '👩‍🦱' },
    { id: 5, name: 'Avatar 5', emoji: '🏃‍♂️' },
    { id: 6, name: 'Avatar 6', emoji: '💪' },
    { id: 7, name: 'Avatar 7', emoji: '🌟' },
    { id: 8, name: 'Avatar 8', emoji: '✨' },
  ];

  useEffect(() => {
    loadUserStats();
    loadUserCredits();
  }, [user]);

  const loadUserCredits = async () => {
    if (!user?.uid) return;
    
    try {
      const result = await lessonCreditsService.getUserCredits(user.uid);
      if (result.success) {
        setRemainingCredits(result.credits);
      }
    } catch (error) {
      console.error('Error loading user credits:', error);
    }
  };

  useEffect(() => {
    // Update profile data when userData changes
    if (userData) {
      setProfileData({
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        phone: userData.phone || '',
        profileImageUrl: userData.profileImageUrl || null,
        isFrontCamera: userData.isFrontCamera || false,
      });
    }
  }, [userData]);



  // Cleanup function to ensure modal is closed when component unmounts
  useEffect(() => {
    return () => {
      setModalVisible(false);
      setLoading(false); // Also reset loading state
    };
  }, []);

  const loadUserStats = async () => {
    if (!user) return;
    
    try {
      const result = await profileService.getUserStats(user.uid);
      if (result.success) {
        setUserStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserStats();
    await loadUserCredits();
    setRefreshing(false);
  };

  const showCreditManagementAlert = (action) => {
    Alert.prompt(
      action === 'add' ? t('admin.addCredit') : t('admin.setCredit'),
      action === 'add' 
        ? `${t('admin.currentCredit')}: ${remainingCredits}\n${t('admin.addCreditAmount')}`
        : `${t('admin.currentCredit')}: ${remainingCredits}\n${t('admin.setCreditAmount')}`,
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('confirm'),
          onPress: (input) => handleCreditManagement(action, input),
        },
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  const handleCreditManagement = async (action, input) => {
    if (!input || isNaN(input) || parseInt(input) <= 0) {
      Alert.alert(t('error'), t('admin.invalidAmount'));
      return;
    }

    const amount = parseInt(input);
    setLoading(true);

    try {
      let result;
      if (action === 'add') {
        result = await lessonCreditsService.addUserCredits(
          user.uid, 
          amount, 
          'Admin tarafından eklendi'
        );
      } else {
        result = await lessonCreditsService.setUserCredits(
          user.uid, 
          amount, 
          'Admin tarafından ayarlandı'
        );
      }

      if (result.success) {
        Alert.alert(t('success'), result.message);
        await loadUserCredits(); // Refresh credits
      } else {
        Alert.alert(t('error'), result.message);
      }
    } catch (error) {
      Alert.alert(t('error'), t('admin.creditError'));
      console.error('Credit management error:', error);
    } finally {
      setLoading(false);
    }
  };

    const handleSaveProfile = async () => {
    
    if (!user) {
      Alert.alert(t('error'), t('errors.userNotFound'));
      return;
    }
    
    setLoading(true);
    
    try {
      // Simulate a delay for testing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      Alert.alert(t('success') + '! ✅', t('profile.profileUpdated'));
      closeModal();
      
      // Update the auth context with new data
      if (setUserData) {
        setUserData({
          ...userData,
          ...profileData,
          displayName: `${profileData.firstName} ${profileData.lastName}`.trim()
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert(t('error'), t('errors.profileSaveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelection = () => {
    // Temporarily disable image selection to prevent conflicts
    Alert.alert(
      'Profil Fotoğrafı', 
      t('photo.photoSelectionDisabled'),
      [{ text: t('done'), style: 'default' }]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      t('auth.logout'),
      t('auth.logoutConfirm'),
      [
        {
          text: t('cancel'),
          style: 'cancel',
        },
        {
          text: t('auth.logoutButton'),
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await logoutUser();
              if (!result.success) {
                Alert.alert(t('error'), result.message || t('errors.logoutError'));
              }
              // Navigation will be handled by AuthContext
            } catch (error) {
              console.error('Logout error:', error);
              Alert.alert(t('error'), t('errors.logoutError'));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleLanguageSelect = async (languageCode) => {
    try {
      // Prepare success message in target language before changing
      const successMessages = {
        en: {
          title: 'Success',
          message: 'Language changed successfully!'
        },
        tr: {
          title: 'Başarılı',
          message: 'Dil başarıyla değiştirildi!'
        }
      };
      
      const targetMessage = successMessages[languageCode];
      
      await changeLanguage(languageCode);
      setLanguageModalVisible(false);
      
      // Show success message in the target language
      setTimeout(() => {
        Alert.alert(targetMessage.title, targetMessage.message);
      }, 100);
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(t('error'), t('errors.languageChangeError'));
    }
  };

  const showAvatarSelection = () => {
    Alert.alert(
      t('photo.selectAvatar'),
      t('photo.selectAvatarPrompt'),
      [
        { text: t('cancel'), style: 'cancel' },
        ...defaultProfileImages.map(avatar => ({
          text: `${avatar.emoji} ${avatar.name}`,
          onPress: () => handleAvatarSelect(avatar)
        }))
      ]
    );
  };

  const handleAvatarSelect = async (avatar) => {
    const avatarUrl = `avatar_${avatar.id}`;
    
    setProfileData(prev => ({ 
      ...prev, 
      profileImageUrl: avatarUrl,
      isFrontCamera: false 
    }));
    
    if (user) {
      try {
        await profileService.updateProfileImage(user.uid, avatarUrl);
        setUserData({
          ...userData,
          profileImageUrl: avatarUrl
        });
      } catch (error) {
        console.error('Error updating avatar:', error);
      }
    }
  };

  const pickImageFromGallery = async () => {
    try {
      // First check current permission status
      const { status: currentStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      
      let finalStatus = currentStatus;
      
      // If no permission, request it
      if (currentStatus !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = newStatus;
      }
      
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          t('photo.galleryAccess'), 
          t('photo.galleryPermission'),
          [
            { text: t('cancel'), style: 'cancel' },
            { 
              text: t('photo.goToSettings'), 
              onPress: () => {
                // Open app settings
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });


      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        setProfileData(prev => ({ 
          ...prev, 
          profileImageUrl: imageUri,
          isFrontCamera: false 
        }));
        
        if (user) {
          try {
            await profileService.updateProfileImage(user.uid, imageUri);
            setUserData({
              ...userData,
              profileImageUrl: imageUri
            });
          } catch (error) {
            console.error('Error updating profile image:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(t('error'), t('errors.photoSelectionError'));
    }
  };

  const takePhoto = async () => {
    try {
      // Check current camera permission
      const { status: currentStatus } = await ImagePicker.getCameraPermissionsAsync();
      
      let finalStatus = currentStatus;
      
      // If no permission, request it
      if (currentStatus !== 'granted') {
        const { status: newStatus } = await ImagePicker.requestCameraPermissionsAsync();
        finalStatus = newStatus;
      }
      
      
      if (finalStatus !== 'granted') {
        Alert.alert(
          t('photo.cameraAccess'), 
          t('photo.cameraPermission'),
          [
            { text: t('cancel'), style: 'cancel' },
            { 
              text: t('photo.goToSettings'), 
              onPress: () => {
                // Open app settings
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        return;
      }

      // Use front camera for profile pictures (selfies are more common for profiles)
      launchCamera(ImagePicker.CameraType.front);

    } catch (error) {
      console.error('Error with camera permissions:', error);
      Alert.alert(t('error'), t('errors.cameraError'));
    }
  };

  const launchCamera = async (cameraType) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
        exif: false,
        cameraType: cameraType,
        allowsMultipleSelection: false,
      });


      if (!result.canceled && result.assets && result.assets[0]) {
        let imageUri = result.assets[0].uri;
        
        // For front camera, the image might be mirrored
        // We'll handle this in the display by not mirroring it
        // since most users expect to see themselves as they appear to others
        
        setProfileData(prev => ({ 
          ...prev, 
          profileImageUrl: imageUri,
          isFrontCamera: cameraType === ImagePicker.CameraType.front 
        }));
        
        if (user) {
          try {
            await profileService.updateProfileImage(user.uid, imageUri);
            setUserData({
              ...userData,
              profileImageUrl: imageUri,
              isFrontCamera: cameraType === ImagePicker.CameraType.front
            });
          } catch (error) {
            console.error('Error updating profile image:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t('error'), t('errors.photoSelectionError'));
    }
  };

  const renderProfileImage = () => {
    if (profileData.profileImageUrl) {
      // Check if it's an avatar or actual image
      if (profileData.profileImageUrl.startsWith('avatar_')) {
        const avatarId = parseInt(profileData.profileImageUrl.replace('avatar_', ''));
        const avatar = defaultProfileImages.find(a => a.id === avatarId);
        if (avatar) {
          return (
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
            </View>
          );
        }
      } else {
        // It's a real image URI
        // Apply horizontal flip for front camera images to fix mirroring
        const imageStyle = profileData.isFrontCamera 
          ? [styles.profileImage, { transform: [{ scaleX: -1 }] }]
          : styles.profileImage;
        
        return (
          <Image 
            source={{ uri: profileData.profileImageUrl }}
            style={imageStyle}
          />
        );
      }
    }
    
    // Default avatar
    return (
      <View style={styles.defaultAvatarContainer}>
        <Ionicons name="person" size={40} color={colors.textSecondary} />
      </View>
    );
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.headerTitle}>{t('profile.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('loading')} ⏳</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
                      <Text style={styles.loadingText}>{t('ui.profileUpdating')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <UniqueHeader
        title={t('profile.title')} 
        subtitle={t('profile.subtitle')}
        showNotification={false}
      />

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContent}>
          {/* Profile Card */}
          <View style={styles.profileCard}>
            <View style={styles.profileImageContainer}>
              {renderProfileImage()}
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>
                {userData?.displayName || `${profileData.firstName} ${profileData.lastName}`.trim() || t('profile.title')}
              </Text>
              <Text style={styles.profileEmail}>{profileData.email}</Text>
            </View>
          </View>

          {/* Statistics */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>{t('profile.statistics')}</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Ionicons name="ticket-outline" size={24} color={colors.primary} />
                <Text style={styles.statNumber}>{remainingCredits}</Text>
                <Text style={styles.statLabel}>{t('profile.remainingLessons')}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                <Text style={styles.statNumber}>{userStats.completedCount}</Text>
                <Text style={styles.statLabel}>{t('profile.totalLessons')}</Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="trophy" size={24} color={colors.warning} />
                <Text style={styles.statNumber}>{userStats.monthlyLessons}</Text>
                <Text style={styles.statLabel}>{t('profile.thisMonth')}</Text>
              </View>
            </View>
          </View>

          {/* Admin Credit Management */}
          {userData?.role === 'admin' && (
            <View style={styles.adminSection}>
              <Text style={styles.sectionTitle}>{t('admin.creditManagement')}</Text>
              <View style={styles.adminControls}>
                <TouchableOpacity 
                  style={[styles.adminButton, { backgroundColor: colors.success }]}
                  onPress={() => showCreditManagementAlert('add')}
                >
                  <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                  <Text style={styles.adminButtonText}>{t('admin.addCredit')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.adminButton, { backgroundColor: colors.warning }]}
                  onPress={() => showCreditManagementAlert('set')}
                >
                  <Ionicons name="create-outline" size={20} color={colors.white} />
                  <Text style={styles.adminButtonText}>{t('admin.setCredit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Personal Info Button */}
          <TouchableOpacity 
            style={styles.modernButton}
            onPress={() => {
              setModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.modernButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.modernButtonContent}>
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="person-outline" size={24} color={colors.white} />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.modernButtonTitle}>{t('profile.personalInfo')}</Text>
                  <Text style={styles.modernButtonSubtitle}>{t('profile.personalInfoDescription')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Language Selection Button */}
          <TouchableOpacity 
            style={styles.modernButton}
            onPress={() => setLanguageModalVisible(true)}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#4A90E2', '#357ABD']}
              style={styles.modernButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.modernButtonContent}>
                <View style={styles.buttonIconContainer}>
                  <Ionicons name="globe-outline" size={24} color={colors.white} />
                </View>
                <View style={styles.buttonTextContainer}>
                  <Text style={styles.modernButtonTitle}>{t('profile.language')}</Text>
                  <Text style={styles.modernButtonSubtitle}>
                    {language === 'tr' ? 'Türkçe' : 'English'} - {t('profile.selectLanguage')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Admin Panel Button - Only for admin and instructor roles */}
          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={[colors.error, '#d32f2f']}
              style={styles.logoutButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.logoutButtonContent}>
                <View style={styles.logoutIconContainer}>
                  <Ionicons name="log-out-outline" size={24} color={colors.white} />
                </View>
                <View style={styles.logoutTextContainer}>
                  <Text style={styles.logoutButtonTitle}>{t('auth.logoutButton')}</Text>
                  <Text style={styles.logoutButtonSubtitle}>{t('auth.logoutDescription')}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.white} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modern Modal for Personal Info - Only render if needed */}
      {modalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={closeModal}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={closeModal}
            />
            <View style={styles.modalContent}>
              {/* Modal Handle */}
              <View style={styles.modalHandle} />
              
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={styles.modalIconContainer}>
                    <Ionicons name="person" size={24} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>{t('profile.personalInfo')}</Text>
                    <Text style={styles.modalSubtitle}>{t('profile.updateProfile')}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={closeModal}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

            {/* Modal Form */}
            <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.firstName')}</Text>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={profileData.firstName}
                    onChangeText={(text) => setProfileData({...profileData, firstName: text})}
                    placeholder={t('profile.enterFirstName')}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.lastName')}</Text>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={profileData.lastName}
                    onChangeText={(text) => setProfileData({...profileData, lastName: text})}
                    placeholder={t('profile.enterLastName')}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.email')}</Text>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={profileData.email}
                    onChangeText={(text) => setProfileData({...profileData, email: text})}
                    placeholder={t('profile.enterEmail')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="email-address"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>{t('auth.phone')}</Text>
                <View style={styles.modernInputContainer}>
                  <Ionicons name="call-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.modernTextInput}
                    value={profileData.phone}
                    onChangeText={(text) => setProfileData({...profileData, phone: text})}
                    placeholder={t('profile.enterPhone')}
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.modernSaveButton} 
                onPress={handleSaveProfile}
                disabled={loading}
              >
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.saveButtonGradient}
                >
                  {loading ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <>
                      <Ionicons name="checkmark" size={20} color={colors.white} />
                      <Text style={styles.modernSaveButtonText}>{t('save')}</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
          </View>
        </Modal>
      )}

      {/* Language Selection Modal */}
      {languageModalVisible && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={languageModalVisible}
          onRequestClose={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setLanguageModalVisible(false)}
            />
            <View style={styles.languageModalContent}>
              {/* Modal Handle */}
              <View style={styles.modalHandle} />
              
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderLeft}>
                  <View style={styles.modalIconContainer}>
                    <Ionicons name="globe" size={24} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>{t('profile.languageSelection')}</Text>
                    <Text style={styles.modalSubtitle}>{t('profile.selectLanguage')}</Text>
                  </View>
                </View>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setLanguageModalVisible(false)}
                >
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {/* Language Options */}
              <View style={styles.languageOptions}>
                {getAvailableLanguages().map((lang) => (
                  <TouchableOpacity
                    key={lang.code}
                    style={[
                      styles.languageOption,
                      language === lang.code && styles.selectedLanguageOption
                    ]}
                    onPress={() => handleLanguageSelect(lang.code)}
                  >
                    <View style={styles.languageOptionContent}>
                      <View style={styles.languageInfo}>
                        <Text style={[
                          styles.languageName,
                          language === lang.code && styles.selectedLanguageName
                        ]}>
                          {lang.nativeName}
                        </Text>
                        <Text style={[
                          styles.languageCode,
                          language === lang.code && styles.selectedLanguageCode
                        ]}>
                          {lang.name}
                        </Text>
                      </View>
                      {language === lang.code && (
                        <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100, // Add bottom padding to avoid navigation bar
  },
  innerContent: {
    padding: 20,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    ...colors.shadow,
  },
  profileImageContainer: {
    marginBottom: 16,
    position: 'relative',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  editImageBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  defaultAvatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.cardBackground,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  statsSection: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...colors.shadow,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  // Modern Button Styles
  modernButton: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    ...colors.shadow,
  },
  modernButtonGradient: {
    padding: 20,
  },
  modernButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  buttonTextContainer: {
    flex: 1,
  },
  modernButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  modernButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Logout Button Styles
  logoutButton: {
    borderRadius: 16,
    marginBottom: 20,
    overflow: 'hidden',
    ...colors.shadow,
  },
  logoutButtonGradient: {
    padding: 20,
  },
  logoutButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  logoutTextContainer: {
    flex: 1,
  },
  logoutButtonTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  logoutButtonSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent', // Make overlay transparent
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent', // Remove gray background
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    maxHeight: height * 0.85,
    minHeight: height * 0.65,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputIcon: {
    marginRight: 12,
  },
  modernTextInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modernSaveButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveButtonGradient: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernSaveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  // Simple header styles
  headerContainer: {
    backgroundColor: colors.primary,
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },
  
  // Admin styles
  adminSection: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  adminControls: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 15,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 0.45,
    justifyContent: 'center',
  },
  adminButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Language Modal Styles
  languageModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 8,
    paddingHorizontal: 24,
    maxHeight: height * 0.5,
    minHeight: height * 0.3,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  languageOptions: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  languageOption: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  selectedLanguageOption: {
    backgroundColor: colors.primary + '15',
    borderColor: colors.primary,
  },
  languageOptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  selectedLanguageName: {
    color: colors.primary,
  },
  languageCode: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  selectedLanguageCode: {
    color: colors.primary,
  },
});
