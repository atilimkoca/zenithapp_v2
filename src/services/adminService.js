import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Admin service for managing user approvals
export const adminService = {
  // Get all pending users for admin approval
  getPendingUsers: async () => {
    try {
      const q = query(
        collection(db, 'users'),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const pendingUsers = [];
      
      querySnapshot.forEach((doc) => {
        pendingUsers.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        users: pendingUsers
      };
    } catch (error) {
      console.error('Error getting pending users:', error);
      return {
        success: false,
        error: error.code,
        message: 'Bekleyen kullanıcılar alınırken hata oluştu.'
      };
    }
  },

  // Approve a user with package assignment
  approveUser: async (userId, adminId, packageData = null) => {
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
      const now = new Date();
      
      // Calculate package expiry date (30 days from now)
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 30);
      
      const updateData = {
        ...userData,
        status: 'approved',
        isActive: true,
        approvedAt: now.toISOString(),
        approvedBy: adminId,
        updatedAt: now.toISOString()
      };
      
      // If package is assigned during approval
      if (packageData && packageData.id) {
        // Extract lesson count - try multiple field names for compatibility
        const lessonCount = packageData.lessonCount || packageData.lessons || packageData.classes || 0;
        const packageType = packageData.packageType || packageData.type || packageData.category || (packageData.isOneOnOne ? 'one-on-one' : 'group');
        const packageName = packageData.name || 'Bilinmeyen Paket';

        // Create package entry for packages array (multi-package support)
        const newPackage = {
          id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          packageId: packageData.id,
          packageName: packageName,
          packageType: packageType,
          startDate: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          totalLessons: lessonCount,
          remainingLessons: lessonCount,
          assignedAt: now.toISOString(),
          assignedBy: adminId,
          status: 'active',
          duration: 1
        };

        // Set both root-level and packageInfo fields for consistency
        updateData.packageName = packageName; // Add packageName at root level
        updateData.packageExpiryDate = expiryDate.toISOString();
        updateData.packageStartDate = now.toISOString();
        updateData.packages = [newPackage]; // Add packages array
        updateData.packageInfo = {
          packageId: packageData.id,
          packageName: packageName,
          packageType: packageType,
          lessonCount: lessonCount,
          remainingClasses: lessonCount, // Also store remainingClasses in packageInfo
          assignedAt: now.toISOString(),
          expiryDate: expiryDate.toISOString()
        };
        updateData.remainingClasses = lessonCount;
        updateData.lessonCredits = lessonCount;
      } else {
        // Set expiry date even without package
        updateData.packageExpiryDate = expiryDate.toISOString();
        updateData.packageStartDate = now.toISOString();
        updateData.packages = []; // Empty packages array
        updateData.packageInfo = {
          packageId: null,
          packageName: 'Paket Atanmadı',
          packageType: null,
          lessonCount: 0,
          remainingClasses: 0,
          assignedAt: now.toISOString(),
          expiryDate: expiryDate.toISOString()
        };
        updateData.remainingClasses = 0;
        updateData.lessonCredits = 0;
      }
      
      await setDoc(userRef, updateData, { merge: true });
      
      return {
        success: true,
        message: 'Kullanıcı başarıyla onaylandı ve paket atandı.'
      };
    } catch (error) {
      console.error('Error approving user:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı onaylanırken hata oluştu.'
      };
    }
  },

  // Renew user package
  renewUserPackage: async (userId, packageData, adminId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }
      
      // Validate package data
      if (!packageData || !packageData.id) {
        return {
          success: false,
          message: 'Geçersiz paket verisi.'
        };
      }

      // Extract lesson count - try multiple field names for compatibility
      const lessonCount = packageData.lessonCount || packageData.lessons || packageData.classes || 0;
      
      if (lessonCount <= 0) {
        console.warn('⚠️ Package has no lessons:', packageData);
        return {
          success: false,
          message: 'Paket ders sayısı belirtilmemiş. Lütfen paketi kontrol edin.'
        };
      }
      
      const userData = userDoc.data();
      const now = new Date();

      // Calculate new expiry date (30 days from now)
      const expiryDate = new Date(now);
      expiryDate.setDate(expiryDate.getDate() + 30);

      const packageName = packageData.name || 'Bilinmeyen Paket';
      const packageType = packageData.packageType || packageData.type || packageData.category || (packageData.isOneOnOne ? 'one-on-one' : 'group');

      // Create new package entry for packages array (multi-package support)
      const newPackage = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        packageId: packageData.id,
        packageName: packageName,
        packageType: packageType,
        startDate: now.toISOString(),
        expiryDate: expiryDate.toISOString(),
        totalLessons: lessonCount,
        remainingLessons: lessonCount,
        assignedAt: now.toISOString(),
        assignedBy: adminId,
        status: 'active',
        duration: 1
      };

      // Get existing packages and add new one
      const existingPackages = userData.packages || [];
      existingPackages.push(newPackage);

      // Calculate total remaining from all packages
      const totalRemainingClasses = existingPackages.reduce((sum, pkg) => {
        if (pkg.status !== 'cancelled') {
          return sum + (pkg.remainingLessons || 0);
        }
        return sum;
      }, 0);

      // Find the latest expiry date
      const latestExpiry = existingPackages
        .filter(pkg => pkg.status !== 'cancelled')
        .reduce((latest, pkg) => {
          const exp = new Date(pkg.expiryDate);
          return exp > latest ? exp : latest;
        }, new Date(0));

      const updateData = {
        packages: existingPackages, // Add to packages array
        packageName: packageName, // FIXED: Add packageName at root level
        packageInfo: {
          packageId: packageData.id,
          packageName: packageName,
          packageType: packageType,
          lessonCount: lessonCount,
          remainingClasses: totalRemainingClasses, // FIXED: Use total remaining, not just new package
          assignedAt: now.toISOString(),
          expiryDate: expiryDate.toISOString(),
          renewedBy: adminId
        },
        remainingClasses: totalRemainingClasses,
        lessonCredits: totalRemainingClasses,
        packageExpiryDate: latestExpiry.toISOString(),
        updatedAt: now.toISOString()
      };

      await setDoc(userRef, updateData, { merge: true });
      
      return {
        success: true,
        message: 'Paket başarıyla yenilendi.'
      };
    } catch (error) {
      console.error('Error renewing package:', error);
      return {
        success: false,
        error: error.code,
        message: 'Paket yenilenirken hata oluştu.'
      };
    }
  },

  // Reject a user
  rejectUser: async (userId, adminId, reason = '') => {
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
      
      await setDoc(userRef, {
        ...userData,
        status: 'rejected',
        isActive: false,
        rejectedAt: new Date().toISOString(),
        rejectedBy: adminId,
        rejectionReason: reason,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      return {
        success: true,
        message: 'Kullanıcı reddedildi.'
      };
    } catch (error) {
      console.error('Error rejecting user:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı reddedilirken hata oluştu.'
      };
    }
  },

  // Get user by ID
  getUserById: async (userId) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        return {
          success: true,
          user: {
            id: userDoc.id,
            ...userDoc.data()
          }
        };
      } else {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }
    } catch (error) {
      console.error('Error getting user:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı bilgileri alınırken hata oluştu.'
      };
    }
  },

  // Get all users with filters
  getAllUsers: async (status = null) => {
    try {
      let q;
      
      if (status) {
        q = query(
          collection(db, 'users'),
          where('status', '==', status),
          orderBy('createdAt', 'desc')
        );
      } else {
        q = query(
          collection(db, 'users'),
          orderBy('createdAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      const users = [];
      
      querySnapshot.forEach((doc) => {
        const userData = doc.data();
        
        // Only include regular users (members), exclude admins and trainers
        if (userData.role !== 'admin' && userData.role !== 'instructor') {
          users.push({
            id: doc.id,
            ...userData
          });
        }
      });
      
      return {
        success: true,
        users: users
      };
    } catch (error) {
      console.error('Error getting users:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcılar alınırken hata oluştu.'
      };
    }
  },

  // Update user status (for bulk operations)
  updateUserStatus: async (userId, status, adminId, reason = '') => {
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
      const updateData = {
        ...userData,
        status: status,
        isActive: status === 'approved',
        updatedAt: new Date().toISOString()
      };
      
      // Add status-specific fields
      if (status === 'approved') {
        updateData.approvedAt = new Date().toISOString();
        updateData.approvedBy = adminId;
      } else if (status === 'rejected') {
        updateData.rejectedAt = new Date().toISOString();
        updateData.rejectedBy = adminId;
        updateData.rejectionReason = reason;
      }
      
      await setDoc(userRef, updateData, { merge: true });
      
      return {
        success: true,
        message: `Kullanıcı durumu ${status} olarak güncellendi.`
      };
    } catch (error) {
      console.error('Error updating user status:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı durumu güncellenirken hata oluştu.'
      };
    }
  },

  // Delete user completely (from Firestore only - Firebase Auth deletion must be done from admin backend)
  deleteUser: async (userId, adminId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        return {
          success: false,
          message: 'Kullanıcı bulunamadı.'
        };
      }

      // Delete from Firestore
      await deleteDoc(userRef);
      
      // Note: Firebase Auth user deletion must be done from admin panel backend
      // using Firebase Admin SDK, not from client-side
      
      return {
        success: true,
        message: 'Kullanıcı başarıyla silindi. (Firebase Auth silme işlemi admin panelinden yapılmalıdır.)'
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı silinirken hata oluştu.'
      };
    }
  },

  // Get user statistics for admin dashboard
  getUserStats: async () => {
    try {
      const q = query(collection(db, 'users'));
      const querySnapshot = await getDocs(q);
      
      let total = 0;
      let pending = 0;
      let approved = 0;
      let rejected = 0;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();

        // Only count regular users (members), exclude admins and trainers
        if (data.role === 'admin' || data.role === 'instructor') {
          return; // Skip admins and trainers
        }

        // Exclude permanently deleted members
        if (data.status === 'permanently_deleted' || data.membershipStatus === 'deleted') {
          return; // Skip deleted members
        }

        total++;

        switch (data.status) {
          case 'pending':
            pending++;
            break;
          case 'approved':
            approved++;
            break;
          case 'rejected':
            rejected++;
            break;
          default:
            // Count users without status as approved (legacy users)
            if (!data.status) {
              approved++;
            }
            break;
        }
      });
      
      return {
        success: true,
        data: {
          total,
          pending,
          approved,
          rejected
        }
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        success: false,
        error: error.code,
        message: 'Kullanıcı istatistikleri alınırken hata oluştu.'
      };
    }
  },

  // Migration function: Update all users' packageInfo with packageType from their assigned packages
  migrateUserPackageTypes: async () => {
    try {
      console.log('🔄 Starting migration: Adding packageType to users...');

      // Get all users
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);

      // Get all packages
      const packagesQuery = query(collection(db, 'packages'));
      const packagesSnapshot = await getDocs(packagesQuery);

      // Create a map of packageId -> packageType
      const packageTypeMap = {};
      packagesSnapshot.forEach((pkgDoc) => {
        const pkgData = pkgDoc.data();
        packageTypeMap[pkgDoc.id] = pkgData.packageType || 'group';
      });

      console.log('📦 Package type map:', packageTypeMap);

      let updatedCount = 0;
      let skippedCount = 0;
      const updates = [];

      // Process each user
      usersSnapshot.forEach((userDoc) => {
        const userData = userDoc.data();

        // Check if user has packageInfo and a packageId
        if (userData.packageInfo && userData.packageInfo.packageId) {
          const packageId = userData.packageInfo.packageId;
          const packageType = packageTypeMap[packageId];

          // Only update if packageType is missing
          if (!userData.packageInfo.packageType && packageType) {
            console.log(`✓ Updating user ${userDoc.id}: package ${packageId} -> ${packageType}`);

            const updatedPackageInfo = {
              ...userData.packageInfo,
              packageType: packageType
            };

            updates.push(
              setDoc(doc(db, 'users', userDoc.id), {
                packageInfo: updatedPackageInfo
              }, { merge: true })
            );

            updatedCount++;
          } else {
            console.log(`⊘ Skipping user ${userDoc.id}: already has packageType or package not found`);
            skippedCount++;
          }
        } else {
          console.log(`⊘ Skipping user ${userDoc.id}: no package assigned`);
          skippedCount++;
        }
      });

      // Execute all updates
      if (updates.length > 0) {
        await Promise.all(updates);
      }

      console.log('✅ Migration complete!');
      console.log(`   Updated: ${updatedCount} users`);
      console.log(`   Skipped: ${skippedCount} users`);

      return {
        success: true,
        message: `Migration complete: ${updatedCount} users updated, ${skippedCount} skipped`,
        updated: updatedCount,
        skipped: skippedCount
      };
    } catch (error) {
      console.error('❌ Error during migration:', error);
      return {
        success: false,
        error: error.code,
        message: 'Migration failed: ' + error.message
      };
    }
  },

  // Renew package for a user
  renewPackage: async (userId, packageId) => {
    try {
      console.log(`🔄 Renewing package ${packageId} for user ${userId}`);

      // Get the package details
      const packageRef = doc(db, 'packages', packageId);
      const packageDoc = await getDoc(packageRef);

      if (!packageDoc.exists()) {
        return {
          success: false,
          error: 'Paket bulunamadı'
        };
      }

      const packageData = packageDoc.data();
      const packageName = packageData.name || 'Standart Paket';
      const lessonCount = packageData.classes || packageData.lessonCount || packageData.lessons || 8;
      const packageType =
        packageData.packageType ||
        packageData.type ||
        packageData.category ||
        (packageData.isOneOnOne ? 'one-on-one' : 'group');
      const price = packageData.price || 0;
      const durationMonths = packageData.duration || 1; // duration in months

      // Get user data
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: 'Kullanıcı bulunamadı'
        };
      }

      // Calculate renewal dates
      const renewalDate = new Date();
      const expiryDate = new Date(renewalDate);
      // Convert months to days (1 month = ~30 days)
      expiryDate.setDate(expiryDate.getDate() + (durationMonths * 30));

      // Update user with new package
      const updateData = {
        remainingClasses: lessonCount,
        lessonCredits: lessonCount,
        membershipStatus: 'active',
        // Store dates at root level for backward compatibility
        packageExpiryDate: expiryDate.toISOString(),
        packageStartDate: renewalDate.toISOString(),
        packageInfo: {
          packageId: packageId,
          packageName: packageName,
          packageType: packageType,
          lessonCount: lessonCount,
          remainingClasses: lessonCount,
          price: price,
          assignedAt: renewalDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          duration: durationMonths // Store duration in months
        },
        lastRenewal: renewalDate.toISOString(),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);

      console.log(`✅ Package renewed successfully for user ${userId}`);

      return {
        success: true,
        message: 'Paket başarıyla yenilendi',
        data: {
          packageName,
          lessonCount,
          expiryDate: expiryDate.toISOString()
        }
      };
    } catch (error) {
      console.error('❌ Error renewing package:', error);
      return {
        success: false,
        error: 'Paket yenilenirken hata oluştu: ' + error.message
      };
    }
  },

  // Get all packages
  getPackages: async () => {
    try {
      const q = query(collection(db, 'packages'));
      const querySnapshot = await getDocs(q);
      const packages = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        packages.push({
          id: doc.id,
          ...data
        });
      });

      return {
        success: true,
        packages
      };
    } catch (error) {
      console.error('Error getting packages:', error);
      return {
        success: false,
        error: error.message,
        packages: []
      };
    }
  },

  // Approve user with package and start date
  approveUserWithPackage: async (userId, packageId, startDateISO) => {
    try {
      console.log(`✅ Approving user ${userId} with package ${packageId}, start date: ${startDateISO}`);

      // Get the package details
      const packageRef = doc(db, 'packages', packageId);
      const packageDoc = await getDoc(packageRef);

      if (!packageDoc.exists()) {
        return {
          success: false,
          error: 'Paket bulunamadı'
        };
      }

      const packageData = packageDoc.data();
      const packageName = packageData.name || 'Standart Paket';
      const lessonCount = packageData.classes || packageData.lessonCount || packageData.lessons || 8;
      const packageType =
        packageData.packageType ||
        packageData.type ||
        packageData.category ||
        (packageData.isOneOnOne ? 'one-on-one' : 'group');
      const price = packageData.price || 0;
      const durationMonths = packageData.duration || 1;

      // Get user data
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: 'Kullanıcı bulunamadı'
        };
      }

      // Calculate dates
      const startDate = new Date(startDateISO);
      const expiryDate = new Date(startDate);
      expiryDate.setDate(expiryDate.getDate() + (durationMonths * 30));

      // Create package entry for packages array (multi-package support)
      const newPackage = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        packageId: packageId,
        packageName: packageName,
        packageType: packageType,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        totalLessons: lessonCount,
        remainingLessons: lessonCount,
        assignedAt: new Date().toISOString(),
        assignedBy: 'admin',
        status: 'active',
        price: price,
        duration: durationMonths
      };

      // Update user with package and approve
      const updateData = {
        status: 'approved',
        isActive: true,
        membershipStatus: 'active',
        approvedAt: new Date().toISOString(),
        remainingClasses: lessonCount,
        lessonCredits: lessonCount,
        packageExpiryDate: expiryDate.toISOString(),
        packageStartDate: startDate.toISOString(),
        packages: [newPackage], // Add packages array
        packageInfo: {
          packageId: packageId,
          packageName: packageName,
          packageType: packageType,
          lessonCount: lessonCount,
          remainingClasses: lessonCount,
          price: price,
          assignedAt: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          duration: durationMonths
        },
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);

      console.log(`✅ User approved successfully with package`);

      return {
        success: true,
        message: 'Üye başarıyla onaylandı'
      };
    } catch (error) {
      console.error('❌ Error approving user:', error);
      return {
        success: false,
        error: 'Üye onaylanırken hata oluştu: ' + error.message
      };
    }
  },

  // Renew package with custom start date
  renewPackageWithStartDate: async (userId, packageId, startDateISO) => {
    try {
      console.log(`🔄 Renewing package ${packageId} for user ${userId}, start date: ${startDateISO}`);

      // Get the package details
      const packageRef = doc(db, 'packages', packageId);
      const packageDoc = await getDoc(packageRef);

      if (!packageDoc.exists()) {
        return {
          success: false,
          error: 'Paket bulunamadı'
        };
      }

      const packageData = packageDoc.data();
      const packageName = packageData.name || 'Standart Paket';
      const lessonCount = packageData.classes || packageData.lessonCount || packageData.lessons || 8;
      const packageType =
        packageData.packageType ||
        packageData.type ||
        packageData.category ||
        (packageData.isOneOnOne ? 'one-on-one' : 'group');
      const price = packageData.price || 0;
      const durationMonths = packageData.duration || 1;

      // Get user data
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return {
          success: false,
          error: 'Kullanıcı bulunamadı'
        };
      }

      const userData = userDoc.data();

      // Calculate dates
      const startDate = new Date(startDateISO);
      const expiryDate = new Date(startDate);
      expiryDate.setDate(expiryDate.getDate() + (durationMonths * 30));

      // Create new package entry
      const newPackage = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        packageId: packageId,
        packageName: packageName,
        packageType: packageType,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        totalLessons: lessonCount,
        remainingLessons: lessonCount,
        assignedAt: new Date().toISOString(),
        assignedBy: 'admin',
        status: 'active',
        price: price,
        duration: durationMonths
      };

      // Get existing packages and add new one (multi-package support)
      const existingPackages = userData.packages || [];
      existingPackages.push(newPackage);

      // Calculate total remaining from all packages
      const totalRemainingClasses = existingPackages.reduce((sum, pkg) => {
        if (pkg.status !== 'cancelled') {
          return sum + (pkg.remainingLessons || 0);
        }
        return sum;
      }, 0);

      // Find the latest expiry date
      const latestExpiry = existingPackages
        .filter(pkg => pkg.status !== 'cancelled')
        .reduce((latest, pkg) => {
          const exp = new Date(pkg.expiryDate);
          return exp > latest ? exp : latest;
        }, new Date(0));

      // Update user with new package
      const updateData = {
        remainingClasses: totalRemainingClasses,
        lessonCredits: totalRemainingClasses,
        membershipStatus: 'active',
        packageName: packageName, // Add packageName at root level
        packageExpiryDate: latestExpiry.toISOString(),
        packageStartDate: startDate.toISOString(),
        packages: existingPackages, // Add to packages array
        packageInfo: {
          packageId: packageId,
          packageName: packageName,
          packageType: packageType,
          lessonCount: lessonCount,
          remainingClasses: totalRemainingClasses, // Total remaining across all packages
          price: price,
          assignedAt: startDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          duration: durationMonths
        },
        lastRenewal: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await updateDoc(userRef, updateData);

      console.log(`✅ Package renewed successfully`);

      return {
        success: true,
        message: 'Paket başarıyla yenilendi'
      };
    } catch (error) {
      console.error('❌ Error renewing package:', error);
      return {
        success: false,
        error: 'Paket yenilenirken hata oluştu: ' + error.message
      };
    }
  },

  // ============================================
  // MULTI-PACKAGE SYSTEM
  // ============================================

  /**
   * Add a new package to user's packages array
   */
  addPackageToUser: async (userId, packageDetails, assignedBy) => {
    try {
      console.log(`📦 Adding package to user ${userId}:`, packageDetails);

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      const userData = userDoc.data();

      // Get package details from database if packageId provided
      let packageName = packageDetails.packageName || 'Standart Paket';
      let lessonCount = packageDetails.lessonCount || packageDetails.remainingClasses || 8;
      let packageType = packageDetails.packageType || 'group';
      let price = packageDetails.price || 0;

      if (packageDetails.packageId) {
        const packageRef = doc(db, 'packages', packageDetails.packageId);
        const packageDoc = await getDoc(packageRef);
        if (packageDoc.exists()) {
          const pkgData = packageDoc.data();
          packageName = pkgData.name || packageName;
          lessonCount = pkgData.lessonCount || pkgData.lessons || pkgData.classes || lessonCount;
          packageType = pkgData.packageType || packageType;
          price = pkgData.price || price;
        }
      }

      // Calculate dates
      const startDate = packageDetails.startDate
        ? new Date(packageDetails.startDate)
        : new Date();
      const durationMonths = packageDetails.duration || 1;
      const expiryDate = new Date(startDate);
      // Use 30 days per month for consistent expiry calculation across all platforms
      expiryDate.setDate(expiryDate.getDate() + (durationMonths * 30));

      // Create new package entry
      const newPackage = {
        id: `pkg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        packageId: packageDetails.packageId || null,
        packageName: packageName,
        packageType: packageType,
        startDate: startDate.toISOString(),
        expiryDate: expiryDate.toISOString(),
        totalLessons: lessonCount,
        remainingLessons: lessonCount,
        assignedAt: new Date().toISOString(),
        assignedBy: assignedBy,
        status: 'active',
        price: price,
        duration: durationMonths
      };

      // Get existing packages array or initialize
      const existingPackages = userData.packages || [];

      // Migrate legacy packageInfo if exists and packages array is empty
      if (existingPackages.length === 0 && userData.packageInfo) {
        const legacyPackage = adminService.migrateLegacyPackage(userData);
        if (legacyPackage) {
          existingPackages.push(legacyPackage);
        }
      }

      // Add new package
      existingPackages.push(newPackage);

      // Calculate total remaining lessons across ALL non-cancelled packages
      // FIXED: Include all packages regardless of date to show accurate total credits
      const totalRemainingClasses = existingPackages.reduce((sum, pkg) => {
        if (pkg.status !== 'cancelled') {
          return sum + (pkg.remainingLessons || 0);
        }
        return sum;
      }, 0);

      // Find the latest expiry date among active packages
      const latestExpiry = existingPackages
        .filter(pkg => pkg.status === 'active')
        .reduce((latest, pkg) => {
          const expiry = new Date(pkg.expiryDate);
          return expiry > latest ? expiry : latest;
        }, new Date(0));

      // Update user document
      const updateData = {
        packages: existingPackages,
        remainingClasses: totalRemainingClasses,
        lessonCredits: totalRemainingClasses,
        packageName: newPackage.packageName, // Add packageName at root level
        packageExpiryDate: latestExpiry.toISOString(),
        packageInfo: {
          packageId: newPackage.id,
          packageName: newPackage.packageName,
          packageType: newPackage.packageType,
          lessonCount: newPackage.totalLessons,
          remainingClasses: totalRemainingClasses, // Add remainingClasses to packageInfo
          assignedAt: newPackage.startDate,
          expiryDate: newPackage.expiryDate
        },
        updatedAt: new Date().toISOString()
      };

      // If user status is pending, also approve them
      if (userData.status === 'pending') {
        updateData.status = 'approved';
        updateData.membershipStatus = 'active';
        updateData.isActive = true;
        updateData.approvedAt = new Date().toISOString();
        updateData.approvedBy = assignedBy;
        updateData.packageStartDate = startDate.toISOString();
      }

      await updateDoc(userRef, updateData);

      console.log(`✅ Package added successfully to user ${userId}`);

      return {
        success: true,
        message: 'Paket başarıyla eklendi',
        package: newPackage,
        totalPackages: existingPackages.length,
        totalRemainingClasses
      };
    } catch (error) {
      console.error('❌ Error adding package to user:', error);
      return { success: false, error: 'Paket eklenirken bir hata oluştu' };
    }
  },

  /**
   * Get all packages for a user
   */
  getUserPackages: async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      const userData = userDoc.data();
      let packages = userData.packages || [];

      // Migrate legacy packageInfo if packages array is empty
      if (packages.length === 0 && userData.packageInfo) {
        const legacyPackage = adminService.migrateLegacyPackage(userData);
        if (legacyPackage) {
          packages = [legacyPackage];
        }
      }

      // Update package statuses based on current date
      const now = new Date();
      packages = packages.map(pkg => {
        const expiryDate = new Date(pkg.expiryDate);
        const startDate = new Date(pkg.startDate);

        let status = pkg.status;
        if (expiryDate < now) {
          status = 'expired';
        } else if (startDate > now) {
          status = 'upcoming';
        } else if (pkg.remainingLessons <= 0) {
          status = 'depleted';
        } else {
          status = 'active';
        }

        return { ...pkg, status };
      });

      return {
        success: true,
        packages,
        totalPackages: packages.length
      };
    } catch (error) {
      console.error('❌ Error getting user packages:', error);
      return { success: false, error: 'Paketler getirilemedi' };
    }
  },

  /**
   * Get packages that cover a specific date
   */
  getPackagesForDate: (packages, targetDate) => {
    const date = new Date(targetDate);
    date.setHours(12, 0, 0, 0);

    return packages.filter(pkg => {
      const startDate = new Date(pkg.startDate);
      startDate.setHours(0, 0, 0, 0);
      const expiryDate = new Date(pkg.expiryDate);
      expiryDate.setHours(23, 59, 59, 999);

      return startDate <= date && expiryDate >= date &&
             pkg.status !== 'cancelled' &&
             pkg.remainingLessons > 0;
    });
  },

  /**
   * Check if user can book a lesson on a specific date
   */
  canBookLessonOnDate: async (userId, lessonDate) => {
    try {
      const packagesResult = await adminService.getUserPackages(userId);
      if (!packagesResult.success) {
        return { canBook: false, error: packagesResult.error };
      }

      const eligiblePackages = adminService.getPackagesForDate(packagesResult.packages, lessonDate);

      if (eligiblePackages.length === 0) {
        return {
          canBook: false,
          reason: 'noPackageForDate',
          message: 'Bu tarih için geçerli bir paketiniz bulunmuyor'
        };
      }

      const hasCredits = eligiblePackages.some(pkg => pkg.remainingLessons > 0);
      if (!hasCredits) {
        return {
          canBook: false,
          reason: 'noCredits',
          message: 'Bu tarih aralığındaki paketinizde kalan ders yok'
        };
      }

      return {
        canBook: true,
        eligiblePackages,
        message: 'Ders rezervasyonu yapılabilir'
      };
    } catch (error) {
      console.error('❌ Error checking booking eligibility:', error);
      return { canBook: false, error: 'Kontrol yapılırken bir hata oluştu' };
    }
  },

  /**
   * Deduct a lesson from the appropriate package based on lesson date
   */
  deductLessonFromPackage: async (userId, lessonDate, lessonInfo = '') => {
    try {
      const packagesResult = await adminService.getUserPackages(userId);
      if (!packagesResult.success) {
        return { success: false, error: packagesResult.error };
      }

      const eligiblePackages = adminService.getPackagesForDate(packagesResult.packages, lessonDate);

      if (eligiblePackages.length === 0) {
        return {
          success: false,
          error: 'Bu tarih için geçerli bir paket bulunamadı',
          noPackageForDate: true
        };
      }

      // Use the first eligible package
      const targetPackage = eligiblePackages[0];

      if (targetPackage.remainingLessons <= 0) {
        return { success: false, error: 'Pakette kalan ders yok' };
      }

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      const userData = userDoc.data();
      const packages = userData.packages || [];

      // Update the specific package
      const updatedPackages = packages.map(pkg => {
        if (pkg.id === targetPackage.id) {
          return {
            ...pkg,
            remainingLessons: pkg.remainingLessons - 1,
            lastUsedAt: new Date().toISOString(),
            lastUsedFor: lessonInfo
          };
        }
        return pkg;
      });

      // Calculate new total remaining from ALL non-cancelled packages (not just active date range)
      // FIXED: Include all packages regardless of date to show accurate total credits
      const totalRemainingClasses = updatedPackages.reduce((sum, pkg) => {
        if (pkg.status !== 'cancelled') {
          return sum + (pkg.remainingLessons || 0);
        }
        return sum;
      }, 0);

      // Build update data including packageInfo sync
      const updateData = {
        packages: updatedPackages,
        remainingClasses: totalRemainingClasses,
        lessonCredits: totalRemainingClasses,
        updatedAt: new Date().toISOString()
      };

      // Also update packageInfo.remainingClasses if it exists
      if (userData.packageInfo) {
        updateData['packageInfo.remainingClasses'] = totalRemainingClasses;
      }

      await updateDoc(userRef, updateData);

      return {
        success: true,
        deductedFromPackage: targetPackage.id,
        packageName: targetPackage.packageName,
        remainingInPackage: targetPackage.remainingLessons - 1,
        totalRemaining: totalRemainingClasses
      };
    } catch (error) {
      console.error('❌ Error deducting lesson from package:', error);
      return { success: false, error: 'Ders düşülürken bir hata oluştu' };
    }
  },

  /**
   * Refund a lesson to the appropriate package based on lesson date (for cancellations)
   */
  refundLessonToPackage: async (userId, lessonDate, lessonInfo = '') => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      const userData = userDoc.data();
      let packages = userData.packages || [];

      // If no packages array, try to use legacy packageInfo
      if (packages.length === 0 && userData.packageInfo) {
        const legacyPackage = adminService.migrateLegacyPackage(userData);
        if (legacyPackage) {
          packages = [legacyPackage];
        }
      }

      if (packages.length === 0) {
        // Fallback: just increment the legacy fields
        await updateDoc(userRef, {
          remainingClasses: increment(1),
          lessonCredits: increment(1),
          updatedAt: new Date().toISOString()
        });
        return {
          success: true,
          message: 'Ders kredisi iade edildi (legacy)',
          usedLegacyRefund: true
        };
      }

      // Find the package that covers the lesson date
      const date = new Date(lessonDate);
      date.setHours(12, 0, 0, 0);

      let targetPackage = packages.find(pkg => {
        const startDate = new Date(pkg.startDate);
        startDate.setHours(0, 0, 0, 0);
        const expiryDate = new Date(pkg.expiryDate);
        expiryDate.setHours(23, 59, 59, 999);

        return startDate <= date && expiryDate >= date && pkg.status !== 'cancelled';
      });

      // If no package covers the date, use the most recent active package
      if (!targetPackage) {
        const now = new Date();
        const activePackages = packages.filter(pkg => {
          const expiryDate = new Date(pkg.expiryDate);
          return expiryDate >= now && pkg.status !== 'cancelled';
        });

        if (activePackages.length > 0) {
          // Sort by start date descending and pick the most recent
          activePackages.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
          targetPackage = activePackages[0];
        } else {
          // Fallback to any package if all are expired
          targetPackage = packages[packages.length - 1];
        }
      }

      // Update the specific package
      const updatedPackages = packages.map(pkg => {
        if (pkg.id === targetPackage.id) {
          const newRemaining = (pkg.remainingLessons || 0) + 1;
          // Don't exceed total lessons
          const maxLessons = pkg.totalLessons || newRemaining;
          return {
            ...pkg,
            remainingLessons: Math.min(newRemaining, maxLessons),
            lastRefundAt: new Date().toISOString(),
            lastRefundFor: lessonInfo
          };
        }
        return pkg;
      });

      // Calculate new total remaining from ALL non-cancelled packages (not just active date range)
      // FIXED: Include all packages regardless of date to show accurate total credits
      const totalRemainingClasses = updatedPackages.reduce((sum, pkg) => {
        if (pkg.status !== 'cancelled') {
          return sum + (pkg.remainingLessons || 0);
        }
        return sum;
      }, 0);

      // Build update data including packageInfo sync
      const updateData = {
        packages: updatedPackages,
        remainingClasses: totalRemainingClasses,
        lessonCredits: totalRemainingClasses,
        updatedAt: new Date().toISOString()
      };

      // Also update packageInfo.remainingClasses if it exists
      if (userData.packageInfo) {
        updateData['packageInfo.remainingClasses'] = totalRemainingClasses;
      }

      await updateDoc(userRef, updateData);

      const refundedPackage = updatedPackages.find(p => p.id === targetPackage.id);

      return {
        success: true,
        refundedToPackage: targetPackage.id,
        packageName: targetPackage.packageName,
        remainingInPackage: refundedPackage?.remainingLessons || 0,
        totalRemaining: totalRemainingClasses,
        message: 'Ders kredisi pakete iade edildi'
      };
    } catch (error) {
      console.error('❌ Error refunding lesson to package:', error);
      return { success: false, error: 'Ders iade edilirken bir hata oluştu' };
    }
  },

  /**
   * Migrate legacy single packageInfo to packages array format
   */
  migrateLegacyPackage: (userData) => {
    if (!userData.packageInfo && !userData.packageExpiryDate) {
      return null;
    }

    const packageInfo = userData.packageInfo || {};

    // FIXED: Check packageInfo.remainingClasses first, then root level values
    const remainingClasses = packageInfo.remainingClasses !== undefined
      ? packageInfo.remainingClasses
      : (userData.remainingClasses || userData.lessonCredits || 0);

    if (remainingClasses <= 0 && !userData.packageExpiryDate) {
      return null;
    }

    // Get totalLessons from packageInfo - look for various field names
    const totalLessons = packageInfo.totalLessons || 
                         packageInfo.lessonCount || 
                         packageInfo.classes || 
                         packageInfo.sessions ||
                         userData.totalLessons ||
                         userData.totalClasses ||
                         remainingClasses; // Only fallback to remaining if nothing else available

    return {
      id: packageInfo.packageId || `legacy_${Date.now()}`,
      packageId: packageInfo.packageId || null,
      packageName: packageInfo.packageName || userData.packageName || 'Mevcut Paket',
      packageType: packageInfo.packageType || userData.packageType || 'group',
      startDate: userData.packageStartDate || packageInfo.assignedAt || userData.approvedAt || new Date().toISOString(),
      expiryDate: userData.packageExpiryDate || packageInfo.expiryDate || new Date().toISOString(),
      totalLessons: totalLessons,
      remainingLessons: remainingClasses,
      assignedAt: packageInfo.assignedAt || userData.approvedAt || new Date().toISOString(),
      assignedBy: userData.approvedBy || 'system_migration',
      status: 'active',
      isLegacy: true
    };
  },

  /**
   * Get visible date ranges for user (union of all package date ranges)
   */
  getVisibleDateRanges: async (userId) => {
    try {
      const packagesResult = await adminService.getUserPackages(userId);
      if (!packagesResult.success || packagesResult.packages.length === 0) {
        return { success: false, ranges: [] };
      }

      const ranges = packagesResult.packages
        .filter(pkg => pkg.status !== 'cancelled')
        .map(pkg => ({
          packageId: pkg.id,
          packageName: pkg.packageName,
          startDate: pkg.startDate,
          expiryDate: pkg.expiryDate,
          hasCredits: pkg.remainingLessons > 0
        }));

      return { success: true, ranges };
    } catch (error) {
      console.error('❌ Error getting visible date ranges:', error);
      return { success: false, error: 'Tarih aralığı getirilemedi' };
    }
  },

  // Update a specific package's remaining lessons
  updateUserPackage: async (userId, packageId, newRemainingLessons) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      const userData = userDoc.data();
      const packages = userData.packages || [];

      if (packages.length === 0) {
        // User has no packages array, update root level remainingClasses only
        await updateDoc(userRef, {
          remainingClasses: newRemainingLessons,
          lessonCredits: newRemainingLessons,
          updatedAt: new Date().toISOString()
        });

        return {
          success: true,
          message: 'Kalan ders sayısı güncellendi',
          totalRemaining: newRemainingLessons
        };
      }

      // Find and update the specific package
      const packageIndex = packages.findIndex(pkg => pkg.id === packageId);

      if (packageIndex === -1) {
        return { success: false, error: 'Paket bulunamadı' };
      }

      // Update the package
      packages[packageIndex].remainingLessons = newRemainingLessons;

      // Calculate total remaining from all non-cancelled packages
      const totalRemaining = packages.reduce((sum, pkg) => {
        if (pkg.status !== 'cancelled') {
          return sum + (pkg.remainingLessons || 0);
        }
        return sum;
      }, 0);

      // Update Firestore - also sync packageInfo.remainingClasses
      const currentPackageInfo = userData.packageInfo || {};
      await updateDoc(userRef, {
        packages: packages,
        remainingClasses: totalRemaining,
        lessonCredits: totalRemaining,
        packageInfo: {
          ...currentPackageInfo,
          remainingClasses: totalRemaining // FIXED: Keep packageInfo in sync
        },
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Paket güncellendi',
        totalRemaining: totalRemaining
      };
    } catch (error) {
      console.error('❌ Error updating user package:', error);
      return {
        success: false,
        error: 'Paket güncellenirken hata oluştu'
      };
    }
  },

  /**
   * MIGRATION: Fix legacy user data that's missing packageInfo.remainingClasses
   * This syncs the root-level remainingClasses to packageInfo and fetches real package names
   */
  migrateUserPackageData: async (userId) => {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return { success: false, error: 'Kullanıcı bulunamadı', userId };
      }

      const userData = userDoc.data();
      const updateData = {};
      let needsUpdate = false;

      // Get the actual remaining classes value
      const actualRemaining = userData.remainingClasses || userData.lessonCredits || 0;

      // Get active package from packages array
      const packages = userData.packages || [];
      const activePackage = packages.find(pkg => pkg.status === 'active') 
        || packages.find(pkg => pkg.status !== 'cancelled')
        || packages[0];

      // Try to get package info from multiple sources
      let correctPackageName = null;
      let correctPackageType = 'group';
      let correctExpiryDate = null;
      let realPackageId = null;

      // PRIORITY 1: Check packages array
      if (activePackage?.packageName && !activePackage.packageName.includes('Mevcut')) {
        correctPackageName = activePackage.packageName;
        correctPackageType = activePackage.packageType || 'group';
        correctExpiryDate = activePackage.expiryDate;
        realPackageId = activePackage.packageId;
      }
      
      // PRIORITY 2: Check selectedPackageId and fetch from database
      if (!correctPackageName) {
        const packageIdToFetch = userData.selectedPackageId 
          || activePackage?.packageId 
          || userData.packageInfo?.packageId
          || userData.packageId;
        
        // Only fetch if it's a real package ID
        if (packageIdToFetch && !packageIdToFetch.startsWith('migrated_') && !packageIdToFetch.startsWith('pkg_') && !packageIdToFetch.startsWith('fallback_')) {
          try {
            const packageRef = doc(db, 'packages', packageIdToFetch);
            const packageDoc = await getDoc(packageRef);
            
            if (packageDoc.exists()) {
              const packageData = packageDoc.data();
              correctPackageName = packageData.name || packageData.packageName;
              correctPackageType = packageData.packageType || packageData.type || 'group';
              realPackageId = packageIdToFetch;
              console.log(`✅ Found package from DB: ${correctPackageName} for user ${userId}`);
            }
          } catch (error) {
            console.warn(`Could not fetch package ${packageIdToFetch}:`, error);
          }
        }
      }

      // PRIORITY 3: Use existing packageInfo if valid
      if (!correctPackageName && userData.packageInfo?.packageName && !userData.packageInfo.packageName.includes('Mevcut')) {
        correctPackageName = userData.packageInfo.packageName;
        correctPackageType = userData.packageInfo.packageType || 'group';
      }

      // PRIORITY 4: Use root level if valid
      if (!correctPackageName && userData.packageName && !userData.packageName.includes('Mevcut')) {
        correctPackageName = userData.packageName;
        correctPackageType = userData.packageType || 'group';
      }

      // Get expiry date from best source
      correctExpiryDate = correctExpiryDate 
        || activePackage?.expiryDate 
        || userData.packageInfo?.expiryDate 
        || userData.packageExpiryDate;

      // If no package name but user has remaining classes, skip
      if (!correctPackageName && actualRemaining > 0) {
        console.log(`⚠️ User ${userId} has ${actualRemaining} classes but no identifiable package. Skipping.`);
        return { success: true, updated: false, userId, message: 'No package found to migrate' };
      }

      // Fix 1: Ensure packageInfo exists and has remainingClasses
      if (!userData.packageInfo || userData.packageInfo.remainingClasses === undefined ||
          (correctPackageName && userData.packageInfo.packageName !== correctPackageName)) {
        needsUpdate = true;
        updateData.packageInfo = {
          ...(userData.packageInfo || {}),
          packageId: realPackageId || activePackage?.packageId || userData.packageInfo?.packageId || `migrated_${Date.now()}`,
          packageName: correctPackageName,
          packageType: correctPackageType,
          lessonCount: userData.packageInfo?.lessonCount || actualRemaining,
          remainingClasses: actualRemaining,
          assignedAt: activePackage?.assignedAt || userData.packageInfo?.assignedAt || userData.packageStartDate || userData.approvedAt || new Date().toISOString(),
          expiryDate: correctExpiryDate || new Date().toISOString()
        };
      } else if (userData.packageInfo.remainingClasses !== actualRemaining) {
        needsUpdate = true;
        updateData.packageInfo = {
          ...userData.packageInfo,
          remainingClasses: actualRemaining
        };
      }

      // Fix 2: Ensure packageName exists at root level
      if (correctPackageName && userData.packageName !== correctPackageName) {
        needsUpdate = true;
        updateData.packageName = correctPackageName;
      }

      // Fix 3: Ensure packageExpiryDate exists
      if (!userData.packageExpiryDate && correctExpiryDate) {
        needsUpdate = true;
        updateData.packageExpiryDate = correctExpiryDate;
      }

      if (needsUpdate) {
        updateData.updatedAt = new Date().toISOString();
        updateData._migratedAt = new Date().toISOString();
        await updateDoc(userRef, updateData);
        console.log(`✅ Migrated user ${userId} package data`);
        return { success: true, updated: true, userId };
      }

      return { success: true, updated: false, userId, message: 'No migration needed' };
    } catch (error) {
      console.error(`❌ Error migrating user ${userId}:`, error);
      return { success: false, error: error.message, userId };
    }
  },

  /**
   * MIGRATION: Migrate all users with missing packageInfo data
   */
  migrateAllUsersPackageData: async () => {
    try {
      console.log('🔄 Starting package data migration for all users...');
      const results = { migrated: 0, skipped: 0, errors: [] };

      const usersCollection = collection(db, 'users');
      const usersQuery = query(usersCollection, where('role', '==', 'customer'));
      const usersSnapshot = await getDocs(usersQuery);

      for (const userDoc of usersSnapshot.docs) {
        const result = await adminService.migrateUserPackageData(userDoc.id);
        if (result.success && result.updated) {
          results.migrated++;
        } else if (result.success) {
          results.skipped++;
        } else {
          results.errors.push({ id: userDoc.id, error: result.error });
        }
      }

      console.log(`✅ Migration complete: ${results.migrated} migrated, ${results.skipped} skipped, ${results.errors.length} errors`);
      return { success: true, ...results };
    } catch (error) {
      console.error('❌ Error during migration:', error);
      return { success: false, error: error.message };
    }
  }
};
