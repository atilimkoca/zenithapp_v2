# Admin Panel Integration Guide

## 🔐 User Approval System

The mobile app now implements a user approval system where users must be approved by an admin before they can access the application.

## 📱 Mobile App Flow

### 1. User Registration
- User registers with email, password, and personal information
- Account is created with `status: 'pending'` 
- User receives message: "Hesabınız başarıyla oluşturuldu! Admin onayı beklendiği için giriş yapabilmek için onay beklemeniz gerekmektedir."

### 2. User Login Attempt
- User tries to login with email/password
- Firebase authentication succeeds
- App checks user status in Firestore
- If status is not 'approved', user is immediately logged out
- User sees "Pending Approval" screen

### 3. Approval States
- **pending**: User waiting for admin approval
- **approved**: User can access the app
- **rejected**: User account was rejected by admin

## 🛠️ Admin Panel Integration

### Database Structure

Users are stored in Firestore with this structure:

```javascript
/users/{userId}
{
  uid: "firebase-user-id",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe", 
  phone: "+90 555 123 45 67",
  displayName: "John Doe",
  
  // Approval system fields
  status: "pending", // pending, approved, rejected
  isActive: false,   // true only when approved
  
  // Timestamps
  createdAt: "2025-09-01T10:00:00.000Z",
  updatedAt: "2025-09-01T10:00:00.000Z",
  lastLoginAt: null,
  
  // Approval details
  approvedAt: null,
  approvedBy: null,    // admin user ID
  rejectedAt: null,
  rejectedBy: null,    // admin user ID  
  rejectionReason: "", // optional reason
  
  // Studio-specific fields
  membershipType: "basic",
  joinDate: "2025-09-01T10:00:00.000Z",
  totalClasses: 0,
  preferences: {
    notifications: true,
    emailUpdates: true
  }
}
```

### Admin Functions Required

Your admin panel should implement these functions:

#### 1. Get Pending Users
```javascript
// Query Firestore for users with status = "pending"
// Order by createdAt desc to show newest first
```

#### 2. Approve User
```javascript
// Update user document:
{
  status: "approved",
  isActive: true,
  approvedAt: new Date().toISOString(),
  approvedBy: adminUserId,
  updatedAt: new Date().toISOString()
}
```

#### 3. Reject User
```javascript
// Update user document:
{
  status: "rejected", 
  isActive: false,
  rejectedAt: new Date().toISOString(),
  rejectedBy: adminUserId,
  rejectionReason: "Optional reason",
  updatedAt: new Date().toISOString()
}
```

## 🔥 Firestore Queries for Admin Panel

### Get All Pending Users
```javascript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';

const getPendingUsers = async () => {
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
  
  return pendingUsers;
};
```

### Approve User
```javascript
import { doc, updateDoc } from 'firebase/firestore';

const approveUser = async (userId, adminId) => {
  const userRef = doc(db, 'users', userId);
  
  await updateDoc(userRef, {
    status: 'approved',
    isActive: true,
    approvedAt: new Date().toISOString(),
    approvedBy: adminId,
    updatedAt: new Date().toISOString()
  });
};
```

### Reject User
```javascript
import { doc, updateDoc } from 'firebase/firestore';

const rejectUser = async (userId, adminId, reason = '') => {
  const userRef = doc(db, 'users', userId);
  
  await updateDoc(userRef, {
    status: 'rejected',
    isActive: false,
    rejectedAt: new Date().toISOString(),
    rejectedBy: adminId,
    rejectionReason: reason,
    updatedAt: new Date().toISOString()
  });
};
```

## 📊 Admin Panel UI Suggestions

### Pending Users Table
Display pending users with these columns:
- **Name**: firstName + lastName
- **Email**: email
- **Phone**: phone  
- **Registration Date**: createdAt
- **Actions**: Approve/Reject buttons

### User Management Dashboard
- **Total Users**: Count all users
- **Pending Approvals**: Count pending users
- **Approved Users**: Count approved users
- **Rejected Users**: Count rejected users

### Approval Actions
- **Bulk Approve**: Select multiple users and approve all
- **Bulk Reject**: Select multiple users and reject all
- **Individual Actions**: Approve/reject single user
- **Rejection Reason**: Optional text field for rejection reason

## 🔔 Notifications (Optional)

Consider implementing:
- **Email notifications** when user is approved/rejected
- **Push notifications** to mobile app when status changes
- **Admin notifications** when new users register

## 🛡️ Security Rules

Update Firestore security rules to ensure users can only read their own data:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read their own data
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only admins can write (via admin SDK or Cloud Functions)
    }
    
    // Admin-only collections
    match /admin/{document=**} {
      allow read, write: if false; // Only server-side access
    }
  }
}
```

## 🚀 Testing the Flow

1. **Register** a new user from mobile app
2. **Check Firestore** - user should have `status: "pending"`
3. **Try to login** - user should see pending approval screen
4. **Approve user** from admin panel
5. **Login again** - user should access the dashboard

## 📝 Mobile App Status Messages

- **Registration Success**: "Hesabınız başarıyla oluşturuldu! Admin onayı beklendiği için giriş yapabilmek için onay beklemeniz gerekmektedir."
- **Login Pending**: "Hesabınız admin onayı bekliyor. Onaylandıktan sonra giriş yapabileceksiniz."
- **Login Rejected**: "Hesabınız reddedilmiş. Daha fazla bilgi için lütfen bizimle iletişime geçin."

## 🔄 Real-time Updates (Optional)

For real-time status updates, implement Firestore listeners in the mobile app:

```javascript
import { onSnapshot } from 'firebase/firestore';

const listenToUserStatus = (userId, callback) => {
  const userRef = doc(db, 'users', userId);
  
  return onSnapshot(userRef, (doc) => {
    if (doc.exists()) {
      const userData = doc.data();
      callback(userData.status);
    }
  });
};
```

This allows the mobile app to automatically update when admin changes user status without requiring app restart.
