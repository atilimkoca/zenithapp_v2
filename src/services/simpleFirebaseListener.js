import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { db } from '../config/firebase';

// Simplified Firebase notification listener that's more reliable
class SimpleFirebaseListener {
  constructor() {
    // Use a shared global set so multiple listener instances (if any) won't double-trigger
    if (!global.__zenith_seen_notifications) global.__zenith_seen_notifications = new Set();
    this.seenNotificationIds = global.__zenith_seen_notifications;
    this.isInitialized = false;
    this.unsubscribeFunctions = [];
    this.currentUserId = null;
  }

  async setupListener(userId) {
    if (!userId) {
      return null;
    }

    // If listener already setup for same user, return existing cleanup to avoid duplicates
    if (this.currentUserId && this.currentUserId === userId && this.unsubscribeFunctions.length > 0) {
      console.warn('⚠️ SimpleFirebaseListener: listener already running for user', userId);
      return () => {
        this.cleanup();
      };
    }

    // If listener is running for a different user, clean it up first
    if (this.unsubscribeFunctions.length > 0 && this.currentUserId && this.currentUserId !== userId) {
      console.log('ℹ️ SimpleFirebaseListener: cleaning up previous listener for', this.currentUserId, 'before starting for', userId);
      this.cleanup();
    }

    try {
      // Track which user this listener is for
      this.currentUserId = userId;
      // Query for user-specific notifications
      const userQuery = query(
        collection(db, 'notifications'),
        where('userId', '==', userId),
        limit(20)
      );

      // Query for broadcast notifications
      const broadcastQuery = query(
        collection(db, 'notifications'),
        where('recipients', '==', 'all'),
        limit(20)
      );

      // Set up user notifications listener
      const unsubscribeUser = onSnapshot(
        userQuery,
        (querySnapshot) => {
          this.handleNotificationSnapshot(querySnapshot, 'user');
        },
        (error) => {
          }
      );

      // Set up broadcast notifications listener
      const unsubscribeBroadcast = onSnapshot(
        broadcastQuery,
        (querySnapshot) => {
          this.handleNotificationSnapshot(querySnapshot, 'broadcast');
        },
        (error) => {
          }
      );

      this.unsubscribeFunctions = [unsubscribeUser, unsubscribeBroadcast];

      // Initialize after 2 seconds to avoid showing existing notifications
      setTimeout(() => {
        this.isInitialized = true;
      }, 2000);

      // Return cleanup function
      return () => {
        this.cleanup();
      };

    } catch (error) {
      return null;
    }
  }

  handleNotificationSnapshot(querySnapshot, source) {
    if (!this.isInitialized) {
      // On initial load, just track existing notifications to avoid firing for historic docs
      querySnapshot.forEach((doc) => {
        this.seenNotificationIds.add(doc.id);
      });
      return;
    }

    // Process new notifications
    const newNotifications = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const notification = {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
      };

      // Check both document ID and notificationId field to prevent duplicates
      const notifId = data.notificationId || doc.id;
      
      // Check if it's a new, unread notification
      if (!this.seenNotificationIds.has(doc.id) && !this.seenNotificationIds.has(notifId) && !notification.isRead) {
        newNotifications.push(notification);
        // Mark both IDs as seen
        this.seenNotificationIds.add(doc.id);
        this.seenNotificationIds.add(notifId);
      }
    });

      // Trigger notifications for new ones (but check shared seen set to avoid duplicates)
    if (newNotifications.length > 0) {
      newNotifications.forEach(notification => {
        const notifId = notification.notificationId || notification.id;
        
        // Double-check both IDs haven't been seen (defensive programming)
        if (!this.seenNotificationIds.has(notification.id) && !this.seenNotificationIds.has(notifId)) {
          this.seenNotificationIds.add(notification.id);
          this.seenNotificationIds.add(notifId);
          this.triggerLocalNotification(notification, source);
        } else {
          console.log('ℹ️ SimpleFirebaseListener: skipping already-seen notification', notification.id);
        }
      });
    }
  }

  async triggerLocalNotification(notification, source) {
    try {
      // Don't trigger notification if it came from mobile app (it already showed via push)
      // Only trigger for web admin notifications
      if (notification.source === 'mobile-admin' || notification.source === 'fcm-push') {
        console.log('🚫 Skipping notification - already shown via push:', notification.id, 'source:', notification.source);
        return true; // Return true but don't actually show it
      }
      
      console.log('✅ Showing notification from', notification.source || 'web-admin', ':', notification.title);

      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: notification.title,
          body: notification.message,
          data: {
            notificationId: notification.id,
            type: notification.type || 'general',
            source: `firebase-${source}`,
          },
          sound: 'default',
          badge: 1,
        },
        trigger: null, // Show immediately
      });

      return true;

    } catch (error) {
      return false;
    }
  }

  cleanup() {
    this.unsubscribeFunctions.forEach(unsubscribe => {
      if (unsubscribe) unsubscribe();
    });
    this.unsubscribeFunctions = [];
    this.isInitialized = false;
    this.currentUserId = null;
    // Don't clear seenNotificationIds - it's a global shared set
  }
}

// Create singleton instance
const simpleListener = new SimpleFirebaseListener();

// Export setup function
export const setupSimpleFirebaseListener = (userId) => {
  return simpleListener.setupListener(userId);
};

// Export test function
export const testSimpleFirebaseListener = async () => {
  try {
    const testNotification = {
      id: 'test-' + Date.now(),
      title: 'Test Firebase Listener 🧪',
      message: 'Simple Firebase listener test',
      type: 'general'
    };

    return await simpleListener.triggerLocalNotification(testNotification, 'test');
  } catch (error) {
    return false;
  }
};