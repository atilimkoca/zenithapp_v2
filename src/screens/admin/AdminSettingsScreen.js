import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import UniqueHeader from '../../components/UniqueHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AdminSettingsScreen({ navigation }) {
  const { user, userData, logout } = useAuth();
  const [settings, setSettings] = useState({
    autoApproveUsers: false,
    emailNotifications: true,
    pushNotifications: true,
    maintenanceMode: false,
    debugMode: false,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('adminSettings');
      if (savedSettings) {
        setSettings({ ...settings, ...JSON.parse(savedSettings) });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('adminSettings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
      Alert.alert('Hata', 'Ayarlar kaydedilemedi');
    }
  };

  const handleToggleSetting = (key, value) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Admin panelinden çıkmak istediğinizden emin misiniz?',
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();
            } catch (error) {
              console.error('Logout error:', error);
            }
          }
        }
      ]
    );
  };

  const handleClearCache = () => {
    Alert.alert(
      'Önbelleği Temizle',
      'Uygulama önbelleğini temizlemek istediğinizden emin misiniz? Bu işlem uygulamayı yeniden başlatacaktır.',
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('Başarılı', 'Önbellek temizlendi');
            } catch (error) {
              Alert.alert('Hata', 'Önbellek temizlenemedi');
            }
          }
        }
      ]
    );
  };

  const SettingItem = ({ icon, title, description, value, onToggle, type = 'switch' }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Ionicons name={icon} size={24} color={colors.primary} />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
      </View>
      {type === 'switch' && (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary + '50' }}
          thumbColor={value ? colors.primary : colors.textSecondary}
        />
      )}
    </View>
  );

  const ActionItem = ({ icon, title, description, onPress, color = colors.textPrimary, destructive = false }) => (
    <TouchableOpacity 
      style={styles.actionItem} 
      onPress={onPress}
    >
      <View style={styles.settingLeft}>
        <View style={[styles.settingIcon, destructive && { backgroundColor: colors.error + '15' }]}>
          <Ionicons name={icon} size={24} color={destructive ? colors.error : color} />
        </View>
        <View style={styles.settingText}>
          <Text style={[styles.settingTitle, destructive && { color: colors.error }]}>{title}</Text>
          {description && <Text style={styles.settingDescription}>{description}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Admin Ayarları"
        subtitle="Sistem konfigürasyonu"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Admin Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Bilgileri</Text>
          <View style={styles.adminInfo}>
            <View style={styles.adminAvatar}>
              <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
            </View>
            <View style={styles.adminDetails}>
              <Text style={styles.adminName}>{userData?.displayName || 'Admin'}</Text>
              <Text style={styles.adminEmail}>{userData?.email}</Text>
              <Text style={styles.adminRole}>
                {userData?.role === 'admin' ? 'Sistem Yöneticisi' : 'Eğitmen'}
              </Text>
            </View>
          </View>
        </View>

        {/* System Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sistem Ayarları</Text>
          
          <SettingItem
            icon="people-outline"
            title="Otomatik Kullanıcı Onayı"
            description="Yeni kullanıcıları otomatik olarak onayla"
            value={settings.autoApproveUsers}
            onToggle={(value) => handleToggleSetting('autoApproveUsers', value)}
          />

          <SettingItem
            icon="construct-outline"
            title="Bakım Modu"
            description="Uygulamayı bakım moduna al"
            value={settings.maintenanceMode}
            onToggle={(value) => handleToggleSetting('maintenanceMode', value)}
          />

          <SettingItem
            icon="bug-outline"
            title="Hata Ayıklama Modu"
            description="Detaylı logları etkinleştir"
            value={settings.debugMode}
            onToggle={(value) => handleToggleSetting('debugMode', value)}
          />
        </View>

        {/* Notification Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bildirim Ayarları</Text>
          
          <SettingItem
            icon="mail-outline"
            title="E-posta Bildirimleri"
            description="Sistem e-postalarını al"
            value={settings.emailNotifications}
            onToggle={(value) => handleToggleSetting('emailNotifications', value)}
          />

          <SettingItem
            icon="notifications-outline"
            title="Push Bildirimleri"
            description="Mobil bildirimleri al"
            value={settings.pushNotifications}
            onToggle={(value) => handleToggleSetting('pushNotifications', value)}
          />
        </View>

        {/* System Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sistem İşlemleri</Text>

          <ActionItem
            icon="refresh-outline"
            title="Verileri Yenile"
            description="Tüm verileri sunucudan yeniden yükle"
            onPress={() => {
              Alert.alert('Başarılı', 'Veriler yenilendi');
            }}
            color={colors.primary}
          />

          <ActionItem
            icon="trash-outline"
            title="Önbelleği Temizle"
            description="Uygulama önbelleğini temizle"
            onPress={handleClearCache}
            color={colors.warning}
          />

          <ActionItem
            icon="download-outline"
            title="Verileri Dışa Aktar"
            description="Sistem verilerini dışa aktar"
            onPress={() => {
              Alert.alert('Bilgi', 'Bu özellik yakında eklenecek');
            }}
            color={colors.info}
          />
        </View>

        {/* System Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sistem Bilgileri</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Uygulama Sürümü</Text>
            <Text style={styles.infoValue}>1.0.0</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Son Güncelleme</Text>
            <Text style={styles.infoValue}>3 Ekim 2025</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>React Native</Text>
          </View>
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <ActionItem
            icon="log-out-outline"
            title="Çıkış Yap"
            description="Admin panelinden çıkış yap"
            onPress={handleLogout}
            destructive
          />
        </View>

      </ScrollView>
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
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...colors.shadow,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },

  // Admin Info
  adminInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  adminDetails: {
    flex: 1,
  },
  adminName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  adminEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  adminRole: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },

  // Settings
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Info
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
});