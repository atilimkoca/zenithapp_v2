import { db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';

// App Store and Play Store URLs
// Note: Update the iOS App Store URL with your actual App ID after publishing
const APP_STORE_URL = 'https://apps.apple.com/app/zenith-studio/id'; // Add your App ID after publishing
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zenithstudio.app';

/**
 * Get the current app version from app.config.js
 */
export const getCurrentAppVersion = () => {
  return Constants.expoConfig?.version || '1.0.0';
};

/**
 * Compare two semantic version strings
 * Returns: -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export const compareVersions = (v1, v2) => {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 < part2) return -1;
    if (part1 > part2) return 1;
  }
  
  return 0;
};

/**
 * Check if an update is available from Firestore
 * Document structure in 'appConfig/version':
 * {
 *   latestVersion: '1.0.6',
 *   minimumVersion: '1.0.5',  // Force update if below this
 *   updateMessage: 'New features available!',
 *   updateMessageTr: 'Yeni özellikler mevcut!',
 *   forceUpdate: true,        // If true, user MUST update
 *   iosUrl: 'https://apps.apple.com/...',
 *   androidUrl: 'https://play.google.com/...'
 * }
 */
export const checkForUpdate = async () => {
  try {
    const currentVersion = getCurrentAppVersion();
    const versionDoc = await getDoc(doc(db, 'appConfig', 'version'));
    
    if (!versionDoc.exists()) {
      console.log('No version config found in Firestore');
      return {
        updateAvailable: false,
        forceUpdate: false,
      };
    }
    
    const config = versionDoc.data();
    const {
      latestVersion,
      minimumVersion,
      updateMessage,
      updateMessageTr,
      forceUpdate: configForceUpdate,
      iosUrl,
      androidUrl,
    } = config;
    
    // Check if current version is below minimum (force update required)
    const belowMinimum = minimumVersion && compareVersions(currentVersion, minimumVersion) < 0;
    
    // Check if there's a newer version available
    const updateAvailable = latestVersion && compareVersions(currentVersion, latestVersion) < 0;
    
    // Force update if below minimum OR if forceUpdate flag is set
    const shouldForceUpdate = belowMinimum || (updateAvailable && configForceUpdate);
    
    return {
      updateAvailable,
      forceUpdate: shouldForceUpdate,
      currentVersion,
      latestVersion: latestVersion || currentVersion,
      minimumVersion: minimumVersion || '1.0.0',
      updateMessage: updateMessage || '',
      updateMessageTr: updateMessageTr || '',
      storeUrl: Platform.OS === 'ios' 
        ? (iosUrl || APP_STORE_URL)
        : (androidUrl || PLAY_STORE_URL),
    };
  } catch (error) {
    console.error('Error checking for update:', error);
    return {
      updateAvailable: false,
      forceUpdate: false,
      error: error.message,
    };
  }
};

/**
 * Open the appropriate app store for the platform
 */
export const openAppStore = async (url) => {
  const storeUrl = url || (Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL);
  
  try {
    const canOpen = await Linking.canOpenURL(storeUrl);
    if (canOpen) {
      await Linking.openURL(storeUrl);
      return true;
    } else {
      console.error('Cannot open store URL:', storeUrl);
      return false;
    }
  } catch (error) {
    console.error('Error opening store:', error);
    return false;
  }
};

export default {
  getCurrentAppVersion,
  compareVersions,
  checkForUpdate,
  openAppStore,
};
