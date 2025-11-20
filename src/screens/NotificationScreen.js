import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useNotifications } from '../context/NotificationContext';
import BottomSheetModal from '../components/BottomSheetModal';

export default function NotificationScreen({ navigation, visible, onClose, route }) {
  const notificationContext = useNotifications();
  
  if (!notificationContext) {
    console.error('NotificationContext not available');
    return null;
  }

  const {
    notifications = [],
    unreadCount = 0,
    loading = false,
    hasMore = false,
    markAsRead,
    markAllAsRead,
    loadMoreNotifications,
    refreshNotifications,
  } = notificationContext;

  const [refreshing, setRefreshing] = useState(false);
  
  // Determine if this is being used as a modal or navigation screen
  const isModal = visible !== undefined;
  const isVisible = isModal ? visible : true;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    // Handle navigation based on notification type
    if (notification.actionUrl) {
      // Parse action URL and navigate accordingly
    }
  };

  const handleMarkAllAsRead = () => {
    if (unreadCount === 0) {
      Alert.alert('Bilgi', 'Okunmamış bildirim bulunmuyor.');
      return;
    }

    Alert.alert(
      'Tümünü Okundu İşaretle',
      'Tüm bildirimleri okundu olarak işaretlemek istediğinizden emin misiniz?',
      [
        {
          text: 'İptal',
          style: 'cancel',
        },
        {
          text: 'Evet',
          onPress: markAllAsRead,
        },
      ]
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'lesson':
        return 'fitness-outline';
      case 'credit':
        return 'ticket-outline';
      case 'promotion':
        return 'gift-outline';
      case 'system':
        return 'settings-outline';
      default:
        return 'information-circle-outline';
    }
  };

  const getNotificationColor = (type, priority) => {
    if (priority === 'urgent') return '#FF4757';
    if (priority === 'high') return '#FF6B47';
    
    switch (type) {
      case 'lesson':
        return colors.primary;
      case 'credit':
        return '#2196F3';
      case 'promotion':
        return '#FF9800';
      case 'system':
        return '#9E9E9E';
      default:
        return colors.textSecondary;
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes <= 1 ? 'Şimdi' : `${diffInMinutes} dk önce`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} saat önce`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays === 1) return 'Dün';
      if (diffInDays <= 7) return `${diffInDays} gün önce`;
      
      return date.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'short',
        year: diffInDays > 365 ? 'numeric' : undefined
      });
    }
  };

  const renderNotification = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.notificationCard,
        !item.isRead && styles.unreadNotification
      ]}
      onPress={() => handleNotificationPress(item)}
    >
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={[
            styles.notificationIcon,
            { backgroundColor: getNotificationColor(item.type, item.priority) + '20' }
          ]}>
            <Ionicons
              name={getNotificationIcon(item.type)}
              size={20}
              color={getNotificationColor(item.type, item.priority)}
            />
          </View>
          
          <View style={styles.notificationMeta}>
            <Text style={styles.notificationTime}>
              {formatDate(item.createdAt)}
            </Text>
            {!item.isRead && <View style={styles.unreadDot} />}
          </View>
        </View>

        <Text style={[
          styles.notificationTitle,
          !item.isRead && styles.unreadTitle
        ]}>
          {item.title}
        </Text>
        
        <Text style={styles.notificationMessage} numberOfLines={3}>
          {item.message}
        </Text>

        {item.priority === 'urgent' && (
          <View style={styles.urgentBadge}>
            <Ionicons name="warning" size={12} color={colors.white} />
            <Text style={styles.urgentBadgeText}>ACİL</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderLoadMoreButton = () => {
    if (!hasMore) return null;

    return (
      <TouchableOpacity
        style={styles.loadMoreButton}
        onPress={loadMoreNotifications}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.loadMoreText}>Daha Fazla Yükle</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="notifications-off-outline" size={64} color={colors.textSecondary} />
      <Text style={styles.emptyStateTitle}>Bildirim Yok</Text>
      <Text style={styles.emptyStateMessage}>
        Henüz herhangi bir bildiriminiz bulunmuyor.
      </Text>
    </View>
  );

  // If used as modal
  if (isModal) {
    return (
      <BottomSheetModal
        visible={isVisible}
        onClose={onClose}
        title="Bildirimler"
        subtitle={`${unreadCount || 0} okunmamış bildirim`}
        accentIcon="notifications-outline"
        maxHeightRatio={0.85}
        footer={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllReadButton}
              onPress={handleMarkAllAsRead}
            >
              <Ionicons name="checkmark-done-outline" size={20} color={colors.white} />
              <Text style={styles.markAllReadText}>Tümünü Okundu İşaretle</Text>
            </TouchableOpacity>
          ) : undefined
        }
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={[
            styles.scrollContent,
            (loading && (!notifications || notifications.length === 0)) || (!notifications || notifications.length === 0) ? styles.scrollContentCenter : null
          ]}
        >
          {loading && (!notifications || notifications.length === 0) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
            </View>
          ) : !notifications || notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {notifications.map((item) => (
                <View key={item.id || Math.random().toString()}>
                  {renderNotification({ item })}
                </View>
              ))}
              {renderLoadMoreButton()}
            </>
          )}
        </ScrollView>
      </BottomSheetModal>
    );
  }

  // If used as navigation screen (full screen)
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation?.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Bildirimler</Text>
          <Text style={styles.headerSubtitle}>{unreadCount || 0} okunmamış bildirim</Text>
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.headerButton}>
            <Ionicons name="checkmark-done-outline" size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.fullScreenContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          (loading && (!notifications || notifications.length === 0)) || (!notifications || notifications.length === 0) ? styles.scrollContentCenter : null
        ]}
      >
        {loading && (!notifications || notifications.length === 0) ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Bildirimler yükleniyor...</Text>
          </View>
        ) : !notifications || notifications.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {notifications.map((item) => (
              <View key={item.id || Math.random().toString()}>
                {renderNotification({ item })}
              </View>
            ))}
            {renderLoadMoreButton()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Full screen styles
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 60,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.transparentGreenLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenContent: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Modal and shared styles
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 0,
  },
  scrollContentCenter: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.textSecondary,
  },
  markAllReadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  markAllReadText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  
  // Notification Card Styles
  notificationCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    backgroundColor: 'rgba(107, 127, 106, 0.02)',
  },
  notificationContent: {
    padding: 16,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
    lineHeight: 22,
  },
  unreadTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notificationMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF4757',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  urgentBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  
  // Load More Button
  loadMoreButton: {
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  loadMoreText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
});