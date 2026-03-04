import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
  PanResponder,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import UniqueHeader from '../../components/UniqueHeader';
import { colors } from '../../constants/colors';
import { useI18n } from '../../context/I18nContext';
import { adminService } from '../../services/adminService';

const formatDate = (value, locale = 'tr') => {
  if (!value) return '-';
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const resolvedLocale = locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : locale || 'tr-TR';
    return date.toLocaleDateString(resolvedLocale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch (error) {
    return value;
  }
};

const ProgressBar = ({ label, value, total, color }) => {
  const safeTotal = total > 0 ? total : 1;
  const progress = Math.min(Math.max(value / safeTotal, 0), 1);

  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {Math.max(0, Math.round(value))} / {Math.max(0, Math.round(safeTotal))}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

export default function AdminUserMembershipScreen({ route, navigation }) {
  const { t, language } = useI18n();
  const {
    userId,
    userName = 'Üye',
    userStatus = 'pending',
    packageInfo,
    remainingClasses,
    lessonCredits,
    packageExpiryDate,
    packageStartDate,
  } = route.params || {};

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [packages, setPackages] = useState([]);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [renewLoading, setRenewLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const sheetTranslateY = useRef(new Animated.Value(0)).current;

  // State for all user packages (multi-package support)
  const [userPackages, setUserPackages] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(true);

  // State for edit package modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPackage, setEditPackage] = useState(null);
  const [editRemainingLessons, setEditRemainingLessons] = useState('');
  const [editStartDate, setEditStartDate] = useState(new Date());
  const [editExpiryDate, setEditExpiryDate] = useState(new Date());
  const [showEditStartDatePicker, setShowEditStartDatePicker] = useState(false);
  const [showEditExpiryDatePicker, setShowEditExpiryDatePicker] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editDurationDays, setEditDurationDays] = useState(30);

  // Load all packages for this user
  useEffect(() => {
    loadUserPackagesData();
  }, [userId]);

  const hideRenewModal = (resetState = false) => {
    setShowRenewModal(false);
    setShowDatePicker(false);
    sheetTranslateY.setValue(0);
    if (resetState) {
      setSelectedPackage(null);
      setStartDate(new Date());
    }
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 6,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          sheetTranslateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 120 || gestureState.vy > 0.8) {
          Animated.timing(sheetTranslateY, {
            toValue: 600,
            duration: 200,
            useNativeDriver: true,
          }).start(() => hideRenewModal(true));
        } else {
          Animated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (showRenewModal) {
      sheetTranslateY.setValue(0);
    }
  }, [showRenewModal]);

  // Treat frozen users as approved for renewal purposes
  const APPROVED_STATUSES = ['approved', 'frozen', 'active'];
  const isApproved = APPROVED_STATUSES.includes((userStatus || '').toLowerCase());

  // Create effective packageInfo - fallback to root-level data if packageInfo is missing
  const effectivePackageInfo = useMemo(() => {
    // If packageInfo exists and is valid, use it
    if (packageInfo && packageInfo.packageId && packageInfo.packageName &&
        packageInfo.packageName !== 'Üyelik bulunamadı' &&
        packageInfo.packageName !== 'Paket Atanmadı' &&
        packageInfo.packageName !== 'Tanımsız Paket') {
      return packageInfo;
    }

    // Fallback: create packageInfo from root-level fields if user has remaining classes
    const credits = remainingClasses ?? lessonCredits ?? 0;
    const totalFromParams = route.params?.totalLessons;
    if (isApproved && credits > 0) {
      return {
        packageId: 'legacy_package',
        packageName: route.params?.packageName || 'Mevcut Paket',
        packageType: route.params?.packageType || 'group',
        totalLessons: totalFromParams || credits, // Use totalLessons if available, fallback to credits
        lessonCount: totalFromParams || credits,
        remainingClasses: credits,
        assignedAt: packageStartDate || null,
        expiryDate: packageExpiryDate || null,
      };
    }

    return null;
  }, [packageInfo, remainingClasses, lessonCredits, packageStartDate, packageExpiryDate, isApproved, route.params]);

  const hasPackage = isApproved && effectivePackageInfo !== null;
  const requiresApprovalFlow = !hasPackage;
  const primaryActionGradient = hasPackage
    ? [colors.primary, colors.primaryDark]
    : ['#059669', '#047857'];
  const primaryActionLabel = hasPackage ? 'Paketi Yenile' : 'Üyeyi Onayla';
  const modalConfirmLabel = hasPackage ? 'Yenile' : 'Onayla';
  const modalTitle = hasPackage ? 'Paket Yenile' : 'Üyeyi Onayla';

  const handleRenewPress = async () => {
    try {
      const result = await adminService.getPackages();
      if (result.success) {
        setPackages(result.packages);
        setShowRenewModal(true);
      } else {
        Alert.alert('Hata', 'Paketler yüklenemedi');
      }
    } catch (error) {
      Alert.alert('Hata', 'Bir hata oluştu');
    }
  };

  const handleEditPackage = (pkg) => {
    setEditPackage(pkg);
    setEditRemainingLessons(String(pkg.remainingLessons || 0));
    // Parse dates from package
    const startDate = pkg.startDate ? new Date(pkg.startDate) : new Date();
    const expiryDate = pkg.expiryDate ? new Date(pkg.expiryDate) : new Date();
    
    setEditStartDate(startDate);
    setEditExpiryDate(expiryDate);
    
    // Calculate duration in days to maintain it when start date changes
    const diffTime = Math.abs(expiryDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setEditDurationDays(diffDays > 0 ? diffDays : 30);
    
    setShowEditStartDatePicker(false);
    setShowEditExpiryDatePicker(false);
    setShowEditModal(true);
  };

  const handleEditSubmit = async () => {
    const newRemaining = parseInt(editRemainingLessons, 10);
    if (isNaN(newRemaining) || newRemaining < 0) {
      Alert.alert('Hata', 'Geçerli bir sayı girin');
      return;
    }

    const resolvedLocale = language === 'tr' ? 'tr-TR' : language === 'en' ? 'en-US' : 'tr-TR';

    Alert.alert(
      'Paketi Düzenle',
      `${editPackage.packageName} paketini güncellemek istediğinizden emin misiniz?\n\n` +
      `Kalan Ders: ${newRemaining}\n` +
      `Başlangıç: ${editStartDate.toLocaleDateString(resolvedLocale)}\n` +
      `Bitiş: ${editExpiryDate.toLocaleDateString(resolvedLocale)}`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Güncelle',
          onPress: async () => {
            setEditLoading(true);
            try {
              const result = await adminService.updateUserPackage(
                userId,
                editPackage.id,
                newRemaining,
                editStartDate.toISOString(),
                editExpiryDate.toISOString()
              );

              if (result.success) {
                Alert.alert('Başarılı', 'Paket güncellendi', [
                  {
                    text: 'Tamam',
                    onPress: () => {
                      setShowEditModal(false);
                      setEditPackage(null);
                      // Refresh user packages
                      loadUserPackagesData();
                    },
                  },
                ]);
              } else {
                Alert.alert('Hata', result.error || 'Paket güncellenemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu');
            } finally {
              setEditLoading(false);
            }
          },
        },
      ]
    );
  };

  const loadUserPackagesData = async () => {
    if (!userId) return;

    try {
      setLoadingPackages(true);
      const result = await adminService.getUserPackages(userId);
      if (result.success) {
        setUserPackages(result.packages);
      }
    } catch (error) {
      console.error('Error loading user packages:', error);
    } finally {
      setLoadingPackages(false);
    }
  };

  const handleConfirmRenew = async () => {
    if (!selectedPackage) {
      Alert.alert('Uyarı', 'Lütfen bir paket seçin');
      return;
    }

    const isApproval = requiresApprovalFlow;
    const actionTitle = isApproval ? 'Üyeyi Onayla' : 'Paketi Yenile';
    const actionButton = isApproval ? 'Onayla' : 'Yenile';
    const resolvedLocale = language === 'tr' ? 'tr-TR' : language === 'en' ? 'en-US' : 'tr-TR';
    const actionMessage = isApproval
      ? `${selectedPackage.name} paketi ile üyeyi onaylamak istediğinizden emin misiniz?\n\nBaşlangıç Tarihi: ${startDate.toLocaleDateString(resolvedLocale)}`
      : `${selectedPackage.name} paketi ile üyeliği yenilemek istediğinizden emin misiniz?\n\nBaşlangıç Tarihi: ${startDate.toLocaleDateString(resolvedLocale)}`;

    Alert.alert(
      actionTitle,
      actionMessage,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: actionButton,
          onPress: async () => {
            setRenewLoading(true);
            try {
              // Use addPackageToUser for both approval and renewal (multi-package support)
              const result = await adminService.addPackageToUser(
                userId,
                {
                  packageId: selectedPackage.id,
                  startDate: startDate.toISOString()
                },
                'admin'
              );

              if (result.success) {
                const successMessage = isApproval
                  ? 'Üye başarıyla onaylandı'
                  : `Paket başarıyla eklendi. Toplam ${result.totalPackages} paket.`;
                Alert.alert('Başarılı', successMessage, [
                  {
                    text: 'Tamam',
                    onPress: () => {
                      hideRenewModal(true);
                      navigation.goBack();
                    },
                  },
                ]);
              } else {
                Alert.alert('Hata', result.error || 'Paket eklenemedi');
              }
            } catch (error) {
              Alert.alert('Hata', 'Bir hata oluştu');
            } finally {
              setRenewLoading(false);
            }
          },
        },
      ]
    );
  };

  const membershipData = useMemo(() => {
    // Use effectivePackageInfo which includes fallback logic
    if (!effectivePackageInfo) {
      return null;
    }

    // Calculate total and remaining from userPackages if available (multi-package support)
    let totalLessons = 0;
    let remaining = 0;
    
    if (userPackages.length > 0) {
      // Sum up from all non-cancelled, non-expired packages
      const now = new Date();
      userPackages.forEach(pkg => {
        if (pkg.status === 'cancelled') return;
        if (pkg.status === 'expired') return;
        if (pkg.expiryDate && new Date(pkg.expiryDate) < now) return;
        totalLessons += (pkg.totalLessons || 0);
        remaining += (pkg.remainingLessons || 0);
      });
    } else {
      // Fallback to effectivePackageInfo
      totalLessons = effectivePackageInfo.totalLessons || effectivePackageInfo.lessonCount || effectivePackageInfo.classes || 0;
      
      if (effectivePackageInfo.remainingClasses !== undefined) {
        remaining = effectivePackageInfo.remainingClasses;
      } else if (typeof remainingClasses === 'number') {
        remaining = remainingClasses;
      }
    }

    const used = Math.max(totalLessons - remaining, 0);

    // Use root-level packageExpiryDate as primary source, fall back to effectivePackageInfo
    // This ensures consistency with freeze/unfreeze operations
    const assignedDate = packageStartDate || effectivePackageInfo.assignedAt || effectivePackageInfo.packageStartDate;
    const expiryDate = packageExpiryDate || effectivePackageInfo.expiryDate;

    let totalDays = 0;
    let remainingDays = 0;
    if (assignedDate && expiryDate) {
      const start = new Date(assignedDate);
      const end = new Date(expiryDate);
      const today = new Date();
      totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      remainingDays = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
    }

    const singularType = effectivePackageInfo.packageType || null;
    const normalizedType = singularType
      ? singularType.toString().trim().toLowerCase()
      : null;
    const showPackageType = normalizedType && normalizedType !== 'one-on-one';

    return {
      packageName: effectivePackageInfo.packageName || 'Tanımsız Paket',
      packageType: showPackageType ? effectivePackageInfo.packageType : null,
      startDate: formatDate(assignedDate || effectivePackageInfo.startDate),
      endDate: formatDate(expiryDate || effectivePackageInfo.endDate),
      totalLessons,
      remainingLessons: remaining,
      usedLessons: used,
      totalDays,
      remainingDays,
      price: effectivePackageInfo.price || effectivePackageInfo.amount || null,
      paymentType: effectivePackageInfo.paymentType || '—',
      lessonCredits: typeof lessonCredits === 'number' ? lessonCredits : remaining,
    };
  }, [effectivePackageInfo, remainingClasses, lessonCredits, packageExpiryDate, packageStartDate, userPackages]);

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Üyelikler"
        subtitle={userName}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
        backgroundColor={[colors.primary, colors.primaryLight, colors.secondary]}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!membershipData ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={56} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>Aktif üyelik bulunamadı</Text>
            <Text style={styles.emptySubtitle}>
              Üyenin paket bilgileri burada görüntülenecektir.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.membershipCard}>
              <LinearGradient
                colors={['#F1F5F9', '#FFFFFF']}
                style={styles.membershipGradient}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.packageTitleGroup}>
                    <Text style={styles.packageName}>{membershipData.packageName}</Text>
                    {membershipData.packageType ? (
                      <Text style={styles.packageType}>{membershipData.packageType}</Text>
                    ) : null}
                  </View>
                  <View style={styles.dateBadge}>
                    <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                    <Text style={styles.dateBadgeText}>{membershipData.startDate} - {membershipData.endDate}</Text>
                  </View>
                </View>

                <View style={styles.metricsRow}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Kalan Ders</Text>
                    <Text style={[styles.metricValue, { color: colors.primary }]}>
                      {membershipData.remainingLessons}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Kullanılan</Text>
                    <Text style={[styles.metricValue, { color: '#F59E0B' }]}>
                      {membershipData.usedLessons}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Toplam</Text>
                    <Text style={[styles.metricValue, { color: '#10B981' }]}>
                      {membershipData.totalLessons}
                    </Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <ProgressBar
                  label="Kalan Ders"
                  value={membershipData.remainingLessons}
                  total={membershipData.totalLessons}
                  color={colors.primary}
                />

                <ProgressBar
                  label="Ders Kullanımı"
                  value={membershipData.usedLessons}
                  total={membershipData.totalLessons}
                  color="#A855F7"
                />

                <ProgressBar
                  label="Gün Sayısı"
                  value={membershipData.totalDays - membershipData.remainingDays}
                  total={membershipData.totalDays}
                  color="#22D3EE"
                />
              </LinearGradient>
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Özet Bilgiler</Text>

              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="time-outline" size={18} color={colors.primary} />
                </View>
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Kalan Gün</Text>
                  <Text style={styles.summaryValue}>{membershipData.remainingDays}</Text>
                </View>
              </View>

              <View style={styles.summaryRow}>
                <View style={styles.summaryIcon}>
                  <Ionicons name="book-outline" size={18} color="#4F46E5" />
                </View>
                <View style={styles.summaryContent}>
                  <Text style={styles.summaryLabel}>Kalan Ders</Text>
                  <Text style={styles.summaryValue}>{membershipData.remainingLessons}</Text>
                </View>
              </View>

              {membershipData.price ? (
                <View style={styles.summaryRow}>
                  <View style={styles.summaryIcon}>
                    <Ionicons name="card-outline" size={18} color="#F59E0B" />
                  </View>
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Paket Ücreti</Text>
                    <Text style={styles.summaryValue}>
                      ₺{Number(membershipData.price).toLocaleString('tr-TR')}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </>
        )}

        {/* All Packages Section */}
        {userPackages.length > 0 && (
          <View style={styles.allPackagesSection}>
            <Text style={styles.sectionTitle}>Tüm Paketler ({userPackages.length})</Text>
            {userPackages.map((pkg, index) => {
              const isActive = pkg.status === 'active';
              const isExpired = pkg.status === 'expired';
              const isUpcoming = pkg.status === 'upcoming';
              const isDepleted = pkg.status === 'depleted';

              const statusColor = isActive ? '#10B981' : isExpired ? '#EF4444' : isUpcoming ? '#3B82F6' : '#F59E0B';
              const statusText = isActive ? 'Aktif' : isExpired ? 'Süresi Doldu' : isUpcoming ? 'Yaklaşan' : 'Tükendi';

              return (
                <View key={pkg.id || index} style={[styles.packageCard, isExpired && styles.packageCardExpired]}>
                  <View style={styles.packageCardHeader}>
                    <View style={styles.packageCardTitleRow}>
                      <Text style={styles.packageCardName}>{pkg.packageName}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusText}</Text>
                      </View>
                    </View>
                    {pkg.packageType && (
                      <Text style={styles.packageCardType}>{pkg.packageType}</Text>
                    )}
                  </View>

                  <View style={styles.packageCardDates}>
                    <View style={styles.packageCardDateItem}>
                      <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                      <Text style={styles.packageCardDateText}>
                        {formatDate(pkg.startDate, language)} - {formatDate(pkg.expiryDate, language)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.packageCardStats}>
                    <View style={styles.packageCardStat}>
                      <Text style={styles.packageCardStatLabel}>Kalan</Text>
                      <Text style={[styles.packageCardStatValue, { color: colors.primary }]}>
                        {pkg.remainingLessons}
                      </Text>
                    </View>
                    <View style={styles.packageCardStat}>
                      <Text style={styles.packageCardStatLabel}>Kullanılan</Text>
                      <Text style={[styles.packageCardStatValue, { color: '#F59E0B' }]}>
                        {(pkg.totalLessons || 0) - (pkg.remainingLessons || 0)}
                      </Text>
                    </View>
                    <View style={styles.packageCardStat}>
                      <Text style={styles.packageCardStatLabel}>Toplam</Text>
                      <Text style={[styles.packageCardStatValue, { color: '#10B981' }]}>
                        {pkg.totalLessons}
                      </Text>
                    </View>
                  </View>

                  {/* Edit Button - only for non-expired packages */}
                  {!isExpired && (
                    <TouchableOpacity
                      style={styles.editPackageButton}
                      onPress={() => handleEditPackage(pkg)}
                    >
                      <Ionicons name="create-outline" size={16} color={colors.primary} />
                      <Text style={styles.editPackageButtonText}>Düzenle</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {loadingPackages && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Paketler yükleniyor...</Text>
          </View>
        )}

        {userId && (
          <TouchableOpacity style={styles.renewButton} onPress={handleRenewPress}>
            <LinearGradient
              colors={primaryActionGradient}
              style={styles.renewButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons
                name={hasPackage ? "refresh-outline" : "checkmark-circle-outline"}
                size={20}
                color={colors.white}
              />
              <Text style={styles.renewButtonText}>
                {primaryActionLabel}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* Renew Package Modal */}
      <Modal
        visible={showRenewModal}
        transparent
        animationType="slide"
        onRequestClose={() => hideRenewModal(true)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View
            style={[
              styles.modalContent,
              { transform: [{ translateY: sheetTranslateY }] },
            ]}
          >
            <View
              style={styles.modalHandleArea}
              {...sheetPanResponder.panHandlers}
              hitSlop={{ top: 10, bottom: 10, left: 40, right: 40 }}
            >
              <View style={styles.modalHandle} />
            </View>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => hideRenewModal()}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              {userName} için paket seçin
            </Text>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.datePickerSection}>
                <Text style={styles.datePickerLabel}>Başlangıç Tarihi</Text>
                <TouchableOpacity
                  style={styles.datePickerButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={styles.datePickerText}>
                    {startDate.toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}
                  </Text>
                </TouchableOpacity>
              </View>

              {showDatePicker && (
                <View style={styles.nativePickerWrapper}>
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(Platform.OS === 'ios');
                      if (selectedDate) {
                        setStartDate(selectedDate);
                      }
                    }}
                    minimumDate={new Date()}
                    themeVariant="light"
                    textColor={Platform.OS === 'ios' ? colors.textPrimary : undefined}
                    style={Platform.OS === 'ios' ? styles.nativePicker : undefined}
                  />
                </View>
              )}

              <View style={styles.packageList}>
                {packages.length === 0 ? (
                  <View style={styles.emptyPackages}>
                    <Ionicons name="alert-circle-outline" size={26} color={colors.textSecondary} />
                    <Text style={styles.emptyPackagesText}>Aktif paket bulunamadı</Text>
                    <Text style={styles.emptyPackagesSubtext}>
                      Paket oluşturduktan sonra üyeyi onaylayabilirsiniz.
                    </Text>
                  </View>
                ) : (
                  packages.map((pkg) => {
                    const isSelected = selectedPackage?.id === pkg.id;
                    const lessonCount = pkg.classes || pkg.lessonCount || pkg.lessons || 0;
                    return (
                      <TouchableOpacity
                        key={pkg.id}
                        style={[styles.packageItem, isSelected && styles.packageItemSelected]}
                        onPress={() => setSelectedPackage(pkg)}
                      >
                        <View style={styles.packageInfo}>
                          <Text style={styles.packageName}>{pkg.name}</Text>
                          <Text style={styles.packageDetails}>
                            {lessonCount} Ders - ₺{pkg.price || 0}
                          </Text>
                          {pkg.description && (
                            <Text style={styles.packageDescription}>{pkg.description}</Text>
                          )}
                        </View>
                        {isSelected && (
                          <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                        )}
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => hideRenewModal(true)}
              >
                <Text style={styles.modalCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, !selectedPackage && styles.modalConfirmButtonDisabled]}
                onPress={handleConfirmRenew}
                disabled={!selectedPackage || renewLoading}
              >
                <LinearGradient
                  colors={!selectedPackage ? ['#ccc', '#999'] : primaryActionGradient}
                  style={styles.modalConfirmGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {renewLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.modalConfirmText}>{modalConfirmLabel}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Edit Package Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.editModalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Paketi Düzenle</Text>
              <TouchableOpacity onPress={() => setShowEditModal(false)}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {editPackage && (
              <>
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 600 }} contentContainerStyle={{ paddingBottom: 16 }}>
                <View style={styles.editPackageInfo}>
                  <Text style={styles.editPackageName}>{editPackage.packageName}</Text>
                </View>

                <View style={styles.editInputGroup}>
                  <Text style={styles.editInputLabel}>Kalan Ders Sayısı</Text>
                  <TextInput
                    style={styles.editInput}
                    value={editRemainingLessons}
                    onChangeText={setEditRemainingLessons}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>

                <View style={styles.editInputGroup}>
                  <Text style={styles.editInputLabel}>Başlangıç Tarihi</Text>
                  <TouchableOpacity
                    style={styles.editDateButton}
                    onPress={() => {
                      setShowEditExpiryDatePicker(false);
                      setShowEditStartDatePicker(!showEditStartDatePicker);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                    <Text style={styles.editDateText}>
                      {editStartDate.toLocaleDateString('tr-TR')}
                    </Text>
                    <Ionicons 
                      name={showEditStartDatePicker ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color={colors.textSecondary} 
                      style={{ marginLeft: 'auto' }}
                    />
                  </TouchableOpacity>
                  {showEditStartDatePicker && (
                    <View style={styles.inlineDatePicker}>
                      <DateTimePicker
                        value={editStartDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        themeVariant="light"
                        textColor={colors.textPrimary}
                        onChange={(event, date) => {
                          if (Platform.OS === 'android') {
                            setShowEditStartDatePicker(false);
                          }
                          if (date) {
                            setEditStartDate(date);
                            // Auto-calculate new expiry date based on preserved duration
                            const newExpiry = new Date(date);
                            newExpiry.setDate(newExpiry.getDate() + editDurationDays);
                            setEditExpiryDate(newExpiry);
                          }
                        }}
                        locale="tr"
                        style={{ height: 200 }}
                      />
                    </View>
                  )}
                </View>

                <View style={styles.editInputGroup}>
                  <Text style={styles.editInputLabel}>Bitiş Tarihi</Text>
                  <TouchableOpacity
                    style={styles.editDateButton}
                    onPress={() => {
                      setShowEditStartDatePicker(false);
                      setShowEditExpiryDatePicker(!showEditExpiryDatePicker);
                    }}
                  >
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                    <Text style={styles.editDateText}>
                      {editExpiryDate.toLocaleDateString('tr-TR')}
                    </Text>
                    <Ionicons 
                      name={showEditExpiryDatePicker ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      color={colors.textSecondary} 
                      style={{ marginLeft: 'auto' }}
                    />
                  </TouchableOpacity>
                  {showEditExpiryDatePicker && (
                    <View style={styles.inlineDatePicker}>
                      <DateTimePicker
                        value={editExpiryDate}
                        mode="date"
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        themeVariant="light"
                        textColor={colors.textPrimary}
                        onChange={(event, date) => {
                          if (Platform.OS === 'android') {
                            setShowEditExpiryDatePicker(false);
                          }
                          if (date) setEditExpiryDate(date);
                        }}
                        locale="tr"
                        style={{ height: 200 }}
                      />
                    </View>
                  )}
                </View>
              </ScrollView>
              
              <View style={[styles.editModalActions, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={styles.editCancelButton}
                    onPress={() => setShowEditModal(false)}
                    disabled={editLoading}
                  >
                    <Text style={styles.editCancelText}>İptal</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.editSaveButton}
                    onPress={handleEditSubmit}
                    disabled={editLoading}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.primaryDark]}
                      style={styles.editSaveGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {editLoading ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <Text style={styles.editSaveText}>Kaydet</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
              </View>
            </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  emptyState: {
    marginTop: 80,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  membershipCard: {
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
    marginBottom: 20,
  },
  membershipGradient: {
    padding: 22,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  packageTitleGroup: {
    flexShrink: 1,
    paddingRight: 16,
  },
  packageName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  packageType: {
    marginTop: 4,
    fontSize: 14,
    color: colors.textSecondary,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(107, 127, 106, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    marginLeft: 12,
    flexShrink: 0,
  },
  dateBadgeText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(15, 24, 16, 0.08)',
    marginVertical: 14,
  },
  progressContainer: {
    marginBottom: 14,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 24, 16, 0.08)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  summaryCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(15, 24, 16, 0.08)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 10,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(15, 24, 16, 0.06)',
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  renewButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  renewButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 8,
  },
  renewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
    paddingTop: 40,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: Platform.select({ ios: 32, default: 24 }),
    maxHeight: '90%',
    width: '100%',
    alignSelf: 'stretch',
  },
  modalHandleArea: {
    width: '100%',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  modalHandle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(15, 24, 16, 0.2)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 360,
  },
  modalScrollContent: {
    paddingBottom: 16,
    paddingTop: 4,
  },
  datePickerSection: {
    marginBottom: 20,
  },
  datePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  packageList: {
    marginTop: 8,
  },
  nativePickerWrapper: {
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(15, 24, 16, 0.06)',
    paddingVertical: Platform.select({ ios: 6, default: 0 }),
    paddingHorizontal: Platform.select({ ios: 6, default: 0 }),
  },
  nativePicker: {
    width: '100%',
    alignSelf: 'center',
    backgroundColor: 'transparent',
  },
  packageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.15)',
    backgroundColor: colors.white,
    marginBottom: 12,
  },
  packageItemSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(107, 127, 106, 0.05)',
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  packageDetails: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  packageDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  emptyPackages: {
    padding: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPackagesText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyPackagesSubtext: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalConfirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalConfirmButtonDisabled: {
    opacity: 0.5,
  },
  modalConfirmGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },

  // All Packages Section Styles
  allPackagesSection: {
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  packageCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  packageCardExpired: {
    opacity: 0.7,
    backgroundColor: '#F9FAFB',
  },
  packageCardHeader: {
    marginBottom: 12,
  },
  packageCardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  packageCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  packageCardType: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  packageCardDates: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  packageCardDateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  packageCardDateText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  packageCardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  packageCardStat: {
    alignItems: 'center',
  },
  packageCardStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  packageCardStatValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Edit Package Button
  editPackageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    gap: 6,
  },
  editPackageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Edit Modal Styles
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  editModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  editPackageInfo: {
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  editPackageName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  editPackageDates: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  editInputGroup: {
    marginBottom: 24,
  },
  editInputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  editInput: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  editDateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  editDateText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  inlineDatePicker: {
    marginTop: 8,
    backgroundColor: 'rgba(107, 127, 106, 0.05)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.textSecondary,
    alignItems: 'center',
  },
  editCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  editSaveButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  editSaveGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  editSaveText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.white,
  },
});
