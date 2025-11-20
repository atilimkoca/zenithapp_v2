import { collection, doc, setDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

export const bookingHistoryService = {
  // Create a booking history record
  createBookingHistory: async (userId, lessonId, lessonData, action = 'booked') => {
    try {
      
      const bookingHistoryRef = doc(collection(db, 'userBookings'));
      
      await setDoc(bookingHistoryRef, {
        userId: userId,
        lessonId: lessonId,
        lessonData: lessonData,
        action: action, // 'booked', 'cancelled', 'completed'
        status: action === 'booked' ? 'upcoming' : action,
        bookingDate: serverTimestamp(),
        actionDate: serverTimestamp(),
        cancelReason: action === 'cancelled' ? 'Kullanıcı tarafından iptal edildi' : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('❌ Error creating booking history:', error);
      return { 
        success: false, 
        error: error.code, 
        message: 'Rezervasyon geçmişi kaydedilemedi.' 
      };
    }
  },

  // Update booking history status
  updateBookingHistory: async (userId, lessonId, newStatus, reason = null) => {
    try {
      
      // Find and update the booking record
      const bookingQuery = query(
        collection(db, 'userBookings'),
        where('userId', '==', userId),
        where('lessonId', '==', lessonId)
      );
      
      const bookingSnapshot = await getDocs(bookingQuery);
      
      if (!bookingSnapshot.empty) {
        const bookingDoc = bookingSnapshot.docs[0];
        
        await updateDoc(bookingDoc.ref, {
          status: newStatus,
          action: newStatus,
          ...(newStatus === 'cancelled' && { 
            cancelledDate: serverTimestamp(),
            cancelReason: reason || 'Kullanıcı tarafından iptal edildi'
          }),
          updatedAt: serverTimestamp()
        });
        
        return { success: true };
      } else {
        return { success: false, message: 'Rezervasyon geçmişi bulunamadı.' };
      }
    } catch (error) {
      console.error('❌ Error updating booking history:', error);
      return { 
        success: false, 
        error: error.code, 
        message: 'Rezervasyon geçmişi güncellenemedi.' 
      };
    }
  }
};

export default bookingHistoryService;
