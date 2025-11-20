import React, { useState, useEffect, useRef } from 'react';
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
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { adminLessonService } from '../../services/lessonService';
import UniqueHeader from '../../components/UniqueHeader';

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

const roundToNearestHalfHour = (date) => {
  const rounded = new Date(date);
  const minutes = rounded.getMinutes();
  
  // Round UP to next 0 or 30
  if (minutes === 0 || minutes === 30) {
    // Already at 0 or 30, keep it
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
  } else if (minutes > 0 && minutes < 30) {
    // Round up to 30
    rounded.setMinutes(30);
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
  } else if (minutes > 30) {
    // Round up to next hour
    rounded.setMinutes(0);
    rounded.setSeconds(0);
    rounded.setMilliseconds(0);
    rounded.setHours(rounded.getHours() + 1);
  }
  
  return rounded;
};

const getInitialScheduledDate = () => {
  return roundToNearestHalfHour(new Date());
};

export default function AdminCreateLessonScreen({ navigation }) {
  const { user, userData } = useAuth();
  const { language } = useI18n();
  
  const scrollViewRef = useRef(null);
  const copyWeeksInputRef = useRef(null);
  
  const [loading, setLoading] = useState(false);
  const [loadingTrainers, setLoadingTrainers] = useState(true);
  const [trainers, setTrainers] = useState([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('');
  const [lessonType, setLessonType] = useState('group');
  const [maxStudents, setMaxStudents] = useState('12');
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [scheduledDate, setScheduledDate] = useState(getInitialScheduledDate());
  const [activePicker, setActivePicker] = useState(null);
  const [tempPickerValue, setTempPickerValue] = useState(getInitialScheduledDate());
  const [duration, setDuration] = useState('45');
  const [selectedDays, setSelectedDays] = useState([getDayKeyFromDate(new Date())]);
  const [copyWeeks, setCopyWeeks] = useState('0');
  const isIOS = Platform.OS === 'ios';

  const lessonTypes = [
    'Pilates',
    'Yoga',
    'Reformer',
    'Mat Pilates',
    'Yoga Flow',
    'Yin Yoga',
    'Vinyasa',
    'Hatha Yoga',
  ];

  useEffect(() => {
    loadTrainers();
  }, []);

  // Initialize selected days when component mounts
  useEffect(() => {
    const currentDayKey = getDayKeyFromDate(new Date());
    setSelectedDays([currentDayKey]);
  }, []);

  const handleSelectDay = (dayKey) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayKey)) {
        // Remove day if already selected (but keep at least one)
        return prev.length > 1 ? prev.filter(d => d !== dayKey) : prev;
      } else {
        // Add day to selection
        return [...prev, dayKey];
      }
    });
  };

  const handleLessonTypeChange = (newLessonType) => {
    setLessonType(newLessonType);
    
    // Auto-adjust max students when selecting one-on-one
    if (newLessonType === 'one-on-one') {
      setMaxStudents('1');
    } else if (maxStudents === '1') {
      setMaxStudents('12');
    }
  };

  const buildLessonPayload = (dayKey) => {
    const durationValue = parseInt(duration, 10) || 0;
    const capacityValue = parseInt(maxStudents, 10) || 0;
    const baseDate = scheduledDate instanceof Date ? new Date(scheduledDate) : new Date();

    if (Number.isNaN(baseDate.getTime())) {
      throw new Error('invalid-date');
    }

    // Adjust date to the specific day
    const adjustedDate = adjustDateToDay(baseDate, dayKey);
    adjustedDate.setSeconds(0, 0);

    const endDate = new Date(adjustedDate);
    endDate.setMinutes(endDate.getMinutes() + durationValue);

    return {
      title: title.trim(),
      description: description.trim(),
      type: type.trim(),
      lessonType: lessonType,
      maxStudents: capacityValue,
      maxParticipants: capacityValue,
      trainerId: selectedTrainer?.id,
      trainerName: selectedTrainer?.name,
      scheduledDate: adjustedDate.toISOString(),
      startTime: formatTimeForSave(adjustedDate),
      endTime: formatTimeForSave(endDate),
      duration: durationValue,
      dayOfWeek: dayKey,
      enrolledStudents: [],
      participants: [],
      currentParticipants: 0,
      status: 'active',
      level: 'all',
      createdBy: user.uid,
      updatedBy: user.uid,
    };
  };

  const loadTrainers = async () => {
    try {
      setLoadingTrainers(true);
      const q = query(
        collection(db, 'users'),
        where('role', 'in', ['instructor', 'admin'])
      );
      
      const querySnapshot = await getDocs(q);
      const trainersList = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        trainersList.push({
          id: doc.id,
          name: data.displayName || `${data.firstName || ''} ${data.lastName || ''}`.trim(),
          ...data,
        });
      });
      
      setTrainers(trainersList);
      
      // Auto-select current user if they are instructor/admin
      if (userData?.role === 'instructor' || userData?.role === 'admin') {
        const currentTrainer = trainersList.find(t => t.id === user.uid);
        if (currentTrainer) {
          setSelectedTrainer(currentTrainer);
        }
      }
    } catch (error) {
      console.error('Error loading trainers:', error);
      Alert.alert('Hata', 'Eğitmenler yüklenirken hata oluştu');
    } finally {
      setLoadingTrainers(false);
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Hata', 'Lütfen ders başlığını girin');
      return;
    }
    if (!type.trim()) {
      Alert.alert('Hata', 'Lütfen ders türünü seçin');
      return;
    }
    if (!selectedTrainer) {
      Alert.alert('Hata', 'Lütfen eğitmen seçin');
      return;
    }
    if (!maxStudents || parseInt(maxStudents) < 1) {
      Alert.alert('Hata', 'Lütfen geçerli bir maksimum öğrenci sayısı girin');
      return;
    }
    if (!duration || parseInt(duration) < 15) {
      Alert.alert('Hata', 'Lütfen geçerli bir ders süresi girin (minimum 15 dakika)');
      return;
    }
    if (selectedDays.length === 0) {
      Alert.alert('Hata', 'Lütfen en az bir gün seçin');
      return;
    }

    try {
      setLoading(true);

      const extraWeeks = parseInt(copyWeeks, 10);
      let totalCreated = 0;
      let totalCopied = 0;

      // Create lessons for each selected day
      for (const dayKey of selectedDays) {
        let lessonData;
        try {
          lessonData = buildLessonPayload(dayKey);
        } catch (payloadError) {
          if (payloadError.message === 'invalid-date') {
            Alert.alert('Hata', 'Seçilen tarih geçerli değil. Lütfen yeniden deneyin.');
            return;
          }
          throw payloadError;
        }

        const result = await adminLessonService.createLesson(lessonData);

        if (result.success) {
          totalCreated++;

          // Copy to future weeks if specified
          if (!Number.isNaN(extraWeeks) && extraWeeks > 0) {
            const copyResult = await adminLessonService.copyLessonToFutureWeeks(
              lessonData,
              extraWeeks
            );

            if (copyResult.success) {
              totalCopied += copyResult.createdCount || 0;
            }
          }
        }
      }

      const dayNames = selectedDays.map(d => DAY_LABELS[d]).join(', ');
      let successMessage = `${totalCreated} ders başarıyla oluşturuldu (${dayNames}).`;

      if (totalCopied > 0) {
        successMessage += `\n${totalCopied} ders ${extraWeeks} hafta boyunca kopyalandı.`;
      }

      Alert.alert('Başarılı', successMessage, [
        {
          text: 'Tamam',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      console.error('Error creating lesson:', error);
      Alert.alert('Hata', 'Ders oluşturulurken bir hata oluştu');
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
      setTempPickerValue(new Date(scheduledDate));
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
    const newDate = new Date(scheduledDate);

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

    // Round the final date to nearest :00 or :30
    const roundedDate = roundToNearestHalfHour(newDate);
    setScheduledDate(roundedDate);
    closePicker();
  };

  const handleCopyWeeksChange = (value) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCopyWeeks(sanitized);
  };

  if (loadingTrainers) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Yeni Ders"
          subtitle="Ders oluştur"
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
          showNotification={false}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <UniqueHeader
        title="Yeni Ders"
        subtitle="Ders bilgilerini girin"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
      />

      <ScrollView 
        ref={scrollViewRef}
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.sectionIconGradient}
            >
              <Ionicons name="information-circle" size={20} color={colors.white} />
            </LinearGradient>
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Temel Bilgiler</Text>
            <Text style={styles.sectionSubtitle}>Ders detaylarını girin</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Ders Başlığı <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputWrapper}>
            <View style={styles.inputIconContainer}>
              <Ionicons name="text-outline" size={18} color={colors.primary} />
            </View>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="Örn: Sabah Yoga"
              placeholderTextColor={colors.textSecondary}
            />
          </View>
        </View>

        {/* Type */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Ders Türü <Text style={styles.required}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
            <View style={styles.chipContainer}>
              {lessonTypes.map((lessonTypeItem) => {
                const isActive = type === lessonTypeItem;
                return (
                  <TouchableOpacity
                    key={lessonTypeItem}
                    style={[styles.typeChip, isActive && styles.typeChipActive]}
                    onPress={() => setType(lessonTypeItem)}
                    activeOpacity={0.7}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.chipGradient}
                      >
                        <Text style={[styles.typeChipText, styles.typeChipTextActive]}>
                          {lessonTypeItem}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.typeChipText}>{lessonTypeItem}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Lesson Type (Group/One-on-One) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Ders Tipi <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.chipContainer}>
            <TouchableOpacity
              style={[styles.lessonTypeChip, lessonType === 'group' && styles.lessonTypeChipActive]}
              onPress={() => handleLessonTypeChange('group')}
              activeOpacity={0.7}
            >
              {lessonType === 'group' ? (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chipGradient}
                >
                  <Text style={[styles.lessonTypeChipText, styles.lessonTypeChipTextActive]}>
                    👥 Grup Dersi
                  </Text>
                </LinearGradient>
              ) : (
                <Text style={styles.lessonTypeChipText}>👥 Grup Dersi</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.lessonTypeChip, lessonType === 'one-on-one' && styles.lessonTypeChipActive]}
              onPress={() => handleLessonTypeChange('one-on-one')}
              activeOpacity={0.7}
            >
              {lessonType === 'one-on-one' ? (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.chipGradient}
                >
                  <Text style={[styles.lessonTypeChipText, styles.lessonTypeChipTextActive]}>
                    👤 Bire Bir Ders
                  </Text>
                </LinearGradient>
              ) : (
                <Text style={styles.lessonTypeChipText}>👤 Bire Bir Ders</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Trainer */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Eğitmen <Text style={styles.required}>*</Text>
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScrollView}>
            <View style={styles.chipContainer}>
              {trainers.map((trainer) => {
                const isActive = selectedTrainer?.id === trainer.id;
                return (
                  <TouchableOpacity
                    key={trainer.id}
                    style={[styles.trainerChip, isActive && styles.trainerChipActive]}
                    onPress={() => setSelectedTrainer(trainer)}
                    activeOpacity={0.7}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.chipGradient}
                      >
                        <View style={styles.trainerAvatar}>
                          <Ionicons name="person" size={16} color={colors.primary} />
                        </View>
                        <Text style={[styles.trainerChipText, styles.trainerChipTextActive]}>
                          {trainer.name}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <>
                        <Ionicons name="person-circle-outline" size={20} color={colors.textSecondary} />
                        <Text style={styles.trainerChipText}>{trainer.name}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Description */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Açıklama</Text>
          <View style={styles.inputWrapper}>
            <View style={[styles.inputIconContainer, styles.inputIconTop]}>
              <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            </View>
            <TextInput
              style={[styles.input, styles.textArea]}
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.sectionIconGradient}
            >
              <Ionicons name="settings-outline" size={20} color={colors.white} />
            </LinearGradient>
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Ders Ayarları</Text>
            <Text style={styles.sectionSubtitle}>Kapasite ve süre</Text>
          </View>
        </View>

        {/* Max Students & Duration */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>
              Max Öğrenci <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
              </View>
              <TextInput
                style={styles.input}
                value={maxStudents}
                onChangeText={setMaxStudents}
                placeholder="12"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>
              Süre (dk) <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputWrapper}>
              <View style={styles.inputIconContainer}>
                <Ionicons name="timer-outline" size={18} color={colors.primary} />
              </View>
              <TextInput
                style={styles.input}
                value={duration}
                onChangeText={setDuration}
                placeholder="60"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIconContainer}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              style={styles.sectionIconGradient}
            >
              <Ionicons name="calendar-outline" size={20} color={colors.white} />
            </LinearGradient>
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Tarih ve Zaman</Text>
            <Text style={styles.sectionSubtitle}>Ders programı</Text>
          </View>
        </View>

        {/* Day */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Ders Günleri <Text style={styles.required}>*</Text>
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScrollView}
          >
            <View style={styles.chipContainer}>
              {DAY_OPTIONS.map(({ key, label: dayLabel }) => {
                const isActive = selectedDays.includes(key);
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.dayChip, isActive && styles.dayChipActive]}
                    onPress={() => handleSelectDay(key)}
                    activeOpacity={0.7}
                  >
                    {isActive ? (
                      <LinearGradient
                        colors={[colors.primary, colors.primaryDark]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.chipGradient}
                      >
                        <Ionicons name="checkmark-circle" size={16} color={colors.white} style={{ marginRight: 6 }} />
                        <Text style={[styles.dayChipText, styles.dayChipTextActive]}>
                          {dayLabel}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <Text style={styles.dayChipText}>{dayLabel}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
          {selectedDays.length > 0 && (
            <View style={styles.selectedDaysInfo}>
              <Ionicons name="information-circle" size={16} color={colors.primary} />
              <Text style={styles.selectedDaysText}>
                {selectedDays.map(d => DAY_LABELS[d]).join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* Date & Time Row */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>
              Tarih <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => openPicker('date')}
              activeOpacity={0.7}
            >
              <View style={styles.dateIconContainer}>
                <Ionicons name="calendar" size={18} color={colors.primary} />
              </View>
              <Text style={styles.dateText}>
                {formatDisplayDate(scheduledDate, language).split(' ').slice(0, 2).join(' ')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputGroup, styles.halfWidth]}>
            <Text style={styles.label}>
              Saat <Text style={styles.required}>*</Text>
            </Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => openPicker('time')}
              activeOpacity={0.7}
            >
              <View style={styles.dateIconContainer}>
                <Ionicons name="time" size={18} color={colors.primary} />
              </View>
              <Text style={styles.dateText}>
                {formatDisplayTime(scheduledDate)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Copy to future weeks */}
        <View style={styles.inputGroup} ref={copyWeeksInputRef}>
          <Text style={styles.label}>Diğer Haftalara Kopyala</Text>
          <View style={styles.copyWeeksCard}>
            <View style={styles.copyWeeksHeader}>
              <View style={styles.copyWeeksIconContainer}>
                <Ionicons name="copy-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.copyWeeksInfo}>
                <Text style={styles.copyWeeksTitle}>Tekrarlayan Ders</Text>
                <Text style={styles.copyWeeksSubtitle}>Aynı dersi gelecek haftalara kopyalayın</Text>
              </View>
            </View>
            <View style={styles.copyInputWrapper}>
              <TextInput
                style={styles.copyInput}
                value={copyWeeks}
                onChangeText={handleCopyWeeksChange}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                keyboardType="number-pad"
                maxLength={2}
                onFocus={() => {
                  setTimeout(() => {
                    copyWeeksInputRef.current?.measureLayout(
                      scrollViewRef.current,
                      (x, y) => {
                        scrollViewRef.current?.scrollTo({
                          y: y - 100,
                          animated: true
                        });
                      },
                      () => {}
                    );
                  }, 100);
                }}
              />
              <Text style={styles.copyInputSuffix}>hafta</Text>
            </View>
          </View>
        </View>

        {/* Create Button */}
        <TouchableOpacity
          style={[styles.createButton, loading && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={loading}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={loading ? [colors.textSecondary, colors.textSecondary] : [colors.success, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.createButtonGradient}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <View style={styles.createButtonIconContainer}>
                  <Ionicons name="add" size={24} color={colors.white} />
                </View>
                <Text style={styles.createButtonText}>Ders Oluştur</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

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
                          : formatDisplayDate(tempPickerValue || new Date(), language)}
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  // Section Headers
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  sectionIconContainer: {
    marginRight: 14,
  },
  sectionIconGradient: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    ...colors.shadow,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  
  // Divider
  divider: {
    height: 1,
    backgroundColor: 'rgba(107, 127, 106, 0.12)',
    marginVertical: 28,
  },
  
  // Modern Input Group
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  required: {
    color: colors.error,
    fontWeight: '800',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIconContainer: {
    position: 'absolute',
    left: 18,
    top: 18,
    zIndex: 1,
  },
  inputIconTop: {
    top: 18,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingLeft: 52,
    paddingRight: 18,
    paddingVertical: 18,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.1)',
    fontWeight: '500',
    ...colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  textArea: {
    minHeight: 130,
    paddingTop: 18,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  
  // Row Layout
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  halfWidth: {
    flex: 1,
  },
  
  // Modern Chip Styles
  chipScrollView: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  chipContainer: {
    flexDirection: 'row',
    paddingVertical: 4,
    gap: 10,
  },
  chipGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 20,
  },
  
  // Type Chips
  typeChip: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.15)',
    overflow: 'hidden',
    ...colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  typeChipActive: {
    borderColor: 'transparent',
    transform: [{ scale: 1.03 }],
  },
  typeChipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    letterSpacing: 0.2,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  typeChipTextActive: {
    color: colors.white,
    fontWeight: '700',
  },

  // Lesson Type Chips (Group/One-on-One)
  lessonTypeChip: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2.5,
    borderColor: 'rgba(107, 127, 106, 0.2)',
    overflow: 'hidden',
    marginHorizontal: 6,
    ...colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    minHeight: 64,
    justifyContent: 'center',
  },
  lessonTypeChipActive: {
    borderColor: colors.primary,
    borderWidth: 3,
    transform: [{ scale: 1.03 }],
    ...colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowColor: colors.primary,
    elevation: 8,
  },
  lessonTypeChipText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.3,
    paddingHorizontal: 20,
    paddingVertical: 18,
    textAlign: 'center',
    lineHeight: 22,
  },
  lessonTypeChipTextActive: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  
  // Day Chips
  dayChip: {
    backgroundColor: colors.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.15)',
    minWidth: 76,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    ...colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  dayChipActive: {
    borderColor: 'transparent',
    transform: [{ scale: 1.05 }],
  },
  dayChipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  dayChipTextActive: {
    color: colors.white,
  },
  selectedDaysInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: `${colors.primary}10`,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  selectedDaysText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
    flex: 1,
  },
  
  // Trainer Chips
  trainerChip: {
    backgroundColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.15)',
    overflow: 'hidden',
    ...colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  trainerChipActive: {
    borderColor: 'transparent',
    transform: [{ scale: 1.03 }],
  },
  trainerChipText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '600',
    marginLeft: 10,
    letterSpacing: 0.2,
    paddingRight: 18,
    paddingVertical: 12,
  },
  trainerChipTextActive: {
    color: colors.white,
    fontWeight: '700',
    marginLeft: 8,
  },
  trainerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 2,
  },
  
  // Modern Date Button
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.1)',
    ...colors.shadow,
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },
  dateIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  dateText: {
    fontSize: 15,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.2,
    flex: 1,
  },
  
  // Copy Weeks Card
  copyWeeksCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 20,
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.1)',
    ...colors.shadow,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  copyWeeksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  copyWeeksIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  copyWeeksInfo: {
    flex: 1,
  },
  copyWeeksTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  copyWeeksSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
    lineHeight: 16,
  },
  copyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(107, 127, 106, 0.15)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: `${colors.primary}05`,
  },
  copyInput: {
    flex: 1,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  copyInputSuffix: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  
  // Modern Create Button
  createButton: {
    marginTop: 16,
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    ...colors.shadow,
    shadowColor: colors.success,
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
  },
  createButtonIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  createButtonText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  
  // Modern Picker Modal (keeping existing styles but enhanced)
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  pickerCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    ...colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    ...colors.shadow,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  pickerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(107, 127, 106, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerBody: {
    borderRadius: 20,
    backgroundColor: `${colors.primary}08`,
    paddingVertical: Platform.OS === 'ios' ? 20 : 16,
    paddingHorizontal: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
  },
  pickerPreviewLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  pickerPreviewValue: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 18,
    letterSpacing: -0.5,
  },
  pickerComponentWrapper: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: colors.white,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
    ...colors.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  pickerActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  pickerActionSecondary: {
    flex: 1,
    backgroundColor: `${colors.primary}10`,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: `${colors.primary}25`,
  },
  pickerActionSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  pickerActionPrimary: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  pickerActionPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.5,
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
  
  // Modern Time Slot List
  timeSlotScroll: {
    maxHeight: 320,
    width: '100%',
  },
  timeSlotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(107, 127, 106, 0.1)',
    backgroundColor: colors.white,
  },
  timeSlotItemActive: {
    backgroundColor: `${colors.primary}12`,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  timeSlotText: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  timeSlotTextActive: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 0.5,
  },
});
