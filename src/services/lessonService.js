import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { bookingHistoryService } from './bookingHistoryService';

// Helper function to fetch trainers data
const TRAINERS_CACHE_TTL = 60 * 1000; // 60 seconds
let trainersCache = null;
let trainersCacheTimestamp = 0;

const fetchTrainersData = async (options = {}) => {
  const forceRefresh = typeof options === 'boolean' ? options : options.forceRefresh;

  if (!forceRefresh && trainersCache && Date.now() - trainersCacheTimestamp < TRAINERS_CACHE_TTL) {
    return trainersCache;
  }

  try {
    const trainersQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['instructor', 'admin'])
    );
    
    const trainersSnapshot = await getDocs(trainersQuery);
    const trainersMap = {};
    
    trainersSnapshot.forEach((doc) => {
      const trainerData = doc.data();
      trainersMap[doc.id] = {
        id: doc.id,
        displayName: trainerData.displayName || `${trainerData.firstName || ''} ${trainerData.lastName || ''}`.trim(),
        firstName: trainerData.firstName || '',
        lastName: trainerData.lastName || '',
        specializations: trainerData.trainerProfile?.specializations || [],
        bio: trainerData.trainerProfile?.bio || '',
        isActive: trainerData.status === 'active' && trainerData.trainerProfile?.isActive !== false
      };
    });
    
    trainersCache = trainersMap;
    trainersCacheTimestamp = Date.now();

    return trainersMap;
  } catch (error) {
    console.error('❌ Error fetching trainers:', error);
    return {};
  }
};

// Helper function to fetch lesson types from admin settings or use predefined types
const fetchLessonTypes = async () => {
  try {
    
    // Try to get lesson types from settings collection first
    const settingsDoc = await getDoc(doc(db, 'settings', 'lessonTypes'));
    
    if (settingsDoc.exists()) {
      const data = settingsDoc.data();
      return data.types || getDefaultLessonTypes();
    } else {
      return getDefaultLessonTypes();
    }
  } catch (error) {
    console.error('❌ Error fetching lesson types:', error);
    return getDefaultLessonTypes();
  }
};

// Helper function to fetch lesson status/levels from Firebase
const fetchLessonStatus = async () => {
  try {
    
    const statusDoc = await getDoc(doc(db, 'settings', 'lessonStatus'));
    
    if (statusDoc.exists()) {
      const data = statusDoc.data();
      return data.levels || getDefaultStatusLevels();
    } else {
      return getDefaultStatusLevels();
    }
  } catch (error) {
    console.error('❌ Error fetching lesson status:', error);
    return getDefaultStatusLevels();
  }
};

// Default status levels
const getDefaultStatusLevels = () => {
  return [
    { id: 'beginner', name: 'Başlangıç', color: '#10B981' },
    { id: 'intermediate', name: 'Orta', color: '#F59E0B' },
    { id: 'advanced', name: 'İleri', color: '#EF4444' }
  ];
};

// Default lesson types if not found in Firebase
const getDefaultLessonTypes = () => {
  return [
    {
      id: 'pilates',
      name: 'Pilates',
      description: 'Core strengthening and posture correction exercises',
      icon: 'fitness-outline',
      color: '#8B5CF6',
      difficulty: ['beginner', 'intermediate', 'advanced'],
      duration: [45, 60, 75],
      maxParticipants: 12
    },
    {
      id: 'yoga',
      name: 'Yoga',
      description: '',
      icon: 'leaf-outline',
      color: '#10B981',
      difficulty: ['beginner', 'intermediate', 'advanced'],
      duration: [60, 75, 90],
      maxParticipants: 15
    },
    {
      id: 'reformer',
      name: 'Reformer Pilates',
      description: 'Pilates exercises with reformer equipment',
      icon: 'barbell-outline',
      color: '#F59E0B',
      difficulty: ['intermediate', 'advanced'],
      duration: [50, 60],
      maxParticipants: 8
    },
    {
      id: 'mat-pilates',
      name: 'Mat Pilates',
      description: 'Mat-based pilates exercises',
      icon: 'body-outline',
      color: '#3B82F6',
      difficulty: ['beginner', 'intermediate'],
      duration: [45, 60],
      maxParticipants: 15
    },
    {
      id: 'vinyasa',
      name: 'Vinyasa Yoga',
      description: 'Flowing yoga sequences',
      icon: 'flower-outline',
      color: '#F97316',
      difficulty: ['intermediate', 'advanced'],
      duration: [75, 90],
      maxParticipants: 12
    },
    {
      id: 'yin-yoga',
      name: 'Yin Yoga',
      description: 'Slow yoga for deep relaxation and flexibility',
      icon: 'moon-outline',
      color: '#84CC16',
      difficulty: ['all'],
      duration: [75, 90],
      maxParticipants: 15
    },
    {
      id: 'hatha',
      name: 'Hatha Yoga',
      description: 'Traditional yoga postures and breath work',
      icon: 'sunny-outline',
      color: '#6366F1',
      difficulty: ['beginner', 'intermediate'],
      duration: [60, 75],
      maxParticipants: 15
    },
    {
      id: 'meditation',
      name: 'Meditasyon',
      description: 'Mental calmness and mindfulness practice',
      icon: 'heart-outline',
      color: '#8B5CF6',
      difficulty: ['all'],
      duration: [30, 45],
      maxParticipants: 20
    },
    {
      id: 'stretching',
      name: 'Stretching',
      description: 'Flexibility and mobility improvement exercises',
      icon: 'accessibility-outline',
      color: '#14B8A6',
      difficulty: ['beginner', 'intermediate'],
      duration: [45, 60],
      maxParticipants: 15
    }
  ];
};

export const lessonService = {
  // Get lesson types
  getLessonTypes: fetchLessonTypes,
  
  // Get lesson status levels
  getLessonStatus: fetchLessonStatus,
  
  // Get trainers data
  getTrainersData: fetchTrainersData,

  // Get all active lessons grouped by date
  getAllLessons: async () => {
    try {
      
      // Fetch lessons, trainers, lesson types, and status in parallel
      const [lessonsQuery, trainersMap, lessonTypes, statusLevels] = await Promise.all([
        getDocs(query(collection(db, 'lessons'))),
        fetchTrainersData(),
        fetchLessonTypes(),
        fetchLessonStatus()
      ]);
      
      const lessons = [];
      
      lessonsQuery.forEach((doc) => {
        const data = doc.data();
        
        // Filter for active lessons only and ensure required fields exist
        if (data.status === 'active' && data.scheduledDate && data.startTime && data.endTime) {
          // Check if lesson is not in the past
          const lessonDate = new Date(data.scheduledDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Set to start of day for comparison
          
          // Only include lessons from today onwards
          if (lessonDate >= today) {
            // Get trainer information
            const trainer = trainersMap[data.trainerId];
            
            // Get lesson type information
            const lessonTypeInfo = lessonTypes.find(type => 
              type.name.toLowerCase() === data.type?.toLowerCase() ||
              type.id.toLowerCase() === data.type?.toLowerCase().replace(/\s+/g, '-')
            );
            
            // Get status/level information
            const statusInfo = statusLevels.find(level => 
              level.id === (data.level || 'intermediate') ||
              level.name.toLowerCase() === (data.level || 'orta').toLowerCase()
            ) || statusLevels.find(level => level.id === 'intermediate');
            
            lessons.push({
              id: doc.id,
              ...data,
              // Format the data for easier use
              formattedDate: data.scheduledDate, // Store raw date for translation in screens
              formattedTime: `${data.startTime} - ${data.endTime}`,
              currentParticipants: data.participants ? data.participants.length : 0,
              availableSpots: data.maxParticipants - (data.participants ? data.participants.length : 0),
              isRecurring: data.isRecurring || false,
              // Package type information
              lessonPackageType: data.maxParticipants === 1 ? 'one-on-one' : 'group',
              // Enhanced trainer information
              instructor: trainer ? trainer.displayName : (data.trainerName || 'No Trainer Information'),
              trainerSpecializations: trainer ? trainer.specializations : [],
              trainerBio: trainer ? trainer.bio : '',
              trainerActive: trainer ? trainer.isActive : false,
              // Enhanced lesson type information
              lessonTypeInfo: lessonTypeInfo || {
                name: data.type || 'General',
                description: 'Lesson description not available',
                icon: 'fitness-outline',
                color: '#6B7280'
              },
              // Enhanced status information
              statusInfo: statusInfo,
              statusLevel: statusInfo.name,
              statusColor: statusInfo.color,
              // Enhanced training attributes
              trainingType: getTrainingType(data.type || data.title, lessonTypeInfo),
              difficulty: data.level || 'intermediate',
              equipment: getEquipmentNeeded(data.type || data.title, lessonTypeInfo),
              benefits: getClassBenefits(data.type || data.title, lessonTypeInfo),
            });
          }
        } else if (data.status === 'active') {
          console.warn('Skipping lesson with missing required fields:', doc.id, {
            hasScheduledDate: !!data.scheduledDate,
            hasStartTime: !!data.startTime,
            hasEndTime: !!data.endTime
          });
        }
      });
      
      // Sort by scheduled date and time on client side
      lessons.sort((a, b) => {
        try {
          // Create comparable datetime strings
          const dateTimeA = new Date(`${a.scheduledDate}T${a.startTime}`);
          const dateTimeB = new Date(`${b.scheduledDate}T${b.startTime}`);
          
          // Check if dates are valid
          if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
            console.warn('Invalid date found during sorting:', {
              lessonA: { id: a.id, scheduledDate: a.scheduledDate, startTime: a.startTime },
              lessonB: { id: b.id, scheduledDate: b.scheduledDate, startTime: b.startTime }
            });
            return 0; // Keep original order if dates are invalid
          }
          
          return dateTimeA - dateTimeB;
        } catch (error) {
          console.warn('Error sorting lessons by date:', error);
          return 0;
        }
      });
      
      // Group lessons by date
      const groupedLessons = groupLessonsByDate(lessons);
      
      
      return {
        success: true,
        lessons: lessons,
        groupedLessons: groupedLessons,
        trainers: Object.values(trainersMap),
        lessonTypes: lessonTypes
      };
    } catch (error) {
      console.error('Error getting lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Error occurred while fetching lessons.'
      };
    }
  },

  // Get lessons by level
  getLessonsByLevel: async (level) => {
    try {
      // Get all lessons first, then filter by level and status on client side
      const q = query(collection(db, 'lessons'));
      
      const querySnapshot = await getDocs(q);
      const lessons = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by level, active status, and not past dates
        if (data.level === level && data.status === 'active' && data.scheduledDate) {
          const lessonDate = new Date(data.scheduledDate);
          
          // Only include lessons from today onwards
          if (lessonDate >= today) {
            lessons.push({
              id: doc.id,
              ...data
            });
          }
        }
      });
      
      // Sort by scheduled date and time on client side
      lessons.sort((a, b) => {
        try {
          const dateTimeA = new Date(`${a.scheduledDate}T${a.startTime}`);
          const dateTimeB = new Date(`${b.scheduledDate}T${b.startTime}`);
          
          if (isNaN(dateTimeA.getTime()) || isNaN(dateTimeB.getTime())) {
            return 0;
          }
          
          return dateTimeA - dateTimeB;
        } catch (error) {
          return 0;
        }
      });
      
      return {
        success: true,
        lessons: lessons
      };
    } catch (error) {
      console.error('Error getting lessons by level:', error);
      return {
        success: false,
        error: error.code,
        message: 'Seviye dersleri alınırken hata oluştu.'
      };
    }
  },

  // Search lessons by title
  searchLessons: async (searchQuery) => {
    try {
      // Get all lessons first, then filter on client side
      const q = query(collection(db, 'lessons'));
      
      const querySnapshot = await getDocs(q);
      const lessons = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        // Filter by title containing search query (case insensitive), active status, and not past dates
        if (data.status === 'active' && 
            data.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
            data.scheduledDate) {
          
          const lessonDate = new Date(data.scheduledDate);
          
          // Only include lessons from today onwards
          if (lessonDate >= today) {
            lessons.push({
              id: doc.id,
              ...data
            });
          }
        }
      });
      
      return {
        success: true,
        lessons: lessons
      };
    } catch (error) {
      console.error('Error searching lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Error occurred while searching lessons.'
      };
    }
  },

  // Book a lesson (add user to participants)
  bookLesson: async (lessonId, userId) => {
    try {
      
      // Check if user membership is frozen
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if membership is cancelled
        if (userData.membershipStatus === 'cancelled' || userData.status === 'cancelled') {
          return {
            success: false,
            messageKey: 'classes.membershipCancelled'
          };
        }

        // Check if membership is frozen
        if (userData.membershipStatus === 'frozen' || userData.status === 'frozen') {
          return {
            success: false,
            messageKey: 'classes.membershipFrozen'
          };
        }

        // Check if membership is inactive
        if (userData.membershipStatus === 'inactive' || userData.status === 'inactive') {
          return {
            success: false,
            messageKey: 'classes.membershipInactive'
          };
        }

        // Prevent booking before membership start date (supports future-dated approvals)
        if (userData.packageStartDate || userData.packageInfo?.assignedAt) {
          const startDateValue = userData.packageStartDate || userData.packageInfo?.assignedAt;
          const startDate = new Date(startDateValue);
          if (!Number.isNaN(startDate.getTime())) {
            const normalizedStartDate = new Date(startDate);
            normalizedStartDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (normalizedStartDate > today) {
              return {
                success: false,
                messageKey: 'classes.membershipNotStarted'
              };
            }
          }
        }
      }
      
      // Import lessonCreditsService
      const { lessonCreditsService } = await import('./lessonCreditsService');
      
      // Check if user has enough credits
      const creditCheck = await lessonCreditsService.checkUserCanBook(userId);
      
      if (!creditCheck.success || !creditCheck.canBook) {
        return {
          success: false,
          messageKey: creditCheck.messageKey || 'classes.insufficientCredits',
          message: creditCheck.message // Keep backward compatibility
        };
      }
      
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        return {
          success: false,
          message: 'Lesson not found.'
        };
      }
      
      const lessonData = lessonDoc.data();
      const currentParticipants = lessonData.participants ? lessonData.participants.length : 0;
      
      // Check if lesson is full
      if (currentParticipants >= lessonData.maxParticipants) {
        return {
          success: false,
          message: 'Lesson is full. Cannot make reservation.'
        };
      }
      
      // Check if user is already registered
      if (lessonData.participants && lessonData.participants.includes(userId)) {
        return {
          success: false,
          message: 'Bu derse zaten kayıtlısınız.'
        };
      }
      
      // Consume user credit first (atomic operation)
      const creditResult = await lessonCreditsService.consumeUserCredit(
        userId, 
        `Lesson booking: ${lessonData.title} - ${lessonData.scheduledDate}`
      );
      
      if (!creditResult.success) {
        return {
          success: false,
          message: creditResult.message || 'Error occurred while using lesson credit.'
        };
      }
      
      try {
        // Add user to participants
        await updateDoc(lessonRef, {
          participants: arrayUnion(userId),
          updatedAt: new Date().toISOString()
        });

        // Create booking history record
        try {
          await bookingHistoryService.createBookingHistory(userId, lessonId, {
            ...lessonData,
            id: lessonId
          }, 'booked');
        } catch (historyError) {
          console.warn('⚠️ Could not create booking history:', historyError);
          // Don't fail the booking if history creation fails
        }
        
        return {
          success: true,
          messageKey: 'classSelection.bookingSuccessMessage',
          remainingCredits: creditResult.remainingCredits
        };
      } catch (bookingError) {
        // If booking fails after consuming credit, refund the credit
        console.error('❌ Booking failed, refunding credit:', bookingError);
        
        await lessonCreditsService.refundUserCredit(
          userId, 
          `Rezervasyon hatası iadesi: ${lessonData.title}`
        );
        
        throw bookingError;
      }
    } catch (error) {
      console.error('Error booking lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Rezervasyon yapılırken hata oluştu.'
      };
    }
  },

  // Get lessons for a specific day
  getLessonsByDay: async (dayOfWeek) => {
    try {
      // Get all lessons first, then filter by day and status on client side
      const q = query(collection(db, 'lessons'));
      
      const querySnapshot = await getDocs(q);
      const lessons = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Filter by day of week, active status, and not past dates
        if (data.dayOfWeek === dayOfWeek && data.status === 'active' && data.scheduledDate) {
          const lessonDate = new Date(data.scheduledDate);
          
          // Only include lessons from today onwards
          if (lessonDate >= today) {
            lessons.push({
              id: doc.id,
              ...data
            });
          }
        }
      });
      
      // Sort by start time on client side
      lessons.sort((a, b) => {
        try {
          // Convert time strings to comparable format
          const timeA = a.startTime.replace(':', '');
          const timeB = b.startTime.replace(':', '');
          return parseInt(timeA) - parseInt(timeB);
        } catch (error) {
          return 0;
        }
      });
      
      return {
        success: true,
        lessons: lessons
      };
    } catch (error) {
      console.error('Error getting lessons by day:', error);
      return {
        success: false,
        error: error.code,
        message: 'Günlük dersler alınırken hata oluştu.'
      };
    }
  }
};

// Helper function to format date - returns structured data for translation
const formatDate = (dateString) => {
  if (!dateString) return { type: 'error', value: 'no_date' };

  try {
    let date;

    // Handle different date formats
    if (typeof dateString === 'string') {
      date = new Date(dateString);
    } else if (dateString instanceof Date) {
      date = dateString;
    } else if (dateString.seconds) {
      date = new Date(dateString.seconds * 1000);
    } else {
      return { type: 'error', value: 'invalid_format' };
    }

    if (isNaN(date.getTime())) {
      return { type: 'error', value: 'invalid_date' };
    }

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Return structured data that can be translated by screens
    if (date.toDateString() === today.toDateString()) {
      return { type: 'relative', value: 'today', date: date };
    }

    if (date.toDateString() === tomorrow.toDateString()) {
      return { type: 'relative', value: 'tomorrow', date: date };
    }

    return { type: 'formatted', value: date, date: date };
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return { type: 'error', value: 'format_error' };
  }
};

// Helper function to group lessons by date
const groupLessonsByDate = (lessons) => {
  const grouped = {};
  
  lessons.forEach(lesson => {
    // Handle cases where scheduledDate might be undefined or null
    if (!lesson.scheduledDate) {
      console.warn('Lesson missing scheduledDate:', lesson.id);
      return; // Skip this lesson
    }
    
    let dateKey;
    try {
      // Handle different date formats
      if (typeof lesson.scheduledDate === 'string') {
        dateKey = lesson.scheduledDate.includes('T') 
          ? lesson.scheduledDate.split('T')[0] 
          : lesson.scheduledDate.split(' ')[0]; // Handle space-separated format
      } else {
        // If it's a Date object, convert to string
        const dateObj = new Date(lesson.scheduledDate);
        dateKey = dateObj.toISOString().split('T')[0];
      }
    } catch (error) {
      console.warn('Error parsing date for lesson:', lesson.id, lesson.scheduledDate);
      return; // Skip this lesson
    }
    
    const formattedDate = lesson.formattedDate || formatDate(lesson.scheduledDate);
    
    if (!grouped[dateKey]) {
      grouped[dateKey] = {
        date: dateKey,
        formattedDate: formattedDate,
        lessons: []
      };
    }
    
    grouped[dateKey].lessons.push(lesson);
  });
  
  // Convert to array and sort by date
  const groupedArray = Object.values(grouped).sort((a, b) => {
    return new Date(a.date) - new Date(b.date);
  });
  
  // Sort lessons within each date group by start time
  groupedArray.forEach(dateGroup => {
    dateGroup.lessons.sort((a, b) => {
      try {
        // Convert time strings (like "08:30") to comparable numbers
        const timeA = a.startTime.replace(':', '');
        const timeB = b.startTime.replace(':', '');
        return parseInt(timeA) - parseInt(timeB);
      } catch (error) {
        console.warn('Error sorting lessons by time:', error);
        return 0;
      }
    });
  });
  
  return groupedArray;
};

// Helper function to get category info
export const getCategoryInfo = (title) => {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('hatha') || titleLower.includes('yoga')) {
    return {
      name: 'Hatha Yoga',
      icon: 'leaf-outline',
      color: '#6B7F6A'
    };
  } else if (titleLower.includes('vinyasa')) {
    return {
      name: 'Vinyasa Yoga',
      icon: 'flower-outline',
      color: '#10B981'
    };
  } else if (titleLower.includes('pilates')) {
    return {
      name: 'Pilates',
      icon: 'fitness-outline',
      color: '#F59E0B'
    };
  } else if (titleLower.includes('meditation') || titleLower.includes('meditasyon')) {
    return {
      name: 'Meditation',
      icon: 'heart-outline',
      color: '#EF4444'
    };
  } else {
    return {
      name: 'General',
      icon: 'body-outline',
      color: '#6B7280'
    };
  }
};

// Enhanced helper functions using real lesson type data
const getTrainingType = (lessonTitle, lessonTypeInfo) => {
  if (lessonTypeInfo) {
    return lessonTypeInfo.description || lessonTypeInfo.name;
  }
  
  // Fallback to title-based logic
  const titleLower = lessonTitle.toLowerCase();
  if (titleLower.includes('hatha')) return 'Traditional Hatha Yoga';
  if (titleLower.includes('vinyasa')) return 'Dynamic Vinyasa Flow';
  if (titleLower.includes('pilates')) return 'Core Strengthening Pilates';
  if (titleLower.includes('meditation') || titleLower.includes('meditasyon')) return 'Mindfulness Meditation';
  if (titleLower.includes('restorative')) return 'Restorative Yoga';
  if (titleLower.includes('power')) return 'Power-Focused Training';
  if (titleLower.includes('yin')) return 'Deep Stretch Yin Yoga';
  if (titleLower.includes('reformer')) return 'Reformer Pilates';
  return 'General Wellness Training';
};

const getEquipmentNeeded = (lessonTitle, lessonTypeInfo) => {
  // If lesson type has equipment info, use it
  if (lessonTypeInfo && lessonTypeInfo.equipment) {
    return lessonTypeInfo.equipment.join(', ');
  }
  
  // Fallback to title-based logic
  const titleLower = lessonTitle.toLowerCase();
  if (titleLower.includes('reformer')) return 'Reformer Equipment';
  if (titleLower.includes('pilates')) return 'Mat, Pilates Ball, Block';
  if (titleLower.includes('restorative') || titleLower.includes('yin')) return 'Bolster, Blanket, Block';
  if (titleLower.includes('power') || titleLower.includes('vinyasa')) return 'Mat, Yoga Block';
  if (titleLower.includes('meditation')) return 'Meditation Cushion';
  return 'Yoga/Pilates Mat';
};

const getClassBenefits = (lessonTitle, lessonTypeInfo) => {
  // If lesson type has benefits info, use it
  if (lessonTypeInfo && lessonTypeInfo.benefits) {
    return lessonTypeInfo.benefits;
  }
  
  // Fallback to title-based logic
  const titleLower = lessonTitle.toLowerCase();
  if (titleLower.includes('hatha')) return ['Balance Improvement', 'Mental Relaxation'];
  if (titleLower.includes('vinyasa')) return ['Strength Building', 'Coordination', 'Flow Movement'];
  if (titleLower.includes('pilates')) return ['Core Strength', 'Posture Correction', 'Muscle Control'];
  if (titleLower.includes('meditation')) return ['Mental Calmness', 'Concentration', 'Stress Reduction'];
  if (titleLower.includes('yin')) return ['Deep Stretching', 'Relaxation', 'Inner Peace'];
  if (titleLower.includes('reformer')) return ['Full Body Conditioning', 'Muscle Definition'];
  return ['General Fitness'];
};

// Admin-specific methods for lesson management
const adminLessonService = {
  // Get all lessons for admin
  getAllLessons: async () => {
    try {
      const lessonsQuery = query(
        collection(db, 'lessons'),
        orderBy('scheduledDate', 'desc')
      );

      const [querySnapshot, trainersMap] = await Promise.all([
        getDocs(lessonsQuery),
        fetchTrainersData()
      ]);

      const lessons = querySnapshot.docs.map((lessonDoc) => {
        const data = lessonDoc.data();
        const trainer = data.trainerId ? trainersMap[data.trainerId] : null;

        const participants = data.participants || data.enrolledStudents || [];
        const currentParticipants = data.currentParticipants ?? participants.length;

        return {
          id: lessonDoc.id,
          ...data,
          trainerName:
            trainer?.displayName ||
            data.trainerName ||
            'Bilinmeyen Eğitmen',
          enrolledStudents: data.enrolledStudents || [],
          participants,
          currentParticipants,
        };
      });

      return {
        success: true,
        lessons,
      };
    } catch (error) {
      console.error('Error getting all lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Dersler alınırken hata oluştu.'
      };
    }
  },

  // Cancel a lesson
  cancelLesson: async (lessonId, adminId) => {
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        return {
          success: false,
          message: 'Ders bulunamadı.'
        };
      }
      
      await updateDoc(lessonRef, {
        status: 'cancelled',
        cancelledAt: new Date().toISOString(),
        cancelledBy: adminId,
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Ders başarıyla iptal edildi.'
      };
    } catch (error) {
      console.error('Error cancelling lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders iptal edilirken hata oluştu.'
      };
    }
  },

  // Create a new lesson
  createLesson: async (lessonData) => {
    try {
      const {
        participants,
        enrolledStudents,
        currentParticipants,
        createdAt,
        updatedAt,
        ...rest
      } = lessonData;

      const payload = {
        ...rest,
        participants: Array.isArray(participants) ? participants : [],
        enrolledStudents: Array.isArray(enrolledStudents) ? enrolledStudents : [],
        currentParticipants: Number.isFinite(currentParticipants) ? currentParticipants : 0,
        status: lessonData.status || 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const lessonRef = await addDoc(collection(db, 'lessons'), payload);

      return {
        success: true,
        lessonId: lessonRef.id,
        message: 'Ders başarıyla oluşturuldu.'
      };
    } catch (error) {
      console.error('Error creating lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders oluşturulurken hata oluştu.'
      };
    }
  },

  // Update a lesson
  updateLesson: async (lessonId, updatedData) => {
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        return {
          success: false,
          message: 'Ders bulunamadı.'
        };
      }

      const currentData = lessonDoc.data();
      
      // Validate that maxStudents is not less than current enrolled students
      const enrolledCount = currentData.enrolledStudents?.length || 0;
      if (updatedData.maxStudents && updatedData.maxStudents < enrolledCount) {
        return {
          success: false,
          message: `Maksimum öğrenci sayısı mevcut kayıtlı öğrenci sayısından (${enrolledCount}) az olamaz.`
        };
      }
      
      // Update the lesson
      const fieldsToUpdate = {
        title: updatedData.title,
        description: updatedData.description,
        type: updatedData.type,
        maxStudents: updatedData.maxStudents,
        maxParticipants: updatedData.maxParticipants ?? updatedData.maxStudents,
        duration: updatedData.duration,
        scheduledDate: updatedData.scheduledDate,
        startTime: updatedData.startTime,
        endTime: updatedData.endTime,
        dayOfWeek: updatedData.dayOfWeek,
        trainerId: updatedData.trainerId ?? currentData.trainerId,
        trainerName: updatedData.trainerName ?? currentData.trainerName,
        status: updatedData.status ?? currentData.status ?? 'active',
        level: updatedData.level ?? currentData.level,
        price: updatedData.price ?? currentData.price,
        updatedBy: updatedData.updatedBy,
        updatedAt: serverTimestamp(),
      };

      Object.keys(fieldsToUpdate).forEach((key) => {
        if (typeof fieldsToUpdate[key] === 'undefined') {
          delete fieldsToUpdate[key];
        }
      });

      await updateDoc(lessonRef, fieldsToUpdate);
      
      return {
        success: true,
        message: 'Ders başarıyla güncellendi.'
      };
    } catch (error) {
      console.error('Error updating lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders güncellenirken hata oluştu.'
      };
    }
  },

  copyLessonToFutureWeeks: async (lessonData, weeksToCopy = 0) => {
    try {
      const totalWeeks = parseInt(weeksToCopy, 10);

      if (Number.isNaN(totalWeeks) || totalWeeks < 1) {
        return {
          success: false,
          message: 'Lütfen 1 veya daha büyük bir hafta sayısı girin.',
        };
      }

      const baseDate = new Date(lessonData.scheduledDate);
      if (Number.isNaN(baseDate.getTime())) {
        return {
          success: false,
          message: 'Geçersiz ders tarihi. Lütfen dersi yeniden kaydedin.',
        };
      }

      const {
        participants,
        enrolledStudents,
        currentParticipants,
        createdAt,
        updatedAt,
        id,
        ...rest
      } = lessonData;

      const sanitizedBase = {
        ...rest,
        participants: [],
        enrolledStudents: [],
        currentParticipants: 0,
        status: rest.status || 'active',
      };

      for (let i = 1; i <= totalWeeks; i += 1) {
        const duplicateDate = new Date(baseDate);
        duplicateDate.setDate(duplicateDate.getDate() + i * 7);

        const duplicatePayload = {
          ...sanitizedBase,
          scheduledDate: duplicateDate.toISOString(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        await addDoc(collection(db, 'lessons'), duplicatePayload);
      }

      return {
        success: true,
        createdCount: totalWeeks,
        message: 'Ders diğer haftalara kopyalandı.',
      };
    } catch (error) {
      console.error('Error copying lesson to future weeks:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders kopyalanırken hata oluştu.',
      };
    }
  },

  // Get lesson statistics
  getLessonStats: async () => {
    try {
      const q = query(collection(db, 'lessons'));
      const querySnapshot = await getDocs(q);
      
      let total = 0;
      let upcoming = 0;
      let completed = 0;
      let cancelled = 0;
      const now = new Date();
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        total++;
        
        if (data.status === 'cancelled') {
          cancelled++;
        } else if (data.status === 'completed') {
          completed++;
        } else if (new Date(data.scheduledDate) > now) {
          upcoming++;
        }
      });
      
      return {
        success: true,
        stats: {
          total,
          upcoming,
          completed,
          cancelled
        }
      };
    } catch (error) {
      console.error('Error getting lesson stats:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders istatistikleri alınırken hata oluştu.'
      };
    }
  },

  // Get all students (users with role 'user')
  getAllStudents: async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('role', '==', 'customer')
      );
      
      const querySnapshot = await getDocs(q);
      const students = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        students.push({
          id: doc.id,
          name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          email: data.email,
          phone: data.phone,
          firstName: data.firstName,
          lastName: data.lastName,
          ...data
        });
      });
      
      // Sort by name
      students.sort((a, b) => a.name.localeCompare(b.name));
      
      return {
        success: true,
        students
      };
    } catch (error) {
      console.error('Error getting students:', error);
      return {
        success: false,
        error: error.code,
        message: 'Öğrenciler yüklenirken hata oluştu.'
      };
    }
  },

  // Manually add student to lesson (admin/instructor only)
  addStudentToLesson: async (lessonId, userId, adminId) => {
    try {
      // First, check user's remaining credits
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }
      
      const userData = userDoc.data();
      const remainingCredits = userData.remainingClasses || userData.lessonCredits || 0;

      if (remainingCredits <= 0) {
        return {
          success: false,
          message: 'Öğrencinin kalan dersi yok. Lütfen paket satın almasını sağlayın.'
        };
      }

      // Check if user is frozen
      if (userData.membershipStatus === 'frozen' || userData.status === 'frozen') {
        return {
          success: false,
          message: 'Bu öğrencinin üyeliği dondurulmuş. Dondurulmuş üyeler derse eklenemez.'
        };
      }

      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        return {
          success: false,
          message: 'Ders bulunamadı.'
        };
      }
      
      const lessonData = lessonDoc.data();
      
      // Check if lesson is in the past
      const now = new Date();
      if (lessonData.scheduledDate && lessonData.startTime) {
        let lessonDate;
        if (typeof lessonData.scheduledDate === 'string') {
          lessonDate = new Date(lessonData.scheduledDate);
        } else if (lessonData.scheduledDate.toDate) {
          lessonDate = lessonData.scheduledDate.toDate();
        } else {
          lessonDate = new Date(lessonData.scheduledDate);
        }
        
        const [hours, minutes] = lessonData.startTime.split(':').map(Number);
        lessonDate.setHours(hours, minutes, 0, 0);
        
        if (lessonDate < now) {
          return {
            success: false,
            message: 'Geçmiş bir derse öğrenci eklenemez. Bu ders zaten gerçekleşti.'
          };
        }
      }
      
      const currentParticipants = lessonData.participants ? lessonData.participants.length : 0;
      
      // Check if lesson is full
      if (currentParticipants >= lessonData.maxParticipants) {
        return {
          success: false,
          message: 'Ders dolu. Maksimum katılımcı sayısına ulaşıldı.'
        };
      }
      
      // Check if user is already registered
      if (lessonData.participants && lessonData.participants.includes(userId)) {
        return {
          success: false,
          message: 'Öğrenci zaten bu derse kayıtlı.'
        };
      }
      
      // Deduct one credit from user
      await updateDoc(userRef, {
        remainingClasses: remainingCredits - 1,
        lessonCredits: remainingCredits - 1,
        updatedAt: serverTimestamp()
      });
      
      // Add user to participants
      await updateDoc(lessonRef, {
        participants: arrayUnion(userId),
        updatedAt: serverTimestamp(),
        updatedBy: adminId
      });

      // Create booking history record
      try {
        await bookingHistoryService.createBookingHistory(userId, lessonId, {
          ...lessonData,
          id: lessonId
        }, 'admin_added');
      } catch (historyError) {
        console.warn('⚠️ Could not create booking history:', historyError);
      }
      
      return {
        success: true,
        message: `Öğrenci derse başarıyla eklendi. Kalan ders: ${remainingCredits - 1}`,
        remainingCredits: remainingCredits - 1
      };
    } catch (error) {
      console.error('Error adding student to lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Öğrenci eklenirken hata oluştu.'
      };
    }
  },

  // Remove student from lesson (admin/instructor only)
  removeStudentFromLesson: async (lessonId, userId, adminId) => {
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
      
      // Check if lesson is in the past
      const now = new Date();
      if (lessonData.scheduledDate && lessonData.startTime) {
        let lessonDate;
        if (typeof lessonData.scheduledDate === 'string') {
          lessonDate = new Date(lessonData.scheduledDate);
        } else if (lessonData.scheduledDate.toDate) {
          lessonDate = lessonData.scheduledDate.toDate();
        } else {
          lessonDate = new Date(lessonData.scheduledDate);
        }
        
        const [hours, minutes] = lessonData.startTime.split(':').map(Number);
        lessonDate.setHours(hours, minutes, 0, 0);
        
        if (lessonDate < now) {
          return {
            success: false,
            message: 'Geçmiş bir dersten öğrenci çıkarılamaz. Bu ders zaten gerçekleşti.'
          };
        }
      }
      
      // Check if user is registered
      if (!lessonData.participants || !lessonData.participants.includes(userId)) {
        return {
          success: false,
          message: 'Öğrenci bu derse kayıtlı değil.'
        };
      }
      
      // Refund credit to user
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const currentCredits = userData.remainingClasses || userData.lessonCredits || 0;
        
        await updateDoc(userRef, {
          remainingClasses: currentCredits + 1,
          lessonCredits: currentCredits + 1,
          updatedAt: serverTimestamp()
        });
      }
      
      // Remove user from participants
      await updateDoc(lessonRef, {
        participants: arrayRemove(userId),
        updatedAt: serverTimestamp(),
        updatedBy: adminId
      });

      // Update booking history
      try {
        await bookingHistoryService.createBookingHistory(userId, lessonId, {
          ...lessonData,
          id: lessonId
        }, 'admin_removed');
      } catch (historyError) {
        console.warn('⚠️ Could not create booking history:', historyError);
      }
      
      return {
        success: true,
        message: 'Öğrenci dersten başarıyla çıkarıldı. Ders kredisi iade edildi.'
      };
    } catch (error) {
      console.error('Error removing student from lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Öğrenci çıkarılırken hata oluştu.'
      };
    }
  }
};

// Export both services
export { lessonService as default, adminLessonService };
