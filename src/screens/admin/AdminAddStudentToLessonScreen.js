import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { adminLessonService as lessonService } from '../../services/lessonService';
import UniqueHeader from '../../components/UniqueHeader';

export default function AdminAddStudentToLessonScreen({ navigation, route }) {
  const { user } = useAuth();
  const { lesson } = route.params;
  
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addingStudent, setAddingStudent] = useState(null);
  const [currentParticipants, setCurrentParticipants] = useState(lesson.participants || []);

  useEffect(() => {
    loadStudents();
  }, []);

  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, currentParticipants]);

  const loadStudents = async () => {
    try {
      setLoading(true);
      const result = await lessonService.getAllStudents();
      
      if (result.success) {
        setStudents(result.students);
      } else {
        Alert.alert('Hata', result.message || 'Öğrenciler yüklenemedi');
      }
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Hata', 'Öğrenciler yüklenirken bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const filterStudents = () => {
    let filtered = students;

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (student) =>
          student.name.toLowerCase().includes(searchLower) ||
          student.email?.toLowerCase().includes(searchLower) ||
          student.phone?.includes(searchTerm)
      );
    }

    setFilteredStudents(filtered);
  };

  const handleAddStudent = async (student) => {
    try {
      setAddingStudent(student.id);

      const result = await lessonService.addStudentToLesson(
        lesson.id,
        student.id,
        user.uid
      );

      if (result.success) {
        setCurrentParticipants([...currentParticipants, student.id]);
        Alert.alert('Başarılı', result.message);
      } else {
        Alert.alert('Hata', result.message);
      }
    } catch (error) {
      console.error('Error adding student:', error);
      Alert.alert('Hata', 'Öğrenci eklenirken bir hata oluştu');
    } finally {
      setAddingStudent(null);
    }
  };

  const handleRemoveStudent = async (student) => {
    Alert.alert(
      'Öğrenciyi Çıkar',
      `${student.name} adlı öğrenciyi dersten çıkarmak istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              setAddingStudent(student.id);

              const result = await lessonService.removeStudentFromLesson(
                lesson.id,
                student.id,
                user.uid
              );

              if (result.success) {
                setCurrentParticipants(currentParticipants.filter(id => id !== student.id));
                Alert.alert('Başarılı', result.message);
              } else {
                Alert.alert('Hata', result.message);
              }
            } catch (error) {
              console.error('Error removing student:', error);
              Alert.alert('Hata', 'Öğrenci çıkarılırken bir hata oluştu');
            } finally {
              setAddingStudent(null);
            }
          },
        },
      ]
    );
  };

  const isStudentEnrolled = (studentId) => currentParticipants.includes(studentId);
  const isFull = currentParticipants.length >= lesson.maxParticipants;

  // Check if lesson is in the past
  const isLessonInPast = () => {
    if (!lesson.scheduledDate || !lesson.startTime) return false;
    
    const now = new Date();
    let lessonDate;
    
    if (typeof lesson.scheduledDate === 'string') {
      lessonDate = new Date(lesson.scheduledDate);
    } else if (lesson.scheduledDate.toDate) {
      lessonDate = lesson.scheduledDate.toDate();
    } else {
      lessonDate = new Date(lesson.scheduledDate);
    }
    
    const [hours, minutes] = lesson.startTime.split(':').map(Number);
    lessonDate.setHours(hours, minutes, 0, 0);
    
    return lessonDate < now;
  };

  const isPastLesson = isLessonInPast();

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Öğrenci Ekle"
          subtitle={lesson.title}
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
    <View style={styles.container}>
      <UniqueHeader
        title="Öğrenci Ekle"
        subtitle={lesson.title}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
      />

      <View style={styles.content}>
        {/* Past Lesson Warning */}
        {isPastLesson && (
          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={20} color={colors.warning} />
            <Text style={styles.warningText}>
              Bu ders geçmişte kaldı. Öğrenci eklenemez veya çıkarılamaz.
            </Text>
          </View>
        )}

        {/* Lesson Info */}
        <View style={styles.lessonInfo}>
          <View style={styles.lessonInfoRow}>
            <Ionicons name="people" size={18} color={colors.primary} />
            <Text style={styles.lessonInfoText}>
              {currentParticipants.length} / {lesson.maxParticipants} Öğrenci
            </Text>
          </View>
          {isFull && (
            <View style={styles.fullBadge}>
              <Text style={styles.fullBadgeText}>Dolu</Text>
            </View>
          )}
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Öğrenci ara (isim, email, telefon)"
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Students List */}
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          {filteredStudents.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyText}>
                {searchTerm ? 'Öğrenci bulunamadı' : 'Henüz öğrenci yok'}
              </Text>
            </View>
          ) : (
            filteredStudents.map((student) => {
              const enrolled = isStudentEnrolled(student.id);
              const isProcessing = addingStudent === student.id;
              const isFrozen = student.membershipStatus === 'frozen' || student.status === 'frozen';

              return (
                <View key={student.id} style={styles.studentCard}>
                  <View style={styles.studentInfo}>
                    <View style={styles.studentAvatar}>
                      <Ionicons name="person" size={24} color={colors.white} />
                    </View>
                    <View style={styles.studentDetails}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        {enrolled && (
                          <View style={styles.enrolledBadge}>
                            <Text style={styles.enrolledBadgeText}>Kayıtlı</Text>
                          </View>
                        )}
                        {isFrozen && (
                          <View style={styles.frozenBadge}>
                            <Text style={styles.frozenBadgeText}>❄️ Donduruldu</Text>
                          </View>
                        )}
                      </View>
                      {student.email && (
                        <Text style={styles.studentContact}>{student.email}</Text>
                      )}
                      {student.phone && (
                        <Text style={styles.studentContact}>{student.phone}</Text>
                      )}
                    </View>
                  </View>

                  {enrolled ? (
                    <TouchableOpacity
                      style={[styles.removeButton, isPastLesson && styles.removeButtonDisabled]}
                      onPress={() => handleRemoveStudent(student)}
                      disabled={isProcessing || isPastLesson}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.error} />
                      ) : (
                        <>
                          <Ionicons name="remove-circle" size={20} color={isPastLesson ? colors.textSecondary : colors.error} />
                          <Text style={[styles.removeButtonText, isPastLesson && styles.removeButtonTextDisabled]}>
                            {isPastLesson ? 'Geçmiş' : 'Çıkar'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.addButton, (isFull || isPastLesson || isFrozen) && styles.addButtonDisabled]}
                      onPress={() => handleAddStudent(student)}
                      disabled={isProcessing || isFull || isPastLesson || isFrozen}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.white} />
                      ) : (
                        <>
                          <Ionicons name="add-circle" size={20} color={colors.white} />
                          <Text style={styles.addButtonText}>
                            {isFrozen ? 'Dondurulmuş' : isPastLesson ? 'Geçmiş' : isFull ? 'Dolu' : 'Ekle'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              );
            })
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      </View>
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
    marginTop: 12,
    fontSize: 14,
    color: colors.textSecondary,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFE69C',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#856404',
    fontWeight: '500',
  },
  lessonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    marginBottom: 12,
    ...colors.shadow,
  },
  lessonInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lessonInfoText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  fullBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  fullBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    ...colors.shadow,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    marginLeft: 12,
  },
  listContainer: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    ...colors.shadow,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  studentContact: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  addButtonDisabled: {
    backgroundColor: colors.border,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginLeft: 6,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
    marginLeft: 12,
  },
  removeButtonDisabled: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    opacity: 0.6,
  },
  removeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
    marginLeft: 6,
  },
  removeButtonTextDisabled: {
    color: colors.textSecondary,
  },
  enrolledBadge: {
    backgroundColor: colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  enrolledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },
  frozenBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  frozenBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.white,
  },
});
