// Test notification utility for development
// Use this to create test notifications while index is building

import { addDoc, collection } from 'firebase/firestore';
import { db } from '../config/firebase';

export const createTestNotification = async (userId) => {
  try {
    
    const testNotification = {
      userId: userId,
      title: 'Test Bildirimi 🧘‍♀️',
      message: 'Bu bir test bildirimidir. Bildirim sistemi çalışıyor!',
      type: 'general',
      priority: 'normal',
      isRead: false,
      createdAt: new Date()
    };


    const docRef = await addDoc(collection(db, 'notifications'), testNotification);
    
    
    return {
      success: true,
      notificationId: docRef.id,
      message: 'Test bildirimi oluşturuldu.'
    };
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
    return {
      success: false,
      error: error.code,
      message: 'Test bildirimi oluşturulamadı: ' + error.message
    };
  }
};

// Create a broadcast notification (like the ones in your database)
export const createBroadcastTestNotification = async () => {
  try {
    
    const broadcastNotification = {
      title: 'Genel Duyuru 📢',
      message: 'Bu tüm kullanıcılar için bir test duyurusudur!',
      type: 'info',
      recipients: 'all',
      status: 'sent',
      createdAt: new Date()
    };


    const docRef = await addDoc(collection(db, 'notifications'), broadcastNotification);
    
    
    return {
      success: true,
      notificationId: docRef.id,
      message: 'Genel duyuru oluşturuldu.'
    };
  } catch (error) {
    console.error('❌ Error creating broadcast notification:', error);
    return {
      success: false,
      error: error.code,
      message: 'Genel duyuru oluşturulamadı: ' + error.message
    };
  }
};

// Create multiple test notifications
export const createMultipleTestNotifications = async (userId, count = 5) => {
  const promises = [];
  
  for (let i = 1; i <= count; i++) {
    const testNotification = {
      userId: userId,
      title: `Test Bildirimi ${i} 📱`,
      message: `Bu ${i}. test bildirimidir. Bildirim sistemi düzgün çalışıyor!`,
      type: i % 2 === 0 ? 'lesson' : 'general',
      priority: i === 1 ? 'high' : 'normal',
      isRead: i % 3 === 0, // Some read, some unread
      createdAt: new Date(Date.now() - (i * 60000)) // Different timestamps
    };

    promises.push(addDoc(collection(db, 'notifications'), testNotification));
  }

  try {
    const results = await Promise.all(promises);
    
    return {
      success: true,
      count: results.length,
      message: `${results.length} test bildirimi oluşturuldu.`
    };
  } catch (error) {
    console.error('❌ Error creating test notifications:', error);
    return {
      success: false,
      error: error.code,
      message: 'Test bildirimleri oluşturulamadı.'
    };
  }
};

// Usage example:
// import { createTestNotification, createMultipleTestNotifications } from '../utils/testNotifications';
// await createTestNotification('your-user-id');
// await createMultipleTestNotifications('your-user-id', 3);