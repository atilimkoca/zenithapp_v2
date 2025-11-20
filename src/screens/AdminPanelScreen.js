import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../constants/colors';
import { adminNotificationUtils } from '../utils/adminNotificationUtils';
import { testSimpleFirebaseListener } from '../services/simpleFirebaseListener';
import { useAuth } from '../context/AuthContext';

const AdminPanelScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Notification form state
  const [notificationForm, setNotificationForm] = useState({
    title: '',
    message: '',
    type: 'general',
    priority: 'normal'
  });

  const notificationTypes = [
    { key: 'general', label: 'Genel', color: colors.primary },
    { key: 'lesson', label: 'Ders', color: '#FF6B6B' },
    { key: 'credit', label: 'Kredi', color: '#4ECDC4' },
    { key: 'promotion', label: 'Promosyon', color: '#45B7D1' },
    { key: 'system', label: 'Sistem', color: '#96CEB4' }
  ];

  const priorityLevels = [
    { key: 'low', label: 'Düşük', color: '#95A5A6' },
    { key: 'normal', label: 'Normal', color: colors.primary },
    { key: 'high', label: 'Yüksek', color: '#F39C12' },
    { key: 'urgent', label: 'Acil', color: '#E74C3C' }
  ];

  const handleSendTestNotification = async () => {
    if (!user?.uid) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    setLoading(true);
    try {
      const result = await adminNotificationUtils.sendTestNotification(user.uid);
      
      if (result.success) {
        Alert.alert('Başarılı', 'Test bildirimi gönderildi!');
      } else {
        Alert.alert('Hata', result.message || 'Test bildirimi gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu');
      console.error('Error sending test notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCustomNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      Alert.alert('Hata', 'Başlık ve mesaj alanları zorunludur');
      return;
    }

    if (!user?.uid) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    setLoading(true);
    try {
      const result = await adminNotificationUtils.sendNotificationWithPush(
        user.uid,
        notificationForm
      );
      
      if (result.success) {
        Alert.alert('Başarılı', 'Özel bildirim gönderildi!');
        setNotificationForm({
          title: '',
          message: '',
          type: 'general',
          priority: 'normal'
        });
      } else {
        Alert.alert('Hata', result.message || 'Bildirim gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu');
      console.error('Error sending custom notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendBroadcastNotification = async () => {
    if (!notificationForm.title.trim() || !notificationForm.message.trim()) {
      Alert.alert('Hata', 'Başlık ve mesaj alanları zorunludur');
      return;
    }

    Alert.alert(
      'Genel Bildirim Gönder',
      'Bu bildirim tüm kullanıcılara gönderilecek. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Gönder',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const result = await adminNotificationUtils.sendBroadcastNotificationWithPush(
                notificationForm
              );
              
              if (result.success) {
                Alert.alert(
                  'Başarılı', 
                  `Genel bildirim gönderildi! (${result.userCount || 0} kullanıcı)`
                );
                setNotificationForm({
                  title: '',
                  message: '',
                  type: 'general',
                  priority: 'normal'
                });
              } else {
                Alert.alert('Hata', result.message || 'Genel bildirim gönderilemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'Beklenmeyen bir hata oluştu');
              console.error('Error sending broadcast notification:', error);
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSendWelcomeNotification = async () => {
    if (!user?.uid) {
      Alert.alert('Hata', 'Kullanıcı oturumu bulunamadı');
      return;
    }

    setLoading(true);
    try {
      const result = await adminNotificationUtils.sendWelcomeNotification(
        user.uid,
        user.displayName || 'Kullanıcı'
      );
      
      if (result.success) {
        Alert.alert('Başarılı', 'Hoş geldin bildirimi gönderildi!');
      } else {
        Alert.alert('Hata', result.message || 'Hoş geldin bildirimi gönderilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Beklenmeyen bir hata oluştu');
      console.error('Error sending welcome notification:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTestFirebaseListener = async () => {
    setLoading(true);
    try {
      const result = await testSimpleFirebaseListener();
      
      if (result) {
        Alert.alert('Başarılı', 'Firebase listener test edildi! Bildirim geldi mi?');
      } else {
        Alert.alert('Hata', 'Firebase listener test edilemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Test sırasında bir hata oluştu');
      console.error('Error testing Firebase listener:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← Geri</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Admin Panel</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleSendTestNotification}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>📱 Test Bildirimi Gönder</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#4ECDC4' }]}
            onPress={handleSendWelcomeNotification}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>👋 Hoş Geldin Bildirimi</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: '#FF6B6B' }]}
            onPress={handleTestFirebaseListener}
            disabled={loading}
          >
            <Text style={styles.actionButtonText}>🔔 Firebase Listener Test</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Notification Form */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Özel Bildirim Oluştur</Text>
          
          <View style={styles.formGroup}>
            <Text style={styles.label}>Başlık</Text>
            <TextInput
              style={styles.input}
              placeholder="Bildirim başlığı"
              value={notificationForm.title}
              onChangeText={(text) => setNotificationForm(prev => ({ ...prev, title: text }))}
              maxLength={100}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mesaj</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Bildirim mesajı"
              value={notificationForm.message}
              onChangeText={(text) => setNotificationForm(prev => ({ ...prev, message: text }))}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Bildirim Türü</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optionContainer}>
                {notificationTypes.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.optionButton,
                      { backgroundColor: type.color },
                      notificationForm.type === type.key && styles.selectedOption
                    ]}
                    onPress={() => setNotificationForm(prev => ({ ...prev, type: type.key }))}
                  >
                    <Text style={styles.optionText}>{type.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Öncelik</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.optionContainer}>
                {priorityLevels.map((priority) => (
                  <TouchableOpacity
                    key={priority.key}
                    style={[
                      styles.optionButton,
                      { backgroundColor: priority.color },
                      notificationForm.priority === priority.key && styles.selectedOption
                    ]}
                    onPress={() => setNotificationForm(prev => ({ ...prev, priority: priority.key }))}
                  >
                    <Text style={styles.optionText}>{priority.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#FF6B6B', flex: 1, marginRight: 8 }]}
              onPress={handleSendCustomNotification}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>📤 Bana Gönder</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: '#E74C3C', flex: 1, marginLeft: 8 }]}
              onPress={handleSendBroadcastNotification}
              disabled={loading}
            >
              <Text style={styles.actionButtonText}>📢 Herkese Gönder</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🌐 Web Admin Panel Entegrasyonu</Text>
          <Text style={styles.infoText}>
            Artık web admin panelinizden bildirim oluşturduğunuzda, mobil uygulamada otomatik olarak bildirim görünecek!
          </Text>
          <Text style={styles.infoText}>
            ✅ Nasıl çalışır:{'\n'}
            • Web admin → Firebase'e bildirim ekle{'\n'}
            • Mobil app Firebase'i dinliyor{'\n'}
            • Yeni bildirim algılandığında telefonda bildirim çıkar{'\n'}
            • Aynı zamanda uygulama içinde de görünür
          </Text>
          <Text style={styles.infoText}>
            🧪 Test için:{'\n'}
            1. "Firebase Listener Test" butonuna basın{'\n'}
            2. Web admin panelinizden bildirim oluşturun{'\n'}
            3. Mobil uygulamada bildirim görünmeli
          </Text>
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    marginRight: 15,
  },
  backButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 15,
  },
  actionButton: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  optionContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  optionButton: {
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
  },
  selectedOption: {
    borderWidth: 3,
    borderColor: colors.text,
  },
  optionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 10,
  },
});

export default AdminPanelScreen;