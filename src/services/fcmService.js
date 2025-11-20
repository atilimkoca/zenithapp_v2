import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getExpoPushToken } from '../utils/expoPushTokenHelper';

class FCMService {
  constructor() {
    this.expoPushToken = null;
    this.isInitialized = false;
  }

  // Initialize FCM service
  async initialize(userId) {
    try {

      // Configure notification handler ONCE (check global flag to prevent duplicates)
      if (!global.__zenith_notification_handler_set) {
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
          }),
        });
        global.__zenith_notification_handler_set = true;
        console.log('✅ Notification handler configured (once)');
      }

      // Request permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      // Get push token using helper
      let tokenData;
      try {
        tokenData = await getExpoPushToken();
      } catch (error) {
        console.warn('Failed to get push token:', error.message);
        return false;
      }

      this.expoPushToken = tokenData.data;

      // Save token to user's document in Firestore
      if (userId && this.expoPushToken) {
        await this.savePushTokenToFirestore(userId, this.expoPushToken);
      }

      this.isInitialized = true;
      return true;

    } catch (error) {
      console.error('❌ FCM initialization error:', error);
      return false;
    }
  }

  // Save push token to Firestore
  async savePushTokenToFirestore(userId, pushToken) {
    try {
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        pushToken: pushToken,
        pushTokenUpdatedAt: serverTimestamp(),
        devicePlatform: Platform.OS,
        notificationsEnabled: true
      });

    } catch (error) {
      console.error('❌ Error saving push token:', error);
      
      // If user document doesn't exist, create it
      try {
        await setDoc(userRef, {
          pushToken: pushToken,
          pushTokenUpdatedAt: serverTimestamp(),
          devicePlatform: Platform.OS,
          notificationsEnabled: true
        }, { merge: true });
        
      } catch (createError) {
        console.error('❌ Error creating user document:', createError);
      }
    }
  }

  // Get current push token
  getPushToken() {
    return this.expoPushToken;
  }

  // Check if FCM is initialized
  isReady() {
    return this.isInitialized && this.expoPushToken !== null;
  }

  // Add notification response listener
  addNotificationResponseListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  // Add notification received listener (for foreground notifications)
  addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  // Remove push token (when user logs out)
  async removePushToken(userId) {
    try {
      if (userId) {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
          pushToken: null,
          notificationsEnabled: false,
          pushTokenUpdatedAt: serverTimestamp()
        });
      }

      this.expoPushToken = null;
      this.isInitialized = false;
    } catch (error) {
      console.error('❌ Error removing push token:', error);
    }
  }

  // Test local notification (for debugging)
  async sendTestNotification() {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "FCM Test 🔔",
          body: "Your FCM service is working correctly!",
          data: { test: true },
        },
        trigger: null, // Show immediately
      });
    } catch (error) {
      console.error('❌ Test notification failed:', error);
    }
  }
}

// Export singleton instance
export default new FCMService();