import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const profileService = {
  // Update user profile data
  updateUserProfile: async (userId, profileData) => {
    try {
      
      const userRef = doc(db, 'users', userId);
      
      const updateData = {
        ...profileData,
        updatedAt: new Date().toISOString(),
        // Update display name if first/last name changed
        ...(profileData.firstName || profileData.lastName) && {
          displayName: `${profileData.firstName || ''} ${profileData.lastName || ''}`.trim()
        }
      };
      
      await updateDoc(userRef, updateData);
      
      return {
        success: true,
        message: 'Profil başarıyla güncellendi!'
      };
    } catch (error) {
      console.error('❌ Error updating user profile:', error);
      return {
        success: false,
        error: error.code,
        message: 'Profil güncellenirken hata oluştu.'
      };
    }
  },

  // Get user's lesson statistics from Firebase
  getUserStats: async (userId) => {
    try {
      
      // Import userLessonService dynamically to avoid circular imports
      const { userLessonService } = await import('./userLessonService');
      
      const result = await userLessonService.getUserLessonStats(userId);
      
      if (result.success) {
        return {
          success: true,
          stats: result.stats
        };
      } else {
        throw new Error(result.message || 'Stats fetch failed');
      }
    } catch (error) {
      console.error('❌ Error getting user stats:', error);
      return {
        success: false,
        stats: {
          totalLessons: 0,
          completedCount: 0,
          thisMonthCount: 0,
          totalHours: 0
        }
      };
    }
  },

  // Update user notification preferences
  updateNotificationPreferences: async (userId, preferences) => {
    try {
      
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        notificationPreferences: preferences,
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Bildirim tercihleri güncellendi!'
      };
    } catch (error) {
      console.error('❌ Error updating notification preferences:', error);
      return {
        success: false,
        error: error.code,
        message: 'Bildirim tercihleri güncellenirken hata oluştu.'
      };
    }
  },

  // Update user profile image URL
  updateProfileImage: async (userId, imageUrl) => {
    try {
      
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        profileImageUrl: imageUrl,
        updatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Profil fotoğrafı güncellendi!'
      };
    } catch (error) {
      console.error('❌ Error updating profile image:', error);
      return {
        success: false,
        error: error.code,
        message: 'Profil fotoğrafı güncellenirken hata oluştu.'
      };
    }
  }
};

export default profileService;
