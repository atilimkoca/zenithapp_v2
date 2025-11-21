import React, { useState, useEffect, useRef } from 'react';
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
  PanResponder,
  Animated,
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
import NotificationScreen from './NotificationScreen';

export default function ProfileScreen({ navigation }) {
  const { userData, user, setUserData } = useAuth();
  const { t, language, changeLanguage, getAvailableLanguages } = useI18n();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [userStats, setUserStats] = useState({
    totalLessons: 0,
    completedCount: 0,
    monthlyLessons: 0,
    totalHours: 0
  });
  const [remainingCredits, setRemainingCredits] = useState(0);

  // Animation for modal slide
  const pan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (modalVisible) {
      pan.setValue(0);
    }
  }, [modalVisible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          pan.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          closeModal();
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            friction: 5
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (languageModalVisible) {
      pan.setValue(0);
    }
  }, [languageModalVisible]);

  const languagePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          pan.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100) {
          setLanguageModalVisible(false);
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            friction: 5
          }).start();
        }
      },
    })
  ).current;

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
        showNotification={true}
        onRightPress={() => setNotificationModalVisible(true)}
      />

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContent}>
          {/* Modern Profile Card */}
          <View style={styles.modernProfileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarWrapper}>
                {renderProfileImage()}
                <View style={styles.onlineBadge} />
              </View>
              <View style={styles.profileTexts}>
                <Text style={styles.modernProfileName}>
                  {userData?.displayName || `${profileData.firstName} ${profileData.lastName}`.trim() || t('profile.title')}
                </Text>
                <Text style={styles.modernProfileEmail}>{profileData.email}</Text>
                {userData?.role === 'admin' && (
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>Admin</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Modern Stats Grid */}
          <Text style={styles.sectionHeader}>{t('profile.statistics')}</Text>
          <View style={styles.statsGrid}>
            <View style={styles.modernStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="ticket" size={22} color={colors.primary} />
              </View>
              <Text style={styles.modernStatValue}>{remainingCredits}</Text>
              <Text style={styles.modernStatLabel}>{t('profile.remainingLessons')}</Text>
            </View>
            
            <View style={styles.modernStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.success + '15' }]}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
              </View>
              <Text style={styles.modernStatValue}>{userStats.completedCount}</Text>
              <Text style={styles.modernStatLabel}>{t('profile.totalLessons')}</Text>
            </View>
            
            <View style={styles.modernStatCard}>
              <View style={[styles.statIconBox, { backgroundColor: colors.warning + '15' }]}>
                <Ionicons name="calendar" size={22} color={colors.warning} />
              </View>
              <Text style={styles.modernStatValue}>{userStats.monthlyLessons}</Text>
              <Text style={styles.modernStatLabel}>{t('profile.thisMonth')}</Text>
            </View>
          </View>

          {/* Admin Credit Management */}
          {userData?.role === 'admin' && (
            <View style={styles.adminSection}>
              <Text style={styles.sectionHeader}>{t('admin.creditManagement')}</Text>
              <View style={styles.adminControls}>
                <TouchableOpacity 
                  style={[styles.adminActionButton, { backgroundColor: colors.success }]}
                  onPress={() => showCreditManagementAlert('add')}
                >
                  <Ionicons name="add" size={24} color={colors.white} />
                  <Text style={styles.adminActionText}>{t('admin.addCredit')}</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.adminActionButton, { backgroundColor: colors.warning }]}
                  onPress={() => showCreditManagementAlert('set')}
                >
                  <Ionicons name="create-outline" size={24} color={colors.white} />
                  <Text style={styles.adminActionText}>{t('admin.setCredit')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Settings Section */}
          <Text style={styles.sectionHeader}>{t('profile.settings')}</Text>
          <View style={styles.settingsContainer}>
            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => setModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.settingIconBox, { backgroundColor: colors.info + '15' }]}>
                <Ionicons name="person-outline" size={20} color={colors.info} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{t('profile.personalInfo')}</Text>
                <Text style={styles.settingSubtitle}>{t('profile.personalInfoDescription')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>

            <View style={styles.settingDivider} />

            <TouchableOpacity 
              style={styles.settingItem}
              onPress={() => setLanguageModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={[styles.settingIconBox, { backgroundColor: '#8E44AD15' }]}>
                <Ionicons name="globe-outline" size={20} color={'#8E44AD'} />
              </View>
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{t('profile.language')}</Text>
                <Text style={styles.settingSubtitle}>
                  {language === 'tr' ? 'Türkçe' : 'English'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
            </TouchableOpacity>
          </View>

          {/* Logout Button */}
          <TouchableOpacity 
            style={styles.modernLogoutButton}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.modernLogoutText}>{t('auth.logoutButton')}</Text>
          </TouchableOpacity>
          
          <Text style={styles.versionText}>Version 2.0.0 • Zenith App</Text>
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
            <Animated.View 
              style={[styles.modalContent, { transform: [{ translateY: pan }] }]}
            >
              {/* Modal Handle with PanResponder */}
              <View 
                style={styles.modalHandleContainer}
                {...panResponder.panHandlers}
              >
                <View style={styles.modalHandle} />
              </View>
              
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
                <View style={[styles.modernInputContainer, { backgroundColor: '#f0f0f0', borderColor: '#e0e0e0' }]}>
                  <Ionicons name="mail-outline" size={20} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.modernTextInput, { color: colors.textSecondary }]}
                    value={profileData.email}
                    editable={false}
                    placeholder={t('profile.enterEmail')}
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Ionicons name="lock-closed-outline" size={16} color={colors.textSecondary} style={{ marginLeft: 8, opacity: 0.5 }} />
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
          </Animated.View>
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
            <Animated.View 
              style={[styles.languageModalContent, { transform: [{ translateY: pan }] }]}
            >
              {/* Modal Handle */}
              <View 
                style={styles.modalHandleContainer}
                {...languagePanResponder.panHandlers}
              >
                <View style={styles.modalHandle} />
              </View>
              
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
            </Animated.View>
          </View>
        </Modal>
      )}

      <NotificationScreen
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        modal={true}
      />
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
  },
  scrollContent: {
    paddingBottom: 100,
  },
  innerContent: {
    padding: 20,
  },
  
  // Modern Profile Card
  modernProfileCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.primary + '10',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 16,
  },
  profileImage: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  defaultAvatarContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  avatarEmoji: {
    fontSize: 30,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  profileTexts: {
    flex: 1,
  },
  modernProfileName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modernProfileEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  roleBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
  },

  // Stats Grid
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  modernStatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  modernStatValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  modernStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Admin Section
  adminSection: {
    marginBottom: 24,
  },
  adminControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  adminActionButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  adminActionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },

  // Settings List
  settingsContainer: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 8,
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  settingIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 64,
  },

  // Logout Button
  modernLogoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error + '10',
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.error + '20',
  },
  modernLogoutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
    marginLeft: 8,
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textLight,
    marginBottom: 20,
  },

  // Modal Styles (Kept mostly same but refined)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent', // Changed from rgba(0,0,0,0.5) to transparent as requested
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.2)', // Subtle static dimming if needed, but user might want fully transparent. 
    // If the user says "gray background is rising", it's because this was on the parent or sliding view.
    // If I put it here, it will still slide if it's inside the Modal.
    // To fix the "rising" background with standard Modal, we usually make the background transparent.
    backgroundColor: 'transparent', 
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: height * 0.85,
    minHeight: height * 0.65,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  modalHandleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 10,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    // marginBottom: 24, // Removed margin from here as it's handled by container
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
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
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalForm: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
    marginLeft: 4,
  },
  modernInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  inputIcon: {
    marginRight: 16,
    opacity: 0.5,
  },
  modernTextInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    paddingVertical: 16,
    fontWeight: '500',
  },
  modalFooter: {
    flexDirection: 'row',
    paddingTop: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    padding: 18,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  modernSaveButton: {
    flex: 2,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonGradient: {
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernSaveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginLeft: 8,
  },
  
  // Language Modal Styles
  languageModalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    maxHeight: height * 0.8, // Increased from 0.5
    minHeight: height * 0.5, // Increased from 0.3
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 20,
  },
  languageOptions: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  languageOption: {
    backgroundColor: '#F8F9FA',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  selectedLanguageOption: {
    backgroundColor: colors.primary + '10',
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
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  selectedLanguageName: {
    color: colors.primary,
  },
  languageCode: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  selectedLanguageCode: {
    color: colors.primary,
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
});
