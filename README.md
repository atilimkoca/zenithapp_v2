````markdown
# Zenith Pilates & Yoga Studio - Mobile App

A modern React Native mobile application for Zenith Pilates & Yoga Studio customers, built with Expo and Firebase.

## ✨ Features

### Authentication & User Management
- **User Registration** with email/password and admin approval system
- **Modern Login Screen** with form validation and error handling
- **Pending Approval Screen** for users awaiting admin approval
- **Password Reset** functionality via email
- **Firebase Authentication** integration

### User Experience
- **Enhanced Bottom Navigation** with smooth animations and transitions
- **Modern UI/UX** with clean design and consistent branding
- **Responsive Design** optimized for various screen sizes
- **Loading States** and error handling throughout the app

### Admin Integration
- **User Approval System** - New users require admin approval before accessing the app
- **Status Management** - Users can be approved, rejected, or pending
- **Firebase Integration** - All user data stored in Firestore with proper security

## 🎨 Design System

### Color Palette
The app uses a consistent green color palette that matches the admin panel:

```javascript
{
  primary: '#6B7F6A',        // Main green
  primaryLight: '#8FA08E',   // Lighter green
  primaryDark: '#4A5A49',    // Darker green
  secondary: '#A5B5A4',      // Soft green
  accent: '#7C8F7B',         // Accent green
  // ... additional colors for backgrounds, text, etc.
}
```

### Enhanced Navigation
- **Animated Tab Bar** with smooth transitions
- **Scale animations** for active tabs
- **Sliding indicator** that follows active tab
- **Press animations** with haptic-like feedback
- **Rounded corners** and shadow effects

## 📁 Project Structure

```
src/
├── components/
│   └── UI.js              # Reusable UI components
├── config/
│   └── firebase.js        # Firebase configuration
├── constants/
│   └── colors.js          # Color palette constants
├── context/
│   └── AuthContext.js     # Authentication state management
├── navigation/
│   ├── MainTabNavigator.js      # Enhanced animated tab navigation
│   └── EnhancedTabNavigator.js  # Alternative with Reanimated
├── screens/
│   ├── LoginScreen.js           # User login interface
│   ├── RegisterScreen.js        # User registration interface
│   ├── PendingApprovalScreen.js # Approval waiting screen
│   ├── DashboardScreen.js       # Main dashboard
│   ├── ClassSelectionScreen.js  # Class booking
│   ├── ClassHistoryScreen.js    # Class history
│   ├── OverviewScreen.js        # Overview/home
│   ├── ProfileScreen.js         # User profile
│   └── SplashScreen.js          # App loading screen
└── services/
    ├── authService.js     # Authentication services
    └── adminService.js    # Admin/user management services
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v16 or higher)
- Expo CLI
- Firebase project configured
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure Firebase:
   - Follow the setup guide in `FIREBASE_SETUP.md`
   - Update `src/config/firebase.js` with your Firebase configuration

4. Start the development server:
   ```bash
   npx expo start
   ```

5. Run on your preferred platform:
   - **iOS**: Press `i` or scan QR code with iPhone Camera
   - **Android**: Press `a` or scan QR code with Expo Go app
   - **Web**: Press `w` to open in browser

## 🔐 User Approval System

The app implements a comprehensive user approval system:

### User Flow
1. **Registration** → User creates account (status: 'pending')
2. **Login Attempt** → User sees pending approval screen if not approved
3. **Admin Approval** → Admin approves/rejects user via admin panel
4. **Access Granted** → Approved users can access the full app

### Database Structure
```javascript
/users/{userId} {
  uid: "firebase-user-id",
  email: "user@example.com",
  firstName: "John",
  lastName: "Doe",
  phone: "+90 555 123 45 67",
  displayName: "John Doe",
  status: "pending", // pending, approved, rejected
  isActive: false,   // true only when approved
  createdAt: "2025-09-01T10:00:00.000Z",
  approvedAt: null,
  approvedBy: null,
  // ... additional fields
}
```

### Admin Functions Available
- `getPendingUsers()` - Get all users awaiting approval
- `approveUser(userId, adminId)` - Approve a user
- `rejectUser(userId, adminId, reason)` - Reject a user with optional reason
- `getUserById(userId)` - Get user details
- `getAllUsers(status)` - Get all users with optional status filter

## 📱 Key Dependencies

- **React Native & Expo** - Mobile development platform
- **Firebase** - Authentication and database
- **React Navigation** - Screen navigation
- **React Native Reanimated** - Smooth animations
- **Expo Linear Gradient** - Background gradients
- **Ionicons** - Icon library

## 🔧 Configuration Files

- `app.json` - Expo configuration
- `firebase.js` - Firebase setup and initialization
- `FIREBASE_SETUP.md` - Detailed Firebase setup guide
- `ADMIN_INTEGRATION.md` - Admin panel integration guide

## 🎯 Current Features

✅ **User Authentication** (register, login, password reset)  
✅ **Admin Approval System** with pending/approved/rejected states  
✅ **Enhanced Navigation** with smooth animations  
✅ **Firebase Integration** for auth and database  
✅ **Modern UI/UX** with consistent design system  
✅ **Form Validation** and error handling  
✅ **Loading States** throughout the app  

## 🚧 Future Enhancements

1. **Class Booking System** - Schedule and book classes
2. **Payment Integration** - In-app payments for classes
3. **Push Notifications** - Class reminders and updates
4. **Profile Management** - Edit user preferences and info
5. **Workout Tracking** - Progress tracking and analytics
6. **Social Features** - Community and sharing capabilities

## 🛠️ Development Notes

- Built with Expo for easier development and deployment
- Firebase handles all authentication and data storage
- Admin panel integration ready for user management
- Enhanced animations using React Native Reanimated
- Responsive design works across different screen sizes
- Turkish language support for user messages

## 📄 License

Private project for Zenith Pilates & Yoga Studio.

````
