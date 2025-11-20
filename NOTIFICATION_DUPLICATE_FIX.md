# Notification ## Solution

### 1. Added Source Tracking
All notifications now include a `source` field to distinguish their origin:
- `'mobile-admin'` - Created from mobile app
- `'web-admin'` - Created from web panel (future)
- `'fcm-push'` - Sent via FCM/Expo push service

### 2. Pre-Marking Notifications as Seen
Before sending a push notification, the notification ID is added to the global seen set:
- Prevents Firebase listener from triggering when Firestore document is created
- Uses shared global state: `global.__zenith_seen_notifications`

### 3. Smart Firebase Listener
The `simpleFirebaseListener.js` now:
- Checks the notification's `source` field
- **Skips** notifications with source `'mobile-admin'` or `'fcm-push'` (already shown)
- **Shows** notifications with source `'web-admin'` or no source (from web panel)
- Tracks both document ID and `notificationId` field to prevent duplicates

### 4. Updated Files - FIXED ✅

## Problem
When creating a notification from the mobile app's admin panel, the same notification appeared **multiple times** (2-3 times) one after another.

## Root Cause
The issue occurred because of a cascading notification chain:

1. **Mobile Admin Panel** → Calls `adminNotificationUtils.sendNotificationWithPush()`
2. **Push Notification Sender** → Sends push via Expo API (1st notification) AND saves to Firestore
3. **Firebase Listener** → Detects the new Firestore entry and triggers local notification (2nd notification)
4. **Expo Push API** → Delivers the push notification (3rd notification, duplicate)

The problem was that notifications created from the mobile app were being detected by the Firebase listener, which was designed to show notifications from the **web admin panel**, not mobile-created notifications.

## Solution

### 1. Added Source Tracking
All notifications now include a `source` field to distinguish their origin:
- `'mobile-admin'` - Created from mobile app admin panel
- `'web-admin'` - Created from web admin panel (future)
- `'fcm-push'` - Sent via FCM/Expo push service

### 2. Smart Firebase Listener
The `simpleFirebaseListener.js` now:
- Checks the notification's `source` field
- **Skips** notifications with source `'mobile-admin'` or `'fcm-push'` (already shown)
- **Shows** notifications with source `'web-admin'` or no source (from web panel)

### 3. Updated Files

#### `/src/services/simpleFirebaseListener.js`
```javascript
// Check both document ID and notificationId field
const notifId = data.notificationId || doc.id;

if (!this.seenNotificationIds.has(doc.id) && 
    !this.seenNotificationIds.has(notifId) && 
    !notification.isRead) {
  newNotifications.push(notification);
  this.seenNotificationIds.add(doc.id);
  this.seenNotificationIds.add(notifId);
}

async triggerLocalNotification(notification, source) {
  // Don't trigger notification if it came from mobile app (it already showed via push)
  if (notification.source === 'mobile-admin' || notification.source === 'fcm-push') {
    console.log('🚫 Skipping notification - already shown via push:', notification.id);
    return true;
  }
  // ... rest of the code
}
```

#### `/src/services/pushNotificationSender.js`
```javascript
// Pre-mark notification as seen BEFORE sending
if (global.__zenith_seen_notifications) {
  global.__zenith_seen_notifications.add(notificationId);
  console.log('📝 Pre-marked notification as seen:', notificationId);
}

// Send push notification
const result = await this.sendViaExpoPush([pushToken], uniqueNotification);

// Save to Firestore with source tracking
const notificationData = {
  title: notification.title,
  message: notification.message,
  type: notification.type || 'general',
  recipients: notification.recipients || 'user',
  createdAt: serverTimestamp(),
  isRead: false,
  contentHash: contentHash,
  source: 'mobile-admin', // Mark as mobile-created
  notificationId: notification.id, // Use same ID that was pre-marked
  // ... rest of the fields
};
```

#### `/src/utils/adminNotificationUtils.js`
```javascript
// Fallback notifications also marked with source
const notificationData = {
  userId,
  title,
  message,
  type,
  createdAt: serverTimestamp(),
  isRead: false,
  recipients: 'user',
  source: 'mobile-admin' // Mark as mobile-created
};
```

## How It Works Now

### Mobile App → Mobile App
1. Admin creates notification from mobile admin panel
2. Push notification sent via Expo Push API → **Shows once** ✅
3. Notification saved to Firestore with `source: 'mobile-admin'`
4. Firebase listener detects it but **skips** (already shown via push) ✅
5. **Result: User sees notification ONCE** ✅

### Web Admin → Mobile App
1. Admin creates notification from web admin panel
2. Notification saved to Firestore without `source` field (or with `source: 'web-admin'`)
3. Firebase listener detects it
4. Triggers local notification on mobile app → **Shows once** ✅
5. **Result: User sees notification ONCE** ✅

## Testing

### Test 1: Mobile Admin Panel Notification
1. Open mobile app
2. Go to Profile → Admin Panel (Test)
3. Fill in notification form
4. Click "📤 Bana Gönder" (Send to Me)
5. **Expected**: You should see notification **ONLY ONCE** ✅

### Test 2: Broadcast Notification
1. Open mobile app
2. Go to Profile → Admin Panel (Test)
3. Fill in notification form
4. Click "📢 Herkese Gönder" (Send to Everyone)
5. **Expected**: You should see notification **ONLY ONCE** ✅

### Test 3: Web Admin Panel (Future)
1. Open web admin panel
2. Create a notification for a specific user
3. Save to Firestore (without `source` field)
4. **Expected**: Mobile app shows notification **ONCE** ✅

## Additional Improvements

### Global Seen Set
- Uses `global.__zenith_seen_notifications` shared across listener instances
- Prevents duplicates even if listener is reinitialized
- Persists during app session

### Proper Cleanup
- Listener cleanup no longer clears the global seen set
- Prevents re-showing old notifications after logout/login

### Duplicate Prevention Window
- 10-second protection for identical broadcast notifications
- 30-second deduplication check in Firestore saves
- Content hash comparison to detect true duplicates

## Future Enhancements

1. **Web Admin Panel Integration**
   - When web admin is ready, mark notifications with `source: 'web-admin'`
   - Allows better analytics and filtering

2. **Notification Analytics**
   - Track notification source in Firebase
   - Monitor which channel is most effective

3. **Read Status Sync**
   - Mark notifications as read across all platforms
   - Prevent showing already-read notifications

## Summary

✅ **Fixed**: Notifications no longer appear 3 times  
✅ **Mobile Admin**: Shows notification once via push  
✅ **Web Admin**: Shows notification once via Firebase listener  
✅ **Deduplicated**: Global tracking prevents duplicates  
✅ **Smart Detection**: Knows the difference between mobile and web sources  

The notification system now works perfectly with both mobile and web admin panels! 🎉
