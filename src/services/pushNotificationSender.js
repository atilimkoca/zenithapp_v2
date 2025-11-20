import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';

class PushNotificationSender {
  constructor() {
    // Expo's push notification endpoint
    this.EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
    // Track call counts for debugging
    this.callCount = 0;
  }

  // Send push notification to specific user
  async sendPushToUser(userId, notification) {
    this.callCount++;
    const callId = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    try {
      console.log(`\n📤 [${callId}] sendPushToUser CALLED (Call #${this.callCount}):`, { userId, notification });

      // Generate unique notification ID
      const notificationId = `user_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`🎫 [${callId}] Generated ID:`, notificationId);
      
      // Add ID to notification
      const uniqueNotification = {
        ...notification,
        id: notificationId,
        timestamp: new Date().toISOString()
      };

      // Mark as seen BEFORE sending to prevent Firebase listener from showing it
      if (global.__zenith_seen_notifications) {
        global.__zenith_seen_notifications.add(notificationId);
        console.log('📝 Pre-marked notification as seen:', notificationId);
      }

      // Get user's push token from Firestore
      const pushToken = await this.getUserPushToken(userId);
      
      if (!pushToken) {
        console.warn('⚠️ No push token found for user:', userId);
        return { success: false, error: 'No push token' };
      }

      // Send via Expo Push API
      console.log(`🚀 [${callId}] Calling sendViaExpoPush...`);
      const result = await this.sendViaExpoPush([pushToken], uniqueNotification);
      console.log(`✅ [${callId}] sendViaExpoPush completed:`, result.success);
      
      // DON'T save to Firestore for mobile admin notifications
      // They're already shown via push, saving would cause Firebase listener to show again
      console.log(`🚫 [${callId}] NOT saving to Firestore (mobile admin)`);

      return result;

    } catch (error) {
      console.error('❌ Error sending push to user:', error);
      return { success: false, error: error.message };
    }
  }

  // Send broadcast push notification to all users
  async sendBroadcastPush(notification) {
    try {
      console.log('Sending broadcast notification:', { notification });

      // Generate unique notification ID to prevent duplicates
      const notificationId = `broadcast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add ID to notification
      const uniqueNotification = {
        ...notification,
        id: notificationId,
        timestamp: new Date().toISOString()
      };

      // Mark as seen BEFORE sending to prevent Firebase listener from showing it
      if (global.__zenith_seen_notifications) {
        global.__zenith_seen_notifications.add(notificationId);
        console.log('📝 Pre-marked broadcast notification as seen:', notificationId);
      }

      // Get all user push tokens
      const pushTokens = await this.getAllPushTokens();
      
      if (pushTokens.length === 0) {
        console.warn('⚠️ No push tokens found for broadcast');
        return { success: false, error: 'No recipients' };
      }

      console.log(`Sending to ${pushTokens.length} users`);

      // Send via Expo Push API
      const result = await this.sendViaExpoPush(pushTokens, uniqueNotification);
      
      // DON'T save to Firestore for mobile admin broadcast notifications
      // They're already shown via push, saving would cause Firebase listener to show again
      console.log('✅ Broadcast push sent successfully, NOT saving to Firestore (mobile admin)');

      return result;

    } catch (error) {
      console.error('❌ Error sending broadcast push:', error);
      return { success: false, error: error.message };
    }
  }

  // Get user's push token from Firestore
  async getUserPushToken(userId) {
    try {
      const userQuery = query(
        collection(db, 'users'),
        where('__name__', '==', userId)
      );
      
      const querySnapshot = await getDocs(userQuery);
      
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        return userData.pushToken || null;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error getting user push token:', error);
      return null;
    }
  }

  // Get all push tokens for broadcast
  async getAllPushTokens() {
    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('notificationsEnabled', '==', true)
      );
      
      const querySnapshot = await getDocs(usersQuery);
      const tokens = [];
      const seenTokens = new Set(); // Track unique tokens
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        if (userData.pushToken && !seenTokens.has(userData.pushToken)) {
          tokens.push(userData.pushToken);
          seenTokens.add(userData.pushToken);
          console.log('✅ Added unique token for user:', doc.id);
        } else if (userData.pushToken && seenTokens.has(userData.pushToken)) {
          console.warn('⚠️ Duplicate token skipped for user:', doc.id);
        }
      });
      
      console.log(`📊 Found ${tokens.length} unique push tokens from ${querySnapshot.size} users`);
      return tokens;
      
    } catch (error) {
      console.error('❌ Error getting all push tokens:', error);
      return [];
    }
  }

  // Send notification via Expo Push API
  async sendViaExpoPush(pushTokens, notification) {
    const execId = Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    try {
      console.log(`
📡 [${execId}] sendViaExpoPush EXECUTING:`, { 
        tokenCount: pushTokens.length, 
        notifId: notification.id,
        title: notification.title 
      });
      
      // Validate notification data
      if (!notification.title || !notification.message) {
        console.error('❌ Invalid notification data:', notification);
        return { success: false, error: 'Title and message are required' };
      }
      
      // Validate push tokens
      const validTokens = pushTokens.filter(token => 
        token && typeof token === 'string' && token.length > 0
      );
      
      if (validTokens.length === 0) {
        console.error('❌ No valid push tokens found:', pushTokens);
        return { success: false, error: 'No valid push tokens' };
      }
      
      const messages = validTokens.map(token => ({
        to: token,
        title: String(notification.title),
        body: String(notification.message),
        data: {
          notificationId: notification.id || Date.now().toString(),
          type: notification.type || 'general',
          source: 'fcm-push'
        },
        sound: 'default',
        badge: 1,
        priority: 'high'
      }));

      console.log('Expo push messages:', JSON.stringify(messages, null, 2));

      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });

      const result = await response.json();
      console.log(`✅ [${execId}] Expo API response:`, result);
      
      if (response.ok) {
        console.log(`✅ [${execId}] Push notification sent successfully`);
        return { success: true, data: result };
      } else {
        console.error('❌ Push notification error:', result);
        return { success: false, error: result };
      }

    } catch (error) {
      console.error('❌ Error sending via Expo Push:', error);
      return { success: false, error: error.message };
    }
  }

  // Save notification to Firestore (for in-app display)
  async saveNotificationToFirestore(notification) {
    try {
      // Check for recent duplicates before saving (within last 30 seconds)
      const recentTime = new Date(Date.now() - 30000); // 30 seconds ago
      
      // Create a content hash for deduplication
      const contentHash = `${notification.title}_${notification.message}_${notification.type || 'general'}`;
      
      // Check if similar notification exists recently
      const duplicateQuery = query(
        collection(db, 'notifications'),
        where('title', '==', notification.title),
        where('message', '==', notification.message),
        where('recipients', '==', notification.recipients || 'user')
      );
      
      const duplicateSnapshot = await getDocs(duplicateQuery);
      
      // Check if any recent duplicate exists
      let isDuplicate = false;
      duplicateSnapshot.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (createdAt > recentTime) {
          console.log('🚫 Duplicate notification detected, skipping save:', { title: notification.title });
          isDuplicate = true;
        }
      });
      
      if (isDuplicate) {
        return null; // Don't save duplicate
      }

      const notificationData = {
        title: notification.title,
        message: notification.message,
        type: notification.type || 'general',
        recipients: notification.recipients || 'user',
        createdAt: serverTimestamp(),
        isRead: false,
        contentHash: contentHash,
        source: 'mobile-admin', // Mark as mobile-created to prevent Firebase listener from showing it again
        notificationId: notification.id, // Use the same ID that was pre-marked
        ...(notification.userId && { userId: notification.userId })
      };

      console.log('💾 Saving unique notification to Firestore:', { title: notification.title, recipients: notification.recipients });
      const docRef = await addDoc(collection(db, 'notifications'), notificationData);
      
      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving notification to Firestore:', error);
      return null;
    }
  }

  // Test function - send notification to yourself
  async sendTestNotification(userId) {
    const testNotification = {
      title: "FCM Test Notification 🚀",
      message: "This is a test push notification from your admin panel!",
      type: "test"
    };

    return await this.sendPushToUser(userId, testNotification);
  }
}

// Export singleton instance
export default new PushNotificationSender();