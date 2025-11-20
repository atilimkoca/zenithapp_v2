import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const lessonTypesService = {
  // Get lesson types from Firebase settings or return defaults
  getLessonTypes: async () => {
    try {
      
      // Try to get lesson types from settings collection
      const settingsDoc = await getDoc(doc(db, 'settings', 'lessonTypes'));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        return {
          success: true,
          lessonTypes: data.types || getDefaultLessonTypes()
        };
      } else {
        return {
          success: true,
          lessonTypes: getDefaultLessonTypes()
        };
      }
    } catch (error) {
      console.error('❌ Error fetching lesson types:', error);
      return {
        success: true,
        lessonTypes: getDefaultLessonTypes(),
        warning: 'Varsayılan ders türleri kullanılıyor.'
      };
    }
  },

  // Get lesson type by ID
  getLessonTypeById: async (typeId) => {
    try {
      const result = await this.getLessonTypes();
      const lessonType = result.lessonTypes.find(type => 
        type.id === typeId || 
        type.name.toLowerCase() === typeId.toLowerCase()
      );
      
      if (lessonType) {
        return {
          success: true,
          lessonType: lessonType
        };
      } else {
        return {
          success: false,
          message: 'Ders türü bulunamadı.'
        };
      }
    } catch (error) {
      console.error('❌ Error getting lesson type by ID:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders türü bilgisi yüklenirken hata oluştu.'
      };
    }
  },

  // Search lesson types
  searchLessonTypes: async (searchTerm) => {
    try {
      const result = await this.getLessonTypes();
      if (!result.success) {
        return result;
      }

      const searchLower = searchTerm.toLowerCase();
      const filteredTypes = result.lessonTypes.filter(type => 
        type.name.toLowerCase().includes(searchLower) ||
        type.description.toLowerCase().includes(searchLower) ||
        type.difficulty.some(level => level.toLowerCase().includes(searchLower))
      );

      return {
        success: true,
        lessonTypes: filteredTypes
      };
    } catch (error) {
      console.error('❌ Error searching lesson types:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders türü arama işleminde hata oluştu.',
        lessonTypes: []
      };
    }
  }
};

// Default lesson types if not found in Firebase
const getDefaultLessonTypes = () => {
  return [
    {
      id: 'pilates',
      name: 'Pilates',
      description: 'Core güçlendirme ve postür düzeltme egzersizleri',
      icon: 'fitness-outline',
      color: '#8B5CF6',
      difficulty: ['beginner', 'intermediate', 'advanced'],
      duration: [45, 60, 75],
      maxParticipants: 12,
      equipment: ['Pilates Matı', 'Pilates Topu', 'Resistance Band'],
      benefits: ['Core Gücü', 'Postür Düzeltme', 'Denge']
    },
    {
      id: 'yoga',
      name: 'Yoga',
      description: 'Yoga pratiği',
      icon: 'leaf-outline',
      color: '#10B981',
      difficulty: ['beginner', 'intermediate', 'advanced'],
      duration: [60, 75, 90],
      maxParticipants: 15,
      equipment: ['Yoga Matı', 'Yoga Bloku', 'Yoga Kayışı'],
      benefits: ['Zihin Dinginliği', 'Stres Azaltma', 'Güç']
    },
    {
      id: 'reformer',
      name: 'Reformer Pilates',
      description: 'Reformer cihazı ile pilates egzersizleri',
      icon: 'barbell-outline',
      color: '#F59E0B',
      difficulty: ['intermediate', 'advanced'],
      duration: [50, 60],
      maxParticipants: 8,
      equipment: ['Reformer Cihazı'],
      benefits: ['Tam Vücut Kondisyon', 'Kas Tanımlama', 'Güç']
    },
    {
      id: 'mat-pilates',
      name: 'Mat Pilates',
      description: 'Matla yapılan pilates egzersizleri',
      icon: 'body-outline',
      color: '#3B82F6',
      difficulty: ['beginner', 'intermediate'],
      duration: [45, 60],
      maxParticipants: 15,
      equipment: ['Pilates Matı', 'Pilates Topu'],
      benefits: ['Core Gücü', 'Postür', 'Denge', 'Koordinasyon']
    },
    {
      id: 'vinyasa',
      name: 'Vinyasa Yoga',
      description: 'Akıcı yoga sekansları',
      icon: 'flower-outline',
      color: '#F97316',
      difficulty: ['intermediate', 'advanced'],
      duration: [75, 90],
      maxParticipants: 12,
      equipment: ['Yoga Matı', 'Yoga Bloku'],
      benefits: ['Güç', 'Koordinasyon', 'Akış', 'Kardiyovasküler Sağlık']
    },
    {
      id: 'yin-yoga',
      name: 'Yin Yoga',
      description: 'Derin gevşeme ve esneklik için yavaş yoga',
      icon: 'moon-outline',
      color: '#84CC16',
      difficulty: ['all'],
      duration: [75, 90],
      maxParticipants: 15,
      equipment: ['Yoga Matı', 'Bolster', 'Yoga Bloku', 'Battaniye'],
      benefits: ['Derin Esneme', 'Gevşeme', 'Stres Azaltma', 'İç Huzur']
    },
    {
      id: 'hatha',
      name: 'Hatha Yoga',
      description: 'Geleneksel yoga pozları ve nefes çalışması',
      icon: 'sunny-outline',
      color: '#6366F1',
      difficulty: ['beginner', 'intermediate'],
      duration: [60, 75],
      maxParticipants: 15,
      equipment: ['Yoga Matı', 'Yoga Bloku', 'Yoga Kayışı'],
      benefits: ['Denge', 'Zihin Rahatlama', 'Nefes Kontrolü']
    },
    {
      id: 'meditation',
      name: 'Meditasyon',
      description: 'Zihin dinginliği ve farkındalık pratiği',
      icon: 'heart-outline',
      color: '#8B5CF6',
      difficulty: ['all'],
      duration: [30, 45],
      maxParticipants: 20,
      equipment: ['Meditasyon Minderi', 'Battaniye'],
      benefits: ['Zihin Dinginliği', 'Konsantrasyon', 'Stres Azaltma', 'İç Farkındalık']
    },
    {
      id: 'stretching',
      name: 'Stretching',
      description: 'Esneklik ve mobilite geliştirme egzersizleri',
      icon: 'accessibility-outline',
      color: '#14B8A6',
      difficulty: ['beginner', 'intermediate'],
      duration: [45, 60],
      maxParticipants: 15,
      equipment: ['Yoga Matı', 'Yoga Kayışı'],
      benefits: ['Mobilite', 'Kas Gevşemesi', 'Yaralanma Önleme']
    },
    {
      id: 'strength',
      name: 'Strength Training',
      description: 'Güç ve dayanıklılık geliştirme antrenmanları',
      icon: 'barbell-outline',
      color: '#EF4444',
      difficulty: ['intermediate', 'advanced'],
      duration: [45, 60],
      maxParticipants: 10,
      equipment: ['Dumbbell', 'Resistance Band', 'Kettlebell'],
      benefits: ['Kas Gücü', 'Dayanıklılık', 'Metabolizma', 'Kemik Yoğunluğu']
    }
  ];
};
