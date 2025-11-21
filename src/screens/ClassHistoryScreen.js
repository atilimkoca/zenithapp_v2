import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { colors } from '../constants/colors';
import { userLessonService } from '../services/userLessonService';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import UniqueHeader from '../components/UniqueHeader';
import { translateLessonsArray } from '../utils/lessonTranslation';
import { formatLocalizedDate } from '../utils/dateUtils';

// Helper function to safely translate lesson types
const translateLessonType = (t, lessonTitle) => {
  if (!lessonTitle) return '';
  const translationKey = `lessonTypes.${lessonTitle}`;
  const translated = t(translationKey);
  return translated === translationKey ? lessonTitle : translated;
};

// Helper function to safely translate lesson descriptions
const translateLessonDescription = (t, description) => {
  if (!description) return '';
  const translationKey = `lessonDescriptions.${description}`;
  const translated = t(translationKey);
  return translated === translationKey ? description : translated;
};

// Helper function to translate cancel reasons
const translateCancelReason = (t, reason) => {
  if (!reason) return '';
  // Check for common cancel reasons and translate them
  if (reason === 'Kullanıcı tarafından iptal edildi' || reason.includes('iptal edildi')) {
    return t('classes.cancelledByUser');
  }
  if (reason === 'Ders iptal edildi' || reason.includes('Ders iptal')) {
    return t('classes.lessonCancelled');
  }
  return reason; // Return original if no translation found
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

// Helper function to calculate this week's lesson count
const calculateThisWeekCount = (lessons) => {
  if (!lessons || !Array.isArray(lessons)) return 0;
  
  return lessons.filter(lesson => {
    if (!lesson.scheduledDate || lesson.userStatus === 'cancelled') return false;
    
    try {
      let lessonDate;
      if (lesson.scheduledDate.includes('T')) {
        lessonDate = new Date(lesson.scheduledDate.split('T')[0]);
      } else {
        lessonDate = new Date(lesson.scheduledDate);
      }
      
      const today = new Date();
      const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
      const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - daysFromMonday);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      return lessonDate >= weekStart && lessonDate <= weekEnd;
    } catch (error) {
      console.warn('Error in week calculation:', error);
      return false;
    }
  }).length;
};

// Helper function to calculate this month's lesson count
const calculateThisMonthCount = (lessons) => {
  if (!lessons || !Array.isArray(lessons)) return 0;
  
  return lessons.filter(lesson => {
    if (!lesson.scheduledDate || lesson.userStatus === 'cancelled') return false;
    
    try {
      let lessonDate;
      if (lesson.scheduledDate.includes('T')) {
        lessonDate = new Date(lesson.scheduledDate.split('T')[0]);
      } else {
        lessonDate = new Date(lesson.scheduledDate);
      }
      
      const today = new Date();
      return lessonDate.getMonth() === today.getMonth() && 
             lessonDate.getFullYear() === today.getFullYear();
    } catch (error) {
      console.warn('Error in month calculation:', error);
      return false;
    }
  }).length;
};

// Helper function to calculate completion rate
const calculateCompletionRate = (completedCount, upcomingCount) => {
  const activeLessons = completedCount + upcomingCount;
  return activeLessons > 0 ? Math.round((completedCount / activeLessons) * 100) : 0;
};

export default function ClassHistoryScreen() {
  const { user } = useAuth();
  const { t, locale, language: currentLanguage } = useI18n();
  const [selectedTab, setSelectedTab] = useState('upcoming'); // upcoming, completed, cancelled
  const [lessons, setLessons] = useState({
    all: [],
    completed: [],
    upcoming: [],
    cancelled: []
  });
  const [stats, setStats] = useState({
    totalLessons: 0,
    completedCount: 0,
    upcomingCount: 0,
    cancelledCount: 0,
    thisWeekCount: 0,
    thisMonthCount: 0,
    favoriteType: null,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user) {
      loadUserLessons();
    }
  }, [user]);

  // Reload lessons when locale or language changes to retranslate content and reformat dates
  useEffect(() => {
    if (user && lessons.all.length > 0) {
      loadUserLessons();
    }
  }, [locale, currentLanguage]);

  // Reload lessons when screen comes into focus (e.g., after booking a lesson)
  useFocusEffect(
    React.useCallback(() => {
      if (user) {
        loadUserLessons();
      }
    }, [user])
  );

  const loadUserLessons = async () => {
    try {
      setLoading(true);
      
      // Get user lessons and stats in parallel
      const [lessonsResult, statsResult] = await Promise.all([
        userLessonService.getUserLessons(user.uid),
        userLessonService.getUserLessonStats(user.uid)
      ]);
      
      if (lessonsResult.success) {
        // Translate lesson data based on current locale
        const translatedLessons = {
          ...lessonsResult.lessons,
          all: lessonsResult.lessons.all?.map(lesson => ({
            ...lesson,
            title: translateLessonType(t, lesson.title),
            type: lesson.type ? translateLessonType(t, lesson.type) : lesson.type,
            trainingType: lesson.trainingType ? translateLessonType(t, lesson.trainingType) : lesson.trainingType,
            description: translateLessonDescription(t, lesson.description),
            formattedDate: formatLocalizedDate(lesson.scheduledDate, currentLanguage, t),
          })) || [],
          completed: lessonsResult.lessons.completed?.map(lesson => ({
            ...lesson,
            title: translateLessonType(t, lesson.title),
            type: lesson.type ? translateLessonType(t, lesson.type) : lesson.type,
            trainingType: lesson.trainingType ? translateLessonType(t, lesson.trainingType) : lesson.trainingType,
            description: translateLessonDescription(t, lesson.description),
            formattedDate: formatLocalizedDate(lesson.scheduledDate, currentLanguage, t),
          })) || [],
          upcoming: lessonsResult.lessons.upcoming?.map(lesson => ({
            ...lesson,
            title: translateLessonType(t, lesson.title),
            type: lesson.type ? translateLessonType(t, lesson.type) : lesson.type,
            trainingType: lesson.trainingType ? translateLessonType(t, lesson.trainingType) : lesson.trainingType,
            description: translateLessonDescription(t, lesson.description),
            formattedDate: formatLocalizedDate(lesson.scheduledDate, currentLanguage, t),
          })) || [],
          cancelled: lessonsResult.lessons.cancelled?.map(lesson => ({
            ...lesson,
            title: translateLessonType(t, lesson.title),
            type: lesson.type ? translateLessonType(t, lesson.type) : lesson.type,
            trainingType: lesson.trainingType ? translateLessonType(t, lesson.trainingType) : lesson.trainingType,
            description: translateLessonDescription(t, lesson.description),
            formattedDate: formatLocalizedDate(lesson.scheduledDate, currentLanguage, t),
          })) || [],
        };
        
        setLessons(translatedLessons);
        
        // Calculate fallback stats from lessons data
        const fallbackStats = {
          totalLessons: translatedLessons.all?.length || 0,
          completedCount: translatedLessons.completed?.length || 0,
          upcomingCount: translatedLessons.upcoming?.length || 0,
          cancelledCount: translatedLessons.cancelled?.length || 0,
          thisWeekCount: calculateThisWeekCount(translatedLessons.all || []),
          thisMonthCount: calculateThisMonthCount(translatedLessons.all || []),
          favoriteType: null,
          completionRate: calculateCompletionRate(translatedLessons.completed?.length || 0, translatedLessons.upcoming?.length || 0)
        };
        
        // Use stats service result if available, otherwise use fallback
        if (statsResult.success && statsResult.stats) {
          setStats({
            ...fallbackStats,
            ...statsResult.stats,
            // Ensure critical values are not undefined/null
            totalLessons: statsResult.stats.totalLessons ?? fallbackStats.totalLessons,
            completedCount: statsResult.stats.completedCount ?? fallbackStats.completedCount,
            upcomingCount: statsResult.stats.upcomingCount ?? fallbackStats.upcomingCount,
            cancelledCount: statsResult.stats.cancelledCount ?? fallbackStats.cancelledCount,
            thisWeekCount: statsResult.stats.thisWeekCount ?? fallbackStats.thisWeekCount,
            thisMonthCount: statsResult.stats.thisMonthCount ?? fallbackStats.thisMonthCount,
            completionRate: statsResult.stats.completionRate ?? fallbackStats.completionRate,
          });
        } else {
          // Use fallback stats if service failed
          console.warn('Stats service failed, using fallback calculation:', statsResult.message);
          setStats(fallbackStats);
        }
      } else {
        Alert.alert(t('error') || 'Error', lessonsResult.message || 'An error occurred while loading lessons.');
        // Set empty stats if lessons failed to load
        setStats({
          totalLessons: 0,
          completedCount: 0,
          upcomingCount: 0,
          cancelledCount: 0,
          thisWeekCount: 0,
          thisMonthCount: 0,
          favoriteType: null,
          completionRate: 0
        });
      }
    } catch (error) {
      console.error('Error loading user lessons:', error);
      Alert.alert('Hata', 'Dersleriniz yüklenirken bir hata oluştu.');
      
      // Set empty stats on error to prevent undefined values
      setStats({
        totalLessons: 0,
        completedCount: 0,
        upcomingCount: 0,
        cancelledCount: 0,
        thisWeekCount: 0,
        thisMonthCount: 0,
        favoriteType: null,
        completionRate: 0
      });
      
      // Set empty lessons on error
      setLessons({
        all: [],
        completed: [],
        upcoming: [],
        cancelled: []
      });
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserLessons();
    setRefreshing(false);
  };

  const tabs = [
    { id: 'upcoming', name: t('classes.upcoming'), count: stats.upcomingCount ?? 0 },
    { id: 'completed', name: t('classes.completed'), count: stats.completedCount ?? 0 },
    { id: 'cancelled', name: t('classes.cancelled'), count: stats.cancelledCount ?? 0 },
  ];

  const getCurrentClasses = () => {
    switch (selectedTab) {
      case 'completed': return lessons.completed;
      case 'upcoming': return lessons.upcoming;
      case 'cancelled': return lessons.cancelled;
      default: return lessons.upcoming;
    }
  };

  const handleCancelClass = (lesson) => {
    // First check if lesson can be cancelled based on time
    let timeCheckMessage = '';
    let hoursUntilLesson = null;
    try {
      let lessonDateTime;
      
      if (lesson.scheduledDate.includes('T')) {
        const dateOnly = lesson.scheduledDate.split('T')[0];
        lessonDateTime = new Date(`${dateOnly}T${lesson.startTime}:00`);
      } else {
        lessonDateTime = new Date(`${lesson.scheduledDate}T${lesson.startTime}:00`);
      }
      
      const now = new Date();
      const timeDiff = lessonDateTime.getTime() - now.getTime();
      hoursUntilLesson = timeDiff / (1000 * 60 * 60);
      
      if (hoursUntilLesson < 8) {
        const formattedHours = formatHoursForLanguage(hoursUntilLesson, currentLanguage);
        timeCheckMessage = `\n⚠️ ${t('classes.cancelNote')} (${formattedHours} ${t('time.hours') || ''})`;
      }
    } catch (error) {
      console.warn('Time check failed:', error);
    }

    Alert.alert(
      t('classes.cancelLessonTitle'),
      `${lesson.title} ${t('classes.cancelConfirm')}\n\n${t('time.date')}: ${lesson.formattedDate}\n${t('time.time')}: ${lesson.formattedTime}${timeCheckMessage}\n\n❗ ${t('classes.cancelWarning')}`,
      [
        { text: t('keepLesson') || 'Keep Lesson', style: 'cancel' },
        { 
          text: t('classes.confirmCancel') || 'Cancel Lesson', 
          style: 'destructive',
          onPress: async () => {
            const result = await userLessonService.cancelLessonBooking(lesson.id, user.uid);
            if (result.success) {
              const message = result.messageKey ? t(result.messageKey) : result.message;
              Alert.alert(t('success') + '! ✅', message);
              loadUserLessons(); // Refresh the lessons
            } else {
              let errorMessage;
              if (result.messageKey === 'classes.cancelTooLate') {
                const hoursValue = result.data?.hoursUntilLesson ?? hoursUntilLesson;
                const formattedHours = formatHoursForLanguage(hoursValue, currentLanguage);
                errorMessage = `${t('classes.cancelTooLateMessage') || 'Ders başlamadan 8 saat öncesine kadar iptal edilebilir.'}\n${t('classes.hoursLeftLabel') || t('time.hoursLeft') || 'Time left'}: ${formattedHours} ${t('time.hours') || ''}`;
              } else {
                errorMessage = result.messageKey ? t(result.messageKey) : result.message;
              }

              Alert.alert(t('error'), errorMessage);
            }
          }
        }
      ]
    );
  };

  const renderStars = (rating) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Ionicons
        key={index}
        name={index < rating ? 'star' : 'star-outline'}
        size={16}
        color={index < rating ? '#FFD700' : colors.gray}
      />
    ));
  };

  const getCategoryIcon = (typeInfo) => {
    return typeInfo?.icon || 'fitness-outline';
  };

  const getCategoryColor = (typeInfo) => {
    return typeInfo?.color || colors.primary;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.success;
      case 'upcoming': return colors.primary;
      case 'cancelled': return colors.error;
      default: return colors.gray;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'completed': return t('classes.completed');
      case 'upcoming': return t('classes.upcoming');
      case 'cancelled': return t('classes.cancelled');
      default: return '';
    }
  };

  const canCancelLesson = (lesson) => {
    if (lesson.userStatus !== 'upcoming') return false;
    
    try {
      let lessonDateTime;
      
      // Handle different date formats
      if (lesson.scheduledDate.includes('T')) {
        const dateOnly = lesson.scheduledDate.split('T')[0];
        lessonDateTime = new Date(`${dateOnly}T${lesson.startTime}:00`);
      } else {
        lessonDateTime = new Date(`${lesson.scheduledDate}T${lesson.startTime}:00`);
      }
      
      const now = new Date();
      const timeDiff = lessonDateTime.getTime() - now.getTime();
      const hoursUntilLesson = timeDiff / (1000 * 60 * 60);
      
      
      return hoursUntilLesson >= 8; // Can cancel if at least 8 hours away
    } catch (error) {
      console.warn('Error checking cancel eligibility:', error);
      return true; // Allow cancellation if we can't check time properly
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UniqueHeader
        title={t('classes.title')} 
        subtitle={t('classes.subtitle')}
        showNotification={false}
      />
      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >

          {/* Modern Stats Overview */}
          <View style={styles.statsOverviewContainer}>
            <View style={styles.mainStatCard}>
              <View style={styles.mainStatHeader}>
                <View>
                  <Text style={styles.mainStatLabel}>{t('classes.upcoming')}</Text>
                  <Text style={styles.mainStatValue}>{loading ? '...' : (stats.upcomingCount ?? 0)}</Text>
                </View>
                <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="calendar" size={24} color={colors.primary} />
                </View>
              </View>
            </View>

            <View style={styles.secondaryStatsRow}>
              <View style={styles.secondaryStatCard}>
                <Ionicons name="checkmark-circle-outline" size={20} color={colors.success} style={styles.statIcon} />
                <Text style={styles.secondaryStatValue}>{loading ? '...' : (stats.completedCount ?? 0)}</Text>
                <Text style={styles.secondaryStatLabel}>{t('classes.completed')}</Text>
              </View>
              <View style={styles.secondaryStatCard}>
                <Ionicons name="trophy-outline" size={20} color={colors.warning} style={styles.statIcon} />
                <Text style={styles.secondaryStatValue}>{loading ? '...' : (stats.totalLessons ?? 0)}</Text>
                <Text style={styles.secondaryStatLabel}>{t('profile.totalLessons')}</Text>
              </View>
              <View style={styles.secondaryStatCard}>
                <Ionicons name="trending-up-outline" size={20} color={colors.info} style={styles.statIcon} />
                <Text style={styles.secondaryStatValue}>{loading ? '...' : `%${stats.completionRate ?? 0}`}</Text>
                <Text style={styles.secondaryStatLabel}>{t('profile.completionRate')}</Text>
              </View>
            </View>
          </View>

          {/* Modern Segmented Tabs */}
          <View style={styles.segmentedControlContainer}>
            {tabs.map((tab) => {
              const isActive = selectedTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.segment, isActive && styles.activeSegment]}
                  onPress={() => setSelectedTab(tab.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.segmentText, isActive && styles.activeSegmentText]}>
                    {tab.name}
                  </Text>
                  {tab.count > 0 && (
                    <View style={[styles.segmentBadge, isActive && styles.activeSegmentBadge]}>
                      <Text style={[styles.segmentBadgeText, isActive && styles.activeSegmentBadgeText]}>
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Modern Classes List */}
          <View style={styles.listSection}>
            {getCurrentClasses().length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyStateIconContainer}>
                  <Ionicons name="calendar-clear-outline" size={48} color={colors.primary} />
                </View>
                <Text style={styles.emptyStateTitle}>{t('classes.noLessons')}</Text>
                <Text style={styles.emptyStateText}>
                  {selectedTab === 'completed' && t('classes.noCompleted')}
                  {selectedTab === 'upcoming' && t('classes.noUpcoming')}
                  {selectedTab === 'cancelled' && t('classes.noCancelled')}
                </Text>
              </View>
            ) : (
              getCurrentClasses().map((lesson) => {
                // Parse date for the date badge
                let day = '', month = '';
                try {
                  let dateObj;
                  if (lesson.scheduledDate.includes('T')) {
                    dateObj = new Date(lesson.scheduledDate.split('T')[0]);
                  } else {
                    dateObj = new Date(lesson.scheduledDate);
                  }
                  day = dateObj.getDate();
                  month = dateObj.toLocaleString(currentLanguage === 'tr' ? 'tr-TR' : 'en-US', { month: 'short' }).toUpperCase();
                } catch (e) {
                  day = '--';
                  month = '---';
                }

                return (
                  <View key={lesson.id} style={styles.modernClassCard}>
                    <View style={styles.cardLeftStrip}>
                      <View style={styles.dateBadge}>
                        <Text style={styles.dateBadgeDay}>{day}</Text>
                        <Text style={styles.dateBadgeMonth}>{month}</Text>
                      </View>
                      <View style={styles.verticalLine} />
                      <View style={[styles.categoryDot, { backgroundColor: getCategoryColor(lesson.typeInfo) }]} />
                    </View>
                    
                    <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.modernClassName} numberOfLines={1}>{lesson.title}</Text>
                        <View style={[
                          styles.modernStatusBadge,
                          { backgroundColor: getStatusColor(lesson.userStatus) + '15' }
                        ]}>
                          <Text style={[
                            styles.modernStatusText,
                            { color: getStatusColor(lesson.userStatus) }
                          ]}>
                            {getStatusText(lesson.userStatus)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.cardInfoRow}>
                        <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.cardInfoText}>{lesson.formattedTime} • {lesson.duration} {t('classes.duration')}</Text>
                      </View>

                      <View style={styles.cardInfoRow}>
                        <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
                        <Text style={styles.cardInfoText}>{lesson.trainerName || lesson.instructor || t('ui.noInstructor')}</Text>
                      </View>

                      {lesson.reason && (
                        <View style={styles.reasonContainer}>
                          <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
                          <Text style={styles.reasonText} numberOfLines={1}>
                            {translateCancelReason(t, lesson.reason)}
                          </Text>
                        </View>
                      )}

                      {lesson.userStatus === 'upcoming' && (
                        <View style={styles.cardActions}>
                          <TouchableOpacity
                            style={[
                              styles.modernCancelButton,
                              !canCancelLesson(lesson) && styles.modernCancelButtonDisabled
                            ]}
                            onPress={() => handleCancelClass(lesson)}
                            disabled={!canCancelLesson(lesson)}
                          >
                            <Text style={[
                              styles.modernCancelButtonText,
                              !canCancelLesson(lesson) && styles.modernCancelButtonDisabledText
                            ]}>
                              {canCancelLesson(lesson) ? t('classes.cancel') : t('classes.cannotCancel')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Bottom spacing */}
          <View style={{ height: 120 }} />
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
  },
  scrollContent: {
    paddingBottom: 40,
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
  
  // Modern Stats Styles
  statsOverviewContainer: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  mainStatCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: colors.primary + '10',
  },
  mainStatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainStatLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  mainStatValue: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  secondaryStatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statIcon: {
    marginBottom: 8,
  },
  secondaryStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  secondaryStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Modern Tabs Styles
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: colors.lightGray,
    borderRadius: 16,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeSegment: {
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  activeSegmentText: {
    color: colors.primary,
  },
  segmentBadge: {
    backgroundColor: colors.gray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 6,
  },
  activeSegmentBadge: {
    backgroundColor: colors.primary + '20',
  },
  segmentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  activeSegmentBadgeText: {
    color: colors.primary,
  },

  // Modern List Styles
  listSection: {
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
  },
  
  // Modern Card Styles
  modernClassCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardLeftStrip: {
    width: 70,
    backgroundColor: colors.lightGray + '50',
    alignItems: 'center',
    paddingVertical: 16,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  dateBadge: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dateBadgeDay: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  dateBadgeMonth: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
  },
  verticalLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardContent: {
    flex: 1,
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  modernClassName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  modernStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  modernStatusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardInfoText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  reasonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error + '10',
    padding: 8,
    borderRadius: 8,
    marginTop: 8,
  },
  reasonText: {
    fontSize: 12,
    color: colors.error,
    marginLeft: 6,
    flex: 1,
  },
  cardActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modernCancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error + '30',
  },
  modernCancelButtonDisabled: {
    borderColor: colors.gray,
    backgroundColor: colors.gray + '10',
  },
  modernCancelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.error,
  },
  modernCancelButtonDisabledText: {
    color: colors.textLight,
  },
});
