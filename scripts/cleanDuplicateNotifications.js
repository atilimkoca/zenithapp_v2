/**
 * Script to clean up duplicate notifications from Firestore
 * Run this once to remove existing duplicates before the deduplication logic takes effect
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Firebase config (replace with your actual config)
const firebaseConfig = {
  // Your Firebase config here
  // Copy from your firebase.js config file
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const cleanDuplicateNotifications = async () => {
  try {
    console.log('🧹 Starting duplicate notification cleanup...');
    
    // Get all notifications
    const notificationsSnapshot = await getDocs(collection(db, 'notifications'));
    const notifications = [];
    
    notificationsSnapshot.forEach((doc) => {
      notifications.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : new Date(doc.data().createdAt)
      });
    });
    
    console.log(`📊 Found ${notifications.length} total notifications`);
    
    // Group by content signature (title + message + type + recipients + rough time)
    const contentGroups = new Map();
    
    notifications.forEach(notif => {
      // Create content signature for grouping
      const timeWindow = Math.floor(notif.createdAt.getTime() / (1000 * 60 * 5)); // 5-minute windows
      const signature = `${notif.title}_${notif.message || notif.body}_${notif.type}_${notif.recipients}_${timeWindow}`;
      
      if (!contentGroups.has(signature)) {
        contentGroups.set(signature, []);
      }
      contentGroups.get(signature).push(notif);
    });
    
    // Find duplicates and mark for deletion
    let duplicatesToDelete = [];
    
    contentGroups.forEach((group, signature) => {
      if (group.length > 1) {
        console.log(`🔍 Found ${group.length} duplicates for: ${group[0].title}`);
        
        // Sort by creation time (keep the earliest one)
        group.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        
        // Mark all but the first one for deletion
        for (let i = 1; i < group.length; i++) {
          duplicatesToDelete.push(group[i].id);
        }
      }
    });
    
    console.log(`🗑️  Found ${duplicatesToDelete.length} duplicate notifications to delete`);
    
    if (duplicatesToDelete.length === 0) {
      console.log('✅ No duplicates found!');
      return;
    }
    
    // Ask for confirmation
    console.log('⚠️  This will permanently delete the duplicate notifications.');
    console.log('   Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Delete duplicates
    console.log('🗑️  Deleting duplicates...');
    
    const deletePromises = duplicatesToDelete.map(async (notifId) => {
      try {
        await deleteDoc(doc(db, 'notifications', notifId));
        console.log(`✅ Deleted duplicate notification: ${notifId}`);
      } catch (error) {
        console.error(`❌ Error deleting ${notifId}:`, error);
      }
    });
    
    await Promise.all(deletePromises);
    
    console.log(`🎉 Cleanup complete! Deleted ${duplicatesToDelete.length} duplicate notifications.`);
    console.log(`📊 Remaining notifications: ${notifications.length - duplicatesToDelete.length}`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  }
};

// Run the cleanup
if (process.argv.includes('--run')) {
  cleanDuplicateNotifications().then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  }).catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
} else {
  console.log('📝 Duplicate notification cleanup script loaded.');
  console.log('🚀 Run with: node cleanDuplicateNotifications.js --run');
  console.log('⚠️  Make sure to update the Firebase config in this file first!');
}

export default cleanDuplicateNotifications;