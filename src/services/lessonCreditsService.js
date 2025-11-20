import { doc, getDoc, setDoc, updateDoc, increment, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const lessonCreditsService = {
  // Get user's lesson credits
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
      // Check both field names for compatibility
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
  consumeUserCredit: async (userId, reason = 'Ders rezervasyonu') => {
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
      
      // Use Firestore increment for atomic operation (negative value to subtract)
      await updateDoc(userRef, {
        remainingClasses: increment(-1), // Use remainingClasses field
        lessonCredits: increment(-1), // Also update lessonCredits for compatibility
        updatedAt: new Date().toISOString()
      });

      // Log the transaction
      await lessonCreditsService.logCreditTransaction(userId, -1, 'consume', reason);
      
      return {
        success: true,
        remainingCredits: currentCredits - 1,
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
  refundUserCredit: async (userId, reason = 'Ders iptali') => {
    try {
      
      const userRef = doc(db, 'users', userId);
      
      // Use Firestore increment for atomic operation
      await updateDoc(userRef, {
        remainingClasses: increment(1), // Use remainingClasses field
        lessonCredits: increment(1), // Also update lessonCredits for compatibility
        updatedAt: new Date().toISOString()
      });

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