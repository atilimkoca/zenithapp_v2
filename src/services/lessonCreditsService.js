import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const lessonCreditsService = {
  // Get user's lesson credits
  // FIXED: Now calculates from packages array if available for accurate count
  getUserCredits: async (userId) => {
    try {

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }

      const userData = userDoc.data();

      // If user has packages array with items, calculate from packages
      const packages = userData.packages || [];
      if (packages.length > 0) {
        const calculatedCredits = packages.reduce((sum, pkg) => {
          if (pkg.status !== 'cancelled') {
            return sum + (pkg.remainingLessons || 0);
          }
          return sum;
        }, 0);

        return {
          success: true,
          credits: calculatedCredits
        };
      }

      // If packages is empty but packageInfo exists, use packageInfo.remainingClasses
      if (userData.packageInfo && userData.packageInfo.remainingClasses !== undefined) {
        return {
          success: true,
          credits: userData.packageInfo.remainingClasses
        };
      }

      // Final fallback to root level values
      const credits = userData.remainingClasses || userData.lessonCredits || 0;

      return {
        success: true,
        credits: credits
      };
    } catch (error) {
      console.error('❌ Error getting user credits:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kalan ders sayısı alınırken hata oluştu.',
        credits: 0
      };
    }
  },

  // Set user's lesson credits (for admin/initial setup)
  setUserCredits: async (userId, credits, reason = 'Ders paketi satın alma') => {
    try {
      
      const userRef = doc(db, 'users', userId);
      
      await updateDoc(userRef, {
        remainingClasses: credits, // Use remainingClasses field
        lessonCredits: credits, // Also update lessonCredits for compatibility
        updatedAt: new Date().toISOString()
      });

      // Log the transaction
      await lessonCreditsService.logCreditTransaction(userId, credits, 'set', reason);
      
      return {
        success: true,
        message: 'Ders sayısı başarıyla güncellendi.'
      };
    } catch (error) {
      console.error('❌ Error setting user credits:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders sayısı güncellenirken hata oluştu.'
      };
    }
  },

  // Add lesson credits to user (for purchasing packages)
  addUserCredits: async (userId, creditsToAdd, reason = 'Ders paketi satın alma') => {
    try {
      
      const userRef = doc(db, 'users', userId);
      
      // Use Firestore increment for atomic operation
      await updateDoc(userRef, {
        remainingClasses: increment(creditsToAdd), // Use remainingClasses field
        lessonCredits: increment(creditsToAdd), // Also update lessonCredits for compatibility
        updatedAt: new Date().toISOString()
      });

      // Log the transaction
      await lessonCreditsService.logCreditTransaction(userId, creditsToAdd, 'add', reason);
      
      return {
        success: true,
        message: `${creditsToAdd} ders kredisi hesabınıza eklendi.`
      };
    } catch (error) {
      console.error('❌ Error adding user credits:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders kredisi eklenirken hata oluştu.'
      };
    }
  },

  // Consume/reduce lesson credits (when booking a lesson)
  // lessonDate: The date of the lesson being booked (to find which package to decrement)
  consumeUserCredit: async (userId, reason = 'Ders rezervasyonu', lessonDate = null) => {
    try {
      
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }
      
      const userData = userDoc.data();
      const currentCredits = userData.remainingClasses || userData.lessonCredits || 0;
      
      if (currentCredits <= 0) {
        return {
          success: false,
          message: 'Yetersiz ders kredisi. Lütfen ders paketi satın alın.'
        };
      }
      
      const newCredits = currentCredits - 1;
      
      // Update all credit-related fields including packageInfo
      const updateData = {
        remainingClasses: newCredits,
        lessonCredits: newCredits,
        updatedAt: new Date().toISOString()
      };
      
      // Also update packageInfo.remainingClasses if packageInfo exists
      if (userData.packageInfo) {
        updateData['packageInfo.remainingClasses'] = newCredits;
      }
      
      // Update the correct package in packages array based on lesson date
      if (userData.packages && userData.packages.length > 0) {
        const lessonDateTime = lessonDate ? new Date(lessonDate) : new Date();
        const packages = [...userData.packages];
        
        // Find the package whose date range contains the lesson date and has remaining lessons
        const packageIndex = packages.findIndex(pkg => {
          if (pkg.status === 'cancelled' || pkg.remainingLessons <= 0) return false;
          const startDate = new Date(pkg.startDate);
          const expiryDate = new Date(pkg.expiryDate);
          return lessonDateTime >= startDate && lessonDateTime <= expiryDate;
        });
        
        if (packageIndex !== -1) {
          // Decrement the matching package's remainingLessons
          packages[packageIndex] = {
            ...packages[packageIndex],
            remainingLessons: packages[packageIndex].remainingLessons - 1
          };
          updateData.packages = packages;
        } else {
          // Fallback: find any active package with remaining lessons
          const fallbackIndex = packages.findIndex(pkg => 
            pkg.status !== 'cancelled' && pkg.remainingLessons > 0
          );
          if (fallbackIndex !== -1) {
            packages[fallbackIndex] = {
              ...packages[fallbackIndex],
              remainingLessons: packages[fallbackIndex].remainingLessons - 1
            };
            updateData.packages = packages;
          }
        }
      }
      
      await updateDoc(userRef, updateData);

      // Log the transaction
      await lessonCreditsService.logCreditTransaction(userId, -1, 'consume', reason);
      
      return {
        success: true,
        remainingCredits: newCredits,
        message: 'Ders kredisi kullanıldı.'
      };
    } catch (error) {
      console.error('❌ Error consuming user credit:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders kredisi kullanılırken hata oluştu.'
      };
    }
  },

  // Refund lesson credit (when cancelling a lesson)
  // lessonDate: The date of the lesson being cancelled (to find which package to increment)
  refundUserCredit: async (userId, reason = 'Ders iptali', lessonDate = null) => {
    try {
      
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }
      
      const userData = userDoc.data();
      const currentCredits = userData.remainingClasses || userData.lessonCredits || 0;
      const newCredits = currentCredits + 1;
      
      // Update all credit-related fields including packageInfo
      const updateData = {
        remainingClasses: newCredits,
        lessonCredits: newCredits,
        updatedAt: new Date().toISOString()
      };
      
      // Also update packageInfo.remainingClasses if packageInfo exists
      if (userData.packageInfo) {
        updateData['packageInfo.remainingClasses'] = newCredits;
      }
      
      // Update the correct package in packages array based on lesson date
      if (userData.packages && userData.packages.length > 0) {
        const lessonDateTime = lessonDate ? new Date(lessonDate) : new Date();
        const packages = [...userData.packages];
        
        // Find the package whose date range contains the lesson date
        const packageIndex = packages.findIndex(pkg => {
          if (pkg.status === 'cancelled') return false;
          const startDate = new Date(pkg.startDate);
          const expiryDate = new Date(pkg.expiryDate);
          return lessonDateTime >= startDate && lessonDateTime <= expiryDate;
        });
        
        if (packageIndex !== -1) {
          // Increment the matching package's remainingLessons (but not exceed totalLessons)
          const pkg = packages[packageIndex];
          const maxLessons = pkg.totalLessons || 999;
          packages[packageIndex] = {
            ...pkg,
            remainingLessons: Math.min(pkg.remainingLessons + 1, maxLessons)
          };
          updateData.packages = packages;
        } else {
          // Fallback: find any active package
          const fallbackIndex = packages.findIndex(pkg => pkg.status !== 'cancelled');
          if (fallbackIndex !== -1) {
            const pkg = packages[fallbackIndex];
            const maxLessons = pkg.totalLessons || 999;
            packages[fallbackIndex] = {
              ...pkg,
              remainingLessons: Math.min(pkg.remainingLessons + 1, maxLessons)
            };
            updateData.packages = packages;
          }
        }
      }
      
      await updateDoc(userRef, updateData);

      // Log the transaction
      await lessonCreditsService.logCreditTransaction(userId, 1, 'refund', reason);
      
      return {
        success: true,
        message: 'Ders kredisi hesabınıza iade edildi.'
      };
    } catch (error) {
      console.error('❌ Error refunding user credit:', error);
      return {
        success: false,
        error: error.code,
        message: 'Ders kredisi iade edilirken hata oluştu.'
      };
    }
  },

  // Log credit transactions for audit trail
  logCreditTransaction: async (userId, amount, type, reason) => {
    try {
      const transactionData = {
        userId: userId,
        amount: amount,
        type: type, // 'add', 'consume', 'refund', 'set'
        reason: reason,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'creditTransactions'), transactionData);
    } catch (error) {
      console.warn('⚠️ Could not log credit transaction:', error);
      // Don't fail the main operation if logging fails
    }
  },

  // Get user's credit transaction history
  getUserCreditHistory: async (userId, limit = 20) => {
    try {
      
      const q = query(
        collection(db, 'creditTransactions'),
        where('userId', '==', userId),
        // orderBy('timestamp', 'desc'), // Uncomment if you need ordering
        // limit(limit) // Uncomment if you need to limit results
      );
      
      const querySnapshot = await getDocs(q);
      const transactions = [];
      
      querySnapshot.forEach((doc) => {
        transactions.push({
          id: doc.id,
          ...doc.data()
        });
      });

      // Sort by timestamp descending (newest first) on client side
      transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      return {
        success: true,
        transactions: transactions.slice(0, limit)
      };
    } catch (error) {
      console.error('❌ Error getting user credit history:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kredi geçmişi alınırken hata oluştu.',
        transactions: []
      };
    }
  },

  // Check if user has enough credits for booking
  checkUserCanBook: async (userId) => {
    try {
      const result = await lessonCreditsService.getUserCredits(userId);
      
      if (!result.success) {
        return result;
      }
      
      const canBook = result.credits > 0;
      
      return {
        success: true,
        canBook: canBook,
        credits: result.credits,
        message: canBook ? 'Rezervasyon yapabilirsiniz.' : 'Yetersiz ders kredisi.'
      };
    } catch (error) {
      console.error('❌ Error checking if user can book:', error);
      return {
        success: false,
        canBook: false,
        credits: 0,
        message: 'Kredi kontrolü yapılırken hata oluştu.'
      };
    }
  },

  // Initialize user credits (for new users)
  initializeUserCredits: async (userId, initialCredits = 0) => {
    try {
      
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }
      
      const userData = userDoc.data();
      
      // Only initialize if credits field doesn't exist
      if (userData.remainingClasses === undefined && userData.lessonCredits === undefined) {
        await updateDoc(userRef, {
          remainingClasses: initialCredits, // Use remainingClasses field
          lessonCredits: initialCredits, // Also set lessonCredits for compatibility
          updatedAt: new Date().toISOString()
        });

        if (initialCredits > 0) {
          await lessonCreditsService.logCreditTransaction(userId, initialCredits, 'set', 'Hesap açılışı - Başlangıç kredisi');
        }
        
        return {
          success: true,
          message: 'Kullanıcı kredileri başlatıldı.'
        };
      } else {
        const existingCredits = userData.remainingClasses || userData.lessonCredits || 0;
        return {
          success: true,
          message: 'Kullanıcı kredileri zaten mevcut.',
          credits: existingCredits
        };
      }
    } catch (error) {
      console.error('❌ Error initializing user credits:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı kredileri başlatılırken hata oluştu.'
      };
    }
  }
};

export default lessonCreditsService;