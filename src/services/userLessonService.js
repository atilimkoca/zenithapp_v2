import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config/firebase';
import { bookingHistoryService } from './bookingHistoryService';

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
  // Get user's lesson history (completed, upcoming, cancelled)
  getUserLessons: async (userId) => {
    try {
      
      // Get all lessons from Firestore
      const lessonsCollection = collection(db, 'lessons');
      const querySnapshot = await getDocs(lessonsCollection);
      
      const userLessons = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      querySnapshot.forEach((doc) => {
        const lessonData = doc.data();
        
        // Check if user is in participants array
        if (lessonData.participants && Array.isArray(lessonData.participants) && 
            lessonData.participants.includes(userId)) {
          
          // Create lesson object with enhanced data
          const lesson = {
            id: doc.id,
            ...lessonData,
            formattedDate: formatDate(lessonData.scheduledDate),
            formattedTime: `${lessonData.startTime} - ${lessonData.endTime}`,
            currentParticipants: lessonData.participants ? lessonData.participants.length : 0,
            typeInfo: getLessonTypeInfo(lessonData.title, lessonData.type)
          };
          
          // Determine lesson status based on date and time
          if (lessonData.scheduledDate) {
            try {
              // Create lesson date and time more carefully
              let lessonDateTime;
              
              // Handle different date formats
              if (lessonData.scheduledDate.includes('T')) {
                // ISO format: 2025-09-08T00:00:00.000Z
                const dateOnly = lessonData.scheduledDate.split('T')[0];
                lessonDateTime = new Date(`${dateOnly}T${lessonData.endTime || lessonData.startTime}:00`);
              } else {
                // Simple format: 2025-09-08
                lessonDateTime = new Date(`${lessonData.scheduledDate}T${lessonData.endTime || lessonData.startTime}:00`);
              }
              
              const now = new Date();
              
              
              if (lessonData.status === 'cancelled') {
                lesson.userStatus = 'cancelled';
                lesson.reason = 'Ders iptal edildi';
              } else if (lessonDateTime < now) {
                lesson.userStatus = 'completed';
              } else {
                lesson.userStatus = 'upcoming';
              }
            } catch (dateError) {
              console.warn('Date parsing error for lesson:', lesson.id, dateError);
              // Try a simpler date comparison
              try {
                const lessonDateOnly = new Date(lessonData.scheduledDate.split('T')[0]);
                const todayOnly = new Date();
                todayOnly.setHours(0, 0, 0, 0);
                lessonDateOnly.setHours(23, 59, 59, 999); // End of lesson day
                
                if (lessonData.status === 'cancelled') {
                  lesson.userStatus = 'cancelled';
                } else if (lessonDateOnly < todayOnly) {
                  lesson.userStatus = 'completed';
                } else {
                  lesson.userStatus = 'upcoming';
                }
              } catch (fallbackError) {
                console.error('Fallback date parsing also failed:', fallbackError);
                lesson.userStatus = 'upcoming';
              }
            }
          } else {
            // For legacy lessons without scheduledDate
            lesson.userStatus = 'upcoming';
          }
          
          userLessons.push(lesson);
        }
      });
      
      // Also check for any user-specific booking records (if exists)
      try {
        const userBookingsCollection = collection(db, 'userBookings');
        const userBookingsQuery = query(userBookingsCollection, where('userId', '==', userId));
        const bookingsSnapshot = await getDocs(userBookingsQuery);
        
        bookingsSnapshot.forEach((doc) => {
          const booking = doc.data();
          // Check if this booking isn't already in the lessons array
          const existingLesson = userLessons.find(l => l.id === booking.lessonId);
          if (!existingLesson && booking.lessonData) {
            // Add historical booking data
            const historyLesson = {
              id: booking.lessonId || doc.id,
              ...booking.lessonData,
              formattedDate: formatDate(booking.lessonData.scheduledDate),
              formattedTime: `${booking.lessonData.startTime} - ${booking.lessonData.endTime}`,
              currentParticipants: booking.lessonData.currentParticipants || 0,
              typeInfo: getLessonTypeInfo(booking.lessonData.title, booking.lessonData.type),
              userStatus: booking.status || 'completed', // Historical bookings are usually completed
              bookingDate: booking.bookingDate,
              cancelledDate: booking.cancelledDate,
              reason: booking.cancelReason
            };
            
            userLessons.push(historyLesson);
          }
        });
      } catch (bookingError) {
      }
      
      // Sort lessons by date and time
      userLessons.sort((a, b) => {
        try {
          const dateTimeA = new Date(`${a.scheduledDate}T${a.startTime || '00:00'}`);
          const dateTimeB = new Date(`${b.scheduledDate}T${b.startTime || '00:00'}`);
          
          if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
            return 0;
          }
          
          // For completed lessons, show newest first
          // For upcoming lessons, show soonest first
          if (a.userStatus === 'completed' && b.userStatus === 'completed') {
            return dateTimeB - dateTimeA; // Newest first
          } else if (a.userStatus === 'upcoming' && b.userStatus === 'upcoming') {
            return dateTimeA - dateTimeB; // Soonest first
          } else if (a.userStatus === 'upcoming' && b.userStatus === 'completed') {
            return -1; // Upcoming lessons first
          } else if (a.userStatus === 'completed' && b.userStatus === 'upcoming') {
            return 1; // Upcoming lessons first
          } else {
            return dateTimeA - dateTimeB;
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
      
      
      return {
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
    } catch (error) {
      console.error('Error getting user lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Dersleriniz yüklenirken hata oluştu.'
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
      
      // Check if lesson can be cancelled (e.g., not too close to start time)
      try {
        let lessonDateTime;
        
        // Handle different date formats for cancellation check
        if (lessonData.scheduledDate.includes('T')) {
          const dateOnly = lessonData.scheduledDate.split('T')[0];
          lessonDateTime = new Date(`${dateOnly}T${lessonData.startTime}:00`);
        } else {
          lessonDateTime = new Date(`${lessonData.scheduledDate}T${lessonData.startTime}:00`);
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

      // Refund lesson credit
      try {
        const { lessonCreditsService } = await import('./lessonCreditsService');
        const refundResult = await lessonCreditsService.refundUserCredit(
          userId, 
          `Ders iptali: ${lessonData.title} - ${lessonData.scheduledDate}`
        );
        
        if (!refundResult.success) {
          console.warn('⚠️ Could not refund credit, but cancellation continues:', refundResult.message);
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
          let lessonDate;
          if (lesson.scheduledDate.includes('T')) {
            lessonDate = new Date(lesson.scheduledDate.split('T')[0]);
          } else {
            lessonDate = new Date(lesson.scheduledDate);
          }
          
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
        const lessonDate = new Date(lesson.scheduledDate);
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
