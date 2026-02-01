import { collection, query, where, getDocs, orderBy, doc, updateDoc, arrayUnion, arrayRemove, getDoc, addDoc, serverTimestamp, startAt, endAt, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { bookingHistoryService } from './bookingHistoryService';
import { clearUserLessonsCache } from './userLessonService';

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes for supporting data
const LESSONS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for lessons (shorter to reflect bookings)
const DATES_CACHE_TTL = 10 * 60 * 1000; // 10 minutes for available dates (lightweight query)

// Trainers cache
let trainersCache = null;
let trainersCacheTimestamp = 0;

// Lesson types cache
let lessonTypesCache = null;
let lessonTypesCacheTimestamp = 0;

// Status levels cache
let statusLevelsCache = null;
let statusLevelsCacheTimestamp = 0;

// Available dates cache (lightweight - just date strings)
let availableDatesCache = null;
let availableDatesCacheTimestamp = 0;

// Per-date lesson cache with individual timestamps
// { "2024-01-15": { lessons: [...], timestamp: 123456789 } }
let perDateLessonsCache = {};

// All processed lessons cache (indexed by date for fast lookup) - kept for backward compatibility
let allLessonsCache = null;
let allLessonsCacheTimestamp = 0;
let lessonsByDateCache = {}; // { "2024-01-15": [lessons], "2024-01-16": [lessons] }

// Admin caches (kept separate from user-facing caches)
let adminAvailableDatesCache = null;
let adminLessonsByDateCache = {};
let adminAllLessonsCache = null;
let adminLessonsCacheTimestamp = 0;
let adminUpcomingLessonCount = 0;

const fetchTrainersData = async (options = {}) => {
  const forceRefresh = typeof options === 'boolean' ? options : options.forceRefresh;

  if (!forceRefresh && trainersCache && Date.now() - trainersCacheTimestamp < CACHE_TTL) {
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

// Helper function to fetch lesson types from admin settings or use predefined types (with caching)
const fetchLessonTypes = async (forceRefresh = false) => {
  if (!forceRefresh && lessonTypesCache && Date.now() - lessonTypesCacheTimestamp < CACHE_TTL) {
    return lessonTypesCache;
  }
  try {
    const settingsDoc = await getDoc(doc(db, 'settings', 'lessonTypes'));
    const types = settingsDoc.exists() ? (settingsDoc.data().types || getDefaultLessonTypes()) : getDefaultLessonTypes();
    lessonTypesCache = types;
    lessonTypesCacheTimestamp = Date.now();
    return types;
  } catch (error) {
    return lessonTypesCache || getDefaultLessonTypes();
  }
};

// Helper function to fetch lesson status/levels from Firebase (with caching)
const fetchLessonStatus = async (forceRefresh = false) => {
  if (!forceRefresh && statusLevelsCache && Date.now() - statusLevelsCacheTimestamp < CACHE_TTL) {
    return statusLevelsCache;
  }
  try {
    const statusDoc = await getDoc(doc(db, 'settings', 'lessonStatus'));
    const levels = statusDoc.exists() ? (statusDoc.data().levels || getDefaultStatusLevels()) : getDefaultStatusLevels();
    statusLevelsCache = levels;
    statusLevelsCacheTimestamp = Date.now();
    return levels;
  } catch (error) {
    return statusLevelsCache || getDefaultStatusLevels();
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

// Normalize various date shapes (string, Date, Firestore Timestamp) into a Date
const normalizeDateValue = (value) => {
  if (!value) return null;

  let parsed = null;

  if (value instanceof Date) {
    parsed = Number.isNaN(value.getTime()) ? null : value;
  } else if (typeof value?.toDate === 'function') {
    const temp = value.toDate();
    parsed = Number.isNaN(temp.getTime()) ? null : temp;
  } else if (typeof value?.seconds === 'number') {
    const temp = new Date(value.seconds * 1000);
    parsed = Number.isNaN(temp.getTime()) ? null : temp;
  } else if (typeof value === 'string') {
    // Handle date-only strings (e.g., "2026-01-07") by parsing as local time
    // This prevents timezone issues where UTC midnight becomes previous day in some timezones
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      parsed = new Date(year, month - 1, day); // Local time constructor
    } else {
      parsed = new Date(value);
    }
    parsed = (parsed && !Number.isNaN(parsed.getTime())) ? parsed : null;
  }

  return parsed;
};

// Normalize a date to midnight local time for date-only comparisons
const normalizeDateToMidnight = (value) => {
  const date = normalizeDateValue(value);
  if (!date) return null;
  const normalized = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return normalized;
};

// Helper to format a date as local YYYY-MM-DD string (avoids UTC conversion issues)
const formatDateToLocalKey = (date) => {
  if (!date) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper to process a single lesson document into the full lesson object
const processLessonDoc = (docData, docId, trainersMap, lessonTypes, statusLevels) => {
  const trainer = trainersMap[docData.trainerId];
  const lessonTypeInfo = lessonTypes.find(type =>
    type.name.toLowerCase() === docData.type?.toLowerCase() ||
    type.id.toLowerCase() === docData.type?.toLowerCase().replace(/\s+/g, '-')
  );
  const statusInfo = statusLevels.find(level =>
    level.id === (docData.level || 'intermediate') ||
    level.name.toLowerCase() === (docData.level || 'orta').toLowerCase()
  ) || statusLevels.find(level => level.id === 'intermediate');

  const lessonDate = normalizeDateValue(docData.scheduledDate);
  if (!lessonDate) return null;

  const scheduledDateISO = lessonDate.toISOString();

  // Determine lesson package type: prioritize explicit lessonType from Firebase, fallback to maxParticipants
  const resolvedLessonPackageType = docData.lessonType || 
    (docData.maxParticipants === 1 ? 'one-on-one' : 'group');

  return {
    id: docId,
    ...docData,
    scheduledDate: scheduledDateISO,
    formattedDate: scheduledDateISO,
    formattedTime: `${docData.startTime} - ${docData.endTime}`,
    currentParticipants: docData.participants ? docData.participants.length : 0,
    availableSpots: docData.maxParticipants - (docData.participants ? docData.participants.length : 0),
    isRecurring: docData.isRecurring || false,
    lessonType: resolvedLessonPackageType,
    lessonPackageType: resolvedLessonPackageType,
    instructor: trainer ? trainer.displayName : (docData.trainerName || 'No Trainer Information'),
    trainerSpecializations: trainer ? trainer.specializations : [],
    trainerBio: trainer ? trainer.bio : '',
    trainerActive: trainer ? trainer.isActive : false,
    lessonTypeInfo: lessonTypeInfo || {
      name: docData.type || 'General',
      description: 'Lesson description not available',
      icon: 'fitness-outline',
      color: '#6B7280'
    },
    statusInfo: statusInfo,
    statusLevel: statusInfo?.name,
    statusColor: statusInfo?.color,
    trainingType: getTrainingType(docData.type || docData.title, lessonTypeInfo),
    difficulty: docData.level || 'intermediate',
    equipment: getEquipmentNeeded(docData.type || docData.title, lessonTypeInfo),
    benefits: getClassBenefits(docData.type || docData.title, lessonTypeInfo),
  };
};

// Helper to fetch and cache all lessons with date indexing
const fetchAndCacheAllLessons = async (forceRefresh = false) => {
  // Return from cache if valid
  if (!forceRefresh && allLessonsCache && Date.now() - allLessonsCacheTimestamp < CACHE_TTL) {
    return { lessons: allLessonsCache, byDate: lessonsByDateCache };
  }

  // Fetch supporting data from cache (fast)
  const [trainersMap, lessonTypes, statusLevels] = await Promise.all([
    fetchTrainersData(),
    fetchLessonTypes(),
    fetchLessonStatus()
  ]);

  // Fetch all active lessons once
  const lessonsSnapshot = await getDocs(query(collection(db, 'lessons'), where('status', '==', 'active')));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const allLessons = [];
  const byDate = {};

  lessonsSnapshot.forEach((doc) => {
    const data = doc.data();
    if (!data.scheduledDate || !data.startTime || !data.endTime) return;

    const lessonDate = normalizeDateToMidnight(data.scheduledDate);
    if (!lessonDate || lessonDate < today) return;

    const processedLesson = processLessonDoc(data, doc.id, trainersMap, lessonTypes, statusLevels);
    if (!processedLesson) return;

    allLessons.push(processedLesson);

    // Index by date - use local date key to avoid UTC issues
    const dateKey = formatDateToLocalKey(lessonDate);
    if (!byDate[dateKey]) {
      byDate[dateKey] = [];
    }
    byDate[dateKey].push(processedLesson);
  });

  // Sort lessons within each date by start time
  Object.keys(byDate).forEach(dateKey => {
    byDate[dateKey].sort((a, b) => {
      const timeA = (a.startTime || '').replace(':', '');
      const timeB = (b.startTime || '').replace(':', '');
      return (parseInt(timeA) || 0) - (parseInt(timeB) || 0);
    });
  });

  // Update cache
  allLessonsCache = allLessons;
  lessonsByDateCache = byDate;
  allLessonsCacheTimestamp = Date.now();

  // Also update available dates cache
  availableDatesCache = Object.keys(byDate).sort();
  availableDatesCacheTimestamp = Date.now();

  return { lessons: allLessons, byDate };
};

// OPTIMIZED: Fetch only available dates without loading all lesson data
// Uses date range query for efficiency (next 60 days)
const fetchAvailableDatesOnly = async (forceRefresh = false) => {
  // Return from cache if valid
  if (!forceRefresh && availableDatesCache && Date.now() - availableDatesCacheTimestamp < DATES_CACHE_TTL) {
    return availableDatesCache;
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateToLocalKey(today);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 60);
    const maxDateStr = formatDateToLocalKey(maxDate);

    // Try date range query first
    let lessonsSnapshot;
    let usedRangeQuery = false;

    try {
      lessonsSnapshot = await getDocs(
        query(
          collection(db, 'lessons'),
          where('status', '==', 'active'),
          where('scheduledDate', '>=', todayStr),
          where('scheduledDate', '<=', maxDateStr)
        )
      );
      usedRangeQuery = true;
    } catch (rangeError) {
      // Fallback
      lessonsSnapshot = await getDocs(
        query(collection(db, 'lessons'), where('status', '==', 'active'))
      );
    }

    const datesSet = new Set();

    lessonsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (!data.scheduledDate) return;

      const lessonDate = normalizeDateToMidnight(data.scheduledDate);
      if (!lessonDate) return;

      // Client-side filtering if range query wasn't used
      if (!usedRangeQuery && (lessonDate < today || lessonDate > maxDate)) return;

      const dateKey = formatDateToLocalKey(lessonDate);
      datesSet.add(dateKey);
    });

    const sortedDates = Array.from(datesSet).sort();

    // Update cache
    availableDatesCache = sortedDates;
    availableDatesCacheTimestamp = Date.now();

    console.log(`⚡ Available dates: ${sortedDates.length} (range query: ${usedRangeQuery})`);
    return sortedDates;
  } catch (error) {
    console.error('Error fetching available dates:', error);
    return availableDatesCache || [];
  }
};

// ULTRA-OPTIMIZED: Fetch everything in a single pass
// This fetches lessons, dates, and processes them in ONE Firebase query
// Supporting data (trainers, types, status) uses defaults on first load for speed
// Limits to next 60 days to keep initial load fast
const fetchInitialDataOptimized = async () => {
  try {
    console.log('⚡ Starting optimized initial fetch...');
    const startTime = Date.now();

    // Start supporting data fetch in background (non-blocking)
    const supportingDataPromise = Promise.all([
      fetchTrainersData(),
      fetchLessonTypes(),
      fetchLessonStatus()
    ]);

    // Calculate date range limits (today to 60 days from now)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateToLocalKey(today);

    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + 60); // Limit to 60 days
    const maxDateStr = formatDateToLocalKey(maxDate);

    // Try date-range query first (most efficient if scheduledDate is stored as string)
    let lessonsSnapshot;
    let usedRangeQuery = false;

    try {
      lessonsSnapshot = await getDocs(
        query(
          collection(db, 'lessons'),
          where('status', '==', 'active'),
          where('scheduledDate', '>=', todayStr),
          where('scheduledDate', '<=', maxDateStr)
        )
      );
      usedRangeQuery = true;
      console.log(`⚡ Used date range query: ${lessonsSnapshot.size} lessons`);
    } catch (rangeError) {
      // Fallback to fetching all and filtering client-side
      console.warn('⚠️ Date range query failed, using client-side filter');
      lessonsSnapshot = await getDocs(
        query(collection(db, 'lessons'), where('status', '==', 'active'))
      );
    }

    const datesSet = new Set();
    const rawLessonsByDate = {};

    // First pass: collect dates and raw lesson data (fast, no processing)
    lessonsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (!data.scheduledDate || !data.startTime || !data.endTime) return;

      const lessonDate = normalizeDateToMidnight(data.scheduledDate);
      if (!lessonDate) return;

      // Client-side date filtering (needed if range query wasn't used)
      if (!usedRangeQuery) {
        if (lessonDate < today || lessonDate > maxDate) return;
      }

      const dateKey = formatDateToLocalKey(lessonDate);
      datesSet.add(dateKey);

      if (!rawLessonsByDate[dateKey]) {
        rawLessonsByDate[dateKey] = [];
      }
      rawLessonsByDate[dateKey].push({ id: docSnapshot.id, data });
    });

    const sortedDates = Array.from(datesSet).sort();

    // Update dates cache immediately
    availableDatesCache = sortedDates;
    availableDatesCacheTimestamp = Date.now();

    // Wait for supporting data (usually fast, already started)
    const [trainersMap, lessonTypes, statusLevels] = await supportingDataPromise;

    // Process lessons for all dates at once
    Object.keys(rawLessonsByDate).forEach(dateKey => {
      const lessons = rawLessonsByDate[dateKey].map(({ id, data }) => 
        processLessonDoc(data, id, trainersMap, lessonTypes, statusLevels)
      ).filter(Boolean);

      // Sort by start time
      lessons.sort((a, b) => {
        const timeA = (a.startTime || '').replace(':', '');
        const timeB = (b.startTime || '').replace(':', '');
        return (parseInt(timeA) || 0) - (parseInt(timeB) || 0);
      });

      // Cache each date's lessons
      perDateLessonsCache[dateKey] = {
        lessons,
        timestamp: Date.now()
      };
      lessonsByDateCache[dateKey] = lessons;
    });

    console.log(`✅ Optimized fetch complete in ${Date.now() - startTime}ms - ${sortedDates.length} dates, ${lessonsSnapshot.size} lessons`);

    return {
      dates: sortedDates,
      lessonsByDate: lessonsByDateCache
    };
  } catch (error) {
    console.error('Error in optimized initial fetch:', error);
    return { dates: [], lessonsByDate: {} };
  }
};

// OPTIMIZED: Fetch lessons for a single date only
// Uses direct scheduledDate query for maximum efficiency
const fetchLessonsForSingleDate = async (dateString, forceRefresh = false) => {
  // Check per-date cache
  const cachedData = perDateLessonsCache[dateString];
  if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < LESSONS_CACHE_TTL) {
    return cachedData.lessons;
  }

  try {
    // Fetch supporting data from cache (fast, usually already cached)
    const [trainersMap, lessonTypes, statusLevels] = await Promise.all([
      fetchTrainersData(),
      fetchLessonTypes(),
      fetchLessonStatus()
    ]);

    // Try direct date query first (fastest - requires scheduledDate stored as string "YYYY-MM-DD")
    let lessonsSnapshot;
    let usedDirectQuery = false;

    try {
      lessonsSnapshot = await getDocs(
        query(
          collection(db, 'lessons'),
          where('status', '==', 'active'),
          where('scheduledDate', '==', dateString)
        )
      );

      // If direct query returns results, use them
      if (lessonsSnapshot.size > 0) {
        usedDirectQuery = true;
        console.log(`⚡ Direct date query: ${lessonsSnapshot.size} lessons for ${dateString}`);
      } else {
        // Direct query returned 0 results - might be date format mismatch (ISO vs YYYY-MM-DD)
        // Fall back to fetching all and filtering client-side
        console.log(`⚠️ Direct date query returned 0 results for ${dateString}, using client-side filter`);
        lessonsSnapshot = await getDocs(
          query(collection(db, 'lessons'), where('status', '==', 'active'))
        );
      }
    } catch (queryError) {
      // Fallback if composite index doesn't exist or scheduledDate format is different
      console.warn('⚠️ Direct date query failed, using client-side filter');
      lessonsSnapshot = await getDocs(
        query(collection(db, 'lessons'), where('status', '==', 'active'))
      );
    }

    const lessons = [];

    lessonsSnapshot.forEach((docSnapshot) => {
      const data = docSnapshot.data();
      if (!data.scheduledDate || !data.startTime || !data.endTime) return;

      // If we used direct query, all docs are for the right date
      // Otherwise, filter client-side
      if (!usedDirectQuery) {
        const lessonDate = normalizeDateValue(data.scheduledDate);
        if (!lessonDate) return;

        const year = lessonDate.getFullYear();
        const month = String(lessonDate.getMonth() + 1).padStart(2, '0');
        const day = String(lessonDate.getDate()).padStart(2, '0');
        const lessonDateKey = `${year}-${month}-${day}`;
        if (lessonDateKey !== dateString) return;
      }

      const processedLesson = processLessonDoc(data, docSnapshot.id, trainersMap, lessonTypes, statusLevels);
      if (processedLesson) {
        lessons.push(processedLesson);
      }
    });

    // Sort by start time
    lessons.sort((a, b) => {
      const timeA = (a.startTime || '').replace(':', '');
      const timeB = (b.startTime || '').replace(':', '');
      return (parseInt(timeA) || 0) - (parseInt(timeB) || 0);
    });

    // Cache the result for this date
    perDateLessonsCache[dateString] = {
      lessons,
      timestamp: Date.now()
    };

    // Also update the byDate cache for backward compatibility
    lessonsByDateCache[dateString] = lessons;

    return lessons;
  } catch (error) {
    console.error(`Error fetching lessons for date ${dateString}:`, error);
    return cachedData?.lessons || [];
  }
};

// Clear per-date cache for a specific date (useful when bookings change)
const invalidateDateCache = (dateString) => {
  if (dateString) {
    delete perDateLessonsCache[dateString];
    delete lessonsByDateCache[dateString];
  }
};

// Clear all lesson caches
const clearAllLessonCaches = () => {
  perDateLessonsCache = {};
  lessonsByDateCache = {};
  allLessonsCache = null;
  allLessonsCacheTimestamp = 0;
  availableDatesCache = null;
  availableDatesCacheTimestamp = 0;
};

// Preload supporting data to warm up caches (call early in app lifecycle)
// This loads trainers, lesson types, and status levels in parallel
const preloadSupportingData = async () => {
  try {
    await Promise.all([
      fetchTrainersData(),
      fetchLessonTypes(),
      fetchLessonStatus()
    ]);
    console.log('✅ Lesson service supporting data preloaded');
  } catch (error) {
    console.warn('⚠️ Error preloading supporting data:', error);
  }
};

export const lessonService = {
  // Get lesson types
  getLessonTypes: fetchLessonTypes,

  // Get lesson status levels
  getLessonStatus: fetchLessonStatus,

  // Get trainers data
  getTrainersData: fetchTrainersData,

  // Cache invalidation utilities
  invalidateDateCache,
  clearAllLessonCaches,

  // Preload supporting data for faster ClassSelectionScreen load
  preloadSupportingData,

  // ULTRA-FAST: Get all data in single optimized fetch (dates + all lessons)
  // Use this for initial screen load - only 1 Firebase query + parallel supporting data
  getInitialData: async () => {
    try {
      // Check if we have valid cached data
      if (availableDatesCache && 
          Date.now() - availableDatesCacheTimestamp < DATES_CACHE_TTL &&
          Object.keys(perDateLessonsCache).length > 0) {
        return {
          success: true,
          dates: availableDatesCache,
          lessonsByDate: lessonsByDateCache,
          fromCache: true
        };
      }

      const result = await fetchInitialDataOptimized();
      return {
        success: true,
        dates: result.dates,
        lessonsByDate: result.lessonsByDate,
        fromCache: false
      };
    } catch (error) {
      console.error('Error in getInitialData:', error);
      return { success: false, dates: [], lessonsByDate: {}, error: error.message };
    }
  },

  // OPTIMIZED: Get available dates (lightweight query, doesn't load all lessons)
  getAvailableDates: async (forceRefresh = false) => {
    try {
      const dates = await fetchAvailableDatesOnly(forceRefresh);
      return { success: true, dates };
    } catch (error) {
      console.error('Error fetching available dates:', error);
      return { success: false, dates: availableDatesCache || [], error: error.message };
    }
  },

  // OPTIMIZED: Get lessons for a specific date (fetches only that date's lessons)
  getLessonsByDate: async (dateString, forceRefresh = false) => {
    try {
      // Check per-date cache first
      const cachedData = perDateLessonsCache[dateString];
      if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < LESSONS_CACHE_TTL) {
        return {
          success: true,
          date: dateString,
          lessons: cachedData.lessons,
          fromCache: true
        };
      }

      // Fetch lessons for this specific date only
      const lessons = await fetchLessonsForSingleDate(dateString, forceRefresh);

      return {
        success: true,
        date: dateString,
        lessons,
        fromCache: false
      };
    } catch (error) {
      console.error('Error fetching lessons by date:', error);
      return { success: false, date: dateString, lessons: [], error: error.message };
    }
  },

  // Get all active lessons grouped by date (keep for backward compatibility but mark as heavy)
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
          // Check if lesson is not in the past - normalize to midnight for comparison
          const lessonDate = normalizeDateToMidnight(data.scheduledDate);
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Set to start of day for comparison
          
          if (!lessonDate) {
            return;
          }

          // Use a normalized ISO string so downstream components get consistent values
          const scheduledDateISO = normalizeDateValue(data.scheduledDate).toISOString();

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
            
            // Determine lesson package type: prioritize explicit lessonType from Firebase, fallback to maxParticipants
            const resolvedLessonPackageType = data.lessonType || 
              (data.maxParticipants === 1 ? 'one-on-one' : 'group');
            
            lessons.push({
              id: doc.id,
              ...data,
              // Format the data for easier use
              scheduledDate: scheduledDateISO,
              formattedDate: scheduledDateISO, // Store normalized date string for translation in screens
              formattedTime: `${data.startTime} - ${data.endTime}`,
              currentParticipants: data.participants ? data.participants.length : 0,
              availableSpots: data.maxParticipants - (data.participants ? data.participants.length : 0),
              isRecurring: data.isRecurring || false,
              // Package type information - use resolved value
              lessonType: resolvedLessonPackageType,
              lessonPackageType: resolvedLessonPackageType,
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
        }
      });
      
      // Sort by scheduled date and time on client side
      lessons.sort((a, b) => {
        const dateTimeA = normalizeDateValue(a.scheduledDate);
        const dateTimeB = normalizeDateValue(b.scheduledDate);
        if (!dateTimeA || !dateTimeB) return 0;
        return dateTimeA - dateTimeB;
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
          const lessonDate = normalizeDateToMidnight(data.scheduledDate);
          
          // Only include lessons from today onwards
          if (lessonDate && lessonDate >= today) {
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
          const dateA = normalizeDateValue(a.scheduledDate);
          const dateB = normalizeDateValue(b.scheduledDate);
          if (!dateA || !dateB) return 0;
          
          // Set times for proper comparison
          if (a.startTime) {
            const [h, m] = a.startTime.split(':').map(Number);
            dateA.setHours(h || 0, m || 0, 0, 0);
          }
          if (b.startTime) {
            const [h, m] = b.startTime.split(':').map(Number);
            dateB.setHours(h || 0, m || 0, 0, 0);
          }
          
          return dateA - dateB;
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
          
          const lessonDate = normalizeDateToMidnight(data.scheduledDate);
          
          // Only include lessons from today onwards
          if (lessonDate && lessonDate >= today) {
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
      
      // Get lesson data early to check lesson date against membership start date
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonDoc = await getDoc(lessonRef);
      
      if (!lessonDoc.exists()) {
        return {
          success: false,
          message: 'Lesson not found.'
        };
      }
      
      const lessonData = lessonDoc.data();
      
      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if user is deleted
        if (userData.status === 'deleted' || userData.status === 'permanently_deleted') {
          return {
            success: false,
            messageKey: 'classes.accountDeleted'
          };
        }

        // Check if membership is cancelled
        if (userData.membershipStatus === 'cancelled' || userData.status === 'cancelled') {
          return {
            success: false,
            messageKey: 'classes.membershipCancelled'
          };
        }

        // Check if user has a package that covers this lesson date (multi-package support)
        const { adminService } = await import('./adminService');
        const lessonScheduledDate = normalizeDateValue(lessonData.scheduledDate);

        if (lessonScheduledDate) {
          const canBookResult = await adminService.canBookLessonOnDate(userId, lessonScheduledDate);
          if (!canBookResult.canBook) {
            return {
              success: false,
              messageKey: canBookResult.reason === 'noPackageForDate'
                ? 'classes.noPackageForDate'
                : 'classes.packageExpiredForLesson',
              message: canBookResult.message
            };
          }
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

        // Allow booking lessons that are on or after the membership start date
        // (supports future-dated approvals - user can book future lessons even before membership starts)
        if (userData.packageStartDate || userData.packageInfo?.assignedAt) {
          const startDateValue = userData.packageStartDate || userData.packageInfo?.assignedAt;
          const membershipStartDate = new Date(startDateValue);
          if (!Number.isNaN(membershipStartDate.getTime())) {
            const normalizedMembershipStartDate = new Date(membershipStartDate);
            normalizedMembershipStartDate.setHours(0, 0, 0, 0);
            
            // Get the lesson's scheduled date
            const lessonScheduledDate = normalizeDateValue(lessonData.scheduledDate);
            if (lessonScheduledDate) {
              lessonScheduledDate.setHours(0, 0, 0, 0);
              
              // If lesson date is before membership start date, prevent booking
              if (lessonScheduledDate < normalizedMembershipStartDate) {
                return {
                  success: false,
                  messageKey: 'classes.membershipNotStarted'
                };
              }
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
      
      // lessonRef, lessonDoc, and lessonData already fetched above
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

      // Check if lesson is too close to start (must be at least 2 hours before)
      try {
        const lessonDateTime = normalizeDateValue(lessonData.scheduledDate);
        if (lessonDateTime && lessonData.startTime) {
          const [hours, minutes] = lessonData.startTime.split(':').map(Number);
          lessonDateTime.setHours(hours || 0, minutes || 0, 0, 0);
        }

        const now = new Date();
        const timeDiff = lessonDateTime ? lessonDateTime.getTime() - now.getTime() : Infinity;
        const hoursUntilLesson = timeDiff / (1000 * 60 * 60);

        if (hoursUntilLesson < 2) {
          return {
            success: false,
            messageKey: 'classSelection.tooLateToBook',
            message: 'Reservations can only be made up to 2 hours before the lesson starts.'
          };
        }
      } catch (timeError) {
        console.warn('Time check error:', timeError);
        // If we can't check time properly, allow booking
      }

      // Deduct lesson from the appropriate package using multi-package system
      const { adminService } = await import('./adminService');
      const lessonDateForDeduction = lessonData.scheduledDate;

      const deductResult = await adminService.deductLessonFromPackage(
        userId,
        lessonDateForDeduction,
        `${lessonData.title} - ${lessonData.scheduledDate}`
      );

      if (!deductResult.success) {
        return {
          success: false,
          messageKey: deductResult.noPackageForDate ? 'classes.noPackageForDate' : 'classes.insufficientCredits',
          message: deductResult.error || 'Error occurred while using lesson credit.'
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

        // Clear user lessons cache after successful booking
        clearUserLessonsCache(userId);

        // Invalidate the per-date cache for this lesson's date so UI updates immediately
        const lessonDate = normalizeDateValue(lessonData.scheduledDate);
        if (lessonDate) {
          const dateKey = formatDateToLocalKey(lessonDate);
          invalidateDateCache(dateKey);
        }

        return {
          success: true,
          messageKey: 'classSelection.bookingSuccessMessage',
          remainingCredits: deductResult.totalRemaining,
          deductedFromPackage: deductResult.packageName
        };
      } catch (bookingError) {
        // If booking fails after consuming credit, we should ideally refund
        // For now, log the error - refund logic can be added if needed
        console.error('❌ Booking failed after deducting credit:', bookingError);
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
          const lessonDate = normalizeDateToMidnight(data.scheduledDate);
          
          // Only include lessons from today onwards
          if (lessonDate && lessonDate >= today) {
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
    if (!lesson.scheduledDate) return;
    const parsedDate = normalizeDateValue(lesson.scheduledDate);
    if (!parsedDate) return;

    const dateKey = formatDateToLocalKey(parsedDate);
    const formattedDate = lesson.formattedDate || formatDate(parsedDate);

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
      const timeA = (a.startTime || '').replace(':', '');
      const timeB = (b.startTime || '').replace(':', '');
      return (parseInt(timeA) || 0) - (parseInt(timeB) || 0);
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

const getAdminDateKey = (value) => {
  const normalized = normalizeDateValue(value);
  if (!normalized) return null;
  return formatDateToLocalKey(normalized);
};

const fetchAndCacheAdminLessons = async (options = {}) => {
  const normalizedOptions = typeof options === 'boolean' ? { forceRefresh: options } : options;
  const {
    forceRefresh = false,
    pastDays = 0,
    futureDays = 120,
  } = normalizedOptions;

  const cacheIsValid = !forceRefresh &&
    adminAllLessonsCache &&
    Date.now() - adminLessonsCacheTimestamp < LESSONS_CACHE_TTL;

  if (cacheIsValid) {
    return { lessons: adminAllLessonsCache, byDate: adminLessonsByDateCache };
  }

  const [trainersMap, lessonTypes, statusLevels] = await Promise.all([
    fetchTrainersData(),
    fetchLessonTypes(),
    fetchLessonStatus()
  ]);

  const now = new Date();
  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - pastDays);

  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  endDate.setDate(endDate.getDate() + futureDays);

  const lessonsQuery = query(
    collection(db, 'lessons'),
    orderBy('scheduledDate'),
    startAt(startDate.toISOString()),
    endAt(endDate.toISOString())
  );

  const querySnapshot = await getDocs(lessonsQuery);

  const lessons = [];
  const byDate = {};

  querySnapshot.forEach((lessonDoc) => {
    const data = lessonDoc.data();
    const lessonDate = normalizeDateValue(data.scheduledDate);
    if (!lessonDate) return;

    // Double-check bounds in case of mixed data types
    if (lessonDate < startDate || lessonDate > endDate) return;

    const processedLesson = processLessonDoc(data, lessonDoc.id, trainersMap, lessonTypes, statusLevels);
    if (!processedLesson) return;

    lessons.push(processedLesson);

    const dateKey = getAdminDateKey(lessonDate);
    if (!byDate[dateKey]) {
      byDate[dateKey] = [];
    }
    byDate[dateKey].push(processedLesson);
  });

  Object.keys(byDate).forEach((dateKey) => {
    byDate[dateKey].sort((a, b) => {
      const timeA = (a.startTime || '').replace(':', '');
      const timeB = (b.startTime || '').replace(':', '');
      return (parseInt(timeA, 10) || 0) - (parseInt(timeB, 10) || 0);
    });
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  adminUpcomingLessonCount = lessons.filter((lesson) => {
    const parsedDate = normalizeDateValue(lesson.scheduledDate);
    if (!parsedDate) return false;
    parsedDate.setHours(0, 0, 0, 0);
    return parsedDate >= todayStart && lesson.status !== 'cancelled';
  }).length;

  adminAllLessonsCache = lessons;
  adminLessonsByDateCache = byDate;
  adminAvailableDatesCache = Object.keys(byDate).sort();
  adminLessonsCacheTimestamp = Date.now();

  return { lessons, byDate };
};

// Admin-specific methods for lesson management
const adminLessonService = {
  // Lightweight date list for admin (uses filtered window)
  getAvailableDates: async (options = {}) => {
    const normalizedOptions = typeof options === 'boolean' ? { forceRefresh: options } : options;
    const {
      forceRefresh = false,
      pastDays = 0,
      futureDays = 120,
    } = normalizedOptions;

    try {
      await fetchAndCacheAdminLessons({ forceRefresh, pastDays, futureDays });

      return {
        success: true,
        dates: adminAvailableDatesCache || [],
        totalLessons: adminAllLessonsCache?.length || 0,
        upcomingLessons: adminUpcomingLessonCount,
      };
    } catch (error) {
      console.error('Error getting admin available dates:', error);
      return {
        success: false,
        dates: adminAvailableDatesCache || [],
        totalLessons: adminAllLessonsCache?.length || 0,
        upcomingLessons: adminUpcomingLessonCount,
        message: 'Ders tarihleri alınırken hata oluştu.'
      };
    }
  },

  // Get lessons for a specific date (cached per day)
  getLessonsByDate: async (dateString, options = {}) => {
    const normalizedOptions = typeof options === 'boolean' ? { forceRefresh: options } : options;
    const {
      forceRefresh = false,
      pastDays = 0,
      futureDays = 120,
    } = normalizedOptions;

    try {
      const cacheIsValid = adminAllLessonsCache &&
        !forceRefresh &&
        Date.now() - adminLessonsCacheTimestamp < LESSONS_CACHE_TTL;

      if (!cacheIsValid) {
        await fetchAndCacheAdminLessons({ forceRefresh, pastDays, futureDays });
      }

      return {
        success: true,
        date: dateString,
        lessons: adminLessonsByDateCache[dateString] || [],
        totalLessons: adminAllLessonsCache?.length || 0,
        upcomingLessons: adminUpcomingLessonCount,
      };
    } catch (error) {
      console.error('Error getting admin lessons by date:', error);
      return {
        success: false,
        date: dateString,
        lessons: [],
        totalLessons: adminAllLessonsCache?.length || 0,
        upcomingLessons: adminUpcomingLessonCount,
        message: 'Dersler alınırken hata oluştu.'
      };
    }
  },

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
        const normalizedDate = normalizeDateValue(data.scheduledDate);
        const scheduledDate = normalizedDate ? normalizedDate.toISOString() : data.scheduledDate;

        const participants = data.participants || data.enrolledStudents || [];
        const currentParticipants = data.currentParticipants ?? participants.length;

        return {
          id: lessonDoc.id,
          ...data,
          scheduledDate,
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

  // Permanently delete a lesson
  deleteLesson: async (lessonId) => {
    try {
      await deleteDoc(doc(db, 'lessons', lessonId));
      return {
        success: true,
        message: 'Ders silindi.'
      };
    } catch (error) {
      console.error('Error deleting lesson:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders silinirken hata oluştu.'
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

      const baseDate = normalizeDateValue(lessonData.scheduledDate);
      if (!baseDate || Number.isNaN(baseDate.getTime())) {
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
        } else {
          const lessonDate = normalizeDateValue(data.scheduledDate);
          if (lessonDate && lessonDate > now) {
            upcoming++;
          }
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

      // Check if user is deleted
      if (userData.status === 'deleted' || userData.status === 'permanently_deleted') {
        return {
          success: false,
          message: 'Bu öğrenci silinmiş. Silinen üyeler derse eklenemez.'
        };
      }

      // Check if user is cancelled
      if (userData.status === 'cancelled' || userData.membershipStatus === 'cancelled') {
        return {
          success: false,
          message: 'Bu öğrencinin üyeliği iptal edilmiş. İptal edilen üyeler derse eklenemez.'
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

      // Check if package has expired for this lesson date
      const packageExpiryDate = userData.packageExpiryDate || userData.packageInfo?.expiryDate;
      if (packageExpiryDate && lessonData.scheduledDate) {
        const expiryDate = new Date(packageExpiryDate);
        expiryDate.setHours(23, 59, 59, 999);

        let lessonDate;
        if (typeof lessonData.scheduledDate === 'string') {
          lessonDate = new Date(lessonData.scheduledDate);
        } else if (lessonData.scheduledDate.toDate) {
          lessonDate = lessonData.scheduledDate.toDate();
        } else {
          lessonDate = new Date(lessonData.scheduledDate);
        }
        lessonDate.setHours(0, 0, 0, 0);

        if (lessonDate > expiryDate) {
          return {
            success: false,
            message: 'Öğrencinin paket süresi bu ders tarihinden önce doluyor. Lütfen paketi yenileyin.'
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
      
      // Clear user lessons cache after admin adds student
      clearUserLessonsCache(userId);
      
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

      // Admin can remove students from past lessons for record-keeping purposes

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
      
      // Clear user lessons cache after admin removes student
      clearUserLessonsCache(userId);
      
      // Invalidate the per-date cache for this lesson's date so UI updates immediately
      const lessonDate = normalizeDateValue(lessonData.scheduledDate);
      if (lessonDate) {
        const dateKey = formatDateToLocalKey(lessonDate);
        invalidateDateCache(dateKey);
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
