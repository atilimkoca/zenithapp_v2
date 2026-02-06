import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { colors } from '../constants/colors';
import { useI18n } from '../context/I18nContext';

const { width, height } = Dimensions.get('window');

const ForceUpdateModal = ({
  visible,
  forceUpdate = false,
  currentVersion,
  latestVersion,
  updateMessage,
  updateMessageTr,
  onUpdate,
  onSkip,
}) => {
  // Safely get translations - may not be available during loading
  let t, language;
  try {
    const i18n = useI18n();
    t = i18n.t;
    language = i18n.language;
  } catch (e) {
    // Fallback if I18n not ready
    t = (key) => {
      const fallback = {
        'update.title': 'Güncelleme Mevcut',
        'update.currentVersion': 'Mevcut',
        'update.newVersion': 'Yeni',
        'update.defaultMessage': 'Yeni bir sürüm mevcut. Lütfen güncelleyin.',
        'update.forceUpdateWarning': 'Uygulamayı kullanmaya devam etmek için bu güncelleme zorunludur.',
        'update.updateNow': 'Şimdi Güncelle',
        'update.later': 'Daha Sonra',
      };
      return fallback[key] || key;
    };
    language = 'tr';
  }
  
  // Get localized message
  const message = language === 'tr' ? (updateMessageTr || updateMessage) : updateMessage;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        // Prevent closing with Android back button when force update is required
        if (!forceUpdate && onSkip) {
          onSkip();
        }
      }}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconEmoji}>🚀</Text>
          </View>
          
          {/* Title */}
          <Text style={styles.title}>{t('update.title')}</Text>
          
          {/* Version Info */}
          <View style={styles.versionContainer}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionLabel}>{t('update.currentVersion')}</Text>
              <Text style={styles.versionNumber}>{currentVersion}</Text>
            </View>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
            <View style={[styles.versionBadge, styles.newVersionBadge]}>
              <Text style={[styles.versionLabel, styles.newVersionLabel]}>{t('update.newVersion')}</Text>
              <Text style={[styles.versionNumber, styles.newVersionNumber]}>{latestVersion}</Text>
            </View>
          </View>
          
          {/* Message */}
          <Text style={styles.message}>
            {message || t('update.defaultMessage')}
          </Text>
          
          {/* Force Update Warning */}
          {forceUpdate && (
            <View style={styles.warningContainer}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <Text style={styles.warningText}>{t('update.forceUpdateWarning')}</Text>
            </View>
          )}
          
          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={onUpdate}
              activeOpacity={0.8}
            >
              <Text style={styles.updateButtonText}>{t('update.updateNow')}</Text>
            </TouchableOpacity>
            
            {!forceUpdate && (
              <TouchableOpacity
                style={styles.skipButton}
                onPress={onSkip}
                activeOpacity={0.7}
              >
                <Text style={styles.skipButtonText}>{t('update.later')}</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Store Badge */}
          <View style={styles.storeContainer}>
            <Text style={styles.storeText}>
              {Platform.OS === 'ios' ? 'App Store' : 'Google Play'}
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  container: {
    backgroundColor: colors.white || '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconEmoji: {
    fontSize: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text || '#1a1a1a',
    marginBottom: 16,
    textAlign: 'center',
  },
  versionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  versionBadge: {
    backgroundColor: colors.background || '#f5f5f5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  newVersionBadge: {
    backgroundColor: colors.primary + '15',
  },
  versionLabel: {
    fontSize: 11,
    color: colors.textSecondary || '#666',
    marginBottom: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  newVersionLabel: {
    color: colors.primary,
  },
  versionNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text || '#1a1a1a',
  },
  newVersionNumber: {
    color: colors.primary,
  },
  arrowContainer: {
    paddingHorizontal: 12,
  },
  arrow: {
    fontSize: 20,
    color: colors.primary,
    fontWeight: '600',
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary || '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 20,
  },
  warningIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  warningText: {
    fontSize: 13,
    color: '#856404',
    flex: 1,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  updateButton: {
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  updateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  skipButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  skipButtonText: {
    color: colors.textSecondary || '#666',
    fontSize: 15,
    fontWeight: '500',
  },
  storeContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border || '#eee',
    width: '100%',
    alignItems: 'center',
  },
  storeText: {
    fontSize: 13,
    color: colors.textSecondary || '#999',
  },
});

export default ForceUpdateModal;
