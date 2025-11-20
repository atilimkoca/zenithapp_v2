import { collection, query, where, getDocs, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const trainerService = {
  // Get all active trainers
  getAllTrainers: async () => {
    try {
      const trainersQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['instructor', 'admin'])
      );
      
      const trainersSnapshot = await getDocs(trainersQuery);
      const trainers = [];
      
      trainersSnapshot.forEach((doc) => {
        const trainerData = doc.data();
        
        // Include all trainers for admin view (not just active ones)
        trainers.push({
          id: doc.id,
          displayName: trainerData.displayName || `${trainerData.firstName || ''} ${trainerData.lastName || ''}`.trim(),
          firstName: trainerData.firstName || '',
          lastName: trainerData.lastName || '',
          email: trainerData.email || '',
          profileImage: trainerData.profileImage || null,
          specializations: trainerData.trainerProfile?.specializations || [],
          bio: trainerData.trainerProfile?.bio || '',
          experience: trainerData.trainerProfile?.experience || '',
          certifications: trainerData.trainerProfile?.certifications || [],
          isActive: trainerData.status === 'active' && trainerData.trainerProfile?.isActive !== false,
          status: trainerData.status || 'active',
          rating: trainerData.trainerProfile?.rating || 0,
          totalClasses: trainerData.trainerProfile?.totalClasses || 0,
          totalLessons: trainerData.trainerProfile?.totalLessons || 0,
          joinedDate: trainerData.createdAt || trainerData.trainerProfile?.joinedDate
        });
      });

      return {
        success: true,
        trainers: trainers
      };
    } catch (error) {
      console.error('❌ Error fetching trainers from mobile:', error);
      return {
        success: false,
        error: error.code,
        message: 'Eğitmenler yüklenirken hata oluştu.',
        trainers: []
      };
    }
  },

  // Get trainer by ID
  getTrainerById: async (trainerId) => {
    try {
      const trainerDoc = await getDoc(doc(db, 'users', trainerId));
      
      if (!trainerDoc.exists()) {
        return {
          success: false,
          message: 'Eğitmen bulunamadı.'
        };
      }
      
      const trainerData = trainerDoc.data();
      
      // Check if user is actually a trainer
      if (!['instructor', 'admin'].includes(trainerData.role)) {
        return {
          success: false,
          message: 'Bu kullanıcı eğitmen değil.'
        };
      }
      
      const trainer = {
        id: trainerDoc.id,
        displayName: trainerData.displayName || `${trainerData.firstName || ''} ${trainerData.lastName || ''}`.trim(),
        firstName: trainerData.firstName || '',
        lastName: trainerData.lastName || '',
        email: trainerData.email || '',
        profileImage: trainerData.profileImage || null,
        specializations: trainerData.trainerProfile?.specializations || [],
        bio: trainerData.trainerProfile?.bio || '',
        experience: trainerData.trainerProfile?.experience || '',
        certifications: trainerData.trainerProfile?.certifications || [],
        isActive: trainerData.status === 'active' && trainerData.trainerProfile?.isActive !== false,
        rating: trainerData.trainerProfile?.rating || 0,
        totalClasses: trainerData.trainerProfile?.totalClasses || 0,
        joinedDate: trainerData.createdAt || trainerData.trainerProfile?.joinedDate
      };
      
      return {
        success: true,
        trainer: trainer
      };
    } catch (error) {
      console.error('❌ Error fetching trainer by ID:', error);
      return {
        success: false,
        error: error.code,
        message: 'Eğitmen bilgileri yüklenirken hata oluştu.'
      };
    }
  },

  // Search trainers by name or specialization
  searchTrainers: async (searchTerm) => {
    try {
      const result = await this.getAllTrainers();
      if (!result.success) {
        return result;
      }

      const searchLower = searchTerm.toLowerCase();
      const filteredTrainers = result.trainers.filter(trainer => {
        const fullName = `${trainer.firstName || ''} ${trainer.lastName || ''}`.toLowerCase();
        const specializations = trainer.specializations.join(' ').toLowerCase();
        const bio = trainer.bio.toLowerCase();
        
        return fullName.includes(searchLower) || 
               trainer.displayName.toLowerCase().includes(searchLower) ||
               specializations.includes(searchLower) || 
               bio.includes(searchLower);
      });

      return {
        success: true,
        trainers: filteredTrainers
      };
    } catch (error) {
      console.error('❌ Error searching trainers:', error);
      return {
        success: false,
        error: error.code,
        message: 'Eğitmen arama işleminde hata oluştu.',
        trainers: []
      };
    }
  },

  // Get trainers by specialization
  getTrainersBySpecialization: async (specialization) => {
    try {
      const result = await this.getAllTrainers();
      if (!result.success) {
        return result;
      }

      const filteredTrainers = result.trainers.filter(trainer => 
        trainer.specializations.some(spec => 
          spec.toLowerCase().includes(specialization.toLowerCase())
        )
      );

      return {
        success: true,
        trainers: filteredTrainers
      };
    } catch (error) {
      console.error('❌ Error filtering trainers by specialization:', error);
      return {
        success: false,
        error: error.code,
        message: 'Uzmanlık alanına göre filtreleme hatası.',
        trainers: []
      };
    }
  },

  // Get trainer's upcoming lessons
  getTrainerLessons: async (trainerId) => {
    try {
      const lessonsQuery = query(
        collection(db, 'lessons'),
        where('trainerId', '==', trainerId),
        where('status', '==', 'active')
      );
      
      const lessonsSnapshot = await getDocs(lessonsQuery);
      const lessons = [];
      const today = new Date();
      
      lessonsSnapshot.forEach((doc) => {
        const lessonData = doc.data();
        
        // Only include future lessons
        if (lessonData.scheduledDate) {
          const lessonDate = new Date(lessonData.scheduledDate);
          if (lessonDate >= today) {
            lessons.push({
              id: doc.id,
              ...lessonData
            });
          }
        }
      });
      
      // Sort by date and time
      lessons.sort((a, b) => {
        const dateTimeA = new Date(`${a.scheduledDate}T${a.startTime}`);
        const dateTimeB = new Date(`${b.scheduledDate}T${b.startTime}`);
        return dateTimeA - dateTimeB;
      });
      
      return {
        success: true,
        lessons: lessons
      };
    } catch (error) {
      console.error('❌ Error fetching trainer lessons:', error);
      return {
        success: false,
        error: error.code,
        message: 'Eğitmen dersleri yüklenirken hata oluştu.',
        lessons: []
      };
    }
  },

  // Update trainer status (for admin)
  updateTrainerStatus: async (trainerId, status, adminId) => {
    try {
      const trainerRef = doc(db, 'users', trainerId);
      const trainerDoc = await getDoc(trainerRef);
      
      if (!trainerDoc.exists()) {
        return {
          success: false,
          message: 'Eğitmen bulunamadı.'
        };
      }
      
      const trainerData = trainerDoc.data();
      
      await updateDoc(trainerRef, {
        status: status,
        'trainerProfile.isActive': status === 'active',
        updatedAt: new Date().toISOString(),
        updatedBy: adminId
      });
      
      return {
        success: true,
        message: `Eğitmen durumu ${status === 'active' ? 'aktif' : 'pasif'} olarak güncellendi.`
      };
    } catch (error) {
      console.error('Error updating trainer status:', error);
      return {
        success: false,
        error: error.code,
        message: 'Eğitmen durumu güncellenirken hata oluştu.'
      };
    }
  }
};
