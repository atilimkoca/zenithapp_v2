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
import RecipientSelector from '../../components/RecipientSelector';
import { manualNotificationService } from '../../services/manualNotificationService';
import { resolveRecipients } from '../../utils/recipientResolver';

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
  const [recipientSpec, setRecipientSpec] = useState({ mode: 'all' });
  const [audience, setAudience] = useState([]);

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
  const openNotificationModal = async () => {
    setCreateNotificationModalVisible(true);
    setRecipientSpec({ mode: 'all' });
    // Load the audience for segment/individual targeting + live counts.
    const res = await manualNotificationService.getAudience();
    if (res.success) setAudience(res.users);
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
    setRecipientSpec({ mode: 'all' });
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

    // Block sending to an empty audience.
    const preview = resolveRecipients(recipientSpec, audience);
    if (recipientSpec.mode !== 'all' && preview.count === 0) {
      Alert.alert('Alıcı yok', 'Bu kritere uyan kullanıcı yok. Hedeflemeyi değiştir.');
      return;
    }

    try {
      setNotificationSending(true);

      const typeMap = { Bilgi: 'general', Uyarı: 'general', Acil: 'urgent', Duyuru: 'announcement' };
      const content = {
        title: notificationTitle.trim(),
        message: notificationMessage.trim(),
        type: typeMap[notificationType] || 'general',
        priority: notificationType === 'Acil' ? 'high' : 'normal',
      };

      const result = await manualNotificationService.send(recipientSpec, content, audience);

      if (result.success) {
        closeNotificationModal();
        Alert.alert(
          'Başarılı',
          recipientSpec.mode === 'all'
            ? 'Bildirim tüm üyelere gönderildi.'
            : result.message || `${result.count} kişiye gönderildi.`
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
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionDescription} numberOfLines={1}>{description}</Text>
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

          {/* Admin Actions - Horizontal Scroll */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actionRow}>
              
              <ActionCard
                title="Üyeler"
                description="Yönet"
                icon="people"
                color={colors.primary}
                onPress={() => navigateToSection('AdminUserManagement')}
                badge={stats.pendingUsers > 0 ? stats.pendingUsers : null}
              />

              <ActionCard
                title="Dersler"
                description="Planla"
                icon="calendar"
                color={colors.success}
                onPress={() => navigateToSection('AdminLessonManagement')}
              />

              <ActionCard
                title="Bildirim"
                description="Gönder"
                icon="notifications"
                color="#FF6B6B"
                onPress={openNotificationModal}
              />

              <ActionCard
                title="Otomatik"
                description="Bildirimler"
                icon="alarm"
                color="#45B7D1"
                onPress={() => navigation.navigate('AdminAutoNotifications')}
              />

              <ActionCard
                title="Çıkış"
                description="Güvenli"
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
            </ScrollView>
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
                <Text style={styles.sendButtonText}>
                  {(() => {
                    const c = resolveRecipients(recipientSpec, audience).count;
                    return recipientSpec.mode === 'all' ? 'Bildirim Gönder' : `${c} kişiye gönder`;
                  })()}
                </Text>
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
            <RecipientSelector audience={audience} spec={recipientSpec} onChange={setRecipientSpec} />
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
  actionRow: {
    paddingRight: 20,
    gap: 12,
  },
  actionCard: {
    width: 110,
    height: 110,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 12,
    ...colors.shadow,
    shadowOpacity: 0.08,
    elevation: 3,
    borderWidth: 1,
    borderColor: colors.lightGray,
    marginRight: 4,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
    textAlign: 'center',
  },
  actionDescription: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: 'bold',
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
