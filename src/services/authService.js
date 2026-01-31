import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

// Register new user
export const registerUser = async (email, password, userData) => {
  try {
    // Create user with email and password
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update user profile with display name
    await updateProfile(user, {
      displayName: `${userData.firstName} ${userData.lastName}`
    });

    // Save additional user data to Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      firstName: userData.firstName,
      lastName: userData.lastName,
      phone: userData.phone,
      displayName: `${userData.firstName} ${userData.lastName}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // User status - requires admin approval
      status: 'pending', // pending, approved, rejected
      isActive: false, // Only true when status is 'approved'
      approvedAt: null,
      approvedBy: null,
      // Additional fields for yoga/pilates studio
      membershipType: 'customer',
      role: 'customer', // customer, admin, instructor
      joinDate: new Date().toISOString(),
      totalClasses: 0,
      preferences: {
        notifications: true,
        emailUpdates: true
      }
    });

    return {
      success: true,
      user: user,
      userData: {
        uid: user.uid,
        email: user.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        phone: userData.phone,
        displayName: `${userData.firstName} ${userData.lastName}`,
        status: 'pending',
        isActive: false,
        role: 'customer'
      },
      messageKey: 'auth.accountCreatedSuccess' // Translation key instead of hardcoded message
    };
  } catch (error) {
    console.error('Registration error:', error);
    
    let errorMessage = 'Kayıt sırasında bir hata oluştu.';
    
    switch (error.code) {
      case 'auth/email-already-in-use':
        errorMessage = 'Bu e-posta adresi zaten kullanımda.';
        break;
      case 'auth/weak-password':
        errorMessage = 'Şifre çok zayıf. En az 6 karakter olmalı.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Geçersiz e-posta adresi.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'İnternet bağlantınızı kontrol edin.';
        break;
    }
    
    return {
      success: false,
      error: error.code,
      message: errorMessage
    };
  }
};

// Login user
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Get additional user data from Firestore
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    
    // If user doesn't exist in Firestore, they were likely deleted from admin panel
    if (!userDoc.exists()) {
      await signOut(auth); // Sign them out immediately
      return {
        success: false,
        messageKey: 'auth.accountDeletedMessage' // Translation key
      };
    }
    
    const userData = userDoc.data();

    // Check if user is deleted or cancelled - block login completely
    if (userData.status === 'deleted' || userData.status === 'permanently_deleted') {
      await signOut(auth); // Sign them out immediately
      return {
        success: false,
        messageKey: 'auth.accountDeletedMessage'
      };
    }

    if (userData.status === 'cancelled' || userData.membershipStatus === 'cancelled') {
      await signOut(auth); // Sign them out immediately
      return {
        success: false,
        messageKey: 'auth.accountCancelledMessage'
      };
    }

    // Check if user is approved (skip check for admins and instructors)
    const isAdminOrInstructor = userData && (userData.role === 'admin' || userData.role === 'instructor');

    if (userData && !isAdminOrInstructor && userData.status !== 'approved') {
      // Don't sign out the user, just return status info
      // This allows them to stay logged in and see the pending screen
      
      let messageKey = 'auth.accountPendingMessage'; // Default
      if (userData.status === 'pending') {
        messageKey = 'auth.accountPendingMessage';
      } else if (userData.status === 'rejected') {
        messageKey = 'auth.accountRejectedMessage';
      }
      
      return {
        success: true, // Change to true so user stays logged in
        user: user,
        userData: userData,
        requiresApproval: true, // Flag to indicate pending status
        messageKey: messageKey // Translation key instead of hardcoded message
      };
    }

    // Update last login time only for approved users
    if (userData && userData.status === 'approved') {
      await setDoc(doc(db, 'users', user.uid), {
        ...userData,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }

    return {
      success: true,
      user: user,
      userData: userData,
      message: 'Başarıyla giriş yaptınız!'
    };
  } catch (error) {
    console.error('Login error:', error);
    
    let errorMessage = 'Giriş sırasında bir hata oluştu.';
    let messageKey = 'general.unexpectedError';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
        messageKey = 'auth.userNotFound';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Yanlış şifre girdiniz.';
        messageKey = 'auth.wrongPassword';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Geçersiz e-posta adresi.';
        messageKey = 'auth.invalidEmail';
        break;
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        errorMessage = 'E-posta veya şifre hatalı.';
        messageKey = 'auth.invalidCredentials';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Bu hesap devre dışı bırakılmış.';
        messageKey = 'auth.userDisabled';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.';
        messageKey = 'auth.tooManyRequests';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'İnternet bağlantınızı kontrol edin.';
        messageKey = 'errors.networkError';
        break;
    }
    
    return {
      success: false,
      error: error.code,
      message: errorMessage,
      messageKey: messageKey
    };
  }
};

// Logout user
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return {
      success: true,
      message: 'Başarıyla çıkış yaptınız!'
    };
  } catch (error) {
    console.error('Logout error:', error);
    return {
      success: false,
      error: error.code,
      message: 'Çıkış sırasında bir hata oluştu.'
    };
  }
};

// Reset password
export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return {
      success: true,
      message: 'Şifre sıfırlama e-postası gönderildi!'
    };
  } catch (error) {
    console.error('Password reset error:', error);
    
    let errorMessage = 'Şifre sıfırlama sırasında bir hata oluştu.';
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Geçersiz e-posta adresi.';
        break;
      case 'auth/network-request-failed':
        errorMessage = 'İnternet bağlantınızı kontrol edin.';
        break;
    }
    
    return {
      success: false,
      error: error.code,
      message: errorMessage
    };
  }
};

// Get current user data
export const getCurrentUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return {
        success: true,
        userData: userDoc.data()
      };
    } else {
      return {
        success: false,
        message: 'Kullanıcı verisi bulunamadı.'
      };
    }
  } catch (error) {
    console.error('Get user data error:', error);
    return {
      success: false,
      error: error.code,
      message: 'Kullanıcı verisi alınırken hata oluştu.'
    };
  }
};

// Listen to authentication state changes
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

// Delete user account completely
export const deleteUserAccount = async (password) => {
  try {
    const user = auth.currentUser;
    
    if (!user) {
      return {
        success: false,
        messageKey: 'errors.userNotFound'
      };
    }

    // Re-authenticate user before deletion (required by Firebase for sensitive operations)
    const credential = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, credential);

    const uid = user.uid;

    // Delete user data from Firestore
    try {
      // Delete main user document
      await deleteDoc(doc(db, 'users', uid));

      // Delete user's lesson bookings
      const bookingsQuery = query(collection(db, 'bookings'), where('userId', '==', uid));
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const batch = writeBatch(db);
      bookingsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      // Delete user's notifications
      try {
        const notificationsQuery = query(collection(db, 'notifications'), where('userId', '==', uid));
        const notificationsSnapshot = await getDocs(notificationsQuery);
        const notifBatch = writeBatch(db);
        notificationsSnapshot.docs.forEach(doc => {
          notifBatch.delete(doc.ref);
        });
        await notifBatch.commit();
      } catch (notifError) {
        console.warn('Could not delete notifications:', notifError);
      }

    } catch (firestoreError) {
      console.error('Firestore deletion error:', firestoreError);
      // Continue with auth deletion even if Firestore fails
    }

    // Delete user from Firebase Authentication
    await deleteUser(user);

    return {
      success: true,
      messageKey: 'auth.accountDeleted'
    };

  } catch (error) {
    console.error('Delete account error:', error);
    
    let messageKey = 'errors.deleteAccountError';
    
    switch (error.code) {
      case 'auth/wrong-password':
        messageKey = 'auth.wrongPassword';
        break;
      case 'auth/invalid-credential':
        messageKey = 'auth.invalidCredentials';
        break;
      case 'auth/requires-recent-login':
        messageKey = 'auth.requiresRecentLogin';
        break;
      case 'auth/network-request-failed':
        messageKey = 'errors.networkError';
        break;
    }
    
    return {
      success: false,
      error: error.code,
      messageKey: messageKey
    };
  }
};
