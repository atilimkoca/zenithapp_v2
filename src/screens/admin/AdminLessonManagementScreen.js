import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  PanResponder,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { adminLessonService as lessonService } from '../../services/lessonService';
import UniqueHeader from '../../components/UniqueHeader';
import DateCarouselPicker from '../../components/DateCarouselPicker';

export default function AdminLessonManagementScreen({ navigation }) {
  const { user } = useAuth();
  const { language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableDates, setAvailableDates] = useState([]);
  const [currentDateLessons, setCurrentDateLessons] = useState([]);
  const [filteredLessons, setFilteredLessons] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDateKey, setSelectedDateKey] = useState(null);
  const selectedDateRef = useRef(null);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [participantDetails, setParticipantDetails] = useState({});
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [upcomingLessonsCount, setUpcomingLessonsCount] = useState(0);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteCriteria, setDeleteCriteria] = useState({
    dayOfWeek: '',
    startTime: '',
    trainerName: '',
    duration: ''
  });
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const dayOptions = useMemo(() => {
    return Array.from(new Set(currentDateLessons.map(l => l.dayOfWeek).filter(Boolean)));
  }, [currentDateLessons]);

  const timeOptions = useMemo(() => {
    return Array.from(new Set(currentDateLessons.map(l => l.startTime).filter(Boolean)));
  }, [currentDateLessons]);

  const trainerOptions = useMemo(() => {
    return Array.from(new Set(currentDateLessons.map(l => l.trainerName).filter(Boolean)));
  }, [currentDateLessons]);

  const durationOptions = useMemo(() => {
    return Array.from(new Set(currentDateLessons.map(l => l.duration).filter(Boolean)));
  }, [currentDateLessons]);
  const panY = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to vertical swipes down
        return gestureState.dy > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        // Only allow dragging down
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        // If dragged down more than 100px, close the modal
        if (gestureState.dy > 100) {
          Animated.timing(panY, {
            toValue: 500,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            closeLessonDetails();
            panY.setValue(0);
          });
        } else {
          // Otherwise, spring back to original position
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
          }).start();
        }
      },
    })
  ).current;

  const loadAvailableDates = useCallback(async (forceRefresh = false) => {
    try {
      const result = await lessonService.getAvailableDates({ forceRefresh });

      if (result.success) {
        setAvailableDates(result.dates || []);
        if (typeof result.upcomingLessons === 'number') {
          setUpcomingLessonsCount(result.upcomingLessons);
        } else if (typeof result.totalLessons === 'number') {
          setUpcomingLessonsCount(result.totalLessons);
        }
        return result.dates || [];
      }

      return [];
    } catch (error) {
      console.error('Error loading admin available dates:', error);
      return [];
    }
  }, []);

  const loadLessonsForDate = useCallback(async (dateKey, forceRefresh = false) => {
    if (!dateKey) {
      setCurrentDateLessons([]);
      setLoadingLessons(false);
      setLoading(false);
      return [];
    }

    setLoadingLessons(true);
    try {
      const result = await lessonService.getLessonsByDate(dateKey, { forceRefresh });

      if (result.success) {
        const lessonsForDate = result.lessons || [];
        setCurrentDateLessons(lessonsForDate);
        if (typeof result.upcomingLessons === 'number') {
          setUpcomingLessonsCount(result.upcomingLessons);
        } else if (typeof result.totalLessons === 'number') {
          setUpcomingLessonsCount(result.totalLessons);
        }
        return lessonsForDate;
      }

      setCurrentDateLessons([]);
      return [];
    } catch (error) {
      console.error('Error loading lessons for date:', error);
      Alert.alert('Hata', 'Dersler yüklenirken hata oluştu');
      setCurrentDateLessons([]);
      return [];
    } finally {
      setLoadingLessons(false);
      setLoading(false);
    }
  }, []);

  const refreshData = useCallback(async (forceRefresh = false) => {
    const dates = await loadAvailableDates(forceRefresh);
    const preferredDate = selectedDateRef.current;
    const nextDate = (preferredDate && dates.includes(preferredDate)) ? preferredDate : dates[0] || null;
    selectedDateRef.current = nextDate;
    setSelectedDateKey(nextDate);
    await loadLessonsForDate(nextDate, forceRefresh);
    if (!nextDate) {
      setLoading(false);
    }
  }, [loadAvailableDates, loadLessonsForDate]);

  useEffect(() => {
    setLoading(true);
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    let filtered = [...currentDateLessons];

    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(lesson =>
        lesson.title?.toLowerCase().includes(searchLower) ||
        lesson.trainerName?.toLowerCase().includes(searchLower) ||
        lesson.type?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by startTime (time of day) within the same date
    filtered.sort((a, b) => {
      const timeA = (a.startTime || '').replace(':', '');
      const timeB = (b.startTime || '').replace(':', '');
      return (parseInt(timeA) || 0) - (parseInt(timeB) || 0);
    });

    setFilteredLessons(filtered);
  }, [currentDateLessons, searchTerm]);

  // Reload lessons when screen comes back into focus (after editing/creating)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshData(true);
    });

    return unsubscribe;
  }, [navigation, refreshData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData(true);
    setRefreshing(false);
  };

  const handleSelectDate = useCallback((dateKey) => {
    selectedDateRef.current = dateKey;
    setSelectedDateKey(dateKey);
    loadLessonsForDate(dateKey);
  }, [loadLessonsForDate]);

  const handleCancelLesson = async (lessonId, lessonTitle) => {
    Alert.alert(
      'Dersi İptal Et',
      `"${lessonTitle}" dersini iptal etmek istediğinizden emin misiniz?`,
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet, İptal Et',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await lessonService.cancelLesson(lessonId, user.uid);
              
              if (result.success) {
                await refreshData(true);
                Alert.alert('Başarılı', 'Ders başarıyla iptal edildi');
              } else {
                Alert.alert('Hata', result.message || 'Ders iptal edilemedi');
              }
            } catch (error) {
              console.error('Error cancelling lesson:', error);
              Alert.alert('Hata', 'Ders iptal edilirken hata oluştu');
            }
          }
        }
      ]
    );
  };

  const handleDeleteCriteriaChange = (field, value) => {
    setDeleteCriteria(prev => ({ ...prev, [field]: value }));
    setDeletePreview(null);
  };

  const computeDeletePreview = async () => {
    try {
      if (!deleteCriteria.dayOfWeek && !deleteCriteria.startTime && !deleteCriteria.trainerName && !deleteCriteria.duration) {
        Alert.alert('Uyarı', 'Lütfen en az bir koşul seçin (gün, saat, eğitmen veya süre).');
        return null;
      }

      const result = await lessonService.getAllLessons();
      if (!result.success) {
        Alert.alert('Hata', result.message || 'Dersler alınamadı');
        return null;
      }

      const matches = result.lessons.filter((lesson) => {
        const lessonDay = lesson.dayOfWeek || (lesson.scheduledDate ? ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(lesson.scheduledDate).getDay()] : '');
        const dayMatch = !deleteCriteria.dayOfWeek || lessonDay === deleteCriteria.dayOfWeek;
        const startMatch = !deleteCriteria.startTime || lesson.startTime === deleteCriteria.startTime;
        const trainerMatch = !deleteCriteria.trainerName || (lesson.trainerName || '').toLowerCase().includes(deleteCriteria.trainerName.toLowerCase());
        const durationMatch = !deleteCriteria.duration || String(lesson.duration) === String(deleteCriteria.duration);
        return dayMatch && startMatch && trainerMatch && durationMatch;
      });

      setDeletePreview({
        count: matches.length,
        sample: matches.slice(0, 4).map((m) => ({
          id: m.id,
          title: m.title,
          time: `${m.startTime || ''}-${m.endTime || ''}`,
          day: m.dayOfWeek || ''
        }))
      });

      return matches;
    } catch (error) {
      console.error('Error computing delete preview:', error);
      Alert.alert('Hata', 'Eşleşmeler alınırken hata oluştu.');
      return null;
    }
  };

  const handleBulkDeleteLessons = async () => {
    try {
      setDeleteLoading(true);
      const matches = await computeDeletePreview();
      if (!matches || matches.length === 0) {
        setDeleteLoading(false);
        return;
      }

      for (const lesson of matches) {
        await lessonService.deleteLesson(lesson.id);
      }

      Alert.alert('Başarılı', `${matches.length} ders silindi.`);
      setShowDeleteModal(false);
      setDeletePreview(null);
      refreshData(true);
    } catch (error) {
      console.error('Error deleting lessons:', error);
      Alert.alert('Hata', 'Dersler silinirken bir hata oluştu.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const showLessonDetails = async (lesson) => {
    console.log('Opening lesson details:', lesson);
    setSelectedLesson(lesson);
    setShowDetailsModal(true);
    setParticipantDetails({});
    
    // Fetch participant details if lesson has participants
    const participantIds = lesson.participants || lesson.enrolledStudents || [];
    console.log('📋 Participant IDs:', participantIds);
    
    if (participantIds.length > 0) {
      setLoadingParticipants(true);
      await fetchParticipantDetails(participantIds);
      setLoadingParticipants(false);
    } else {
      setLoadingParticipants(false);
    }
  };

  const fetchParticipantDetails = async (participantIds) => {
    try {
      const details = {};
      
      for (const participantId of participantIds) {
        try {
          // Fetch user data from Firestore
          const userDoc = await getDoc(doc(db, 'users', participantId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            console.log('👤 Fetched user data:', { id: participantId, data: userData });
            const firstName = userData.firstName || userData.displayName?.split(' ')[0] || 'Adı';
            const lastName = userData.lastName || userData.displayName?.split(' ')[1] || 'Soyadı';
            
            details[participantId] = {
              name: `${firstName} ${lastName}`.trim(),
              email: userData.email || 'Email bilgisi yok',
              phone: userData.phone || 'Telefon bilgisi yok',
            };
          } else {
            console.log('⚠️ User document not found:', participantId);
            details[participantId] = {
              name: `ID: ${participantId.substring(0, 12)}...`,
              email: 'Üye bulunamadı',
              phone: '-',
            };
          }
        } catch (error) {
          console.error('Error fetching participant:', participantId, error);
          details[participantId] = {
            name: `Hata: ${participantId.substring(0, 8)}...`,
            email: 'Veri getirme hatası',
            phone: '-',
          };
        }
      }
      
      console.log('✅ All participant details fetched:', details);
      setParticipantDetails(details);
    } catch (error) {
      console.error('Error in fetchParticipantDetails:', error);
    }
  };

  const closeLessonDetails = () => {
    setShowDetailsModal(false);
    setSelectedLesson(null);
    setParticipantDetails({});
    setLoadingParticipants(false);
    panY.setValue(0);
  };

  // Helper to get the actual lesson start datetime by combining scheduledDate and startTime
  const getLessonDateTime = (lesson) => {
    const lessonDate = new Date(lesson.scheduledDate);
    if (lesson.startTime) {
      const [hours, minutes] = lesson.startTime.split(':').map(Number);
      lessonDate.setHours(hours || 0, minutes || 0, 0, 0);
    }
    return lessonDate;
  };

  const getStatusColor = (lesson) => {
    if (lesson.status === 'cancelled') return colors.error;
    if (lesson.status === 'completed') return colors.success;
    if (getLessonDateTime(lesson) < new Date()) return colors.warning;
    return colors.primary;
  };

  const getStatusText = (lesson) => {
    if (lesson.status === 'cancelled') return 'İptal Edildi';
    if (lesson.status === 'completed') return 'Tamamlandı';
    if (getLessonDateTime(lesson) < new Date()) return 'Geçmiş';
    return 'Yaklaşan';
  };

  const LessonCard = ({ lesson }) => {
    const participantCount = lesson.currentParticipants || lesson.participants?.length || lesson.enrolledStudents?.length || 0;
    const maxCapacity = lesson.maxStudents || lesson.maxParticipants || 0;
    const capacityPercentage = maxCapacity > 0 ? (participantCount / maxCapacity) * 100 : 0;
    
    return (
      <TouchableOpacity 
        style={styles.lessonCard}
        onPress={() => showLessonDetails(lesson)}
        activeOpacity={0.95}
      >
        <LinearGradient
          colors={[getStatusColor(lesson) + '08', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.lessonCardGradient}
        >
          {/* Status Indicator Strip */}
          <View style={[styles.statusStrip, { backgroundColor: getStatusColor(lesson) }]} />
          
          <View style={styles.lessonCardContent}>
            {/* Header Section */}
            <View style={styles.lessonHeader}>
              <View style={styles.lessonIconWrapper}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.lessonIconGradient}
                >
                  <Ionicons name="barbell" size={22} color={colors.white} />
                </LinearGradient>
              </View>
              
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle} numberOfLines={1}>
                  {lesson.title}
                </Text>
                <View style={styles.lessonMeta}>
                  <Ionicons name="person" size={13} color={colors.textSecondary} />
                  <Text style={styles.lessonTrainer} numberOfLines={1}>
                    {lesson.trainerName}
                  </Text>
                </View>
              </View>
              
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(lesson) }]}>
                <Text style={styles.statusText}>
                  {getStatusText(lesson)}
                </Text>
              </View>
            </View>

            {/* Type Badge */}
            <View style={styles.lessonTypeContainer}>
              <View style={styles.lessonTypeBadge}>
                <Ionicons name="fitness-outline" size={12} color={colors.primary} />
                <Text style={styles.lessonType}>{lesson.type}</Text>
              </View>
              {lesson.lessonType && (
                <View style={[
                  styles.lessonTypeBadge,
                  lesson.lessonType === 'one-on-one' && styles.lessonTypeBadgeOneOnOne
                ]}>
                  <Text style={[
                    styles.lessonType,
                    lesson.lessonType === 'one-on-one' && styles.lessonTypeOneOnOne
                  ]}>
                    {lesson.lessonType === 'one-on-one' ? '👤 Bire Bir' : '👥 Grup'}
                  </Text>
                </View>
              )}
            </View>

            {/* Details Grid */}
            <View style={styles.lessonDetailsGrid}>
              <View style={styles.detailGridItem}>
                <Ionicons name="calendar" size={15} color={colors.primary} />
                <Text style={styles.detailValue}>
                  {new Date(lesson.scheduledDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
                    day: 'numeric',
                    month: 'short'
                  })}
                </Text>
              </View>

              <View style={styles.detailGridItem}>
                <Ionicons name="time" size={15} color={colors.primary} />
                <Text style={styles.detailValue}>
                  {lesson.startTime || new Date(lesson.scheduledDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {lesson.duration && (
                <View style={styles.detailGridItem}>
                  <Ionicons name="hourglass" size={15} color={colors.primary} />
                  <Text style={styles.detailValue}>{lesson.duration}dk</Text>
                </View>
              )}
            </View>

            {/* Capacity Progress */}
            <View style={styles.capacitySection}>
              <View style={styles.capacityHeader}>
                <View style={styles.capacityLabelContainer}>
                  <Ionicons name="people" size={16} color={colors.textPrimary} />
                  <Text style={styles.capacityLabel}>Katılımcılar</Text>
                </View>
                <Text style={styles.capacityCount}>
                  {participantCount}/{maxCapacity}
                </Text>
              </View>
              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarBackground}>
                  <LinearGradient
                    colors={
                      capacityPercentage >= 100 
                        ? [colors.error, colors.error] 
                        : capacityPercentage >= 80 
                          ? [colors.warning, colors.warning]
                          : [colors.success, colors.primary]
                    }
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${Math.min(capacityPercentage, 100)}%` }]}
                  />
                </View>
              </View>
            </View>

            {/* Action Buttons - Admin can edit/cancel past lessons too */}
            {(() => {
              // Only hide buttons for cancelled lessons
              if (lesson.status === 'cancelled') {
                return null;
              }

              return (
                <View style={styles.lessonActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      navigation.navigate('EditLesson', { lesson });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.white} />
                    <Text style={styles.actionButtonText}>Düzenle</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.cancelButton]}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleCancelLesson(lesson.id, lesson.title);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={16} color={colors.white} />
                    <Text style={styles.actionButtonText}>İptal Et</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Ders Yönetimi"
          subtitle="Tüm dersler"
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Dersler yükleniyor...</Text>
        </View>
      </View>
    );
  }

  const upcomingCount = upcomingLessonsCount || currentDateLessons.length || 0;

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Ders Yönetimi"
        subtitle={`${upcomingCount} yaklaşan ders`}
        onRightPress={() => navigation.navigate('Notifications')}
      />

      <View style={styles.content}>
        {/* Modern Search Bar */}
        <View style={styles.searchWrapper}>
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Ders ara..."
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholderTextColor={colors.textSecondary}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity 
                onPress={() => setSearchTerm('')}
                style={styles.clearButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={styles.bulkDeleteButton}
            onPress={() => {
              setDeleteCriteria({ dayOfWeek: '', startTime: '', trainerName: '', duration: '' });
              setDeletePreview(null);
              setShowDeleteModal(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color={colors.white} />
            <Text style={styles.bulkDeleteButtonText}>Ders Sil</Text>
          </TouchableOpacity>
        </View>

        <DateCarouselPicker
          dates={availableDates}
          selectedDate={selectedDateKey}
          onSelectDate={handleSelectDate}
        />

        {/* Lessons List */}
        <ScrollView
          style={styles.lessonsList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
          showsVerticalScrollIndicator={false}
        >
          {loadingLessons ? (
            <View style={styles.loadingLessonsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingLessonsText}>Dersler yükleniyor...</Text>
            </View>
          ) : filteredLessons.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <LinearGradient
                  colors={[colors.primary + '20', colors.primary + '05']}
                  style={styles.emptyIconGradient}
                >
                  <Ionicons name="calendar-outline" size={64} color={colors.primary} />
                </LinearGradient>
              </View>
              <Text style={styles.emptyTitle}>Ders bulunamadı</Text>
              <Text style={styles.emptyText}>
                {searchTerm 
                  ? 'Arama kriterlerinize uygun ders bulunamadı.' 
                  : selectedDateKey
                    ? 'Bu tarih için ders bulunmuyor.'
                    : 'Henüz ders bulunmuyor.'}
              </Text>
              {!searchTerm && (
                <TouchableOpacity
                  style={styles.emptyActionButton}
                  onPress={() => navigation.navigate('CreateLesson')}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryDark]}
                    style={styles.emptyActionButtonGradient}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={colors.white} />
                    <Text style={styles.emptyActionButtonText}>Yeni Ders Oluştur</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredLessons.map((lesson) => (
              <LessonCard key={lesson.id} lesson={lesson} />
            ))
          )}
        </ScrollView>
      </View>

      {/* Modern Floating Add Button */}
      <TouchableOpacity
        style={styles.floatingButton}
        onPress={() => navigation.navigate('CreateLesson')}
        activeOpacity={0.9}
      >
        <LinearGradient
          colors={[colors.success, colors.primary]}
          style={styles.floatingButtonGradient}
        >
          <Ionicons name="add" size={28} color={colors.white} />
        </LinearGradient>
      </TouchableOpacity>

      {/* Bulk Delete Modal */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalOverlayTouchable} activeOpacity={1} onPress={() => setShowDeleteModal(false)} />
          <View style={styles.bulkModalContent}>
            <View style={styles.bulkModalHeader}>
              <Text style={styles.bulkModalTitle}>Ders Sil</Text>
              <TouchableOpacity onPress={() => setShowDeleteModal(false)}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.bulkModalBody}>
              <Text style={styles.bulkModalLabel}>Gün Seç</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkChipsRow}>
                <TouchableOpacity
                  style={[styles.bulkChip, deleteCriteria.dayOfWeek === '' && styles.bulkChipActive]}
                  onPress={() => handleDeleteCriteriaChange('dayOfWeek', '')}
                >
                  <Text style={[styles.bulkChipText, deleteCriteria.dayOfWeek === '' && styles.bulkChipTextActive]}>Tümü</Text>
                </TouchableOpacity>
                {dayOptions.map((day) => (
                  <TouchableOpacity
                    key={day}
                    style={[styles.bulkChip, deleteCriteria.dayOfWeek === day && styles.bulkChipActive]}
                    onPress={() => handleDeleteCriteriaChange('dayOfWeek', day)}
                  >
                    <Text style={[styles.bulkChipText, deleteCriteria.dayOfWeek === day && styles.bulkChipTextActive]}>{day}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.bulkModalLabel}>Başlangıç Saati</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkChipsRow}>
                <TouchableOpacity
                  style={[styles.bulkChip, deleteCriteria.startTime === '' && styles.bulkChipActive]}
                  onPress={() => handleDeleteCriteriaChange('startTime', '')}
                >
                  <Text style={[styles.bulkChipText, deleteCriteria.startTime === '' && styles.bulkChipTextActive]}>Tümü</Text>
                </TouchableOpacity>
                {timeOptions.map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[styles.bulkChip, deleteCriteria.startTime === time && styles.bulkChipActive]}
                    onPress={() => handleDeleteCriteriaChange('startTime', time)}
                  >
                    <Text style={[styles.bulkChipText, deleteCriteria.startTime === time && styles.bulkChipTextActive]}>{time}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.bulkModalLabel}>Eğitmen</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkChipsRow}>
                <TouchableOpacity
                  style={[styles.bulkChip, deleteCriteria.trainerName === '' && styles.bulkChipActive]}
                  onPress={() => handleDeleteCriteriaChange('trainerName', '')}
                >
                  <Text style={[styles.bulkChipText, deleteCriteria.trainerName === '' && styles.bulkChipTextActive]}>Tümü</Text>
                </TouchableOpacity>
                {trainerOptions.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.bulkChip, deleteCriteria.trainerName === name && styles.bulkChipActive]}
                    onPress={() => handleDeleteCriteriaChange('trainerName', name)}
                  >
                    <Text style={[styles.bulkChipText, deleteCriteria.trainerName === name && styles.bulkChipTextActive]}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.bulkModalLabel}>Süre (dk)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bulkChipsRow}>
                <TouchableOpacity
                  style={[styles.bulkChip, deleteCriteria.duration === '' && styles.bulkChipActive]}
                  onPress={() => handleDeleteCriteriaChange('duration', '')}
                >
                  <Text style={[styles.bulkChipText, deleteCriteria.duration === '' && styles.bulkChipTextActive]}>Tümü</Text>
                </TouchableOpacity>
                {durationOptions.map((dur) => (
                  <TouchableOpacity
                    key={dur}
                    style={[styles.bulkChip, deleteCriteria.duration === String(dur) && styles.bulkChipActive]}
                    onPress={() => handleDeleteCriteriaChange('duration', String(dur))}
                  >
                    <Text style={[styles.bulkChipText, deleteCriteria.duration === String(dur) && styles.bulkChipTextActive]}>{dur} dk</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {deletePreview && (
                <View style={styles.bulkPreviewBox}>
                  <Text style={styles.bulkPreviewTitle}>{deletePreview.count} ders silinecek</Text>
                  {deletePreview.sample.map((item) => (
                    <Text key={item.id} style={styles.bulkPreviewItem}>
                      {item.day} • {item.time} • {item.title}
                    </Text>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.bulkModalActions}>
              <TouchableOpacity
                style={[styles.bulkActionButton, styles.bulkPreviewButton]}
                onPress={computeDeletePreview}
                disabled={deleteLoading}
              >
                <Text style={styles.bulkActionButtonText}>Eşleşmeleri Önizle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bulkActionButton, styles.bulkDeleteConfirmButton, deleteLoading && { opacity: 0.6 }]}
                onPress={handleBulkDeleteLessons}
                disabled={deleteLoading}
              >
                <Text style={[styles.bulkActionButtonText, { color: colors.white }]}>
                  {deleteLoading ? 'Siliniyor...' : 'Eşleşenleri Sil'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

  {/* Lesson Details Modal */}
  <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeLessonDetails}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalOverlayTouchable} 
            activeOpacity={1}
            onPress={closeLessonDetails}
          />
          <View style={styles.modalContentWrapper}>
            <Animated.View
              style={[
                styles.modalContent,
                {
                  transform: [{ translateY: panY }]
                }
              ]}
            >
              {selectedLesson ? (
                <>
                  {/* Swipe Indicator and Header - Draggable Area */}
                  <View {...panResponder.panHandlers}>
                    <View style={styles.swipeIndicatorContainer}>
                      <View style={styles.swipeIndicator} />
                    </View>

                    {/* Gradient Header */}
                    <LinearGradient
                      colors={[colors.gradientStart, colors.primaryDark]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.modalHeaderGradient}
                    >
                      <View style={styles.headerTop}>
                        <View style={styles.iconCircle}>
                          <Ionicons name="fitness" size={26} color={colors.white} />
                        </View>
                        <TouchableOpacity
                          onPress={closeLessonDetails}
                          style={styles.closeButton}
                        >
                          <Ionicons name="close" size={24} color={colors.white} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.modalTitle}>{selectedLesson.title}</Text>
                      <View style={styles.modalStatusBadge}>
                        <Text style={[styles.modalStatusBadgeText, { color: getStatusColor(selectedLesson) }]}>
                          {getStatusText(selectedLesson)}
                        </Text>
                      </View>
                    </LinearGradient>
                  </View>

                  <View style={styles.modalInner}>
                    <ScrollView
                      style={styles.modalBody}
                      contentContainerStyle={styles.modalScrollContent}
                      showsVerticalScrollIndicator={false}
                      bounces={true}
                      keyboardShouldPersistTaps="handled"
                    >
                      {/* Info Cards */}
                      <View style={styles.infoCards}>
                        <View style={styles.infoCard}>
                          <View style={styles.infoCardIcon}>
                            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.infoCardLabel}>Tarih</Text>
                          <Text style={styles.infoCardValue}>
                            {new Date(selectedLesson.scheduledDate).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric'
                            })}
                          </Text>
                        </View>

                        <View style={styles.infoCard}>
                          <View style={styles.infoCardIcon}>
                            <Ionicons name="time-outline" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.infoCardLabel}>Saat</Text>
                          <Text style={styles.infoCardValue}>
                            {selectedLesson.startTime || new Date(selectedLesson.scheduledDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                          </Text>
                        </View>

                        <View style={styles.infoCard}>
                          <View style={styles.infoCardIcon}>
                            <Ionicons name="people-outline" size={20} color={colors.primary} />
                          </View>
                          <Text style={styles.infoCardLabel}>Kapasite</Text>
                          <Text style={styles.infoCardValue}>
                            {selectedLesson.currentParticipants || selectedLesson.participants?.length || selectedLesson.enrolledStudents?.length || 0}/{selectedLesson.maxStudents || selectedLesson.maxParticipants || 0}
                          </Text>
                        </View>
                      </View>

                      {/* Details Section */}
                      <View style={styles.detailsSection}>
                        <View style={styles.detailItem}>
                          <View style={styles.detailIconContainer}>
                            <Ionicons name="person-outline" size={22} color={colors.primary} />
                          </View>
                          <View style={styles.detailTextContainer}>
                            <Text style={styles.detailItemLabel}>Eğitmen</Text>
                            <Text style={styles.detailItemValue}>{selectedLesson.trainerName || 'Belirtilmemiş'}</Text>
                          </View>
                        </View>

                        <View style={styles.detailItem}>
                          <View style={styles.detailIconContainer}>
                            <Ionicons name="barbell-outline" size={22} color={colors.primary} />
                          </View>
                          <View style={styles.detailTextContainer}>
                            <Text style={styles.detailItemLabel}>Ders Türü</Text>
                            <Text style={styles.detailItemValue}>{selectedLesson.type || 'Belirtilmemiş'}</Text>
                          </View>
                        </View>

                        {selectedLesson.lessonType && (
                          <View style={styles.detailItem}>
                            <View style={styles.detailIconContainer}>
                              <Ionicons 
                                name={selectedLesson.lessonType === 'one-on-one' ? 'person-outline' : 'people-outline'} 
                                size={22} 
                                color={selectedLesson.lessonType === 'one-on-one' ? '#8b5cf6' : colors.primary} 
                              />
                            </View>
                            <View style={styles.detailTextContainer}>
                              <Text style={styles.detailItemLabel}>Ders Tipi</Text>
                              <Text style={[
                                styles.detailItemValue,
                                selectedLesson.lessonType === 'one-on-one' && { color: '#8b5cf6', fontWeight: '700' }
                              ]}>
                                {selectedLesson.lessonType === 'one-on-one' ? '👤 Bire Bir Ders' : '👥 Grup Dersi'}
                              </Text>
                            </View>
                          </View>
                        )}

                        <View style={styles.detailItem}>
                          <View style={styles.detailIconContainer}>
                            <Ionicons name="hourglass-outline" size={22} color={colors.primary} />
                          </View>
                          <View style={styles.detailTextContainer}>
                            <Text style={styles.detailItemLabel}>Süre</Text>
                            <Text style={styles.detailItemValue}>{selectedLesson.duration ? `${selectedLesson.duration} dakika` : 'Belirtilmemiş'}</Text>
                          </View>
                        </View>

                        <View style={styles.detailItem}>
                          <View style={styles.detailIconContainer}>
                            <Ionicons name="calendar-outline" size={22} color={colors.primary} />
                          </View>
                          <View style={styles.detailTextContainer}>
                            <Text style={styles.detailItemLabel}>Gün</Text>
                            <Text style={styles.detailItemValue}>
                              {(() => {
                                const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
                                const dayIndex = new Date(selectedLesson.scheduledDate).getDay();
                                return days[dayIndex];
                              })()}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {selectedLesson.description && (
                        <View style={styles.descriptionContainer}>
                          <Text style={styles.sectionTitle}>Açıklama</Text>
                          <Text style={styles.descriptionText}>{selectedLesson.description}</Text>
                        </View>
                      )}

                      {(() => {
                        const participantIds = selectedLesson.participants || selectedLesson.enrolledStudents || [];
                        if (participantIds.length === 0) return null;
                        
                        return (
                          <View style={styles.participantsSection}>
                            <View style={styles.sectionHeader}>
                              <Text style={styles.sectionTitle}>Katılımcılar</Text>
                              <View style={styles.participantCount}>
                                <Text style={styles.participantCountText}>{participantIds.length}</Text>
                              </View>
                            </View>
                            {loadingParticipants ? (
                              <View style={styles.loadingParticipants}>
                                <ActivityIndicator size="small" color={colors.primary} />
                                <Text style={styles.participantsLoadingText}>Yükleniyor...</Text>
                              </View>
                            ) : (
                              participantIds.map((participantId, index) => {
                                const participant = participantDetails[participantId];
                                return (
                                  <View key={index} style={styles.participantCard}>
                                    <View style={styles.participantAvatar}>
                                      <Ionicons name="person" size={22} color={colors.primary} />
                                    </View>
                                    <View style={styles.participantInfo}>
                                      <Text style={styles.participantName}>
                                        {participant?.name || 'Yükleniyor...'}
                                      </Text>
                                      {participant?.phone && participant.phone !== '-' && (
                                        <View style={styles.participantDetail}>
                                          <Ionicons name="call-outline" size={14} color={colors.textSecondary} />
                                          <Text style={styles.participantDetailText}>{participant.phone}</Text>
                                        </View>
                                      )}
                                      {participant?.email && participant.email !== 'Email bilgisi yok' && (
                                        <View style={styles.participantDetail}>
                                          <Ionicons name="mail-outline" size={14} color={colors.textSecondary} />
                                          <Text style={styles.participantDetailText}>{participant.email}</Text>
                                        </View>
                                      )}
                                    </View>
                                  </View>
                                );
                              })
                            )}
                          </View>
                        );
                      })()}

                      <View style={styles.modalBottomPadding} />
                    </ScrollView>

                    {/* Bottom Action Buttons - Admin can manage past lessons too */}
                    {(() => {
                      // Only hide buttons for cancelled lessons
                      if (selectedLesson.status === 'cancelled') {
                        return (
                          <View style={styles.modalFooterInfo}>
                            <Ionicons name="close-circle" size={20} color={colors.error} />
                            <Text style={styles.modalFooterInfoText}>Bu ders iptal edildi</Text>
                          </View>
                        );
                      }

                      // Show action buttons for all lessons (including past)
                      return (
                        <View style={styles.modalFooter}>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.footerButtonContainer}
                          >
                            <TouchableOpacity
                              style={styles.footerButton}
                              onPress={() => {
                                closeLessonDetails();
                                navigation.navigate('AddStudentToLesson', { lesson: selectedLesson });
                              }}
                            >
                              <View style={styles.footerButtonIcon}>
                                <Ionicons name="person-add-outline" size={20} color={colors.white} />
                              </View>
                              <Text style={styles.footerButtonText}>Öğrenci Ekle</Text>
                            </TouchableOpacity>
                          </ScrollView>
                        </View>
                      );
                    })()}
                  </View>
                </>
              ) : (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.modalLoadingText}>Yükleniyor...</Text>
              </View>
            )}
            </Animated.View>
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
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Modern Search
  searchWrapper: {
    marginTop: 12,
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.08)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
  },

  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  bulkDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    ...colors.shadow,
    shadowOpacity: 0.12,
  },
  bulkDeleteButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },

  // Modern Lessons List
  lessonsList: {
    flex: 1,
  },
  loadingLessonsContainer: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLessonsText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  lessonCard: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    ...colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  lessonCardGradient: {
    borderRadius: 20,
    backgroundColor: colors.white,
  },

  bulkModalContent: {
    marginHorizontal: 16,
    marginTop: '20%',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    ...colors.shadow,
  },
  bulkModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bulkModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  bulkModalBody: {
    gap: 10,
  },
  bulkModalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  bulkInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  bulkTextInput: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  bulkPreviewBox: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkPreviewTitle: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  bulkPreviewItem: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  bulkChipsRow: {
    marginTop: 6,
    marginBottom: 12,
  },
  bulkChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  bulkChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  bulkChipText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  bulkChipTextActive: {
    color: colors.white,
  },
  bulkModalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  bulkActionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  bulkPreviewButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bulkDeleteConfirmButton: {
    backgroundColor: colors.error,
  },
  bulkActionButtonText: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  statusStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 5,
  },
  lessonCardContent: {
    padding: 18,
    paddingLeft: 22,
  },
  lessonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  lessonIconWrapper: {
    marginRight: 14,
  },
  lessonIconGradient: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  lessonInfo: {
    flex: 1,
    marginRight: 12,
  },
  lessonTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  lessonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonTrainer: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  lessonTypeContainer: {
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  lessonTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary + '12',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  lessonTypeBadgeOneOnOne: {
    backgroundColor: '#8b5cf6' + '15',
  },
  lessonType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  lessonTypeOneOnOne: {
    color: '#8b5cf6',
    marginLeft: 0,
  },
  lessonDetailsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  detailGridItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.1)',
    gap: 6,
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    ...colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    marginBottom: 2,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  capacitySection: {
    marginBottom: 16,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  capacityLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  capacityLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 6,
  },
  capacityCount: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarBackground: {
    flex: 1,
    backgroundColor: colors.gray,
    borderRadius: 4,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  lessonActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    ...colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  cancelButton: {
    backgroundColor: colors.error,
  },
  editButton: {
    backgroundColor: colors.primary,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
    letterSpacing: 0.2,
  },

  // Modern Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIconGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  emptyText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyActionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    ...colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  emptyActionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  emptyActionButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.2,
  },

  // Modal Styles (keeping existing ones)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContentWrapper: {
    maxHeight: '85%',
    width: '100%',
  },
  modalContent: {
    backgroundColor: 'transparent',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
    overflow: 'hidden',
  },
  swipeIndicatorContainer: {
    paddingTop: 12,
    paddingBottom: 8,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  swipeIndicator: {
    width: 45,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  modalHeaderGradient: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  modalInner: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingTop: 12,
    paddingBottom: 0,
    maxHeight: '85%',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  modalStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  modalStatusBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  modalBody: {
    paddingTop: 8,
    maxHeight: 400,
  },
  modalScrollContent: {
    paddingBottom: 20,
  },
  
  // Info Cards
  infoCards: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  infoCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  infoCardLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  infoCardValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },

  // Details Section
  detailsSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  detailIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${colors.primary}10`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  detailTextContainer: {
    flex: 1,
  },
  detailItemLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 3,
    fontWeight: '500',
  },
  detailItemValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // Description
  descriptionContainer: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    backgroundColor: colors.white,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },

  // Participants Section
  participantsSection: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  participantCount: {
    backgroundColor: colors.primary,
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  participantCountText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    justifyContent: 'center',
  },
  participantsLoadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: colors.textSecondary,
  },
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: colors.white,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  participantAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  participantDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  participantDetailText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  modalBottomPadding: {
    height: 20,
  },
  modalLoadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },

  // Modal Footer
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingBottom: 24,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  footerButtonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 20,
    justifyContent: 'center',
  },
  footerButton: {
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  footerButtonDanger: {
    backgroundColor: colors.error,
    shadowColor: colors.error,
  },
  footerButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  footerButtonIconDanger: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  footerButtonText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  modalFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingBottom: 24,
    paddingHorizontal: 20,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    gap: 8,
  },
  modalFooterInfoText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  // Modern Floating Button
  floatingButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  floatingButtonGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
