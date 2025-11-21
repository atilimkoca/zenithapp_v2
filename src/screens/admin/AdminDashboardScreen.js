import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/adminService';
import UniqueHeader from '../../components/UniqueHeader';
import BottomSheetModal from '../../components/BottomSheetModal';
import NotificationScreen from '../NotificationScreen';

const { width } = Dimensions.get('window');

export default function AdminDashboardScreen({ navigation }) {
  const { user, userData, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalUsers: 0,
    pendingUsers: 0,
    approvedUsers: 0,
    rejectedUsers: 0,
    totalLessons: 0,
    todayLessons: 0,
    revenue: 0,
    monthlyRevenue: 0,
  });
  const [createNotificationModalVisible, setCreateNotificationModalVisible] = useState(false);
  const [viewNotificationsModalVisible, setViewNotificationsModalVisible] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState('Bilgi');
  const [notificationRecipients, setNotificationRecipients] = useState('Tüm Üyeler');
  const [notificationSending, setNotificationSending] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showRecipientsDropdown, setShowRecipientsDropdown] = useState(false);

  const notificationTypes = [
    { value: 'Bilgi', color: '#2196F3', description: 'Genel bilgilendirme' },
    { value: 'Uyarı', color: '#FF9800', description: 'Önemli uyarı mesajı' },
    { value: 'Acil', color: '#F44336', description: 'Acil durum bildirimi' },
    { value: 'Duyuru', color: '#4CAF50', description: 'Genel duyuru' }
  ];

  const recipientTypes = [
    { value: 'Tüm Üyeler', icon: 'people', description: 'Tüm kayıtlı üyeler' },
    { value: 'Aktif Üyeler', icon: 'people-circle', description: 'Aktif durumda olan üyeler' },
    { value: 'Eğitmenler', icon: 'school', description: 'Eğitmen rolündeki kullanıcılar' },
    { value: 'Yöneticiler', icon: 'shield-checkmark', description: 'Admin rolündeki kullanıcılar' }
  ];

  useEffect(() => {
    console.log('AdminDashboardScreen rendered');
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load user statistics
      const userStats = await adminService.getUserStats();
      if (userStats.success) {
        setStats(prev => ({
          ...prev,
          totalUsers: userStats.data.total || 0,
          pendingUsers: userStats.data.pending || 0,
          approvedUsers: userStats.data.approved || 0,
          rejectedUsers: userStats.data.rejected || 0,
        }));
      }

      // Load lesson statistics (placeholder - implement in dashboardService)
      // const lessonStats = await dashboardService.getLessonStats();
      // const revenueStats = await dashboardService.getRevenueStats();
      
    } catch (error) {
      console.error('Error loading admin dashboard:', error);
      Alert.alert('Hata', 'Dashboard verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const navigateToSection = (section) => {
    // Map old screen names to new tab names
    const screenMapping = {
      'AdminUserManagement': 'AdminUsers',
      'AdminLessonManagement': 'AdminLessons', 
      'AdminNotifications': 'AdminNotifications',
      'AdminTrainerManagement': 'AdminTrainerManagement', // Stack screen
      'AdminSettings': 'AdminSettings', // Stack screen
      'AdminFinanceReports': 'AdminFinanceReports' // Stack screen
    };
    
    const targetScreen = screenMapping[section] || section;
    navigation.navigate(targetScreen);
  };

  // Open modal with slide-up animation
  const openNotificationModal = () => {
    setCreateNotificationModalVisible(true);
  };

  // Close modal with slide-down animation
  const closeNotificationModal = () => {
    setCreateNotificationModalVisible(false);
    setShowTypeDropdown(false);
    setShowRecipientsDropdown(false);
    setNotificationTitle('');
    setNotificationMessage('');
    setNotificationType('Bilgi');
    setNotificationRecipients('Tüm Üyeler');
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'Bilgi': return '#2196F3'; // Blue
      case 'Uyarı': return '#FF9800'; // Orange
      case 'Acil': return '#F44336'; // Red
      case 'Duyuru': return '#4CAF50'; // Green
      default: return '#2196F3';
    }
  };

  const getRecipientIcon = (recipient) => {
    switch (recipient) {
      case 'Tüm Üyeler': return 'people';
      case 'Aktif Üyeler': return 'people-circle';
      case 'Eğitmenler': return 'school';
      case 'Yöneticiler': return 'shield-checkmark';
      default: return 'people';
    }
  };

  const sendNotification = async () => {
    if (!notificationTitle.trim() || !notificationMessage.trim()) {
      Alert.alert('Hata', 'Lütfen başlık ve mesaj alanlarını doldurun.');
      return;
    }

    // Prevent rapid fire sending
    if (notificationSending) {
      console.log('🚫 Notification already being sent, ignoring duplicate request');
      return;
    }

    try {
      setNotificationSending(true);
      
      const notificationData = {
        title: notificationTitle.trim(),
        message: notificationMessage.trim(), // Changed from 'body' to 'message'
        type: notificationType,
        priority: notificationType === 'Acil' ? 'high' : 'normal',
        targetAudience: notificationRecipients,
        timestamp: new Date().toISOString(),
        createdBy: userData?.displayName || 'Admin',
        status: 'sent'
      };

      console.log('Sending notification with data:', notificationData);

      // Import the notification utils at the top and use them here
      const { adminNotificationUtils } = require('../../utils/adminNotificationUtils');
      const result = await adminNotificationUtils.sendBroadcastNotification(notificationData);
      
      if (result.success) {
        closeNotificationModal();
        Alert.alert(
          'Başarılı',
          `Bildirim ${notificationRecipients.toLowerCase()} kullanıcılara gönderildi.`
        );
      } else {
        console.error('Notification send failed:', result.message);
        Alert.alert('Hata', result.message || 'Bildirim gönderilemedi.');
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      Alert.alert('Hata', 'Bildirim gönderirken hata oluştu: ' + error.message);
    } finally {
      // Add a small delay to prevent rapid consecutive sends
      setTimeout(() => {
        setNotificationSending(false);
      }, 1000);
    }
  };

  const StatCard = ({ icon, value, label, color, subtitle }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  const ActionCard = ({ title, description, icon, color, onPress, badge }) => (
    <TouchableOpacity style={styles.actionCard} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.actionIconContainer, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
        {badge && (
          <View style={styles.actionBadge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      <View style={styles.actionContent}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionDescription} numberOfLines={2}>{description}</Text>
      </View>
      <View style={styles.actionArrow}>
        <Ionicons name="chevron-forward" size={20} color={colors.gray} />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Admin Paneli"
          subtitle="Yönetim dashboard'u"
         onRightPress={() => setViewNotificationsModalVisible(true)}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Admin verileri yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Admin Paneli"
        subtitle="Yönetim dashboard'u"
          onRightPress={() => setViewNotificationsModalVisible(true)}
        showStats={true}
        stats={[
          { value: stats.totalUsers.toString(), label: 'Toplam Üye', icon: 'people-outline', color: 'rgba(255, 255, 255, 0.3)' },
          { value: stats.pendingUsers.toString(), label: 'Bekleyen', icon: 'time-outline', color: 'rgba(255, 255, 255, 0.3)' },
        ]}
      />

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContent}>
          
          {/* Admin Welcome Section */}
          <View style={styles.welcomeSection}>
            <View style={styles.adminAvatar}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeTitle}>
                Hoş geldin, {userData?.displayName || 'Admin'}
              </Text>
              <Text style={styles.welcomeSubtitle}>
                {userData?.role === 'admin' ? 'Sistem Yöneticisi' : 'Eğitmen'}
              </Text>
            </View>
          </View>

          {/* Key Statistics */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>Özet İstatistikler</Text>
            <View style={styles.statsGrid}>
              <StatCard
                icon="people"
                value={stats.totalUsers}
                label="Toplam Üye"
                color={colors.primary}
              />
              <StatCard
                icon="time"
                value={stats.pendingUsers}
                label="Bekleyen Onay"
                color={colors.warning}
                subtitle="Hemen onaylayın!"
              />
              <StatCard
                icon="checkmark-circle"
                value={stats.approvedUsers}
                label="Onaylanan"
                color={colors.success}
              />
              <StatCard
                icon="close-circle"
                value={stats.rejectedUsers}
                label="Reddedilen"
                color={colors.error}
              />
            </View>
          </View>

          {/* Admin Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Yönetim İşlemleri</Text>
            <View style={styles.actionGrid}>
              
              <ActionCard
                title="Üye Yönetimi"
                description="Kullanıcıları onayla, reddet veya düzenle"
                icon="people"
                color={colors.primary}
                onPress={() => navigateToSection('AdminUserManagement')}
                badge={stats.pendingUsers > 0 ? stats.pendingUsers : null}
              />

              <ActionCard
                title="Ders Yönetimi"
                description="Ders programını ve sınıfları yönet"
                icon="calendar"
                color={colors.success}
                onPress={() => navigateToSection('AdminLessonManagement')}
              />

              <ActionCard
                title="Bildirim Merkezi"
                description="Toplu bildirim ve duyuru gönder"
                icon="notifications"
                color="#FF6B6B"
                onPress={openNotificationModal}
              />

              <ActionCard
                title="Çıkış Yap"
                description="Yönetici hesabından güvenle çıkış yap"
                icon="log-out"
                color="#9E9E9E"
                onPress={() => {
                  Alert.alert(
                    'Çıkış Yap',
                    'Çıkış yapmak istediğinize emin misiniz?',
                    [
                      { text: 'İptal', style: 'cancel' },
                      {
                        text: 'Çıkış Yap',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await logout();
                          } catch (error) {
                            console.error('Logout error:', error);
                            Alert.alert('Hata', 'Çıkış yapılırken bir hata oluştu.');
                          }
                        },
                      },
                    ]
                  );
                }}
              />

            </View>
          </View>

        </View>
      </ScrollView>

      <BottomSheetModal
        visible={createNotificationModalVisible}
        onClose={closeNotificationModal}
        title="Bildirim Gönder"
        subtitle="Üyelerinize hızla ulaşacak bir mesaj hazırlayın."
        accentIcon="notifications-outline"
        footer={
          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.cancelButton} onPress={closeNotificationModal}>
              <Text style={styles.cancelButtonText}>İptal</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sendButton, notificationSending && styles.sendButtonDisabled]}
              onPress={sendNotification}
              disabled={notificationSending}
            >
              {notificationSending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.sendButtonText}>Bildirim Gönder</Text>
              )}
            </TouchableOpacity>
          </View>
        }
      >
        <ScrollView
          style={styles.modalContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Başlık *</Text>
            <TextInput
              style={styles.textInput}
              value={notificationTitle}
              onChangeText={setNotificationTitle}
              placeholder="Bildirim başlığını girin..."
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Mesaj *</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notificationMessage}
              onChangeText={setNotificationMessage}
              placeholder="Bildirim mesajını girin..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Bildirim Türü</Text>
            <TouchableOpacity
              style={[styles.selectionButton, showTypeDropdown && styles.selectionButtonActive]}
              onPress={() => {
                setShowTypeDropdown(!showTypeDropdown);
                setShowRecipientsDropdown(false);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.typeIndicator, { backgroundColor: getTypeColor(notificationType) }]} />
              <Text style={styles.selectionText}>{notificationType}</Text>
              <Ionicons name={showTypeDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
            </TouchableOpacity>

            {showTypeDropdown && (
              <View style={styles.dropdownContainer}>
                {notificationTypes.map((type) => (
                  <TouchableOpacity
                    key={`notification-type-${type.value}`}
                    style={[styles.dropdownItem, notificationType === type.value && styles.dropdownItemSelected]}
                    onPress={() => {
                      setNotificationType(type.value);
                      setShowTypeDropdown(false);
                    }}
                  >
                    <View style={[styles.typeIndicator, { backgroundColor: type.color }]} />
                    <View style={styles.dropdownItemContent}>
                      <Text
                        style={[
                          styles.dropdownItemTitle,
                          notificationType === type.value && styles.dropdownItemTitleSelected,
                        ]}
                      >
                        {type.value}
                      </Text>
                      <Text style={styles.dropdownItemDescription}>{type.description}</Text>
                    </View>
                    {notificationType === type.value && <Ionicons name="checkmark" size={20} color="#2196F3" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Alıcılar</Text>
            <TouchableOpacity
              style={[styles.selectionButton, showRecipientsDropdown && styles.selectionButtonActive]}
              onPress={() => {
                setShowRecipientsDropdown(!showRecipientsDropdown);
                setShowTypeDropdown(false);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name={getRecipientIcon(notificationRecipients)} size={20} color="#2196F3" />
              <Text style={styles.selectionText}>{notificationRecipients}</Text>
              <Ionicons name={showRecipientsDropdown ? 'chevron-up' : 'chevron-down'} size={20} color="#666" />
            </TouchableOpacity>

            {showRecipientsDropdown && (
              <View style={styles.dropdownContainer}>
                {recipientTypes.map((recipient) => (
                  <TouchableOpacity
                    key={`recipients-${recipient.value}`}
                    style={[styles.dropdownItem, notificationRecipients === recipient.value && styles.dropdownItemSelected]}
                    onPress={() => {
                      setNotificationRecipients(recipient.value);
                      setShowRecipientsDropdown(false);
                    }}
                  >
                    <Ionicons name={recipient.icon} size={20} color="#2196F3" />
                    <View style={styles.dropdownItemContent}>
                      <Text
                        style={[
                          styles.dropdownItemTitle,
                          notificationRecipients === recipient.value && styles.dropdownItemTitleSelected,
                        ]}
                      >
                        {recipient.value}
                      </Text>
                      <Text style={styles.dropdownItemDescription}>{recipient.description}</Text>
                    </View>
                    {notificationRecipients === recipient.value && <Ionicons name="checkmark" size={20} color="#2196F3" />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </BottomSheetModal>

      <NotificationScreen
        visible={viewNotificationsModalVisible}
        onClose={() => setViewNotificationsModalVisible(false)}
      />
    </View>
  );
}

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
    backgroundColor: colors.background,
  },
  innerContent: {
    padding: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  
  // Welcome Section
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...colors.shadow,
  },
  adminAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Stats Section
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -6,
  },
  statCard: {
    width: (width - 40) / 2,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 6,
    ...colors.shadow,
    shadowOpacity: 0.05,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  statIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  statSubtitle: {
    fontSize: 11,
    color: colors.warning,
    marginTop: 4,
    fontWeight: '500',
  },

  // Actions Section
  actionsSection: {
    marginBottom: 24,
  },
  actionGrid: {
    gap: 12,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 16,
    ...colors.shadow,
    shadowOpacity: 0.05,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  actionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  actionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 2,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  actionArrow: {
    marginLeft: 12,
  },

  // Activity Section
  activitySection: {
    marginBottom: 24,
  },
  activityCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    ...colors.shadow,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  modalContent: {
    padding: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.gray,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },

  // Selection Button Styles
  selectionButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 56,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  selectionButtonActive: {
    borderColor: '#2196F3',
    backgroundColor: '#F3F8FF',
  },
  selectionText: {
    fontSize: 16,
    color: '#1A1A1A',
    fontWeight: '500',
    marginLeft: 12,
    flex: 1,
  },
  typeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  // Dropdown Styles
  dropdownContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  dropdownItemSelected: {
    backgroundColor: '#F3F8FF',
  },
  dropdownItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  dropdownItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 2,
  },
  dropdownItemTitleSelected: {
    color: '#2196F3',
  },
  dropdownItemDescription: {
    fontSize: 14,
    color: '#666666',
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.gray,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sendButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textSecondary,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
});
