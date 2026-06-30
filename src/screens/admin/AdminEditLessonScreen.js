import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { colors } from '../../constants/colors';
import { db } from '../../config/firebase';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { adminLessonService } from '../../services/lessonService';
import UniqueHeader from '../../components/UniqueHeader';

const LESSON_TYPES = [
  'Pilates',
  'Yoga',
  'Reformer',
  'Mat Pilates',
  'Yoga Flow',
  'Yin Yoga',
  'Vinyasa',
  'Hatha Yoga',
];

const DURATION_OPTIONS = [45, 50, 60, 75, 90];

// Studio operating window used by the day rail (06:00 – 22:00).
const DAY_START_MINUTES = 6 * 60;
const DAY_END_MINUTES = 22 * 60;
const DAY_SPAN_MINUTES = DAY_END_MINUTES - DAY_START_MINUTES;
const MAX_MAT_DOTS = 30;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const DAY_OPTIONS = [
  { key: 'monday', label: 'Pzt' },
  { key: 'tuesday', label: 'Sal' },
  { key: 'wednesday', label: 'Çar' },
  { key: 'thursday', label: 'Per' },
  { key: 'friday', label: 'Cum' },
  { key: 'saturday', label: 'Cmt' },
  { key: 'sunday', label: 'Paz' },
];

const DAY_LABELS = {
  monday: 'Pazartesi',
  tuesday: 'Salı',
  wednesday: 'Çarşamba',
  thursday: 'Perşembe',
  friday: 'Cuma',
  saturday: 'Cumartesi',
  sunday: 'Pazar',
};

const getDayKeyFromDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'monday';
  }
  return WEEKDAY_KEYS[date.getDay()] || 'monday';
};

const adjustDateToDay = (baseDate, targetKey) => {
  const targetIndex = WEEKDAY_KEYS.indexOf(targetKey);
  if (targetIndex === -1) {
    return baseDate;
  }

  const result = new Date(baseDate);
  const currentIndex = result.getDay();
  let diff = targetIndex - currentIndex;
  if (diff < 0) {
    diff += 7;
  }

  result.setDate(result.getDate() + diff);
  return result;
};

const toDate = (value) => {
  if (!value) {
    return new Date();
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000);
  }

  return new Date(value);
};

const combineDateAndTime = (dateValue, timeString) => {
  const date = toDate(dateValue);

  if (Number.isNaN(date.getTime())) {
    return new Date();
  }

  if (timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes)) {
      date.setHours(hours, minutes, 0, 0);
    }
  }

  return date;
};

const formatDisplayDate = (date, locale = 'tr') => {
  if (Number.isNaN(date.getTime())) {
    return '--/--';
  }
  const resolvedLocale = locale === 'tr' ? 'tr-TR' : locale === 'en' ? 'en-US' : 'tr-TR';
  return date.toLocaleDateString(resolvedLocale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const formatDisplayTime = (date) =>
  Number.isNaN(date.getTime())
    ? '--:--'
    : date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
      });

const formatTimeForSave = (date) =>
  Number.isNaN(date.getTime())
    ? '00:00'
    : date.toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

const deriveDurationMinutes = (lesson) => {
  if (lesson.duration) {
    return lesson.duration;
  }

  if (lesson.startTime && lesson.endTime) {
    const [startHour, startMinute] = lesson.startTime.split(':').map(Number);
    const [endHour, endMinute] = lesson.endTime.split(':').map(Number);

    if (
      [startHour, startMinute, endHour, endMinute].every(
        (value) => !Number.isNaN(value)
      )
    ) {
      const startTotal = startHour * 60 + startMinute;
      const endTotal = endHour * 60 + endMinute;
      const diff = endTotal - startTotal;
      if (diff > 0) {
        return diff;
      }
    }
  }

  return 60;
};

const getEndTimePreview = (startDate, durationMinutes) => {
  const durationValue = parseInt(durationMinutes, 10);
  if (Number.isNaN(durationValue) || durationValue <= 0) {
    return '--:--';
  }

  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + durationValue);

  return formatDisplayTime(endDate);
};

export default function AdminEditLessonScreen({ navigation, route }) {
  const { lesson } = route.params;
  const { user } = useAuth();
  const { language } = useI18n();
  const resolvedScheduledDate = combineDateAndTime(lesson.scheduledDate, lesson.startTime);
  const initialDuration = deriveDurationMinutes(lesson);
  const lessonTypeOptions = useMemo(() => {
    if (lesson.type && !LESSON_TYPES.includes(lesson.type)) {
      return [lesson.type, ...LESSON_TYPES];
    }
    return LESSON_TYPES;
  }, [lesson.type]);
  
  const [loading, setLoading] = useState(false);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [trainers, setTrainers] = useState([]);
  const [selectedTrainer, setSelectedTrainer] = useState(
    lesson.trainerId
      ? { id: lesson.trainerId, name: lesson.trainerName || lesson.instructor || '' }
      : null
  );
  const [title, setTitle] = useState(lesson.title || '');
  const [description, setDescription] = useState(lesson.description || '');
  const [type, setType] = useState(lesson.type || '');
  const [maxStudents, setMaxStudents] = useState((lesson.maxStudents || lesson.maxParticipants || '').toString());
  const [duration, setDuration] = useState(initialDuration.toString());
  const [scheduledDate, setScheduledDate] = useState(resolvedScheduledDate);
  const [activePicker, setActivePicker] = useState(null);
  const [tempPickerValue, setTempPickerValue] = useState(resolvedScheduledDate);
  const [selectedDay, setSelectedDay] = useState(
    lesson.dayOfWeek || getDayKeyFromDate(resolvedScheduledDate)
  );
  const participantsCount = lesson.enrolledStudents?.length || lesson.participants?.length || 0;
  const parsedMaxStudents = parseInt(maxStudents, 10);
  const isIOS = Platform.OS === 'ios';
  const maxCapacity =
    !Number.isNaN(parsedMaxStudents) && parsedMaxStudents > 0
      ? parsedMaxStudents
      : lesson.maxStudents || lesson.maxParticipants || 0;
  const endTimePreview = getEndTimePreview(scheduledDate, duration);
  const availableSlots = maxCapacity > 0 ? Math.max(0, maxCapacity - participantsCount) : null;
  const durationNum = parseInt(duration, 10) || 0;
  const enrollmentFloor = Math.max(participantsCount, 1);

  // Day-rail geometry: place the lesson block inside the 06:00–22:00 window.
  const startMinutesOfDay =
    scheduledDate instanceof Date && !Number.isNaN(scheduledDate.getTime())
      ? scheduledDate.getHours() * 60 + scheduledDate.getMinutes()
      : DAY_START_MINUTES;
  const railLeft = clamp((startMinutesOfDay - DAY_START_MINUTES) / DAY_SPAN_MINUTES, 0, 1);
  const railWidth = clamp(durationNum / DAY_SPAN_MINUTES, 0.03, 1 - railLeft);

  // Mat occupancy: render one dot per seat, filled up to the enrolled count.
  const matTotal = clamp(maxCapacity, 0, MAX_MAT_DOTS);
  const matOverflow = maxCapacity > MAX_MAT_DOTS;

  const adjustMaxStudents = (delta) => {
    const current = parseInt(maxStudents, 10) || 0;
    const next = Math.max(enrollmentFloor, current + delta);
    setMaxStudents(String(next));
  };
  useEffect(() => {
    setSelectedDay(getDayKeyFromDate(scheduledDate));
  }, [scheduledDate]);
  const weekdayLabel = DAY_LABELS[selectedDay] || 'Bilinmiyor';

  useEffect(() => {
    let isMounted = true;

    const loadTrainers = async () => {
      try {
        setLoadingTrainers(true);
        const trainersQuery = query(
          collection(db, 'users'),
          where('role', 'in', ['instructor', 'admin'])
        );

        const snapshot = await getDocs(trainersQuery);
        const trainersList = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          trainersList.push({
            id: docSnap.id,
            name:
              data.displayName ||
              `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
              'İsimsiz Eğitmen',
            ...data,
          });
        });

        if (!isMounted) {
          return;
        }

        setTrainers(trainersList);

        // Reconcile the lesson's current trainer with the loaded list so the
        // name/avatar stay accurate even if it changed since the lesson was created.
        if (lesson.trainerId) {
          const matched = trainersList.find((t) => t.id === lesson.trainerId);
          if (matched) {
            setSelectedTrainer(matched);
          }
        }
      } catch (error) {
        console.error('Error loading trainers:', error);
        if (isMounted) {
          Alert.alert('Hata', 'Eğitmenler yüklenirken hata oluştu');
        }
      } finally {
        if (isMounted) {
          setLoadingTrainers(false);
        }
      }
    };

    loadTrainers();

    return () => {
      isMounted = false;
    };
  }, [lesson.trainerId]);

  const handleSelectDay = (dayKey) => {
    setSelectedDay(dayKey);
    setScheduledDate((current) => {
      const base = current instanceof Date ? new Date(current) : new Date();
      if (Number.isNaN(base.getTime())) {
        return adjustDateToDay(new Date(), dayKey);
      }
      const adjusted = adjustDateToDay(base, dayKey);
      adjusted.setHours(base.getHours(), base.getMinutes(), 0, 0);
      return adjusted;
    });
  };

  const buildLessonPayload = () => {
    const durationValue = parseInt(duration, 10) || 0;
    const capacityValue = parseInt(maxStudents, 10) || 0;
    const baseDate = scheduledDate instanceof Date ? new Date(scheduledDate) : new Date();

    if (Number.isNaN(baseDate.getTime())) {
      throw new Error('invalid-date');
    }

    baseDate.setSeconds(0, 0);

    const endDate = new Date(baseDate);
    endDate.setMinutes(endDate.getMinutes() + durationValue);

    return {
      ...lesson,
      title: title.trim(),
      description: description.trim(),
      type: type.trim(),
      maxStudents: capacityValue,
      maxParticipants: capacityValue,
      duration: durationValue,
      trainerId: selectedTrainer?.id ?? lesson.trainerId,
      trainerName: selectedTrainer?.name ?? lesson.trainerName,
      scheduledDate: baseDate.toISOString(),
      scheduledDateKey: `${baseDate.getFullYear()}-${String(baseDate.getMonth() + 1).padStart(2, '0')}-${String(baseDate.getDate()).padStart(2, '0')}`,
      startTime: formatTimeForSave(baseDate),
      endTime: formatTimeForSave(endDate),
      dayOfWeek: selectedDay,
      updatedBy: user.uid,
    };
  };

  const handleSave = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Hata', 'Lütfen ders başlığını girin');
      return;
    }
    if (!type.trim()) {
      Alert.alert('Hata', 'Lütfen ders türünü girin');
      return;
    }
    if (!selectedTrainer?.id) {
      Alert.alert('Hata', 'Lütfen eğitmen seçin');
      return;
    }
    if (!maxStudents || parseInt(maxStudents) < 1) {
      Alert.alert('Hata', 'Lütfen geçerli bir maksimum öğrenci sayısı girin');
      return;
    }
    if (!duration || parseInt(duration) < 1) {
      Alert.alert('Hata', 'Lütfen geçerli bir ders süresi girin');
      return;
    }

    try {
      setLoading(true);

      let updatedLesson;
      try {
        updatedLesson = buildLessonPayload();
      } catch (payloadError) {
        if (payloadError.message === 'invalid-date') {
          Alert.alert('Hata', 'Seçilen tarih geçerli değil. Lütfen yeniden deneyin.');
          return;
        }
        throw payloadError;
      }

      const result = await adminLessonService.updateLesson(lesson.id, updatedLesson);

      if (result.success) {
        const message = result.updatedFutureCount
          ? result.message || `Ders ve ${result.updatedFutureCount} gelecek ders güncellendi`
          : 'Ders başarıyla güncellendi';
        Alert.alert('Başarılı', message, [
          {
            text: 'Tamam',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        Alert.alert('Hata', result.message || 'Ders güncellenemedi');
      }
    } catch (error) {
      console.error('Error updating lesson:', error);
      Alert.alert('Hata', 'Ders güncellenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Generate time slots from 06:00 to 22:00 in 30-minute intervals
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour <= 22; hour++) {
      slots.push({ hour, minute: 0, label: `${hour.toString().padStart(2, '0')}:00` });
      if (hour < 22) {
        slots.push({ hour, minute: 30, label: `${hour.toString().padStart(2, '0')}:30` });
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  const openPicker = (type) => {
    if (type === 'time') {
      // For time picker, find the current time slot
      const currentHour = scheduledDate.getHours();
      const currentMinute = scheduledDate.getMinutes();
      const currentSlot = timeSlots.find(
        slot => slot.hour === currentHour && slot.minute === currentMinute
      ) || timeSlots.find(slot => slot.hour === 9 && slot.minute === 0); // Default to 09:00
      setSelectedTimeSlot(currentSlot);
    } else {
      const baseDate = Number.isNaN(scheduledDate.getTime())
        ? new Date()
        : new Date(scheduledDate);
      setTempPickerValue(baseDate);
    }
    setActivePicker(type);
  };

  const closePicker = () => {
    setActivePicker(null);
    setSelectedTimeSlot(null);
  };

  const handlePickerChange = (_, selectedValue) => {
    if (selectedValue) {
      setTempPickerValue(selectedValue);
    }
  };

  const handlePickerConfirm = () => {
    const baseDate = Number.isNaN(scheduledDate.getTime())
      ? new Date()
      : new Date(scheduledDate);
    const newDate = new Date(baseDate);

    if (activePicker === 'date') {
      if (!tempPickerValue || Number.isNaN(tempPickerValue.getTime())) {
        closePicker();
        return;
      }
      newDate.setFullYear(
        tempPickerValue.getFullYear(),
        tempPickerValue.getMonth(),
        tempPickerValue.getDate()
      );
    } else if (activePicker === 'time') {
      if (!selectedTimeSlot) {
        closePicker();
        return;
      }
      newDate.setHours(selectedTimeSlot.hour, selectedTimeSlot.minute, 0, 0);
    }

    setScheduledDate(newDate);
    closePicker();
  };

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Dersi Düzenle"
        subtitle={lesson.title}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Live class-card preview — mirrors how the lesson reads right now */}
        <View style={styles.previewCard}>
          <View style={styles.previewTopRow}>
            <Text style={styles.previewEyebrow}>
              {(type || 'Ders').toUpperCase()}
            </Text>
            <View style={styles.previewBadge}>
              <Ionicons name="create-outline" size={13} color={colors.white} />
              <Text style={styles.previewBadgeText}>Düzenleniyor</Text>
            </View>
          </View>

          <Text style={styles.previewTitle} numberOfLines={2}>
            {title.trim() || 'İsimsiz Ders'}
          </Text>

          <View style={styles.previewInstructorRow}>
            <View style={styles.previewAvatar}>
              <Ionicons name="person" size={13} color={colors.primaryDark} />
            </View>
            <Text style={styles.previewInstructor}>
              {selectedTrainer?.name || 'Eğitmen seçilmedi'}
            </Text>
          </View>

          <View style={styles.previewDivider} />

          <View style={styles.previewMetaRow}>
            <View style={styles.previewMeta}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.previewMetaText}>{weekdayLabel}</Text>
            </View>
            <View style={styles.previewMeta}>
              <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.previewMetaText}>
                {formatDisplayTime(scheduledDate)} – {endTimePreview}
              </Text>
            </View>
            <View style={styles.previewMeta}>
              <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.75)" />
              <Text style={styles.previewMetaText}>
                {participantsCount}/{maxCapacity || '—'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Ders Bilgileri</Text>
              <Text style={styles.sectionSubtitle}>Başlık, tür ve eğitmen</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Ders Başlığı *</Text>
              <TextInput
                style={styles.fieldInput}
                value={title}
                onChangeText={setTitle}
                placeholder="Örn: Sabah Yoga"
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Ders Türü *</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.typeChipsContainer}
              >
                {lessonTypeOptions.map((lessonType) => {
                  const isActive = type === lessonType;
                  return (
                    <TouchableOpacity
                      key={lessonType}
                      style={[
                        styles.typeChip,
                        isActive && styles.typeChipActive,
                      ]}
                      onPress={() => setType(lessonType)}
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          isActive && styles.typeChipTextActive,
                        ]}
                      >
                        {lessonType}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Eğitmen *</Text>
              {loadingTrainers ? (
                <View style={styles.trainerLoadingRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={styles.trainerLoadingText}>Eğitmenler yükleniyor...</Text>
                </View>
              ) : trainers.length === 0 ? (
                <View style={styles.trainerEmptyRow}>
                  <Ionicons name="alert-circle-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.trainerLoadingText}>Eğitmen bulunamadı</Text>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.trainerChipsContainer}
                >
                  {trainers.map((trainer) => {
                    const isActive = selectedTrainer?.id === trainer.id;
                    return (
                      <TouchableOpacity
                        key={trainer.id}
                        style={[styles.trainerChip, isActive && styles.trainerChipActive]}
                        onPress={() => setSelectedTrainer(trainer)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.trainerAvatar,
                            isActive && styles.trainerAvatarActive,
                          ]}
                        >
                          <Ionicons
                            name="person"
                            size={14}
                            color={isActive ? colors.primary : colors.textSecondary}
                          />
                        </View>
                        <Text
                          style={[
                            styles.trainerChipText,
                            isActive && styles.trainerChipTextActive,
                          ]}
                        >
                          {trainer.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={[styles.fieldWrapper, styles.fieldWrapperLast]}>
              <Text style={styles.fieldLabel}>Açıklama</Text>
              <TextInput
                style={[styles.fieldInput, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ders hakkında detaylı bilgi..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Program</Text>
              <Text style={styles.sectionSubtitle}>Gün, tarih ve saat</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.daySelector}>
              <Text style={styles.daySelectorLabel}>Ders Günü</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.dayChipsContainer}
              >
                {DAY_OPTIONS.map(({ key, label }) => {
                  const isActive = selectedDay === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      style={[styles.dayChip, isActive && styles.dayChipActive]}
                      onPress={() => handleSelectDay(key)}
                    >
                      <Text style={[styles.dayChipText, isActive && styles.dayChipTextActive]}>
                        {label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.helperText}>Seçilen gün: {weekdayLabel}</Text>
            </View>

            <View style={[styles.inlineRow, styles.fieldWrapper]}>
              <TouchableOpacity
                style={[styles.metaButton, styles.inlineItem]}
                onPress={() => openPicker('date')}
              >
                <View style={styles.metaCardHeader}>
                  <View style={styles.metaIconBadge}>
                    <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
                <Text style={styles.metaLabel}>Tarih</Text>
                <Text style={styles.metaValue}>{formatDisplayDate(scheduledDate, language)}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.metaButton, styles.inlineItem]}
                onPress={() => openPicker('time')}
              >
                <View style={styles.metaCardHeader}>
                  <View style={styles.metaIconBadge}>
                    <Ionicons name="time-outline" size={18} color={colors.primary} />
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </View>
                <Text style={styles.metaLabel}>Başlangıç Saati</Text>
                <Text style={styles.metaValue}>{formatDisplayTime(scheduledDate)}</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.helperText}>
              ⏰ Sadece 30 dakikalık aralıklar seçilebilir (06:00, 06:30, 07:00, ...)
            </Text>

            {/* Day rail — where this class sits in the studio's day */}
            <View style={styles.railWrap}>
              <View style={styles.railHeaderRow}>
                <Text style={styles.railTitle}>Gün İçindeki Yeri</Text>
                <View style={styles.railTimePill}>
                  <Text style={styles.railTimePillText}>
                    {formatDisplayTime(scheduledDate)} – {endTimePreview}
                  </Text>
                </View>
              </View>
              <View style={styles.railTrack}>
                <View
                  style={[
                    styles.railBlock,
                    { left: `${railLeft * 100}%`, width: `${railWidth * 100}%` },
                  ]}
                >
                  <View style={styles.railBlockDot} />
                </View>
              </View>
              <View style={styles.railScale}>
                <Text style={styles.railScaleText}>06:00</Text>
                <Text style={styles.railScaleText}>14:00</Text>
                <Text style={styles.railScaleText}>22:00</Text>
              </View>
            </View>

            <View style={[styles.fieldWrapper, styles.fieldWrapperLast]}>
              <Text style={styles.fieldLabel}>Ders Süresi (Dakika) *</Text>
              <View style={styles.durationChips}>
                {DURATION_OPTIONS.map((min) => {
                  const isActive = durationNum === min;
                  return (
                    <TouchableOpacity
                      key={min}
                      style={[styles.durChip, isActive && styles.durChipActive]}
                      onPress={() => setDuration(String(min))}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.durChipText, isActive && styles.durChipTextActive]}>
                        {min}′
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.metaInputWrapper}>
                <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                <TextInput
                  style={styles.metaInput}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="Özel süre"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
                <Text style={styles.metaInputSuffix}>dk</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIconBadge}>
              <Ionicons name="people-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.sectionTitle}>Kontenjan</Text>
              <Text style={styles.sectionSubtitle}>Katılımcı kapasitesi</Text>
            </View>
          </View>
          <View style={styles.card}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Maksimum Öğrenci Sayısı *</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={[
                    styles.stepperBtn,
                    (parseInt(maxStudents, 10) || 0) <= enrollmentFloor && styles.stepperBtnDisabled,
                  ]}
                  onPress={() => adjustMaxStudents(-1)}
                  disabled={(parseInt(maxStudents, 10) || 0) <= enrollmentFloor}
                  activeOpacity={0.7}
                >
                  <Ionicons name="remove" size={22} color={colors.primary} />
                </TouchableOpacity>

                <View style={styles.stepperValueWrap}>
                  <Text style={styles.stepperValue}>{maxStudents || '0'}</Text>
                  <Text style={styles.stepperUnit}>kişilik kontenjan</Text>
                </View>

                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => adjustMaxStudents(1)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={22} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Mat occupancy — one dot per spot, filled up to the enrolled count */}
            <View style={[styles.matGauge, styles.fieldWrapperLast]}>
              <View style={styles.matHeaderRow}>
                <Text style={styles.matHeaderLabel}>Doluluk</Text>
                <Text style={styles.matHeaderValue}>
                  {participantsCount}
                  <Text style={styles.matHeaderValueDim}> / {maxCapacity || 0}</Text>
                </Text>
              </View>

              <View style={styles.matDotsRow}>
                {Array.from({ length: matTotal }).map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.matDot,
                      index < participantsCount ? styles.matDotFilled : styles.matDotEmpty,
                    ]}
                  />
                ))}
                {matTotal === 0 && (
                  <Text style={styles.matEmptyHint}>Kontenjan belirleyin</Text>
                )}
                {matOverflow && <Text style={styles.matOverflowHint}>+{maxCapacity - MAX_MAT_DOTS}</Text>}
              </View>

              <View style={styles.matLegendRow}>
                <View style={styles.matLegendItem}>
                  <View style={[styles.matDot, styles.matDotFilled, styles.matLegendDot]} />
                  <Text style={styles.matLegendText}>{participantsCount} dolu</Text>
                </View>
                <View style={styles.matLegendItem}>
                  <View style={[styles.matDot, styles.matDotEmpty, styles.matLegendDot]} />
                  <Text style={styles.matLegendText}>
                    {availableSlots !== null ? availableSlots : 0} boş
                  </Text>
                </View>
              </View>

              <Text style={styles.matNote}>
                Kontenjanı kayıtlı öğrenci sayısının ({participantsCount}) altına düşüremezsiniz.
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: 16 }} />
      </ScrollView>

      <View style={styles.footerBar}>
        <TouchableOpacity
          style={styles.footerCancel}
          onPress={() => navigation.goBack()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.footerCancelText}>Vazgeç</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.saveButtonText}>Kaydet</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
      <Modal
        visible={Boolean(activePicker)}
        transparent
        animationType="fade"
        onRequestClose={closePicker}
      >
        <TouchableWithoutFeedback onPress={closePicker}>
          <View style={styles.pickerBackdrop}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderLeft}>
                <View style={styles.pickerIconBadge}>
                  <Ionicons
                    name={activePicker === 'time' ? 'time-outline' : 'calendar-outline'}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.pickerTitle}>
                  {activePicker === 'time' ? 'Saat Seçin' : 'Tarih Seçin'}
                </Text>
              </View>
              <TouchableOpacity style={styles.pickerCloseButton} onPress={closePicker}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.pickerBody}>
              {Boolean(activePicker) && (
                <>
                  <Text style={styles.pickerPreviewLabel}>
                    {activePicker === 'time' ? 'Seçilen Saat' : 'Seçilen Tarih'}
                  </Text>
                  <Text style={styles.pickerPreviewValue}>
                    {activePicker === 'time'
                      ? selectedTimeSlot?.label || '--:--'
                      : formatDisplayTime(tempPickerValue || new Date())}
                  </Text>
                  <View style={styles.pickerComponentWrapper}>
                    {activePicker === 'time' ? (
                      <ScrollView 
                        style={styles.timeSlotScroll}
                        showsVerticalScrollIndicator={false}
                      >
                        {timeSlots.map((slot) => (
                          <TouchableOpacity
                            key={slot.label}
                            style={[
                              styles.timeSlotItem,
                              selectedTimeSlot?.label === slot.label && styles.timeSlotItemActive
                            ]}
                            onPress={() => setSelectedTimeSlot(slot)}
                          >
                            <Text style={[
                              styles.timeSlotText,
                              selectedTimeSlot?.label === slot.label && styles.timeSlotTextActive
                            ]}>
                              {slot.label}
                            </Text>
                            {selectedTimeSlot?.label === slot.label && (
                              <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    ) : (
                      <DateTimePicker
                        value={tempPickerValue || new Date()}
                        mode="date"
                        display="spinner"
                        onChange={handlePickerChange}
                        minimumDate={new Date()}
                        locale="tr-TR"
                        style={styles.nativePicker}
                        {...(isIOS
                          ? {
                              preferredDatePickerStyle: 'wheels',
                              textColor: colors.textPrimary,
                              accentColor: colors.primary,
                              themeVariant: 'light',
                            }
                          : {})}
                      />
                    )}
                  </View>
                </>
              )}
            </View>

            <View style={styles.pickerActions}>
              <TouchableOpacity style={styles.pickerActionSecondary} onPress={closePicker}>
                <Text style={styles.pickerActionSecondaryText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickerActionPrimary} onPress={handlePickerConfirm}>
                <Text style={styles.pickerActionPrimaryText}>Onayla</Text>
              </TouchableOpacity>
            </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: `${colors.primary}14`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12.5,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },

  // Signature: live class-card preview
  previewCard: {
    backgroundColor: colors.primaryDark,
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 20,
    marginBottom: 28,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 10,
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryLight,
    letterSpacing: 2,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 100,
    paddingLeft: 8,
    paddingRight: 11,
    paddingVertical: 5,
  },
  previewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 4,
    letterSpacing: 0.2,
  },
  previewTitle: {
    fontSize: 27,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: -0.6,
    marginTop: 14,
    lineHeight: 32,
  },
  previewInstructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  previewAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 9,
  },
  previewInstructor: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: -0.1,
  },
  previewDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 18,
    marginBottom: 14,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
    marginVertical: 2,
  },
  previewMetaText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginLeft: 6,
    letterSpacing: -0.1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
    ...colors.shadow,
  },
  fieldWrapper: {
    marginBottom: 20,
  },
  fieldWrapperLast: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldInput: {
    backgroundColor: colors.white,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  textArea: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  inlineRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginRight: -12,
    marginBottom: -12,
  },
  inlineItem: {
    flex: 1,
    minWidth: 140,
    marginRight: 12,
    marginBottom: 12,
  },
  metaButton: {
    alignItems: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: `${colors.primary}18`,
    ...colors.shadow,
  },
  metaCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 14,
  },
  metaIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  metaValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  daySelector: {
    marginBottom: 20,
  },
  daySelectorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  dayChipsContainer: {
    paddingVertical: 4,
  },
  dayChip: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayChipText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  dayChipTextActive: {
    color: colors.white,
  },
  helperText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  pickerCard: {
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    ...colors.shadow,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  pickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pickerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBody: {
    borderRadius: 20,
    backgroundColor: colors.transparentGreenLight,
    paddingVertical: Platform.OS === 'ios' ? 18 : 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  pickerPreviewLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  pickerPreviewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  pickerComponentWrapper: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
  },
  pickerActions: {
    flexDirection: 'row',
    marginTop: 16,
  },
  pickerActionSecondary: {
    flex: 1,
    backgroundColor: colors.transparentGreenLight,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  pickerActionSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pickerActionPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    ...colors.shadow,
  },
  pickerActionPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  typeChipsContainer: {
    paddingVertical: 12,
  },
  typeChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  typeChipText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  typeChipTextActive: {
    color: colors.white,
  },
  trainerChipsContainer: {
    paddingVertical: 12,
  },
  trainerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 100,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    marginRight: 8,
  },
  trainerChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  trainerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  trainerAvatarActive: {
    backgroundColor: colors.white,
  },
  trainerChipText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  trainerChipTextActive: {
    color: colors.white,
  },
  trainerLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  trainerEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  trainerLoadingText: {
    marginLeft: 8,
    fontSize: 13,
    color: colors.textSecondary,
  },
  nativePicker: {
    width: '100%',
    ...Platform.select({
      ios: {
        height: 220,
      },
    }),
  },
  nativePickerTime: {
    ...Platform.select({
      ios: {
        height: 190,
      },
    }),
  },
  metaInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
  },
  metaInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    marginLeft: 10,
  },
  metaInputSuffix: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // Day rail
  railWrap: {
    marginTop: 18,
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${colors.primary}14`,
  },
  railHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  railTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  railTimePill: {
    backgroundColor: colors.white,
    borderRadius: 100,
    paddingHorizontal: 11,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  railTimePillText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.primaryDark,
    letterSpacing: 0.2,
  },
  railTrack: {
    height: 14,
    borderRadius: 7,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  railBlock: {
    position: 'absolute',
    height: 14,
    minWidth: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railBlockDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.white,
  },
  railScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  railScaleText: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textLight,
    letterSpacing: 0.4,
  },

  // Duration quick-picks
  durationChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 10,
    marginBottom: 12,
  },
  durChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  durChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  durChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  durChipTextActive: {
    color: colors.white,
  },

  // Capacity stepper
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 18,
    padding: 8,
    borderWidth: 1,
    borderColor: `${colors.primary}14`,
  },
  stepperBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.primary}22`,
    ...colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  stepperBtnDisabled: {
    opacity: 0.4,
  },
  stepperValueWrap: {
    flex: 1,
    alignItems: 'center',
  },
  stepperValue: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  stepperUnit: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 1,
  },

  // Mat occupancy gauge
  matGauge: {
    marginTop: 20,
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${colors.primary}14`,
  },
  matHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  matHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  matHeaderValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
    letterSpacing: -0.3,
  },
  matHeaderValueDim: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textLight,
  },
  matDotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  matDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 7,
    marginBottom: 7,
  },
  matDotFilled: {
    backgroundColor: colors.primary,
  },
  matDotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: `${colors.primary}40`,
  },
  matEmptyHint: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 7,
  },
  matOverflowHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 7,
    marginLeft: 2,
  },
  matLegendRow: {
    flexDirection: 'row',
    marginTop: 6,
  },
  matLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 18,
  },
  matLegendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 0,
  },
  matLegendText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  matNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 12,
  },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: `${colors.primary}12`,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 12,
  },
  footerCancel: {
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 14,
    backgroundColor: colors.transparentGreenLight,
    marginRight: 12,
  },
  footerCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.2,
  },
  timeSlotScroll: {
    maxHeight: 300,
    width: '100%',
  },
  timeSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  timeSlotItemActive: {
    backgroundColor: `${colors.primary}10`,
  },
  timeSlotText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  timeSlotTextActive: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
});
