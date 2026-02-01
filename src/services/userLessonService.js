import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { bookingHistoryService } from './bookingHistoryService';

// Cache configuration for performance
const CACHE_TTL = 60 * 1000; // 1 minute cache for user lessons
let userLessonsCache = {};
let userLessonsCacheTimestamp = {};

// Helper function to safely parse date values (handles timezone issues)
const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value?.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'string') {
    // Handle date-only strings (e.g., "2026-01-07") by parsing as local time
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

// Clear cache for a specific user (call after booking/cancellation)
export const clearUserLessonsCache = (userId) => {
  if (userId) {
    delete userLessonsCache[userId];
    delete userLessonsCacheTimestamp[userId];
  }
};

// Helper function to format date
const formatDate = (dateString) => {
  if (!dateString) return 'Tarih belirtilmemiş';
  
  try {
    let date;
    
    if (typeof dateString === 'string') {
      date = new Date(dateString);
    } else if (dateString instanceof Date) {
      date = dateString;
    } else if (dateString.seconds) {
      date = new Date(dateString.seconds * 1000);
    } else {
      return 'Geçersiz tarih';
    }
    
    if (isNaN(date.getTime())) {
      return 'Geçersiz tarih';
    }
    
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Bugün';
    }
    
    if (date.toDateString() === tomorrow.toDateString()) {
      return 'Yarın';
    }
    
    return date.toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      weekday: 'long'
    });
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return 'Tarih hatası';
  }
};

// Helper function to get lesson type icon and color
const getLessonTypeInfo = (title, type) => {
  const titleLower = (title || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();
  
  if (titleLower.includes('hatha') || typeLower.includes('hatha')) {
    return { icon: 'leaf-outline', color: '#10B981', category: 'Hatha Yoga' };
  } else if (titleLower.includes('vinyasa') || typeLower.includes('vinyasa')) {
    return { icon: 'flower-outline', color: '#F59E0B', category: 'Vinyasa Yoga' };
  } else if (titleLower.includes('pilates') || typeLower.includes('pilates')) {
    return { icon: 'fitness-outline', color: '#8B5CF6', category: 'Pilates' };
  } else if (titleLower.includes('meditation') || titleLower.includes('meditasyon') || typeLower.includes('meditation')) {
    return { icon: 'heart-outline', color: '#EF4444', category: 'Meditation' };
  } else if (titleLower.includes('reformer') || typeLower.includes('reformer')) {
    return { icon: 'barbell-outline', color: '#06B6D4', category: 'Reformer Pilates' };
  } else if (titleLower.includes('stretching') || typeLower.includes('stretching')) {
    return { icon: 'accessibility-outline', color: '#14B8A6', category: 'Stretching' };
  } else {
    return { icon: 'body-outline', color: '#6B7280', category: 'Genel' };
  }
};

export const userLessonService = {
  // OPTIMIZED: Get user's lesson history using array-contains query with caching
  getUserLessons: async (userId, options = {}) => {
    const { forceRefresh = false } = options;
    
    try {
      // Check cache first (unless force refresh)
      if (!forceRefresh && userLessonsCache[userId] && 
          Date.now() - userLessonsCacheTimestamp[userId] < CACHE_TTL) {
        return userLessonsCache[userId];
      }
      
      // OPTIMIZED: Use array-contains query instead of fetching ALL lessons
      const lessonsCollection = collection(db, 'lessons');
      const userLessonsQuery = query(
        lessonsCollection,
        where('participants', 'array-contains', userId)
      );
      
      const querySnapshot = await getDocs(userLessonsQuery);
      
      const userLessons = [];
      const now = new Date();
      
      querySnapshot.forEach((docSnapshot) => {
        const lessonData = docSnapshot.data();
        
        // No need to check participants - query already filtered by array-contains
        // Create lesson object with enhanced data
        const lesson = {
          id: docSnapshot.id,
          ...lessonData,
          formattedDate: formatDate(lessonData.scheduledDate),
          formattedTime: `${lessonData.startTime} - ${lessonData.endTime}`,
          currentParticipants: lessonData.participants ? lessonData.participants.length : 0,
          typeInfo: getLessonTypeInfo(lessonData.title, lessonData.type)
        };
        
        // Determine lesson status based on date and time
        if (lessonData.scheduledDate) {
          try {
            // Create lesson date and time using parseDateValue for proper timezone handling
            const lessonDate = parseDateValue(lessonData.scheduledDate);
            if (lessonDate) {
              // Set the time on the properly parsed date
              if (lessonData.endTime || lessonData.startTime) {
                const timeStr = lessonData.endTime || lessonData.startTime;
                const [hours, minutes] = timeStr.split(':').map(Number);
                lessonDate.setHours(hours || 0, minutes || 0, 0, 0);
              }
              
              const now = new Date();
              
              if (lessonData.status === 'cancelled') {
                lesson.userStatus = 'cancelled';
                lesson.reason = 'Ders iptal edildi';
              } else if (lessonDate < now) {
                lesson.userStatus = 'completed';
              } else {
                lesson.userStatus = 'upcoming';
              }
            } else {
              lesson.userStatus = 'upcoming';
            }
          } catch (dateError) {
            console.warn('Date parsing error for lesson:', lesson.id, dateError);
            lesson.userStatus = 'upcoming';
          }
        } else {
            // For legacy lessons without scheduledDate
            lesson.userStatus = 'upcoming';
          }
          
          userLessons.push(lesson);
      });
      
      // Skip userBookings query for better performance - lessons query is now optimized
      // The array-contains query already returns all relevant lessons
      
      // Sort lessons by date and time
      userLessons.sort((a, b) => {
        try {
          const dateA = parseDateValue(a.scheduledDate);
          const dateB = parseDateValue(b.scheduledDate);
          
          if (!dateA || !dateB) return 0;
          
          // Set times on the dates
          if (a.startTime) {
            const [h, m] = a.startTime.split(':').map(Number);
            dateA.setHours(h || 0, m || 0, 0, 0);
          }
          if (b.startTime) {
            const [h, m] = b.startTime.split(':').map(Number);
            dateB.setHours(h || 0, m || 0, 0, 0);
          }
          
          // For completed lessons, show newest first
          // For upcoming lessons, show soonest first
          if (a.userStatus === 'completed' && b.userStatus === 'completed') {
            return dateB - dateA; // Newest first
          } else if (a.userStatus === 'upcoming' && b.userStatus === 'upcoming') {
            return dateA - dateB; // Soonest first
          } else if (a.userStatus === 'upcoming' && b.userStatus === 'completed') {
            return -1; // Upcoming lessons first
          } else if (a.userStatus === 'completed' && b.userStatus === 'upcoming') {
            return 1; // Upcoming lessons first
          } else {
            return dateA - dateB;
          }
        } catch (error) {
          return 0;
        }
      });
      
      // Separate lessons by status
      const completedLessons = userLessons.filter(l => l.userStatus === 'completed');
      const upcomingLessons = userLessons.filter(l => l.userStatus === 'upcoming');
      const cancelledLessons = userLessons.filter(l => l.userStatus === 'cancelled');
      
      // Calculate total lessons excluding cancelled ones
      const activeLessons = completedLessons.length + upcomingLessons.length;
      
      const result = {
        success: true,
        lessons: {
          all: userLessons,
          completed: completedLessons,
          upcoming: upcomingLessons,
          cancelled: cancelledLessons
        },
        stats: {
          totalLessons: activeLessons, // Exclude cancelled from total
          completedCount: completedLessons.length,
          upcomingCount: upcomingLessons.length,
          cancelledCount: cancelledLessons.length
        }
      };
      
      // Cache the result for future requests
      userLessonsCache[userId] = result;
      userLessonsCacheTimestamp[userId] = Date.now();
      
      return result;
    } catch (error) {
      console.error('Error getting user lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Dersleriniz yüklenirken hata oluştu.'
      };
    }
  },

  // FAST: Get only upcoming lessons for overview (optimized for initial load)
  getUpcomingLessonsOnly: async (userId, maxCount = 3) => {
    try {
      // Use cache if available
      if (userLessonsCache[userId] && 
          Date.now() - userLessonsCacheTimestamp[userId] < CACHE_TTL) {
        const cached = userLessonsCache[userId];
        return {
          success: true,
          lessons: cached.lessons?.upcoming?.slice(0, maxCount) || [],
          stats: cached.stats
        };
      }
      
      const now = new Date();
      
      // OPTIMIZED: Query only user's lessons with array-contains (no compound index needed)
      const lessonsCollection = collection(db, 'lessons');
      const userLessonsQuery = query(
        lessonsCollection,
        where('participants', 'array-contains', userId)
      );
      
      const querySnapshot = await getDocs(userLessonsQuery);
      const upcomingLessons = [];
      
      querySnapshot.forEach((docSnapshot) => {
        const lessonData = docSnapshot.data();
        
        // Skip cancelled lessons
        if (lessonData.status === 'cancelled') return;
        
        // Check if lesson is actually upcoming (not past)
        try {
          const lessonDate = parseDateValue(lessonData.scheduledDate);
          if (!lessonDate) return; // Skip lessons without valid date
          
          // Set the time on the parsed date
          if (lessonData.endTime || lessonData.startTime) {
            const timeStr = lessonData.endTime || lessonData.startTime;
            const [hours, minutes] = timeStr.split(':').map(Number);
            lessonDate.setHours(hours || 0, minutes || 0, 0, 0);
          }
          
          if (lessonDate <= now) return; // Skip past lessons
        } catch (e) {
          // If date parsing fails, include the lesson
        }
        
        upcomingLessons.push({
          id: docSnapshot.id,
          ...lessonData,
          formattedDate: formatDate(lessonData.scheduledDate),
          formattedTime: `${lessonData.startTime} - ${lessonData.endTime}`,
          currentParticipants: lessonData.participants ? lessonData.participants.length : 0,
          typeInfo: getLessonTypeInfo(lessonData.title, lessonData.type),
          userStatus: 'upcoming'
        });
      });
      
      // Sort by date in memory using parseDateValue for proper timezone handling
      upcomingLessons.sort((a, b) => {
        const dateA = parseDateValue(a.scheduledDate);
        const dateB = parseDateValue(b.scheduledDate);
        if (!dateA || !dateB) return 0;
        if (a.startTime) {
          const [h, m] = a.startTime.split(':').map(Number);
          dateA.setHours(h || 0, m || 0, 0, 0);
        }
        if (b.startTime) {
          const [h, m] = b.startTime.split(':').map(Number);
          dateB.setHours(h || 0, m || 0, 0, 0);
        }
        return dateA - dateB;
      });
      
      return {
        success: true,
        lessons: upcomingLessons.slice(0, maxCount),
        stats: {
          upcomingCount: upcomingLessons.length
        }
      };
    } catch (error) {
      console.error('Error getting upcoming lessons:', error);
      // Fallback to full query if optimized query fails
      try {
        const fullResult = await userLessonService.getUserLessons(userId);
        if (fullResult.success) {
          return {
            success: true,
            lessons: fullResult.lessons?.upcoming?.slice(0, maxCount) || [],
            stats: fullResult.stats
          };
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
      return {
        success: false,
        error: error.code,
        lessons: [],
        stats: { upcomingCount: 0 }
      };
    }
  },

  // Cancel a lesson booking
  cancelLessonBooking: async (lessonId, userId) => {
    try {
      
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        return {
          success: false,
          message: 'Ders bulunamadı.'
        };
      }
      
      const lessonData = lessonDoc.data();
      
      // Check if user is in participants
      if (!lessonData.participants || !lessonData.participants.includes(userId)) {
        return {
          success: false,
          message: 'Bu derse kayıtlı değilsiniz.'
        };
      }
      
      // Check if lesson can be cancelled (must be at least 8 hours before start time)
      try {
        // Create lesson datetime by combining scheduledDate with startTime
        // Use parseDateValue to handle timezone issues with date-only strings
        const lessonDateTime = parseDateValue(lessonData.scheduledDate) || new Date();
        if (lessonData.startTime) {
          const [hours, minutes] = lessonData.startTime.split(':').map(Number);
          lessonDateTime.setHours(hours || 0, minutes || 0, 0, 0);
        }

        const now = new Date();
        const timeDiff = lessonDateTime.getTime() - now.getTime();
        const hoursUntilLesson = timeDiff / (1000 * 60 * 60);

        if (hoursUntilLesson < 8) {
          return {
            success: false,
            message: 'Lessons can be cancelled up to 8 hours before start time.',
            messageKey: 'classes.cancelTooLate',
            data: {
              hoursUntilLesson: Math.max(0, hoursUntilLesson)
            }
          };
        }
      } catch (timeError) {
        console.warn('Time check error, allowing cancellation:', timeError);
        // If we can't check time properly, allow cancellation
      }
      
      // Remove user from participants array
      await updateDoc(lessonRef, {
        participants: arrayRemove(userId),
        updatedAt: new Date().toISOString()
      });

      // Refund lesson credit to the appropriate package
      try {
        const { adminService } = await import('./adminService');
        const lessonScheduledDate = lessonData.scheduledDate || new Date().toISOString();
        const refundResult = await adminService.refundLessonToPackage(
          userId,
          lessonScheduledDate,
          `Ders iptali: ${lessonData.title} - ${lessonData.scheduledDate}`
        );

        if (!refundResult.success) {
          console.warn('⚠️ Could not refund credit to package, but cancellation continues:', refundResult.error);
        } else {
          console.log('✅ Lesson credit refunded to package:', refundResult.packageName);
        }
      } catch (creditError) {
        console.warn('⚠️ Credit refund failed:', creditError);
        // Don't fail the cancellation if credit refund fails
      }

      // Update booking history
      try {
        await bookingHistoryService.updateBookingHistory(userId, lessonId, 'cancelled', 
          'Kullanıcı tarafından iptal edildi');
      } catch (historyError) {
        console.warn('⚠️ Could not update booking history:', historyError);
        // Don't fail the cancellation if history update fails
      }
      
      // Clear cache after cancellation so next fetch gets fresh data
      clearUserLessonsCache(userId);
      
      // Invalidate the per-date cache in lessonService for this lesson's date
      try {
        const { lessonService } = await import('./lessonService');
        if (lessonData.scheduledDate) {
          const lessonDate = parseDateValue(lessonData.scheduledDate);
          if (lessonDate) {
            // Use local date format to match cache keys (avoid UTC timezone issues)
            const year = lessonDate.getFullYear();
            const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
            const day = String(lessonDate.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            lessonService.invalidateDateCache(dateKey);
          }
        }
      } catch (cacheError) {
        console.warn('⚠️ Could not invalidate lesson cache:', cacheError);
      }
      
      return {
        success: true,
        messageKey: 'classes.cancelSuccessMessage'
      };
    } catch (error) {
      console.error('Error cancelling lesson booking:', error);
      return {
        success: false,
        error: error.code,
        messageKey: 'classes.cancelErrorMessage'
      };
    }
  },

  // Get lesson statistics for user
  getUserLessonStats: async (userId) => {
    try {
      const result = await userLessonService.getUserLessons(userId);
      
      if (!result.success) {
        return result;
      }
      
      const { lessons, stats } = result;
      
      // Calculate additional statistics
      const thisWeekLessons = lessons.all.filter(lesson => {
        if (!lesson.scheduledDate || lesson.userStatus === 'cancelled') return false;
        
        try {
          // Use parseDateValue for safe date parsing
          const lessonDate = parseDateValue(lesson.scheduledDate);
          if (!lessonDate) return false;
          // Normalize to midnight for date-only comparison
          lessonDate.setHours(0, 0, 0, 0);
          
          const today = new Date();
          
          // Get the start of this week (Monday)
          const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
          const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Adjust for Sunday being 0
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() - daysFromMonday);
          weekStart.setHours(0, 0, 0, 0);
          
          // Get the end of this week (Sunday)
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          weekEnd.setHours(23, 59, 59, 999);
          
          
          return lessonDate >= weekStart && lessonDate <= weekEnd;
        } catch (error) {
          console.warn('Error in week calculation for lesson:', lesson.id, error);
          return false;
        }
      });
      
      const thisMonthLessons = lessons.all.filter(lesson => {
        if (!lesson.scheduledDate || lesson.userStatus === 'cancelled') return false;
        
        try {
          // Use parseDateValue for safe date parsing
          const lessonDate = parseDateValue(lesson.scheduledDate);
          if (!lessonDate) return false;
          
          const today = new Date();
          
          
          return lessonDate.getMonth() === today.getMonth() && 
                 lessonDate.getFullYear() === today.getFullYear();
        } catch (error) {
          console.warn('Error in month calculation for lesson:', lesson.id, error);
          return false;
        }
      });
      
      // Calculate completion rate (completed lessons vs total active lessons)
      const activeLessons = stats.completedCount + stats.upcomingCount;
      const completionRate = activeLessons > 0 ? 
        Math.round((stats.completedCount / activeLessons) * 100) : 0;
      
      return {
        success: true,
        stats: {
          ...stats,
          thisWeekCount: thisWeekLessons.length,
          thisMonthCount: thisMonthLessons.length,
          completionRate: completionRate
        }
      };
    } catch (error) {
      console.error('Error getting user lesson stats:', error);
      return {
        success: false,
        error: error.code,
        message: 'İstatistikler yüklenirken hata oluştu.'
      };
    }
  },

  // Get upcoming lessons for today
  getTodayLessons: async (userId) => {
    try {
      const result = await userLessonService.getUserLessons(userId);
      
      if (!result.success) {
        return result;
      }
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const todayLessons = result.lessons.upcoming.filter(lesson => {
        if (!lesson.scheduledDate) return false;
        return lesson.scheduledDate.startsWith(todayStr);
      });
      
      return {
        success: true,
        lessons: todayLessons
      };
    } catch (error) {
      console.error('Error getting today lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Bugünkü dersler yüklenirken hata oluştu.'
      };
    }
  },

  // Get user lesson statistics for profile page
  getUserLessonStats: async (userId) => {
    try {
      
      const result = await userLessonService.getUserLessons(userId);
      
      if (!result.success) {
        return {
          success: false,
          message: result.message,
          stats: {
            totalLessons: 0,
            completedCount: 0,
            monthlyLessons: 0,
            totalHours: 0
          }
        };
      }
      
      const { completed } = result.lessons;
      const totalLessons = completed.length;
      
      // Calculate this month's lessons
      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      
      const monthlyLessons = completed.filter(lesson => {
        if (!lesson.scheduledDate) return false;
        const lessonDate = parseDateValue(lesson.scheduledDate);
        if (!lessonDate) return false;
        return lessonDate.getMonth() === thisMonth && lessonDate.getFullYear() === thisYear;
      }).length;
      
      // Calculate total lessons completed (no hours calculation)
      const stats = {
        totalLessons,
        completedCount: totalLessons,
        monthlyLessons,
        totalHours: totalLessons // Each lesson = 1 unit, not calculating actual hours
      };
      
      
      return {
        success: true,
        stats
      };
    } catch (error) {
      console.error('❌ Error getting user lesson stats:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı istatistikleri yüklenirken hata oluştu.',
        stats: {
          totalLessons: 0,
          completedCount: 0,
          monthlyLessons: 0,
          totalHours: 0
        }
      };
    }
  }
};

export default userLessonService;
