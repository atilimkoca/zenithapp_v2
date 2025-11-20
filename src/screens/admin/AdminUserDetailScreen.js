import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '../../constants/colors';
import UniqueHeader from '../../components/UniqueHeader';
import { adminService } from '../../services/adminService';
import { useI18n } from '../../context/I18nContext';

const buildUserName = (user) => {
  if (user?.displayName) return user.displayName;
  const fallback = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return fallback || 'İsimsiz Üye';
};

const getInitials = (user) => {
  const name = buildUserName(user);
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const InfoRow = ({ icon, label, value, onPress, rightIcon = 'chevron-forward', disabled }) => {
  return (
    <TouchableOpacity
      style={[styles.infoRow, disabled && styles.infoRowDisabled]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={disabled || !onPress}
    >
      <View style={styles.infoLeft}>
        <View style={styles.infoIcon}>
          <Ionicons name={icon} size={18} color="#9CA3AF" />
        </View>
        <View style={styles.infoTextGroup}>
          <Text style={styles.infoLabel}>{label}</Text>
          <Text style={styles.infoValue} numberOfLines={1}>
            {value || '—'}
          </Text>
        </View>
      </View>
      {onPress && (
        <View style={styles.infoChevron}>
          <Ionicons name={rightIcon} size={20} color={colors.primary} />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default function AdminUserDetailScreen({ route, navigation }) {
  useI18n();
  const { userId, initialUser } = route.params || {};
  const [user, setUser] = useState(initialUser || null);
  const [loading, setLoading] = useState(!initialUser);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;

    const fetchUser = async () => {
      try {
        setLoading(true);
        const result = await adminService.getUserById(userId);
        if (result.success) {
          setUser(result.user);
        } else {
          setError(result.message || 'Kullanıcı bilgileri alınamadı.');
        }
      } catch (err) {
        console.error('Error loading user detail:', err);
        setError('Kullanıcı bilgileri alınamadı.');
      } finally {
        setLoading(false);
      }
    };

    if (!initialUser) {
      fetchUser();
    }
  }, [userId, initialUser]);

  const statusDescriptor = useMemo(() => {
    const status = user?.status;
    switch (status) {
      case 'approved':
        return { label: 'Aktif', color: '#4ADE80', icon: 'checkmark-circle' };
      case 'pending':
        return { label: 'Onay Bekliyor', color: '#FBBF24', icon: 'time' };
      case 'rejected':
        return { label: 'Reddedildi', color: '#F87171', icon: 'close-circle' };
      case 'inactive':
        return { label: 'Pasif', color: '#94A3B8', icon: 'pause-circle' };
      default:
        return { label: status || 'Bilinmiyor', color: '#CBD5F5', icon: 'help-circle' };
    }
  }, [user?.status]);

  const handleEmailPress = () => {
    if (user?.email) {
      Linking.openURL(`mailto:${user.email}`).catch(() => null);
    }
  };

  const handlePhonePress = () => {
    const phone = user?.phoneNumber || user?.phone;
    if (phone) {
      const sanitized = phone.replace(/\s+/g, '');
      Linking.openURL(`tel:${sanitized}`).catch(() => null);
    }
  };

  const handleMembershipPress = () => {
    navigation.navigate('AdminUserMembership', {
      userId,
      userName: buildUserName(user),
      userStatus: user?.status || 'pending',
      packageInfo: user?.packageInfo || null,
      remainingClasses: user?.remainingClasses ?? null,
      lessonCredits: user?.lessonCredits ?? null,
      packageExpiryDate: user?.packageExpiryDate ?? null,
      packageStartDate: user?.packageStartDate ?? null,
    });
  };

  const avatarSource = user?.photoURL || user?.avatar;

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Üye Detayı"
        subtitle={buildUserName(user)}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
        backgroundColor={[colors.primary, colors.primaryLight, colors.secondary]}
      />

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Üye bilgileri yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.loader}>
          <Ionicons name="alert-circle" size={42} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
              <LinearGradient
                colors={[colors.white, '#F3F6F3']}
                style={styles.profileGradient}
              >
                <View style={styles.avatarWrapper}>
                  {avatarSource ? (
                    <Image source={{ uri: avatarSource }} style={styles.detailAvatar} />
                  ) : (
                    <View style={styles.detailAvatarFallback}>
                    <Text style={styles.detailAvatarInitial}>{getInitials(user)}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.profileName}>{buildUserName(user)}</Text>
              <View style={[styles.profileStatus, { borderColor: statusDescriptor.color }]}>
                <Ionicons name={statusDescriptor.icon} size={14} color={statusDescriptor.color} />
                <Text style={[styles.profileStatusText, { color: statusDescriptor.color }]}>
                  {statusDescriptor.label}
                </Text>
              </View>
              {user?.packageInfo?.packageName ? (
                <View style={styles.packageTag}>
                  <Ionicons name="layers-outline" size={14} color={colors.primary} />
                  <Text style={styles.packageTagText}>{user.packageInfo.packageName}</Text>
                </View>
              ) : null}
            </LinearGradient>
          </View>

          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>İletişim</Text>
          </View>

          <InfoRow
            icon="mail-outline"
            label="E-posta"
            value={user?.email || 'E-posta bulunamadı'}
            disabled
          />

          <InfoRow
            icon="call-outline"
            label="Telefon"
            value={user?.phoneNumber || user?.phone || 'Telefon bulunamadı'}
            disabled
          />

          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Profil</Text>
          </View>

          <InfoRow
            icon="person-outline"
            label="Ad"
            value={user?.firstName || '—'}
            disabled
          />
          <InfoRow
            icon="people-outline"
            label="Soyad"
            value={user?.lastName || '—'}
            disabled
          />
          <InfoRow
            icon="calendar-outline"
            label="Doğum Tarihi"
            value={user?.birthDate || '—'}
            disabled
          />
          <InfoRow
            icon="male-female-outline"
            label="Cinsiyet"
            value={user?.gender || '—'}
            disabled
          />

          <View style={styles.sectionTitleRow}>
            <Text style={styles.sectionTitle}>Üyelik</Text>
          </View>

          <InfoRow
            icon="card-outline"
            label="Üyelikler"
            value={user?.packageInfo?.packageName || 'Üyelik bulunamadı'}
            onPress={handleMembershipPress}
            rightIcon="chevron-forward"
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 15,
  },
  errorText: {
    marginTop: 12,
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  profileCard: {
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 8,
  },
  profileGradient: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  avatarWrapper: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  detailAvatar: {
    width: '100%',
    height: '100%',
  },
  detailAvatarFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailAvatarInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.primary,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileStatus: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    borderWidth: 1,
  },
  profileStatusText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  packageTag: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 127, 106, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  packageTagText: {
    color: colors.textPrimary,
    fontWeight: '600',
    marginLeft: 6,
  },
  sectionTitleRow: {
    marginTop: 4,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(15, 24, 16, 0.08)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  infoRowDisabled: {
    opacity: 0.75,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  infoTextGroup: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoChevron: {
    marginLeft: 12,
  },
});
