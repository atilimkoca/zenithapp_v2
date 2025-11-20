import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getExpoPushToken } from '../utils/expoPushTokenHelper';

// Note: Notification handler is set in fcmService.js to avoid duplicates

export const pushNotificationService = {
  // Register for push notifications and get token
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

      // Get push notification token
      
      let token;
      try {
        token = await getExpoPushToken();
      } catch (error) {
        throw new Error(`Push token alınamadı: ${error.message}`);
      }


      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'Default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
          sound: 'default',
        });

        // Create additional channels for different notification types
        await Notifications.setNotificationChannelAsync('lesson', {
          name: 'Ders Bildirimleri',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#6B7F6A',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('credit', {
          name: 'Kredi Bildirimleri',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 250],
          lightColor: '#2196F3',
          sound: 'default',
        });

        await Notifications.setNotificationChannelAsync('promotion', {
          name: 'Promosyon Bildirimleri',
          importance: Notifications.AndroidImportance.DEFAULT,
          vibrationPattern: [0, 100, 100, 100],
          lightColor: '#FF9800',
          sound: 'default',
        });
      }

      return {
        success: true,
        token: token.data,
        message: 'Push bildirimler aktifleştirildi'
      };

    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      return {
        success: false,
        error: error.message,
        message: 'Push bildirim kaydı başarısız',
        token: null
      };
    }
  },

  // Save push token to user's Firebase document
  savePushTokenToUser: async (userId, token) => {
    try {
      if (!userId || !token) {
        return { success: false, message: 'Gerekli bilgiler eksik' };
      }


      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        pushToken: token,
        pushTokenUpdatedAt: new Date(),
        deviceInfo: {
          platform: Platform.OS,
          isDevice: Device.isDevice,
          deviceName: Device.deviceName || 'Unknown',
          osVersion: Device.osVersion || 'Unknown'
        }
      });


      return {
        success: true,
        message: 'Push token kaydedildi'
      };

    } catch (error) {
      console.error('❌ Error saving push token:', error);
      return {
        success: false,
        error: error.message,
        message: 'Push token kaydedilemedi'
      };
    }
  },

  // Send a test push notification using Expo's push service
  sendTestPushNotification: async (token, title = 'Test Bildirimi', message = 'Bu bir test push bildirimidir!') => {
    try {

      const pushMessage = {
        to: token,
        sound: 'default',
        title: title,
        body: message,
        data: { 
          type: 'test',
          timestamp: Date.now(),
          source: 'zenith-app'
        },
        channelId: 'default',
        priority: 'high',
        badge: 1
      };

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessage),
      });

      const result = await response.json();
      
      if (result.data && result.data[0] && result.data[0].status === 'ok') {
        return {
          success: true,
          message: 'Test push bildirimi gönderildi',
          ticketId: result.data[0].id
        };
      } else {
        return {
          success: false,
          message: 'Test push bildirimi gönderilemedi',
          error: result
        };
      }

    } catch (error) {
      console.error('❌ Error sending test push notification:', error);
      return {
        success: false,
        error: error.message,
        message: 'Test push bildirimi hatası'
      };
    }
  },

  // Send push notification to multiple tokens
  sendBulkPushNotifications: async (tokens, title, message, data = {}) => {
    try {

      const messages = tokens.map(token => ({
        to: token,
        sound: 'default',
        title: title,
        body: message,
        data: {
          ...data,
          timestamp: Date.now(),
          source: 'zenith-app'
        },
        channelId: data.type === 'lesson' ? 'lesson' : 
                   data.type === 'credit' ? 'credit' : 
                   data.type === 'promotion' ? 'promotion' : 'default',
        priority: data.priority === 'high' ? 'high' : 'normal',
      }));

      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      

      return {
        success: true,
        message: `${tokens.length} cihaza push bildirimi gönderildi`,
        result: result
      };

    } catch (error) {
      console.error('❌ Error sending bulk push notifications:', error);
      return {
        success: false,
        error: error.message,
        message: 'Toplu push bildirimi hatası'
      };
    }
  },

  // Get current notification permissions
  getNotificationPermissions: async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return {
        success: true,
        status: status,
        granted: status === 'granted'
      };
    } catch (error) {
      console.error('❌ Error getting notification permissions:', error);
      return {
        success: false,
        status: 'unknown',
        granted: false
      };
    }
  },

  // Clear all notifications
  clearAllNotifications: async () => {
    try {
      await Notifications.dismissAllNotificationsAsync();
      return { success: true, message: 'Tüm bildirimler temizlendi' };
    } catch (error) {
      console.error('❌ Error clearing notifications:', error);
      return { success: false, message: 'Bildirimler temizlenemedi' };
    }
  },

  // Set notification badge count
  setBadgeCount: async (count) => {
    try {
      await Notifications.setBadgeCountAsync(count);
      return { success: true };
    } catch (error) {
      console.error('❌ Error setting badge count:', error);
      return { success: false };
    }
  }
};

// Export notification event listeners for App.js
export const setupNotificationListeners = () => {
  // Prevent duplicate registration
  if (global.__zenith_notification_listeners_registered) {
    console.warn('⚠️ Notification listeners already registered - skipping duplicate registration');
    return () => {
      // No-op cleanup because original cleanup is still responsible for removal
      return;
    };
  }

  // Listener for notifications received while app is in foreground
  const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
    // Intentionally left blank - app can react via NotificationContext if needed
  });

  // Listener for when user taps on a notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
    const data = response.notification.request.content.data || {};

    // Handle different notification types (navigation should be handled by app's router)
    if (data.type === 'lesson') {
      // Navigate to lessons screen
    } else if (data.type === 'credit') {
      // Navigate to profile/credits screen
    } else if (data.type === 'promotion') {
      // Navigate to promotions or show modal
    }
  });

  // Mark as registered so subsequent calls are no-ops
  global.__zenith_notification_listeners_registered = true;

  // Return cleanup function that also clears the global flag
  return () => {
    try {
      if (foregroundSubscription && typeof foregroundSubscription.remove === 'function') foregroundSubscription.remove();
      if (responseSubscription && typeof responseSubscription.remove === 'function') responseSubscription.remove();
    } catch (e) {
      console.warn('Error removing notification listeners during cleanup', e);
    }
    delete global.__zenith_notification_listeners_registered;
  };
};