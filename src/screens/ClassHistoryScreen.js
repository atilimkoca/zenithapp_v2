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

          {/* Enhanced Stats Overview */}
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {loading ? '...' : (stats.upcomingCount ?? 0)}
              </Text>
              <Text style={styles.statLabel}>{t('classes.upcoming')}</Text>
              <Ionicons name="calendar" size={24} color={colors.primary} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {loading ? '...' : (stats.completedCount ?? 0)}
              </Text>
              <Text style={styles.statLabel}>{t('classes.completed')}</Text>
              <Ionicons name="checkmark-circle" size={24} color={colors.success} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {loading ? '...' : (stats.totalLessons ?? 0)}
              </Text>
              <Text style={styles.statLabel}>{t('profile.totalLessons')}</Text>
              <Ionicons name="trophy" size={24} color={colors.warning} />
            </View>
          </View>

          {/* Additional Stats Row */}
          {!loading && (stats.totalLessons ?? 0) > 0 && (
            <View style={styles.additionalStats}>
              <View style={styles.additionalStatCard}>
                <View style={styles.statRow}>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.additionalStatLabel}>{t('profile.thisMonth')}</Text>
                </View>
                <Text style={styles.additionalStatNumber}>
                  {loading ? '...' : `${stats.thisMonthCount ?? 0} ${t('classes.lessons')}`}
                </Text>
              </View>
              
              <View style={styles.additionalStatCard}>
                <View style={styles.statRow}>
                  <Ionicons name="trending-up-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.additionalStatLabel}>{t('profile.completionRate')}</Text>
                </View>
                <Text style={styles.additionalStatNumber}>
                  {loading ? '...' : `%${stats.completionRate ?? 0}`}
                </Text>
              </View>

              <View style={styles.additionalStatCard}>
                <View style={styles.statRow}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.additionalStatLabel}>{t('profile.thisWeek')}</Text>
                </View>
                <Text style={styles.additionalStatNumber}>
                  {loading ? '...' : `${stats.thisWeekCount ?? 0} ${t('classes.lessons')}`}
                </Text>
              </View>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabsContainer}>
            {tabs.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  selectedTab === tab.id && styles.activeTab
                ]}
                onPress={() => setSelectedTab(tab.id)}
              >
                <Text 
                  style={[
                    styles.tabText,
                    selectedTab === tab.id && styles.activeTabText
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit={true}
                  minimumFontScale={0.8}
                >
                  {tab.name}
                </Text>
                <View style={[
                  styles.tabBadge,
                  selectedTab === tab.id && styles.activeTabBadge
                ]}>
                  <Text style={[
                    styles.tabBadgeText,
                    selectedTab === tab.id && styles.activeTabBadgeText
                  ]}>
                    {tab.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Classes List */}
          <View style={styles.section}>
            {getCurrentClasses().length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={64} color={colors.gray} />
                <Text style={styles.emptyStateTitle}>{t('classes.noLessons')}</Text>
                <Text style={styles.emptyStateText}>
                  {selectedTab === 'completed' && t('classes.noCompleted')}
                  {selectedTab === 'upcoming' && t('classes.noUpcoming')}
                  {selectedTab === 'cancelled' && t('classes.noCancelled')}
                </Text>
              </View>
            ) : (
              getCurrentClasses().map((lesson) => (
                <View key={lesson.id} style={styles.classCard}>
                  <View style={styles.classHeader}>
                    <View style={styles.classMainInfo}>
                      <View style={styles.classTitleRow}>
                        <View style={[
                          styles.categoryIcon,
                          { backgroundColor: getCategoryColor(lesson.typeInfo) + '15' }
                        ]}>
                          <Ionicons
                            name={getCategoryIcon(lesson.typeInfo)}
                            size={20}
                            color={getCategoryColor(lesson.typeInfo)}
                          />
                        </View>
                        <View style={styles.classTextInfo}>
                          <Text style={styles.className}>{lesson.title}</Text>
                          <Text style={styles.instructorName}>
                            🧘‍♀️ {lesson.trainerName || lesson.instructor || t('ui.noInstructor')}
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusColor(lesson.userStatus) + '15' }
                    ]}>
                      <Text style={[
                        styles.statusText,
                        { color: getStatusColor(lesson.userStatus) }
                      ]}>
                        {getStatusText(lesson.userStatus)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.classDetails}>
                    <View style={styles.detailRow}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>{lesson.formattedDate}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>{lesson.formattedTime}</Text>
                    </View>
                    {lesson.duration && (
                      <View style={styles.detailRow}>
                        <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.detailText}>{lesson.duration} {t('classes.duration')}</Text>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
                      <Text style={styles.detailText}>
                        {lesson.currentParticipants}/{lesson.maxParticipants} {t('classes.participants')}
                      </Text>
                    </View>
                    {lesson.reason && (
                      <View style={styles.detailRow}>
                        <Ionicons name="information-circle-outline" size={16} color={colors.error} />
                        <Text style={[styles.detailText, { color: colors.error }]}>{translateCancelReason(t, lesson.reason)}</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Area */}
                  <View style={styles.classFooter}>
                    {/* Lesson Type Badge */}
                    <View style={styles.leftFooter}>
                      <View style={[
                        styles.typeBadge, 
                        { backgroundColor: getCategoryColor(lesson.typeInfo) + '15' }
                      ]}>
                        <Text style={[
                          styles.typeBadgeText, 
                          { color: getCategoryColor(lesson.typeInfo) }
                        ]}>
                          {lesson.typeInfo?.category || lesson.type || t('classes.general')}
                        </Text>
                      </View>
                    </View>
                    
                    {lesson.userStatus === 'upcoming' && (
                      <TouchableOpacity
                        style={[
                          styles.cancelButton,
                          !canCancelLesson(lesson) && styles.cancelButtonDisabled
                        ]}
                        onPress={() => handleCancelClass(lesson)}
                        disabled={!canCancelLesson(lesson)}
                      >
                        <Ionicons name="close-circle-outline" size={18} color={
                          canCancelLesson(lesson) ? colors.error : colors.gray
                        } />
                        <Text style={[
                          styles.cancelButtonText,
                          !canCancelLesson(lesson) && styles.cancelButtonDisabledText
                        ]}>
                          {canCancelLesson(lesson) ? t('classes.cancel') : t('classes.cannotCancel')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
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
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
    textAlign: 'center',
  },
  additionalStats: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  additionalStatCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 2,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  additionalStatLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 4,
    fontWeight: '500',
  },
  additionalStatNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginHorizontal: 4,
    borderRadius: 12,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 44,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 6,
    flex: 1,
    textAlign: 'center',
    numberOfLines: 1,
    adjustsFontSizeToFit: true,
    minimumFontScale: 0.8,
  },
  activeTabText: {
    color: colors.white,
  },
  tabBadge: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 18,
    flexShrink: 0,
  },
  activeTabBadge: {
    backgroundColor: colors.white + '30',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  activeTabBadgeText: {
    color: colors.white,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  classCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
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
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  classTextInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  instructorName: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  classDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  classFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftFooter: {
    flex: 1,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.error + '15',
    borderRadius: 12,
  },
  cancelButtonDisabled: {
    backgroundColor: colors.gray + '10',
    opacity: 0.6,
  },
  cancelButtonText: {
    color: colors.error,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  cancelButtonDisabledText: {
    color: colors.gray,
  },
  noCancelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  noCancelText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginLeft: 4,
    fontStyle: 'italic',
  },
});
