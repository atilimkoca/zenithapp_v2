import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useI18n } from '../context/I18nContext';
import UniqueHeader from '../components/UniqueHeader';
import { lessonCreditsService } from '../services/lessonCreditsService';
import { userLessonService } from '../services/userLessonService';
import { translateLessonsArray } from '../utils/lessonTranslation';
import { formatLocalizedDate } from '../utils/dateUtils';

const { width } = Dimensions.get('window');

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

// Helper function to format dates with proper translation
export default function OverviewScreen({ navigation }) {
  const { userData, user } = useAuth();
  const { unreadCount } = useNotifications();
  const { t, locale } = useI18n();
  const [remainingCredits, setRemainingCredits] = useState(0);
  const [upcomingLessons, setUpcomingLessons] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({ totalLessons: 0, completedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, [user?.uid]);

  // Reload data when locale changes to retranslate content
  useEffect(() => {
    if (user?.uid && upcomingLessons.length > 0) {
      loadData();
    }
  }, [locale]);

  const loadData = async (isRefresh = false) => {
    if (!user?.uid) return;
    
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      // Load user credits and lessons in parallel
      const [creditsResult, lessonsResult] = await Promise.all([
        lessonCreditsService.getUserCredits(user.uid),
        userLessonService.getUserLessons(user.uid)
      ]);

      if (creditsResult.success) {
        setRemainingCredits(creditsResult.credits);
      }

      if (lessonsResult.success) {
        // Get upcoming lessons only (limit to 3 for overview)
        const upcoming = lessonsResult.lessons?.upcoming || [];
        
        // Translate lesson data based on current locale
        const translatedUpcoming = upcoming.map(lesson => ({
          ...lesson,
          title: translateLessonType(t, lesson.title),
          type: lesson.type ? translateLessonType(t, lesson.type) : lesson.type,
          trainingType: lesson.trainingType ? translateLessonType(t, lesson.trainingType) : lesson.trainingType,
          description: translateLessonDescription(t, lesson.description),
          formattedDate: formatLocalizedDate(lesson.scheduledDate || lesson.formattedDate, locale, t),
        }));
        
        setUpcomingLessons(translatedUpcoming.slice(0, 3));
        
        // Set monthly stats from the lessons result
        setMonthlyStats({
          totalLessons: lessonsResult.stats?.totalLessons || 0,
          completedCount: lessonsResult.stats?.completedCount || 0
        });
      }
    } catch (error) {
      console.error('Error loading overview data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    loadData(true);
  };

  const handleCallStudio = () => {
    const phoneNumber = '05348402490';
    Linking.openURL(`tel:${phoneNumber}`).catch(() => {
      Alert.alert(
        t('error') || 'Error',
        t('overview.phoneAppError') || 'Could not open phone app'
      );
    });
  };

  const handleOpenLocation = () => {
    const address = 'Maltepe, Mithatpaşa Cd. No:197, 35310 Güzelbahçe/İzmir';
    const encodedAddress = encodeURIComponent(address);
    
    // Try to open in Google Maps first, then Apple Maps as fallback
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    const appleMapsUrl = `http://maps.apple.com/?q=${encodedAddress}`;
    
    Linking.canOpenURL(googleMapsUrl)
      .then(supported => {
        if (supported) {
          return Linking.openURL(googleMapsUrl);
        } else {
          return Linking.openURL(appleMapsUrl);
        }
      })
      .catch(() => {
        Alert.alert(
          t('error') || 'Error',
          t('overview.mapsAppError') || 'Could not open maps app'
        );
      });
  };



  const formatLessonTime = (lesson) => {
    try {
      // Try to format the date properly
      if (lesson.scheduledDate) {
        let lessonDate;
        
        if (typeof lesson.scheduledDate === 'string') {
          lessonDate = new Date(lesson.scheduledDate.split('T')[0]);
        } else if (lesson.scheduledDate.seconds) {
          lessonDate = new Date(lesson.scheduledDate.seconds * 1000);
        } else {
          lessonDate = new Date(lesson.scheduledDate);
        }
        
        if (!isNaN(lessonDate.getTime())) {
          const dateOptions = { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
          };
          
          const formattedDate = lessonDate.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', dateOptions);
          
          return {
            date: formattedDate,
            time: lesson.formattedTime || `${lesson.startTime || ''} - ${lesson.endTime || ''}`
          };
        }
      }
      
      // Fallback to existing formatted data
      return {
        date: lesson.formattedDate || '',
        time: lesson.formattedTime || ''
      };
    } catch (error) {
      return {
        date: lesson.formattedDate || '',
        time: lesson.formattedTime || ''
      };
    }
  };

  const headerStats = [
    { 
      value: monthlyStats.totalLessons.toString(), 
      label: t('overview.thisMonth') || 'This Month',
      sublabel: t('overview.classes') || 'Classes',
      icon: 'calendar-outline', 
      color: 'rgba(255, 255, 255, 0.3)' 
    },
    { 
      value: remainingCredits.toString(), 
      label: t('overview.remaining') || 'Remaining',
      sublabel: t('overview.credits') || 'Credits',
      icon: 'ticket-outline', 
      color: 'rgba(255, 255, 255, 0.3)' 
    },
    { 
      value: upcomingLessons.length.toString(), 
      label: t('overview.upcoming') || 'Upcoming',
      sublabel: t('overview.classes') || 'Classes',
      icon: 'time-outline', 
      color: 'rgba(255, 255, 255, 0.3)' 
    },
  ];

  const renderUpcomingLesson = (lesson) => {
    const timeInfo = formatLessonTime(lesson);
    
    return (
      <View 
        key={lesson.id} 
        style={styles.classCard}
      >
        <View style={styles.classInfo}>
          <View style={styles.classHeader}>
            <View style={[styles.lessonTypeIcon, { backgroundColor: lesson.typeInfo?.color + '20' || 'rgba(107, 127, 106, 0.1)' }]}>
              <Ionicons 
                name={lesson.typeInfo?.icon || 'body-outline'} 
                size={20} 
                color={lesson.typeInfo?.color || colors.primary} 
              />
            </View>
            <View style={styles.classMainInfo}>
              <Text style={styles.className}>{lesson.title}</Text>
              <Text style={styles.instructorName}>
                {lesson.instructor || lesson.trainerName || t('ui.noInstructor') || 'No Instructor Information'}
              </Text>
            </View>
          </View>
          <View style={styles.classDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>{timeInfo.time || lesson.formattedTime}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.detailText}>{timeInfo.date || lesson.formattedDate}</Text>
            </View>
            {lesson.duration && (
              <View style={styles.detailItem}>
                <Ionicons name="hourglass-outline" size={16} color={colors.textSecondary} />
                <Text style={styles.detailText}>
                  {lesson.duration} {t('classes.duration') || 'minutes'}
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Zénith Studio"
        subtitle={t('overview.welcomeMessage') || 'Welcome to your yoga journey'}
        showStats={true}
        stats={headerStats}
        onRightPress={() => {
          navigation.navigate('Notifications');
        }}
      />

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Upcoming Classes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {t('overview.upcomingLessons') || 'Upcoming Classes'}
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('ClassSelection')}>
              <Text style={styles.seeAllText}>
                {t('overview.seeAll') || 'See All'}
              </Text>
            </TouchableOpacity>
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>
                {t('overview.loadingClasses') || 'Loading classes...'}
              </Text>
            </View>
          ) : upcomingLessons.length > 0 ? (
            upcomingLessons.map(renderUpcomingLesson)
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {t('overview.noUpcomingClasses') || 'No upcoming classes yet'}
              </Text>
              <TouchableOpacity 
                style={styles.bookNowButton}
                onPress={() => navigation.navigate('ClassSelection')}
              >
                <Text style={styles.bookNowText}>
                  {t('overview.bookClass') || 'Book a Class'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Studio Contact Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('overview.studioContact') || 'Studio Contact'}
          </Text>
          <View style={styles.studioCard}>
            <View style={styles.studioHeader}>
              <View style={styles.studioLogoContainer}>
                <Text style={styles.studioLogoText}>Z</Text>
              </View>
              <View style={styles.studioInfo}>
                <Text style={styles.studioName}>Zénith Studio</Text>
                <Text style={styles.studioSubtitle}>
                  {t('overview.premiumExperience') || 'Premium yoga experience'}
                </Text>
              </View>
            </View>
            
            <View style={styles.contactInfo}>
              <View style={styles.contactItem}>
                <Ionicons name="location-outline" size={18} color={colors.primary} />
                <Text style={styles.contactText}>
                  Maltepe, Mithatpaşa Cd. No:197{'\n'}35310 Güzelbahçe/İzmir
                </Text>
              </View>
              <View style={styles.contactItem}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
                <Text style={styles.contactText}>0534 840 24 90</Text>
              </View>
            </View>
            
            <View style={styles.studioActions}>
              <TouchableOpacity style={styles.studioAction} onPress={handleCallStudio}>
                <Ionicons name="call-outline" size={16} color={colors.primary} />
                <Text style={styles.studioActionText}>
                  {t('overview.call') || 'Call'}
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.studioAction} onPress={handleOpenLocation}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.studioActionText}>
                  {t('overview.location') || 'Location'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Additional Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('overview.quickAccess') || 'Quick Access'}
          </Text>
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ClassSelection')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="add-circle-outline" size={24} color="#10B981" />
              </View>
              <Text style={styles.quickActionText}>
                {t('overview.bookClassAction') || 'Book Class'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.quickActionCard}
              onPress={() => navigation.navigate('ClassHistory')}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="list-outline" size={24} color="#3B82F6" />
              </View>
              <Text style={styles.quickActionText}>
                {t('overview.myClasses') || 'My Classes'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
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
    marginTop: -15,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
    marginTop: 24,
  },
  
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  
  seeAllText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600',
  },
  
  // Loading and Empty States
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  
  emptyText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
    fontWeight: '500',
  },
  
  bookNowButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  
  bookNowText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Class Cards
  classCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.08)',
  },
  
  classInfo: {
    flex: 1,
  },
  
  classHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  lessonTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  
  classMainInfo: {
    flex: 1,
  },
  
  className: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  
  instructorName: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  classDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: '30%',
    marginBottom: 4,
  },
  
  detailText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  
  joinButtonContainer: {
    marginLeft: 12,
  },
  
  joinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  
  joinButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  
  // Studio Card
  studioCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.08)',
  },
  
  studioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  
  studioLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  
  studioLogoText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  
  studioInfo: {
    flex: 1,
  },
  
  studioName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  
  studioSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  contactInfo: {
    marginBottom: 20,
  },
  
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  
  contactText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 12,
    fontWeight: '500',
    lineHeight: 20,
    flex: 1,
  },
  
  studioActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingTop: 8,
  },
  
  studioAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(107, 127, 106, 0.08)',
    borderRadius: 20,
  },
  
  studioActionText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '600',
  },
  
  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  
  quickActionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 8,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.06)',
  },
  
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  quickActionText: {
    fontSize: 13,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '600',
    lineHeight: 18,
  },
});


