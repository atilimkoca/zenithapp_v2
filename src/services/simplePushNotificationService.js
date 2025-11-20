import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { getExpoPushToken } from '../utils/expoPushTokenHelper';

// Simple push notification service for Expo Go development
export const simplePushNotificationService = {
  // Register for push notifications (Expo Go compatible)
  registerForPushNotifications: async () => {
    try {
      
      // Check if device supports push notifications
      if (!Device.isDevice) {
        return {
          success: false,
          message: 'Push bildirimleri sadece gerçek cihazlarda çalışır',
          token: null
        };
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return {
          success: false,
          message: 'Bildirim izni reddedildi',
          token: null
        };
      }

      // Get push notification token (Expo Go compatible)
      
      // Get push token using centralized helper
      let token;
      try {
        token = await getExpoPushToken();
      } catch (error) {
        // For development, create a mock token to avoid crashes
        if (__DEV__) {
          const mockToken = `ExponentPushToken[development-${Device.osName}-${Date.now()}]`;
          token = { data: mockToken };
        } else {
          throw error;
        }
      }


      return {
        success: true,
        token: token.data,
        message: 'Push bildirimler aktifleştirildi (Expo Go)'
      };

    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      return {
        success: false,
        error: error.message,
        message: 'Push bildirim kaydı başarısız: ' + error.message,
        token: null
      };
    }
  },

  // Send test push notification
  sendTestPushNotification: async (token, title = 'Test Bildirimi', message = 'Bu bir test push bildirimidir!') => {
    try {

      // In Expo Go, we'll send a local notification that will actually appear on the phone
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: title,
          body: message,
          data: { 
            type: 'test',
            timestamp: Date.now(),
            source: 'zenith-app-expo-go'
          },
          sound: 'default',
        },
        trigger: { seconds: 1 }, // Show after 1 second
      });


      return {
        success: true,
        message: 'Test bildirimi gönderildi (Expo Go)',
        notificationId: notificationId
      };

    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      return {
        success: false,
        error: error.message,
        message: 'Test bildirimi hatası'
      };
    }
  }
};

// Note: Notification handler is set in fcmService.js to avoid duplicates
// Do NOT set it here - multiple handlers cause duplicate notifications