import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { adminNotificationUtils } from '../../utils/adminNotificationUtils';
import UniqueHeader from '../../components/UniqueHeader';
import BottomSheetModal from '../../components/BottomSheetModal';

export default function AdminNotificationsScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(true);

  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'general',
    priority: 'normal',
  });

  const notificationTypes = [
    { key: 'general', label: 'Genel', color: colors.primary, icon: 'information-circle-outline' },
    { key: 'lesson', label: 'Ders', color: '#FF6B6B', icon: 'calendar-outline' },
    { key: 'announcement', label: 'Duyuru', color: '#4ECDC4', icon: 'megaphone-outline' },
    { key: 'reminder', label: 'Hatırlatma', color: '#45B7D1', icon: 'alarm-outline' },
    { key: 'system', label: 'Sistem', color: '#96CEB4', icon: 'cog-outline' },
  ];

  const priorityLevels = [
    { key: 'low', label: 'Düşük', color: colors.success },
    { key: 'normal', label: 'Normal', color: colors.primary },
    { key: 'high', label: 'Yüksek', color: colors.warning },
    { key: 'urgent', label: 'Acil', color: colors.error },
  ];

  const handleSendNotification = async (target = 'all') => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      Alert.alert('Hata', 'Başlık ve mesaj alanları zorunludur.');
      return;
    }

    setLoading(true);

    try {
      const notificationData = {
        ...notificationForm,
        senderId: user.uid,
        senderName: user.displayName || 'Admin',
        target,
        createdAt: new Date().toISOString(),
      };

      const result = await adminNotificationUtils.sendNotification(notificationData);

      if (result.success) {
        setSheetVisible(false);
        Alert.alert(
          'Başarılı',
          target === 'all' ? 'Bildirim tüm kullanıcılara gönderildi!' : 'Bildirim gönderildi!'
        );
        setNotificationForm({
          title: '',
          message: '',
          type: 'general',
          priority: 'normal',
        });
      } else {
        Alert.alert('Hata', result.message || 'Bildirim gönderilemedi');
      }
    } catch (error) {
      console.error('Notification send error:', error);
      Alert.alert('Hata', 'Bildirim gönderilirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCustomNotification = () => handleSendNotification('self');
  const handleSendBroadcastNotification = () => handleSendNotification('all');

  const TypeSelector = ({ type, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.typeButton,
        { backgroundColor: isSelected ? type.color : type.color + '25' },
      ]}
      onPress={onPress}
    >
      <Ionicons name={type.icon} size={18} color={isSelected ? colors.white : type.color} />
      <Text style={[styles.typeText, isSelected && styles.typeTextActive]}>{type.label}</Text>
    </TouchableOpacity>
  );

  const PrioritySelector = ({ priority, isSelected, onPress }) => (
    <TouchableOpacity
      style={[
        styles.priorityButton,
        {
          backgroundColor: isSelected ? priority.color : priority.color + '20',
          borderColor: priority.color,
        },
      ]}
      onPress={onPress}
    >
      <Text style={[styles.priorityText, isSelected && { color: colors.white }]}>
        {priority.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Bildirimler"
        subtitle="Toplu bildirim gönder"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightIcon="help-circle-outline"
        onRightPress={() => {
          Alert.alert(
            'Bildirim Yardımı',
            'Tüm kullanıcılara veya sadece kendinize test bildirimi gönderebilirsiniz. Bildirim türü ve öncelik seviyesini seçerek daha etkili mesajlar oluşturabilirsiniz.'
          );
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name="notifications-outline" size={28} color={colors.primary} />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.heroTitle}>Bildirim Merkezi</Text>
            <Text style={styles.heroSubtitle}>
              Üyelere hızlıca duyuru, hatırlatma veya özel mesaj gönderebilirsiniz.
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.openSheetButton} onPress={() => setSheetVisible(true)}>
          <Ionicons name="sparkles-outline" size={20} color={colors.white} />
          <Text style={styles.openSheetButtonText}>Yeni Bildirim Oluştur</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hazır Şablonlar</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.primary + '15' }]}
              onPress={() => {
                setNotificationForm({
                  title: 'Yeni Duyuru!',
                  message: 'Bu hafta yeni dersler planlandı. Detaylar için uygulamayı kontrol et!',
                  type: 'announcement',
                  priority: 'normal',
                });
                setSheetVisible(true);
              }}
            >
              <Ionicons name="megaphone-outline" size={22} color={colors.primary} />
              <Text style={styles.quickActionTitle}>Genel Duyuru</Text>
              <Text style={styles.quickActionDescription}>Hızlıca duyuru paylaş</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.warning + '15' }]}
              onPress={() => {
                setNotificationForm({
                  title: 'Ders Hatırlatması',
                  message: 'Bugünkü dersiniz için 2 saat kaldı. Hazır mısınız?',
                  type: 'reminder',
                  priority: 'high',
                });
                setSheetVisible(true);
              }}
            >
              <Ionicons name="alarm-outline" size={22} color={colors.warning} />
              <Text style={styles.quickActionTitle}>Ders Hatırlatması</Text>
              <Text style={styles.quickActionDescription}>Önemli hatırlatma gönder</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionButton, { backgroundColor: colors.success + '15' }]}
              onPress={() => {
                setNotificationForm({
                  title: 'Hoş Geldiniz!',
                  message: 'Aramıza katıldığınız için teşekkür ederiz! İlk dersinizi planlamayı unutmayın.',
                  type: 'general',
                  priority: 'normal',
                });
                setSheetVisible(true);
              }}
            >
              <Ionicons name="heart-outline" size={22} color={colors.success} />
              <Text style={styles.quickActionTitle}>Hoş Geldin Mesajı</Text>
              <Text style={styles.quickActionDescription}>Yeni üyeye özel mesaj</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <BottomSheetModal
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        title="Bildirim Oluştur"
        subtitle="Üyelere hızlıca duyuru, hatırlatma veya özel mesaj gönderin."
        accentIcon="notifications-outline"
        footer={
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetButtonSecondary]}
              onPress={handleSendCustomNotification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="send-outline" size={16} color={colors.primary} />
                  <Text style={styles.secondaryButtonText}>Test Bildirimi</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sheetButton, styles.sheetButtonPrimary]}
              onPress={handleSendBroadcastNotification}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="people-outline" size={16} color={colors.white} />
                  <Text style={styles.primaryButtonText}>Tüm Kullanıcılara Gönder</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        }
      >
        <ScrollView
          contentContainerStyle={styles.sheetContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formGroup}>
            <Text style={styles.label}>Başlık *</Text>
            <TextInput
              style={styles.input}
              value={notificationForm.title}
              onChangeText={(text) => setNotificationForm((prev) => ({ ...prev, title: text }))}
              placeholder="Bildirim başlığı girin..."
              placeholderTextColor={colors.textSecondary}
              maxLength={100}
            />
            <Text style={styles.characterCount}>{notificationForm.title.length}/100</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mesaj *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={notificationForm.message}
              onChangeText={(text) => setNotificationForm((prev) => ({ ...prev, message: text }))}
              placeholder="Bildirim mesajını girin..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={500}
            />
            <Text style={styles.characterCount}>{notificationForm.message.length}/500</Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Bildirim Türü</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeContainer}
            >
              {notificationTypes.map((type) => (
                <TypeSelector
                  key={type.key}
                  type={type}
                  isSelected={notificationForm.type === type.key}
                  onPress={() => setNotificationForm((prev) => ({ ...prev, type: type.key }))}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Öncelik Seviyesi</Text>
            <View style={styles.priorityContainer}>
              {priorityLevels.map((priority) => (
                <PrioritySelector
                  key={priority.key}
                  priority={priority}
                  isSelected={notificationForm.priority === priority.key}
                  onPress={() =>
                    setNotificationForm((prev) => ({ ...prev, priority: priority.key }))
                  }
                />
              ))}
            </View>
          </View>
        </ScrollView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...colors.shadow,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    marginLeft: 16,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  openSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 20,
    ...colors.shadow,
  },
  openSheetButtonText: {
    marginLeft: 8,
    color: colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    ...colors.shadow,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 14,
  },
  quickActions: {
    gap: 14,
  },
  quickActionButton: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.transparentGreenLight,
  },
  quickActionTitle: {
    marginTop: 12,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  quickActionDescription: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  sheetContent: {
    paddingBottom: 8,
    gap: 18,
  },
  formGroup: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
  typeContainer: {
    flexGrow: 0,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginRight: 12,
  },
  typeText: {
    marginLeft: 8,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  typeTextActive: {
    color: colors.white,
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  sheetButtonSecondary: {
    backgroundColor: colors.transparentGreenLight,
    borderWidth: 1,
    borderColor: colors.transparentGreen,
  },
  sheetButtonPrimary: {
    backgroundColor: colors.primary,
  },
  secondaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  primaryButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
});
 
