import React, { createContext, useContext, useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

// Helper function to deduplicate notifications
const deduplicateNotifications = (notifications) => {
  const seen = new Map();
  const unique = [];
  
  for (const notification of notifications) {
    // Create a unique key based on id, title, and content
    const key = notification.id || 
      `${notification.title || ''}_${notification.body || notification.message || ''}_${notification.createdAt?.seconds || Date.now()}`;
    
    if (!seen.has(key)) {
      seen.set(key, true);
      unique.push(notification);
    } else {
      console.log('🔄 Duplicate notification filtered:', { key, title: notification.title });
    }
  }
  
  return unique;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);

  // Real-time listener unsubscribe function
  const [unsubscribe, setUnsubscribe] = useState(null);

  // Initialize notifications when user changes
  useEffect(() => {
    
    if (user?.uid) {
      setupNotificationListener();
      loadInitialNotifications();
    } else {
      // Clean up when user logs out
      if (unsubscribe) {
        unsubscribe();
        setUnsubscribe(null);
      }
      resetNotificationState();
    }

    // Cleanup on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [user?.uid]);

  const resetNotificationState = () => {
    setNotifications([]);
    setUnreadCount(0);
    setLoading(false);
    setLastDoc(null);
    setHasMore(true);
  };

  const setupNotificationListener = () => {
    if (!user?.uid) return;

    const unsubscribeFn = notificationService.listenToUserNotifications(
      user.uid,
      (result) => {
        
        if (result.success) {
          // Deduplicate notifications by ID and content
          const uniqueNotifications = deduplicateNotifications(result.notifications);
          setNotifications(uniqueNotifications);
          setUnreadCount(result.unreadCount);
        } else {
          console.error('❌ NotificationContext: Listener error:', result.message);
        }
      }
    );

    if (unsubscribeFn) {
      setUnsubscribe(() => unsubscribeFn);
    } else {
      console.error('❌ NotificationContext: Failed to setup listener');
    }
  };

  const loadInitialNotifications = async () => {
    if (!user?.uid) return;

    setLoading(true);
    
    try {
      const result = await notificationService.getUserNotifications(user.uid, 20);
      
      
      if (result.success) {
        
        // Deduplicate notifications
        const uniqueNotifications = deduplicateNotifications(result.notifications);
        setNotifications(uniqueNotifications);
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        
        const unreadCount = uniqueNotifications.filter(notif => !notif.isRead).length;
        setUnreadCount(unreadCount);
        
      } else {
        console.error('❌ NotificationContext: Failed to load notifications:', result.message);
      }
    } catch (error) {
      console.error('❌ NotificationContext: Error in loadInitialNotifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreNotifications = async () => {
    if (!user?.uid || !hasMore || loading) return;

    setLoading(true);
    try {
      const result = await notificationService.getUserNotifications(user.uid, 20, lastDoc);
      
      if (result.success) {
        // Deduplicate new notifications and merge with existing
        const uniqueNewNotifications = deduplicateNotifications(result.notifications);
        setNotifications(prev => {
          const combined = [...prev, ...uniqueNewNotifications];
          return deduplicateNotifications(combined);
        });
        setLastDoc(result.lastDoc);
        setHasMore(result.hasMore);
        
      }
    } catch (error) {
      console.error('❌ Error loading more notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId) => {
    if (!user?.uid) return;
    
    try {
      const result = await notificationService.markAsRead(notificationId, user.uid);
      
      if (result.success) {
        // Update local state optimistically
        setNotifications(prev => 
          prev.map(notif => 
            notif.id === notificationId 
              ? { ...notif, isRead: true, readAt: new Date() }
              : notif
          )
        );
        
        setUnreadCount(prev => Math.max(0, prev - 1));
        
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      return {
        success: false,
        message: 'Bildirim güncellenirken hata oluştu.'
      };
    }
  };

  const markAllAsRead = async () => {
    if (!user?.uid) return;

    try {
      const result = await notificationService.markAllAsRead(user.uid);
      
      if (result.success) {
        // Update local state optimistically
        setNotifications(prev => 
          prev.map(notif => ({ 
            ...notif, 
            isRead: true, 
            readAt: new Date() 
          }))
        );
        
        setUnreadCount(0);
        
      }
      
      return result;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      return {
        success: false,
        message: 'Bildirimler güncellenirken hata oluştu.'
      };
    }
  };

  const refreshNotifications = async () => {
    if (!user?.uid) return;

    // Reset state and reload
    setLastDoc(null);
    setHasMore(true);
    await loadInitialNotifications();
  };

  const getNotificationsByType = (type) => {
    return notifications.filter(notif => notif.type === type);
  };

  const getRecentNotifications = (count = 5) => {
    return notifications.slice(0, count);
  };

  const value = {
    notifications,
    unreadCount,
    loading,
    hasMore,
    
    // Actions
    loadMoreNotifications,
    markAsRead,
    markAllAsRead,
    refreshNotifications,
    
    // Getters
    getNotificationsByType,
    getRecentNotifications,
    
    // Stats
    totalCount: notifications.length,
    readCount: notifications.filter(notif => notif.isRead).length,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationContext;