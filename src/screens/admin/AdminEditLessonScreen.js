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
import { colors } from '../../constants/colors';
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
  const [copyWeeks, setCopyWeeks] = useState('');
  const [copyLoading, setCopyLoading] = useState(false);
  const participantsCount = lesson.enrolledStudents?.length || lesson.participants?.length || 0;
  const parsedMaxStudents = parseInt(maxStudents, 10);
  const isIOS = Platform.OS === 'ios';
  const maxCapacity =
    !Number.isNaN(parsedMaxStudents) && parsedMaxStudents > 0
      ? parsedMaxStudents
      : lesson.maxStudents || lesson.maxParticipants || 0;
  const endTimePreview = getEndTimePreview(scheduledDate, duration);
  const availableSlots = maxCapacity > 0 ? Math.max(0, maxCapacity - participantsCount) : null;
  useEffect(() => {
    setSelectedDay(getDayKeyFromDate(scheduledDate));
  }, [scheduledDate]);
  const weekdayLabel = DAY_LABELS[selectedDay] || 'Bilinmiyor';

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
      scheduledDate: baseDate.toISOString(),
      startTime: formatTimeForSave(baseDate),
      endTime: formatTimeForSave(endDate),
      dayOfWeek: selectedDay,
      updatedBy: user.uid,
    };
  };

  const handleCopyWeeksChange = (value) => {
    const sanitized = value.replace(/[^0-9]/g, '');
    setCopyWeeks(sanitized);
  };

  const handleCopyToFutureWeeks = async () => {
    const weeksCount = parseInt(copyWeeks, 10);

    if (Number.isNaN(weeksCount) || weeksCount < 1) {
      Alert.alert('Hata', 'Lütfen geçerli bir hafta sayısı girin (en az 1).');
      return;
    }

    try {
      setCopyLoading(true);
      const payload = buildLessonPayload();
      const copyResult = await adminLessonService.copyLessonToFutureWeeks(payload, weeksCount);

      if (copyResult.success) {
        Alert.alert('Başarılı', `${copyResult.createdCount} hafta için ders kopyalandı.`);
        setCopyWeeks('');
      } else {
        Alert.alert('Hata', copyResult.message || 'Ders kopyalanamadı. Lütfen tekrar deneyin.');
      }
    } catch (error) {
      if (error.message === 'invalid-date') {
        Alert.alert('Hata', 'Ders tarihi geçerli değil. Lütfen tarihi güncelleyin.');
      } else {
        console.error('Error copying lesson:', error);
        Alert.alert('Hata', 'Ders kopyalanırken bir hata oluştu.');
      }
    } finally {
      setCopyLoading(false);
    }
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
        Alert.alert('Başarılı', 'Ders başarıyla güncellendi', [
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ders Bilgileri</Text>
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
          <Text style={styles.sectionTitle}>Program</Text>
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

            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Ders Süresi (Dakika) *</Text>
              <View style={styles.metaInputWrapper}>
                <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                <TextInput
                  style={styles.metaInput}
                  value={duration}
                  onChangeText={setDuration}
                  placeholder="Örn: 60"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.metaInfoRow}>
              <View style={styles.metaChip}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.metaChipText}>{weekdayLabel}</Text>
              </View>
              <View style={styles.metaChip}>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
                <Text style={styles.metaChipText}>Bitiş: {endTimePreview}</Text>
              </View>
            </View>

            <View style={[styles.copySection, styles.fieldWrapperLast]}>
              <Text style={styles.copyLabel}>Bu dersi diğer haftalara kopyala</Text>
              <View style={styles.copyControls}>
                <View style={styles.copyInputWrapper}>
                  <TextInput
                    style={styles.copyInput}
                    value={copyWeeks}
                    onChangeText={handleCopyWeeksChange}
                    placeholder="0"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={styles.copyInputSuffix}>hafta</Text>
                </View>
                <TouchableOpacity
                  style={[styles.copyButton, copyLoading && styles.copyButtonDisabled]}
                  onPress={handleCopyToFutureWeeks}
                  disabled={copyLoading}
                >
                  {copyLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <>
                      <Ionicons name="copy-outline" size={16} color={colors.white} />
                      <Text style={styles.copyButtonText}>Kopyala</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
              <Text style={styles.helperText}>
                Girilen hafta sayısı kadar ders gelecek haftalara eklenir.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Kontenjan</Text>
          <View style={styles.card}>
            <View style={styles.fieldWrapper}>
              <Text style={styles.fieldLabel}>Maksimum Öğrenci Sayısı *</Text>
              <View style={styles.metaInputWrapper}>
                <Ionicons name="people-outline" size={18} color={colors.primary} />
                <TextInput
                  style={styles.metaInput}
                  value={maxStudents}
                  onChangeText={setMaxStudents}
                  placeholder="Örn: 15"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={[styles.infoStrip, styles.fieldWrapperLast]}>
              <View style={styles.infoStripIcon}>
                <Ionicons name="information-circle" size={20} color={colors.primary} />
              </View>
              <View style={styles.infoStripContent}>
                <Text style={styles.infoStripTitle}>Mevcut Katılımcı Durumu</Text>
                <Text style={styles.infoStripText}>
                  {participantsCount} öğrenci kayıtlı
                  {availableSlots !== null && ` • ${availableSlots} kontenjan boş`}
                </Text>
                <Text style={styles.infoStripNote}>
                  Maksimum öğrenci sayısını mevcut kayıtlı sayının altına düşüremezsiniz.
                </Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
    paddingBottom: 48,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.2,
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
  metaInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    marginRight: -10,
    marginBottom: -10,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 10,
    marginBottom: 10,
  },
  metaChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
    textTransform: 'capitalize',
    marginLeft: 6,
  },
  copySection: {
    marginTop: 16,
  },
  copyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 10,
  },
  copyControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  copyInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
    width: 140,
    marginRight: 12,
  },
  copyInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
  },
  copyInputSuffix: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...colors.shadow,
  },
  copyButtonDisabled: {
    opacity: 0.6,
  },
  copyButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  infoStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: `${colors.primary}20`,
  },
  infoStripIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...colors.shadow,
  },
  infoStripContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoStripTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoStripText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  infoStripNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 10,
    ...colors.shadow,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
