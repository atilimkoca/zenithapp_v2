import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const COLLECTION = 'packages';

const sanitizeForUpdate = (data) => {
  if (!data || typeof data !== 'object') {
    return {};
  }

  const {
    id,
    createdAt,
    createdBy,
    updatedAt,
    ...rest
  } = data;

  return rest;
};

const packageService = {
  async getAllPackages() {
    try {
      const packagesRef = collection(db, COLLECTION);
      const packagesQuery = query(packagesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(packagesQuery);

      const items = snapshot.docs.map((packageDoc) => ({
        id: packageDoc.id,
        ...packageDoc.data(),
      }));

      return {
        success: true,
        data: items,
      };
    } catch (error) {
      console.error('Error fetching packages:', error);
      return {
        success: false,
        error: 'Paketler alınamadı',
      };
    }
  },

  async getActivePackages() {
    try {
      const packagesRef = collection(db, COLLECTION);
      // Query only by isActive to avoid composite index requirement
      const packagesQuery = query(
        packagesRef,
        where('isActive', '==', true)
      );
      const snapshot = await getDocs(packagesQuery);
      
      // Filter and sort in memory
      const items = snapshot.docs
        .map((packageDoc) => ({
          id: packageDoc.id,
          ...packageDoc.data(),
        }))
        .sort((a, b) => (a.price || 0) - (b.price || 0)); // Sort by price ascending

      return {
        success: true,
        data: items,
      };
    } catch (error) {
      console.error('Error fetching active packages:', error);
      return {
        success: false,
        error: 'Aktif paketler alınamadı',
      };
    }
  },

  async getPackageById(packageId) {
    try {
      const packageRef = doc(db, COLLECTION, packageId);
      const packageDoc = await getDoc(packageRef);

      if (!packageDoc.exists()) {
        return {
          success: false,
          error: 'Paket bulunamadı',
        };
      }

      return {
        success: true,
        data: {
          id: packageDoc.id,
          ...packageDoc.data(),
        },
      };
    } catch (error) {
      console.error('Error fetching package:', error);
      return {
        success: false,
        error: 'Paket alınamadı',
      };
    }
  },

  async createPackage(packageData) {
    try {
      const sanitized = sanitizeForUpdate(packageData);
      const now = serverTimestamp();
      const payload = {
        ...sanitized,
        isActive: sanitized.isActive ?? true,
        features: Array.isArray(sanitized.features) ? sanitized.features : [],
        packageType: sanitized.packageType || 'group', // Default to 'group' if not specified
        createdAt: now,
        updatedAt: now,
      };

      const docRef = await addDoc(collection(db, COLLECTION), payload);

      return {
        success: true,
        data: {
          id: docRef.id,
          ...payload,
        },
      };
    } catch (error) {
      console.error('Error creating package:', error);
      return {
        success: false,
        error: 'Paket oluşturulamadı',
      };
    }
  },

  async updatePackage(packageId, packageData) {
    try {
      const packageRef = doc(db, COLLECTION, packageId);
      const sanitized = sanitizeForUpdate(packageData);
      const payload = {
        ...sanitized,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(packageRef, payload);

      return {
        success: true,
        data: {
          id: packageId,
          ...payload,
        },
      };
    } catch (error) {
      console.error('Error updating package:', error);
      return {
        success: false,
        error: 'Paket güncellenemedi',
      };
    }
  },

  async deletePackage(packageId) {
    try {
      const packageRef = doc(db, COLLECTION, packageId);
      await deleteDoc(packageRef);

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting package:', error);
      return {
        success: false,
        error: 'Paket silinemedi',
      };
    }
  },
};

export default packageService;
