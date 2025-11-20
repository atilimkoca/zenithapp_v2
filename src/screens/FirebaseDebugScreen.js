import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { colors } from '../constants/colors';
import { lessonService } from '../services/lessonService';
import { trainerService } from '../services/trainerService';
import { lessonTypesService } from '../services/lessonTypesService';

/**
 * Firebase Debug Component
 * Bu component Firebase bağlantısını ve veri yapısını test etmek için kullanılır
 */
export default function FirebaseDebugScreen() {
  const [debugInfo, setDebugInfo] = useState({
    lessons: { status: 'pending', data: null, error: null },
    trainers: { status: 'pending', data: null, error: null },
    lessonTypes: { status: 'pending', data: null, error: null }
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runAllTests();
  }, []);

  const runAllTests = async () => {
    setLoading(true);

    // Test 1: Lessons
    try {
      const lessonsResult = await lessonService.getAllLessons();
      setDebugInfo(prev => ({
        ...prev,
        lessons: {
          status: lessonsResult.success ? 'success' : 'error',
          data: lessonsResult,
          error: lessonsResult.success ? null : lessonsResult.message
        }
      }));
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        lessons: {
          status: 'error',
          data: null,
          error: error.message
        }
      }));
    }

    // Test 2: Trainers
    try {
      const trainersResult = await trainerService.getAllTrainers();
      setDebugInfo(prev => ({
        ...prev,
        trainers: {
          status: trainersResult.success ? 'success' : 'error',
          data: trainersResult,
          error: trainersResult.success ? null : trainersResult.message
        }
      }));
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        trainers: {
          status: 'error',
          data: null,
          error: error.message
        }
      }));
    }

    // Test 3: Lesson Types
    try {
      const typesResult = await lessonTypesService.getLessonTypes();
      setDebugInfo(prev => ({
        ...prev,
        lessonTypes: {
          status: typesResult.success ? 'success' : 'error',
          data: typesResult,
          error: typesResult.success ? null : typesResult.message
        }
      }));
    } catch (error) {
      setDebugInfo(prev => ({
        ...prev,
        lessonTypes: {
          status: 'error',
          data: null,
          error: error.message
        }
      }));
    }

    setLoading(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'success': return colors.success;
      case 'error': return colors.error;
      case 'pending': return colors.warning;
      default: return colors.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'pending': return '⏳';
      default: return '❓';
    }
  };

  const renderTestSection = (title, testKey, data) => (
    <View style={styles.testSection}>
      <View style={styles.testHeader}>
        <Text style={styles.testTitle}>
          {getStatusIcon(data.status)} {title}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(data.status) }]}>
          <Text style={styles.statusText}>{data.status.toUpperCase()}</Text>
        </View>
      </View>

      {data.error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Hata:</Text>
          <Text style={styles.errorText}>{data.error}</Text>
        </View>
      )}

      {data.data && (
        <View style={styles.dataContainer}>
          <Text style={styles.dataTitle}>Sonuçlar:</Text>
          
          {testKey === 'lessons' && (
            <View style={styles.dataStats}>
              <Text style={styles.statText}>📚 Dersler: {data.data.lessons?.length || 0}</Text>
              <Text style={styles.statText}>👥 Eğitmenler: {data.data.trainers?.length || 0}</Text>
              <Text style={styles.statText}>🏷️ Ders Türleri: {data.data.lessonTypes?.length || 0}</Text>
              <Text style={styles.statText}>📅 Tarih Grupları: {data.data.groupedLessons?.length || 0}</Text>
            </View>
          )}

          {testKey === 'trainers' && (
            <View style={styles.dataStats}>
              <Text style={styles.statText}>👨‍🏫 Toplam Eğitmen: {data.data.trainers?.length || 0}</Text>
              {data.data.trainers?.map((trainer, index) => (
                <Text key={index} style={styles.trainerItem}>
                  • {trainer.displayName} ({trainer.specializations?.join(', ') || 'Specialization yok'})
                </Text>
              ))}
            </View>
          )}

          {testKey === 'lessonTypes' && (
            <View style={styles.dataStats}>
              <Text style={styles.statText}>🏷️ Ders Türleri: {data.data.lessonTypes?.length || 0}</Text>
              {data.data.lessonTypes?.slice(0, 5).map((type, index) => (
                <Text key={index} style={styles.typeItem}>
                  • {type.name} - {type.description?.substring(0, 30)}...
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );

  const handleShowRawData = (testKey) => {
    const data = debugInfo[testKey].data;
    Alert.alert(
      `${testKey.toUpperCase()} Raw Data`,
      JSON.stringify(data, null, 2),
      [{ text: 'Kapat', style: 'cancel' }],
      { userInterfaceStyle: 'light' }
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔧 Firebase Debug</Text>
        <Text style={styles.headerSubtitle}>Bağlantı ve veri yapısı testi</Text>
      </View>

      <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={[styles.refreshButton, loading && styles.refreshButtonDisabled]}
          onPress={runAllTests}
          disabled={loading}
        >
          <Text style={styles.refreshButtonText}>
            {loading ? '🔄 Test Çalışıyor...' : '🔄 Testleri Yeniden Çalıştır'}
          </Text>
        </TouchableOpacity>

        {renderTestSection('Dersler (Lessons)', 'lessons', debugInfo.lessons)}
        {renderTestSection('Eğitmenler (Trainers)', 'trainers', debugInfo.trainers)}
        {renderTestSection('Ders Türleri (Lesson Types)', 'lessonTypes', debugInfo.lessonTypes)}

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>ℹ️ Debug Bilgileri</Text>
          <Text style={styles.infoText}>
            • Bu ekran Firebase bağlantısını test eder{'\n'}
            • Tüm servisler çalıştırılır ve sonuçlar gösterilir{'\n'}
            • Hata durumunda detaylar Console'da loglanır{'\n'}
            • Raw data görmek için test başlıklarına basın
          </Text>
        </View>

        <View style={styles.buttonsContainer}>
          {Object.keys(debugInfo).map(testKey => (
            <TouchableOpacity
              key={testKey}
              style={styles.rawDataButton}
              onPress={() => handleShowRawData(testKey)}
            >
              <Text style={styles.rawDataButtonText}>
                {testKey.toUpperCase()} Raw Data
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  scrollContainer: {
    flex: 1,
    padding: 16,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  refreshButtonDisabled: {
    backgroundColor: colors.gray,
  },
  refreshButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  testSection: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  testHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: colors.error + '10',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    lineHeight: 18,
  },
  dataContainer: {
    backgroundColor: colors.success + '05',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: colors.success,
  },
  dataTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
    marginBottom: 8,
  },
  dataStats: {
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  trainerItem: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  typeItem: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  infoSection: {
    backgroundColor: colors.primary + '08',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  buttonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 32,
  },
  rawDataButton: {
    backgroundColor: colors.secondary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    flex: 1,
    minWidth: '30%',
  },
  rawDataButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});
