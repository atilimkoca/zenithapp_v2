// Admin Notification Utility with FCM Support
// This file contains helper functions for admin panel to send notifications

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import * as Notifications from 'expo-notifications';
import PushNotificationSender from '../services/pushNotificationSender';

// Send notification to specific user with FCM push
export const sendNotificationWithPush = async (userId, title, message, type = 'general') => {
  try {

    // Create notification object
    const notification = {
      title,
      message,
      type,
      userId
    };

    // Send via FCM (this handles both push notification AND Firestore storage)
    const pushResult = await PushNotificationSender.sendPushToUser(userId, notification);
    
    if (pushResult.success) {
      return {
        success: true,
        message: 'Notification sent successfully via FCM',
        pushResult
      };
    } else {
      console.warn('⚠️ FCM failed, trying local notification fallback');
      
      // Fallback: Save to Firestore only (for in-app display)
      const notificationData = {
        userId,
        title,
        message,
        type,
        createdAt: serverTimestamp(),
        isRead: false,
        recipients: 'user',
        source: 'mobile-admin' // Mark as mobile-created
      };

      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      
      return {
        success: true,
        message: 'Notification saved (FCM failed, using Firestore only)',
        notificationId: docRef.id
      };
    }

  } catch (error) {
    console.error('❌ Error sending notification with push:', error);
    return {
      success: false,
      message: 'Failed to send notification: ' + error.message
    };
  }
};

// Send broadcast notification to all users with FCM push
export const sendBroadcastNotificationWithPush = async (title, message, type = 'general') => {
  try {
    console.log('Sending broadcast notification:', { title, message, type });

    // Create a unique signature for this exact notification
    const notificationSignature = `${title.trim()}_${message.trim()}_${type}`;
    const currentTime = Date.now();
    
    // Check global memory for recent identical notifications (prevent rapid duplicates)
    const recentKey = `broadcast_${notificationSignature}`;
    if (global[recentKey] && (currentTime - global[recentKey]) < 10000) { // 10 second protection
      console.warn('🚫 Preventing duplicate broadcast within 10 seconds:', title);
      return {
        success: false,
        message: 'Duplicate notification blocked - same notification sent too recently'
      };
    }
    
    // Mark this notification as recently sent
    global[recentKey] = currentTime;
    
    // Clean up after 30 seconds
    setTimeout(() => {
      delete global[recentKey];
    }, 30000);

    // Create notification object
    const notification = {
      title,
      message,
      type
    };

    // Send via FCM (this handles both push notification AND Firestore storage)
    const pushResult = await PushNotificationSender.sendBroadcastPush(notification);
    
    if (pushResult.success) {
      return {
        success: true,
        message: 'Broadcast notification sent successfully via FCM',
        pushResult
      };
    } else {
      console.warn('⚠️ FCM broadcast failed, trying local notification fallback');
      
      // Fallback: Save to Firestore only (for in-app display)
      const notificationData = {
        title,
        message,
        type,
        createdAt: serverTimestamp(),
        isRead: false,
        recipients: 'all',
        source: 'mobile-admin' // Mark as mobile-created
      };

      console.log('Saving to Firestore:', notificationData);
      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      
      return {
        success: true,
        message: 'Broadcast notification saved (FCM failed, using Firestore only)',
        notificationId: docRef.id
      };
    }

  } catch (error) {
    console.error('❌ Error sending broadcast notification with push:', error);
    return {
      success: false,
      message: 'Failed to send broadcast notification: ' + error.message
    };
  }
};

// Test FCM notification
export const sendTestFCMNotification = async (userId) => {
  try {
    
    const result = await PushNotificationSender.sendTestNotification(userId);
    
    if (result.success) {
      return {
        success: true,
        message: 'FCM test notification sent successfully'
      };
    } else {
      console.warn('⚠️ FCM test failed:', result.error);
      return {
        success: false,
        message: 'FCM test failed: ' + result.error
      };
    }
  } catch (error) {
    console.error('❌ Error sending FCM test:', error);
    return {
      success: false,
      message: 'FCM test error: ' + error.message
    };
  }
};

export const adminNotificationUtils = {
  // Send notification with push notification (FCM)
  sendNotificationWithPush: async (userId, notificationData) => {
    return await sendNotificationWithPush(
      userId, 
      notificationData.title, 
      notificationData.message, 
      notificationData.type
    );
  },

  // Send notification to all users with push (FCM)
  sendBroadcastNotificationWithPush: async (notificationData) => {
    return await sendBroadcastNotificationWithPush(
      notificationData.title, 
      notificationData.message, 
      notificationData.type
    );
  },

  // Send a test notification
  sendTestNotification: async (userId) => {
    return await sendNotificationWithPush(
      userId,
      'Test Bildirimi FCM 🚀',
      'Bu bir FCM test bildirimidir. Bildirim sistemi çalışıyor!',
      'test'
    );
  },

  // Send welcome notification to new users
  sendWelcomeNotification: async (userId, userName) => {
    return await sendNotificationWithPush(
      userId,
      'Zénith Studio\'ya Hoş Geldiniz! 🧘‍♀️',
      `Merhaba ${userName}! Yoga yolculuğunuza başlamaya hazır mısınız? İlk dersinizi hemen rezerve edebilirsiniz.`,
      'welcome'
    );
  },

  // Send lesson reminder notification
  sendLessonReminder: async (userId, lessonName, lessonTime) => {
    return await sendNotificationWithPush(
      userId,
      'Ders Hatırlatması 📅',
      `${lessonName} dersiniz ${lessonTime} saatinde başlayacak. Hazır mısınız?`,
      'lesson'
    );
  },

  // Send credit expiration warning
  sendCreditExpirationWarning: async (userId, expirationDate) => {
    return await sendNotificationWithPush(
      userId,
      'Kredi Süresi Uyarısı ⏰',
      `Kalan ders kredileriniz ${expirationDate} tarihinde sona erecek. Rezervasyon yapmayı unutmayın!`,
      'credit'
    );
  },

  // Send promotion notification to all users
  sendPromotionNotification: async (title, message) => {
    return await sendBroadcastNotificationWithPush(title, message, 'promotion');
  },

  // Send system maintenance notification
  sendMaintenanceNotification: async (maintenanceTime) => {
    return await sendBroadcastNotificationWithPush(
      'Sistem Bakımı 🔧',
      `Sistem bakımı nedeniyle ${maintenanceTime} saatleri arasında uygulama kullanılamayacaktır.`,
      'system'
    );
  },

  // Send lesson booking confirmation
  sendBookingConfirmation: async (userId, lessonName, lessonDate, lessonTime) => {
    return await sendNotificationWithPush(
      userId,
      'Rezervasyon Onaylandı ✅',
      `${lessonName} dersiniz ${lessonDate} tarihinde ${lessonTime} saatinde rezerve edildi.`,
      'lesson'
    );
  },

  // Send lesson cancellation
  sendCancellationNotification: async (userId, lessonName, lessonDate) => {
    return await sendNotificationWithPush(
      userId,
      'Ders İptal Edildi ❌',
      `${lessonDate} tarihindeki ${lessonName} dersiniz iptal edildi. Kredi hesabınıza iade edilmiştir.`,
      'lesson'
    );
  },

  // Send credit added notification
  sendCreditAddedNotification: async (userId, creditsAdded, totalCredits) => {
    return await sendNotificationWithPush(
      userId,
      'Kredi Eklendi 🎟️',
      `Hesabınıza ${creditsAdded} ders kredisi eklendi. Toplam krediniz: ${totalCredits}`,
      'credit'
    );
  },

  // Get notification templates
  getNotificationTemplates: () => {
    return [
      {
        id: 'welcome',
        title: 'Hoş Geldiniz!',
        message: 'Zenith Studio ailesine hoş geldiniz. Sağlıklı yaşam yolculuğunuz başlıyor!',
        type: 'welcome'
      },
      {
        id: 'lesson_reminder',
        title: 'Ders Hatırlatması',
        message: 'Yaklaşan dersinizi unutmayın! Sizi bekliyoruz.',
        type: 'lesson'
      },
      {
        id: 'package_expires',
        title: 'Paket Süreniz Dolmak Üzere',
        message: 'Paket süreniz 3 gün içinde dolacak. Yenilemeyi unutmayın!',
        type: 'credit'
      },
      {
        id: 'maintenance',
        title: 'Bakım Duyurusu',
        message: 'Sistem bakımı nedeniyle hizmet geçici olarak kesintiye uğrayabilir.',
        type: 'system'
      },
      {
        id: 'new_feature',
        title: 'Yeni Özellik!',
        message: 'Yeni özelliklerimizi keşfedin ve deneyiminizi geliştirin.',
        type: 'general'
      },
      {
        id: 'promotion',
        title: 'Özel Kampanya',
        message: 'Sınırlı süre için özel indirimlerimizden yararlanın!',
        type: 'promotion'
      }
    ];
  },

  // Send broadcast notification (updated interface for AdminNotificationsScreen)
  sendBroadcastNotification: async (notificationData) => {
    console.log('Received notification data:', notificationData);
    
    const { title, message, body, type, priority, targetAudience } = notificationData;
    
    // Use message if available, otherwise fall back to body
    const notificationMessage = message || body;
    
    if (!title || !notificationMessage) {
      console.error('Missing required fields: title or message');
      return {
        success: false,
        message: 'Title and message are required'
      };
    }
    
    // Create a unique hash for deduplication
    const notificationHash = `${title.trim()}_${notificationMessage.trim()}_${type || 'general'}`;
    const timestamp = Date.now();
    
    // Check if this exact notification was sent recently (within 30 seconds)
    const recentKey = `recent_notification_${notificationHash}`;
    const lastSent = global[recentKey];
    
    if (lastSent && (timestamp - lastSent) < 30000) {
      console.warn('🚫 Duplicate notification prevented:', { title, notificationMessage });
      return {
        success: false,
        message: 'Duplicate notification prevented. Same notification sent recently.'
      };
    }
    
    // Mark this notification as recently sent
    global[recentKey] = timestamp;
    
    // Clean up old entries (prevent memory leaks)
    setTimeout(() => {
      delete global[recentKey];
    }, 60000); // Clear after 1 minute
    
    // For now, use the existing broadcast function
    // In future, you can implement audience filtering based on targetAudience
    const result = await sendBroadcastNotificationWithPush(
      title,
      notificationMessage,
      type || 'general'
    );
    
    console.log('✅ Broadcast notification sent:', { title, success: result.success });
    return result;
  }
};