import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { lessonService, getCategoryInfo } from '../services/lessonService';
import { userLessonService } from '../services/userLessonService';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import UniqueHeader from '../components/UniqueHeader';
import DateCarouselPicker from '../components/DateCarouselPicker';
import NotificationScreen from './NotificationScreen';

const { width } = Dimensions.get('window');

// Helper function to safely translate lesson descriptions
const translateLessonDescription = (t, description) => {
  if (!description) return '';
  const translationKey = `lessonDescriptions.${description}`;
  const translated = t(translationKey);
  return translated === translationKey ? description : translated;
};

const normalizePackageType = (value) => {
  if (!value) return null;
  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) return null;

  const collapsed = normalized.replace(/[^a-z0-9]/g, '');

  const oneOnOneKeywords = [
    'bireysel',
    'oneonone',
    'onetoone',
    '1on1',
    '1to1',
    'private',
    'privatelesson',
    'privateclass'
  ];

  const groupKeywords = [
    'group',
    'groups',
    'groupclass',
    'groupclasses',
    'grouplesson',
    'grup',
    'class',
    'classes'
  ];

  if (oneOnOneKeywords.includes(collapsed)) {
    return 'one-on-one';
  }

  if (groupKeywords.includes(collapsed)) {
    return 'group';
  }

  return null;
};

const getLessonAccessType = (lesson) => {
  if (!lesson) {
    return 'group';
  }

  // Check lessonType first (this is the actual field in Firebase)
  const fromLesson = normalizePackageType(
    lesson.lessonType || lesson.lessonPackageType || lesson.packageType || lesson.type
  );

  if (fromLesson) {
    return fromLesson;
  }

  // Fallback: Check maxParticipants to determine lesson type
  if (typeof lesson.maxParticipants === 'number') {
    return lesson.maxParticipants <= 1 ? 'one-on-one' : 'group';
  }

  return 'group';
};

const formatHoursForLanguage = (hours, language) => {
  if (hours === null || hours === undefined || Number.isNaN(hours)) {
    return '0';
  }
  const normalized = Math.max(0, hours);
  const formatted = normalized.toFixed(1);
  if (language === 'tr') {
    return formatted.replace('.', ',');
  }
  return formatted;
};

// Memoized lesson card component to prevent unnecessary re-renders
const LessonCard = React.memo(({ lesson, userId, onBook, onCancel, t }) => {
  const categoryInfo = lesson.lessonTypeInfo || getCategoryInfo(lesson.title);
  const isFullyBooked = lesson.currentParticipants >= lesson.maxParticipants;
  const isUserBooked = lesson.participants && lesson.participants.includes(userId);

  const now = Date.now();
  // Combine scheduledDate with startTime to get actual lesson start time
  // Handle date-only strings by parsing as local time to avoid timezone issues
  let lessonDate;
  const dateVal = lesson.scheduledDate;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    const [year, month, day] = dateVal.split('-').map(Number);
    lessonDate = new Date(year, month - 1, day);
  } else {
    lessonDate = new Date(dateVal);
  }
  if (lesson.startTime) {
    const [hours, minutes] = lesson.startTime.split(':').map(Number);
    lessonDate.setHours(hours || 0, minutes || 0, 0, 0);
  }
  const lessonDateTime = lessonDate.getTime();
  const timeUntilLesson = lessonDateTime - now;
  const twoHoursInMs = 2 * 60 * 60 * 1000;
  const eightHoursInMs = 8 * 60 * 60 * 1000;
  const isTooLateToBook = timeUntilLesson <= twoHoursInMs && timeUntilLesson > 0;
  const canCancelBooking = isUserBooked && timeUntilLesson >= eightHoursInMs;

  const buttonMode = isUserBooked && canCancelBooking ? 'cancel' :
    isUserBooked ? 'booked' :
    isTooLateToBook ? 'tooLate' :
    isFullyBooked ? 'full' : 'book';

  const buttonDisabled = ['full', 'tooLate', 'booked'].includes(buttonMode);
  const isMutedDisabled = ['full', 'tooLate'].includes(buttonMode);

  const buttonConfig = {
    cancel: { gradient: [colors.error, colors.error + 'CC'], icon: 'close-circle-outline', label: t('classes.cancel') || 'İptal Et' },
    booked: { gradient: [colors.success, colors.success + 'DD'], icon: 'checkmark-circle-outline', label: t('classSelection.bookedButton') || 'Rezerve Edildi' },
    tooLate: { gradient: [colors.warning, colors.warning + 'CC'], icon: 'time-outline', label: t('classSelection.tooLateButton') || 'Çok Geç' },
    full: { gradient: [colors.lightGray, colors.gray], icon: 'close-circle-outline', label: t('classSelection.fullButton') || 'Dolu' },
    book: { gradient: [colors.primary, colors.primaryDark], icon: 'add-circle-outline', label: t('classSelection.bookButton') || 'Rezerve Et' },
  };

  const { gradient: buttonGradient, icon: buttonIcon, label: buttonLabel } = buttonConfig[buttonMode];
  const capacityPercentage = (lesson.currentParticipants / lesson.maxParticipants) * 100;

  return (
    <View style={[styles.classCard, isFullyBooked && styles.classCardDisabled]}>
      <LinearGradient
        colors={isFullyBooked ? [colors.gray, colors.lightGray] : [colors.white, colors.white + 'F8']}
        style={styles.cardGradient}
      >
        <View style={styles.classHeader}>
          <View style={styles.classMainInfo}>
            <View style={styles.classTitleRow}>
              <View style={[styles.categoryIconSmall, { backgroundColor: (categoryInfo.color || colors.primary) + '15' }]}>
                <Ionicons name={categoryInfo.icon || 'fitness-outline'} size={16} color={categoryInfo.color || colors.primary} />
              </View>
              <View style={styles.classNameContainer}>
                <Text style={styles.className}>{lesson.title}</Text>
              </View>
            </View>
            <View style={styles.trainerInfo}>
              <View style={styles.trainerAvatar}>
                <Ionicons name="person" size={16} color={colors.primary} />
              </View>
              <View style={styles.trainerDetails}>
                <Text style={styles.trainerName}>{lesson.instructor}</Text>
                <Text style={styles.trainerTitle}>
                  {lesson.trainerSpecializations?.length > 0 ? lesson.trainerSpecializations[0] : ''}
                </Text>
                {lesson.trainerActive === false && (
                  <Text style={[styles.trainerTitle, { color: colors.warning }]}>⚠️ Pasif Eğitmen</Text>
                )}
              </View>
            </View>
          </View>
          {isFullyBooked ? (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>{t('classSelection.fullBadge') || 'DOLU'}</Text>
            </View>
          ) : (
            <View style={[styles.availableBadge, { backgroundColor: colors.success + '15' }]}>
              <Text style={[styles.availableBadgeText, { color: colors.success }]}>{t('classSelection.availableBadge') || 'MÜSAİT'}</Text>
            </View>
          )}
        </View>

        <View style={styles.classDetails}>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>{lesson.formattedTime}</Text>
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>{lesson.duration}{t('classSelection.minutesShort') || 'dk'}</Text>
              </View>
            </View>
          </View>
          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>
                {lesson.currentParticipants}/{lesson.maxParticipants} {t('classSelection.people') || 'kişi'}
              </Text>
              <View style={styles.capacityBarContainer}>
                <View style={styles.capacityBar}>
                  <View
                    style={[
                      styles.capacityFill,
                      {
                        width: `${capacityPercentage}%`,
                        backgroundColor: isFullyBooked ? colors.error : capacityPercentage > 80 ? colors.warning : colors.success
                      }
                    ]}
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.classFooter}>
          <View style={styles.leftFooter}>
            <View style={[styles.levelBadge, { backgroundColor: '#38a169' + '15', marginRight: 8 }]}>
              <Text style={[styles.levelText, { color: '#38a169' }]}>
                {lesson.type || lesson.lessonTypeInfo?.name || t('classSelection.general') || 'Genel'}
              </Text>
            </View>
            <View style={[styles.levelBadge, { backgroundColor: (lesson.statusColor || '#F59E0B') + '15' }]}>
              <Text style={[styles.levelText, { color: lesson.statusColor || '#F59E0B' }]}>
                {lesson.statusLevel || t('classSelection.intermediate') || 'Orta'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.bookButton, buttonDisabled && styles.bookButtonDisabled]}
            onPress={() => buttonMode === 'cancel' ? onCancel(lesson) : buttonMode === 'book' ? onBook(lesson) : null}
            disabled={buttonDisabled}
          >
            <LinearGradient colors={buttonGradient} style={styles.bookButtonGradient}>
              <Ionicons name={buttonIcon} size={18} color={isMutedDisabled ? colors.textSecondary : colors.white} />
              <Text style={[styles.bookButtonText, isMutedDisabled && styles.bookButtonTextDisabled]}>{buttonLabel}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
});

export default function ClassSelectionScreen() {
  const { user, userData } = useAuth();
  const { t, language: currentLanguage } = useI18n();

  // Available dates (lightweight)
  const [availableDates, setAvailableDates] = useState([]);
  // Current day's lessons
  const [currentDayLessons, setCurrentDayLessons] = useState([]);
  const [filteredLessons, setFilteredLessons] = useState([]);

  const [loading, setLoading] = useState(true);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const loadedDatesRef = useRef(new Set()); // Track which dates have been loaded

  const formatDisplayDate = useCallback((value) => {
    if (!value) return '';

    let date;

    if (typeof value === 'string') {
      date = new Date(value);
    } else if (value instanceof Date) {
      date = value;
    } else if (value && typeof value === 'object' && typeof value.seconds === 'number') {
      date = new Date(value.seconds * 1000);
    } else if (value && typeof value === 'object' && typeof value.toDate === 'function') {
      date = value.toDate();
    } else {
      return '';
    }

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const options = { day: 'numeric', month: 'long', weekday: 'long' };
    const locale = currentLanguage === 'tr' ? 'tr-TR' : 'en-US';

    try {
      return date.toLocaleDateString(locale, options);
    } catch (error) {
      try {
        return date.toLocaleDateString('tr-TR', options);
      } catch (fallbackError) {
        return date.toDateString();
      }
    }
  }, [currentLanguage]);

  // Load available dates first (lightweight)
  const loadAvailableDates = useCallback(async (forceRefresh = false) => {
    try {
      const result = await lessonService.getAvailableDates(forceRefresh);
      if (result.success && result.dates.length > 0) {
        setAvailableDates(result.dates);
        // Auto-select first date if none selected
        if (!selectedDateKey) {
          setSelectedDateKey(result.dates[0]);
        }
      }
    } catch (error) {
      console.error('Error loading available dates:', error);
    }
  }, [selectedDateKey]);

  // Load lessons for a specific date
  const loadLessonsForDate = useCallback(async (dateKey) => {
    if (!dateKey) return;

    // Don't show loading spinner if we have cached data
    const result = await lessonService.getLessonsByDate(dateKey);
    if (!result.fromCache) {
      setLoadingLessons(true);
    }
    
    try {
      if (result.success) {
        // Add formatted date to each lesson
        const lessonsWithFormattedDate = result.lessons.map(lesson => ({
          ...lesson,
          formattedDate: formatDisplayDate(lesson.scheduledDate),
        }));
        setCurrentDayLessons(lessonsWithFormattedDate);
        loadedDatesRef.current.add(dateKey);
      }
    } catch (error) {
      console.error('Error loading lessons for date:', error);
    } finally {
      setLoadingLessons(false);
    }
  }, [formatDisplayDate]);

  // Initial load - FAST: single optimized fetch
  useEffect(() => {
    const loadInitialData = async () => {
      const startTime = Date.now();
      console.log('⚡ ClassSelectionScreen: Starting initial load...');
      try {
        // Use ultra-optimized single fetch for initial load
        const result = await lessonService.getInitialData();
        console.log(`⚡ ClassSelectionScreen: getInitialData completed in ${Date.now() - startTime}ms`);
        if (result.success && result.dates.length > 0) {
          setAvailableDates(result.dates);
          const firstDate = result.dates[0];
          setSelectedDateKey(firstDate);
          
          // Lessons are already loaded and cached, just format them
          const cachedLessons = result.lessonsByDate[firstDate] || [];
          const lessonsWithFormattedDate = cachedLessons.map(lesson => ({
            ...lesson,
            formattedDate: formatDisplayDate(lesson.scheduledDate),
          }));
          setCurrentDayLessons(lessonsWithFormattedDate);
          loadedDatesRef.current.add(firstDate);
        }
      } catch (error) {
        console.error('Error in initial load:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadInitialData();
  }, []);

  // Track the initial date to avoid double-loading
  const initialDateRef = useRef(null);

  // Load lessons when selected date changes (but not for initial load)
  useEffect(() => {
    // Skip if still loading or no date selected
    if (loading || !selectedDateKey) return;
    
    // Skip the first call after initial load (lessons already loaded)
    if (initialDateRef.current === null) {
      initialDateRef.current = selectedDateKey;
      return;
    }
    
    // Only fetch if date actually changed
    if (selectedDateKey !== initialDateRef.current) {
      initialDateRef.current = selectedDateKey;
      loadLessonsForDate(selectedDateKey);
    }
  }, [selectedDateKey, loading, loadLessonsForDate]);

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Filter lessons based on search and user package type
  useEffect(() => {
    if (currentDayLessons.length === 0) {
      setFilteredLessons([]);
      return;
    }

    let filtered = [...currentDayLessons];

    // Filter out past lessons - users should only see upcoming lessons
    const now = new Date();
    filtered = filtered.filter(lesson => {
      // Parse scheduledDate safely to handle timezone issues
      let lessonDate;
      const dateVal = lesson.scheduledDate;
      if (typeof dateVal === 'string') {
        // Handle date-only strings (e.g., "2026-01-07") by parsing as local time
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
          const [year, month, day] = dateVal.split('-').map(Number);
          lessonDate = new Date(year, month - 1, day);
        } else {
          lessonDate = new Date(dateVal);
        }
      } else {
        lessonDate = new Date(dateVal);
      }
      
      if (lesson.startTime) {
        const [hours, minutes] = lesson.startTime.split(':').map(Number);
        lessonDate.setHours(hours || 0, minutes || 0, 0, 0);
      }
      return lessonDate >= now;
    });

    // Filter by user's package type - ALWAYS apply this filter
    const rawPackageType = userData?.packageInfo?.packageType;
    const normalizedUserPackageType = normalizePackageType(rawPackageType);
    // Default to 'group' if no package type is set
    const userAccessType = normalizedUserPackageType === 'one-on-one' ? 'one-on-one' : 'group';

    console.log('🔍 Filtering lessons:', {
      totalLessons: currentDayLessons.length,
      userPackageType: rawPackageType,
      normalizedUserType: normalizedUserPackageType,
      userAccessType: userAccessType
    });

    filtered = filtered.filter(lesson => {
      const lessonAccessType = getLessonAccessType(lesson);
      
      console.log(`   Lesson "${lesson.title}":`, {
        lessonType: lesson.lessonType,
        lessonPackageType: lesson.lessonPackageType,
        maxParticipants: lesson.maxParticipants,
        resolvedAccessType: lessonAccessType,
        matches: userAccessType === 'one-on-one' ? lessonAccessType === 'one-on-one' : lessonAccessType === 'group'
      });
      
      if (userAccessType === 'one-on-one') {
        // One-on-one users can ONLY see one-on-one lessons
        return lessonAccessType === 'one-on-one';
      } else {
        // Group users can ONLY see group lessons (not one-on-one)
        return lessonAccessType === 'group';
      }
    });

    console.log(`✅ Filtered to ${filtered.length} lessons matching user's ${userAccessType} package`);

    // Filter lessons by package date ranges (multi-package support)
    const userPackages = userData?.packages || [];

    // Build date ranges from packages array, or fall back to legacy single package
    let packageDateRanges = [];

    if (userPackages.length > 0) {
      // Use multi-package system
      packageDateRanges = userPackages
        .filter(pkg => pkg.status !== 'cancelled' && pkg.remainingLessons > 0)
        .map(pkg => ({
          start: new Date(pkg.startDate),
          end: new Date(pkg.expiryDate)
        }));
    } else {
      // Fall back to legacy single package
      const packageExpiryDate = userData?.packageExpiryDate || userData?.packageInfo?.expiryDate;
      const packageStartDate = userData?.packageStartDate || userData?.packageInfo?.assignedAt;

      if (packageExpiryDate) {
        packageDateRanges = [{
          start: packageStartDate ? new Date(packageStartDate) : new Date(0),
          end: new Date(packageExpiryDate)
        }];
      }
    }

    // Filter lessons to only show those within any package date range
    if (packageDateRanges.length > 0) {
      filtered = filtered.filter(lesson => {
        let lessonDate;
        const dateVal = lesson.scheduledDate;
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
          const [year, month, day] = dateVal.split('-').map(Number);
          lessonDate = new Date(year, month - 1, day);
        } else {
          lessonDate = new Date(dateVal);
        }
        lessonDate.setHours(12, 0, 0, 0); // Normalize to noon

        // Check if lesson falls within ANY package date range
        return packageDateRanges.some(range => {
          const startDate = new Date(range.start);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(range.end);
          endDate.setHours(23, 59, 59, 999);
          return lessonDate >= startDate && lessonDate <= endDate;
        });
      });

      console.log(`📅 Filtered by ${packageDateRanges.length} package date range(s): ${filtered.length} lessons remaining`);
    }

    // Filter by search query
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(lesson =>
        lesson.title.toLowerCase().includes(query) ||
        lesson.instructor?.toLowerCase().includes(query) ||
        lesson.type?.toLowerCase().includes(query)
      );
    }

    setFilteredLessons(filtered);
  }, [currentDayLessons, userData?.packageInfo?.packageType, userData?.packages, userData?.packageExpiryDate, userData?.packageInfo?.expiryDate, userData?.packageStartDate, userData?.packageInfo?.assignedAt, debouncedSearchQuery]);

  // Use availableDates directly instead of computing from lessons
  const availableDateKeys = useMemo(() => availableDates, [availableDates]);

  // Re-format current day lessons when language changes
  const prevLanguageRef = useRef(currentLanguage);
  useEffect(() => {
    if (prevLanguageRef.current === currentLanguage) return;
    prevLanguageRef.current = currentLanguage;

    if (currentDayLessons.length > 0) {
      setCurrentDayLessons(prevLessons => prevLessons.map(lesson => ({
        ...lesson,
        formattedDate: formatDisplayDate(lesson.scheduledDate),
      })));
    }
  }, [currentLanguage, currentDayLessons.length, formatDisplayDate]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAvailableDates(true);
    if (selectedDateKey) {
      await loadLessonsForDate(selectedDateKey);
    }
    setRefreshing(false);
  };

  const handleSelectDate = (value) => {
    setSelectedDateKey(value);
  };

  // Helper functions for booking
  const handleBookClass = async (lesson) => {
    if (!user) {
      Alert.alert(t('general.error') || 'Hata', t('classSelection.loginRequired') || 'Rezervasyon yapmak için giriş yapmanız gerekiyor.');
      return;
    }

    // Check if lesson is too close to start (within 2 hours)
    const now = new Date();
    // Parse scheduledDate safely to handle timezone issues
    let lessonDateTime;
    const dateVal = lesson.scheduledDate;
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-').map(Number);
      lessonDateTime = new Date(year, month - 1, day);
    } else {
      lessonDateTime = new Date(dateVal);
    }
    if (lesson.startTime) {
      const [hours, minutes] = lesson.startTime.split(':').map(Number);
      lessonDateTime.setHours(hours || 0, minutes || 0, 0, 0);
    }
    const timeUntilLesson = lessonDateTime.getTime() - now.getTime();
    const twoHoursInMs = 2 * 60 * 60 * 1000;
    
    if (timeUntilLesson <= twoHoursInMs && timeUntilLesson > 0) {
      Alert.alert(
        t('classSelection.tooLateTitle') || 'Rezervasyon Çok Geç', 
        t('classSelection.tooLateMessage') || 'Bu ders başlamadan 2 saat öncesine kadar rezerve edilebilir.'
      );
      return;
    }

    Alert.alert(
      t('classSelection.bookingConfirmTitle') || 'Ders Rezervasyonu',
      `${lesson.title} ${t('classSelection.bookingConfirmMessage') || 'dersini rezerve etmek istediğinizden emin misiniz?'}\n\n${t('classSelection.instructor') || 'Eğitmen'}: ${lesson.instructor}\n${t('classSelection.time') || 'Zaman'}: ${lesson.formattedTime}\n${t('classSelection.date') || 'Tarih'}: ${lesson.formattedDate}\n${t('classSelection.duration') || 'Süre'}: ${lesson.duration} ${t('classSelection.minutes') || 'dakika'}`,
      [
        { text: t('general.cancel') || 'İptal', style: 'cancel' },
        { 
          text: t('classSelection.bookButton') || 'Rezerve Et', 
          onPress: async () => {
            const result = await lessonService.bookLesson(lesson.id, user.uid);
            if (result.success) {
              Alert.alert(
                t('classSelection.bookingSuccess') || 'Başarılı! 🎉', 
                result.messageKey ? t(result.messageKey) : result.message
              );
              loadLessonsForDate(selectedDateKey); // Refresh the lessons for current date
            } else {
              Alert.alert(
                t('general.error') || 'Hata', 
                result.messageKey ? t(result.messageKey) : result.message
              );
            }
          }
        }
      ]
    );
  };

  const handleCancelClass = (lesson) => {
    if (!user) {
      Alert.alert(t('general.error') || 'Hata', t('classSelection.loginRequired') || 'Rezervasyon yapmak için giriş yapmanız gerekiyor.');
      return;
    }

    // Parse scheduledDate safely to handle timezone issues
    let lessonDateTime;
    const dateVal = lesson.scheduledDate;
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-').map(Number);
      lessonDateTime = new Date(year, month - 1, day);
    } else {
      lessonDateTime = new Date(dateVal);
    }
    if (lesson.startTime) {
      const [hours, minutes] = lesson.startTime.split(':').map(Number);
      lessonDateTime.setHours(hours || 0, minutes || 0, 0, 0);
    }

    const now = new Date();
    const hoursUntilLesson = (lessonDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    const formattedHoursLeft = formatHoursForLanguage(hoursUntilLesson, currentLanguage);

    Alert.alert(
      t('classes.cancelLessonTitle') || 'Dersi İptal Et',
      `${lesson.title} ${t('classes.cancelConfirm') || 'dersini iptal etmek istediğinizden emin misiniz?'}\n\n${t('classSelection.instructor') || 'Eğitmen'}: ${lesson.instructor}\n${t('classSelection.time') || 'Zaman'}: ${lesson.formattedTime}\n${t('classSelection.date') || 'Tarih'}: ${lesson.formattedDate}\n${t('classes.cancelNote') ? `\n${t('classes.cancelNote')}` : ''}\n${t('classes.hoursLeftLabel') || t('time.hoursLeft') || 'Time left'}: ${formattedHoursLeft} ${t('time.hours') || ''}`,
      [
        { text: t('general.cancel') || 'İptal', style: 'cancel' },
        {
          text: t('classes.confirmCancel') || 'Dersi İptal Et',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const result = await userLessonService.cancelLessonBooking(lesson.id, user.uid);
              if (result.success) {
                Alert.alert(
                  t('success') || 'Başarılı',
                  result.messageKey ? t(result.messageKey) : result.message || (t('classes.cancelSuccessMessage') || 'Ders rezervasyonunuz başarıyla iptal edildi.')
                );
                await loadLessonsForDate(selectedDateKey);
              } else {
                let errorMessage;
                if (result.messageKey === 'classes.cancelTooLate') {
                  const hoursValue = result.data?.hoursUntilLesson ?? hoursUntilLesson;
                  const formattedHours = formatHoursForLanguage(hoursValue, currentLanguage);
                  errorMessage = `${t('classes.cancelTooLateMessage') || 'Ders başlamadan 8 saat öncesine kadar iptal edilebilir.'}\n${t('classes.hoursLeftLabel') || t('time.hoursLeft') || 'Time left'}: ${formattedHours} ${t('time.hours') || ''}`;
                } else {
                  errorMessage = result.messageKey ? t(result.messageKey) : result.message || (t('classes.cancelErrorMessage') || 'Rezervasyon iptal edilirken hata oluştu.');
                }

                Alert.alert(
                  t('error') || 'Hata',
                  errorMessage
                );
              }
            } catch (error) {
              console.error('Error cancelling lesson:', error);
              Alert.alert(
                t('error') || 'Hata',
                t('classes.cancelErrorMessage') || 'Rezervasyon iptal edilirken hata oluştu.'
              );
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader 
          title={t('classSelection.title') || "Yoga Dersleri"} 
          subtitle={t('classSelection.loadingLessons') || "Dersler yükleniyor..."} 
          rightIcon="refresh"
          onRightPress={onRefresh}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('classSelection.loadingLessons') || "Dersler yükleniyor..."}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UniqueHeader 
        title={t('classSelection.title') || "Yoga Dersleri"} 
        subtitle={t('classSelection.subtitle') || "Katılmak istediğiniz dersi seçin"}
        showNotification={true}
        onRightPress={() => setNotificationModalVisible(true)}
      >
      </UniqueHeader>

      <Animated.ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
      >
          {/* Remove the old pageHeader since we now have ModernHeader */}

          {/* Enhanced Search Bar */}
          <View style={styles.searchContainer}>
            <LinearGradient
              colors={[colors.white, colors.white + 'F8']}
              style={styles.searchWrapper}
            >
              <View style={styles.searchInputContainer}>
                <Ionicons name="search-outline" size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder={t('classSelection.searchPlaceholder') || "Ders veya eğitmen ara..."}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholderTextColor={colors.textSecondary}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </LinearGradient>
          </View>

          <DateCarouselPicker
            dates={availableDateKeys}
            selectedDate={selectedDateKey}
            onSelectDate={handleSelectDate}
            allowClear={false}
          />

          {/* Available Classes with Enhanced Design */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderModern}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                <Text style={styles.sectionTitle}>{t('classSelection.availableClasses') || 'Mevcut Dersler'}</Text>
              </View>
              <View style={styles.resultsCountBadge}>
                <Text style={styles.resultsCount}>
                  {filteredLessons.length}
                </Text>
              </View>
            </View>

            {loadingLessons ? (
              <View style={styles.loadingLessonsContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingLessonsText}>{t('classSelection.loadingDayLessons') || 'Dersler yükleniyor...'}</Text>
              </View>
            ) : filteredLessons.length === 0 ? (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
                </View>
                <Text style={styles.emptyTitle}>{t('classSelection.noLessonsFound') || 'Ders bulunamadı'}</Text>
                <Text style={styles.emptyText}>
                  {searchQuery ? (t('classSelection.noLessonsDescription') || 'Arama kriterlerinize uygun ders bulunmuyor.') : (t('classSelection.noActiveLessons') || 'Bu tarihte aktif ders bulunmuyor.')}
                </Text>
              </View>
            ) : (
              <View style={styles.dateGroup}>
                {/* Date Header for selected day */}
                <LinearGradient
                  colors={[colors.primary + '08', colors.primary + '05']}
                  style={styles.dateHeader}
                >
                  <View style={styles.dateHeaderLeft}>
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                    <Text style={styles.dateTitle}>{formatDisplayDate(selectedDateKey)}</Text>
                  </View>
                  <View style={styles.dateBadge}>
                    <Text style={styles.dateBadgeText}>
                      {filteredLessons.length} {t('classSelection.lessons') || 'ders'}
                    </Text>
                  </View>
                </LinearGradient>

                {/* Class Cards - using memoized component */}
                {filteredLessons.map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    userId={user?.uid}
                    onBook={handleBookClass}
                    onCancel={handleCancelClass}
                    t={t}
                  />
                ))}
              </View>
            )}
          </View>

          {/* Enhanced Info Card */}
          <View style={styles.section}>
            <View style={styles.infoHeader}>
              <Ionicons name="information-circle" size={24} color={colors.primary} />
              <Text style={styles.infoHeaderTitle}>{t('classSelection.infoTitle') || 'Booking Guide'}</Text>
            </View>
            
            <View style={styles.infoCardsContainer}>
              {/* Cancel Policy Card */}
              <LinearGradient
                colors={[colors.warning + '12', colors.warning + '08']}
                style={styles.infoItemCard}
              >
                <View style={styles.infoItemIconContainer}>
                  <Ionicons name="time-outline" size={22} color={colors.warning} />
                </View>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemTitle}>{t('classSelection.infoBulletTitle1') || 'Cancellation Policy'}</Text>
                  <Text style={styles.infoItemText}>
                    {t('classSelection.infoBullet1') || 'Lessons can be cancelled up to 2 hours before start time'}
                  </Text>
                </View>
              </LinearGradient>

              {/* Arrival Time Card */}
              <LinearGradient
                colors={[colors.primary + '12', colors.primary + '08']}
                style={styles.infoItemCard}
              >
                <View style={styles.infoItemIconContainer}>
                  <Ionicons name="alarm-outline" size={22} color={colors.primary} />
                </View>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemTitle}>{t('classSelection.infoBulletTitle2') || 'First Visit'}</Text>
                  <Text style={styles.infoItemText}>
                    {t('classSelection.infoBullet2') || 'First-time participants should arrive 15 minutes early'}
                  </Text>
                </View>
              </LinearGradient>

              {/* Equipment Card */}
              <LinearGradient
                colors={[colors.success + '12', colors.success + '08']}
                style={styles.infoItemCard}
              >
                <View style={styles.infoItemIconContainer}>
                  <Ionicons name="fitness-outline" size={22} color={colors.success} />
                </View>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemTitle}>{t('classSelection.infoBulletTitle3') || 'Equipment'}</Text>
                  <Text style={styles.infoItemText}>
                    {t('classSelection.infoBullet3') || 'All required equipment is provided in class'}
                  </Text>
                </View>
              </LinearGradient>

              {/* Clothing Card */}
              <LinearGradient
                colors={[colors.secondary + '12', colors.secondary + '08']}
                style={styles.infoItemCard}
              >
                <View style={styles.infoItemIconContainer}>
                  <Ionicons name="shirt-outline" size={22} color={colors.secondary} />
                </View>
                <View style={styles.infoItemContent}>
                  <Text style={styles.infoItemTitle}>{t('classSelection.infoBulletTitle4') || 'Dress Code'}</Text>
                  <Text style={styles.infoItemText}>
                    {t('classSelection.infoBullet4') || 'Remember to wear comfortable clothing'}
                  </Text>
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* Bottom spacing for navigation */}
          <View style={{ height: 120 }} />
        </Animated.ScrollView>

      <NotificationScreen
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        modal={true}
      />
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
    backgroundColor: colors.background,
  },
  
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    fontWeight: '500',
  },
  loadingLessonsContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLessonsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },

  // Modern Header Styles
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  headerStats: {
    alignItems: 'flex-end',
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Enhanced Search Styles
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },
  searchWrapper: {
    borderRadius: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
    marginLeft: 12,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },

  // Filter Pills Styles
  section: {
    paddingHorizontal: 24,
    marginBottom: 20,
  },

  // Modern Section Headers
  sectionHeaderModern: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
    letterSpacing: -0.3,
  },
  resultsCountBadge: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },

  // Enhanced Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // Enhanced Date Group
  dateGroup: {
    marginBottom: 28,
  },
  dateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  dateHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  dateBadge: {
    backgroundColor: colors.white + 'CC',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  dateBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },

  // Enhanced Class Cards
  classCard: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  classCardDisabled: {
    opacity: 0.7,
  },
  cardGradient: {
    padding: 20,
    borderRadius: 20,
  },

  // Enhanced Class Header
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  classMainInfo: {
    flex: 1,
  },
  classTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  classNameContainer: {
    flex: 1,
  },
  className: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  trainingType: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Trainer Information
  trainerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  trainerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  trainerDetails: {
    flex: 1,
    paddingTop: 8,
  },
  trainerName: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  trainerTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },

  // Status Badges
  fullBadge: {
    backgroundColor: colors.error + '15',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  fullBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.error,
    letterSpacing: 0.5,
  },
  availableBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  availableBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Enhanced Class Details
  classDetails: {
    marginBottom: 16,
  },
  detailsRow: {
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  durationBadge: {
    backgroundColor: colors.success + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },

  // Enhanced Capacity Bar
  capacityBarContainer: {
    marginLeft: 8,
  },
  capacityBar: {
    width: 60,
    height: 6,
    backgroundColor: colors.lightGray,
    borderRadius: 3,
  },
  capacityFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Extra Info
  extraInfo: {
    marginTop: 8,
  },
  infoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  infoChipText: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  benefitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  benefitChip: {
    backgroundColor: colors.primary + '10',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 6,
    marginBottom: 4,
  },
  benefitText: {
    fontSize: 10,
    color: colors.primary,
    fontWeight: '600',
  },

  // Enhanced Footer
  classFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  levelBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recurringText: {
    fontSize: 10,
    color: colors.primary,
    marginLeft: 4,
    fontWeight: '600',
  },

  // Enhanced Book Button
  bookButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  bookButtonDisabled: {
    opacity: 0.6,
  },
  bookButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
    justifyContent: 'center',
  },
  bookButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },
  bookButtonTextDisabled: {
    color: colors.textSecondary,
  },

  // Enhanced Info Section
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  infoHeaderTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 12,
    letterSpacing: -0.3,
  },
  infoCardsContainer: {
    gap: 12,
  },
  infoItemCard: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  infoItemIconContainer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoItemContent: {
    flex: 1,
    paddingTop: 2,
  },
  infoItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  infoItemText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
    fontWeight: '500',
  },
});
