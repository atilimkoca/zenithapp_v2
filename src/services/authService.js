import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
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
    
    switch (error.code) {
      case 'auth/user-not-found':
        errorMessage = 'Bu e-posta adresiyle kayıtlı kullanıcı bulunamadı.';
        break;
      case 'auth/wrong-password':
        errorMessage = 'Yanlış şifre girdiniz.';
        break;
      case 'auth/invalid-email':
        errorMessage = 'Geçersiz e-posta adresi.';
        break;
      case 'auth/user-disabled':
        errorMessage = 'Bu hesap devre dışı bırakılmış.';
        break;
      case 'auth/too-many-requests':
        errorMessage = 'Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.';
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
