# 🔒 SECURITY SETUP REQUIRED

**⚠️ IMPORTANT: This repository requires environment configuration before use!**

## Firebase Configuration

This app uses Firebase for backend services. You need to configure your own Firebase project:

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication, Firestore, and Cloud Functions

### 2. Get Your Configuration
1. In Firebase Console, go to Project Settings
2. Add a web app to your project
3. Copy the config object

### 3. Environment Setup

Create a `.env` file in the root directory with your Firebase configuration:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=your-actual-api-key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
EXPO_PUBLIC_FIREBASE_APP_ID=your-app-id
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id
```

### 4. Install Dependencies
```bash
npm install
```

### 5. Run the App
```bash
npx expo start
```

## Security Notes

- **Never commit your `.env` file to version control**
- **Never share your Firebase API keys publicly**
- **Use Firebase security rules to protect your data**

## Features

- User authentication
- Class booking system
- Multi-language support (Turkish/English)
- Push notifications
- Admin panel

## Tech Stack

- React Native (Expo)
- Firebase (Auth, Firestore)
- React Navigation
- Expo Notifications

---

**Note**: This is a yoga studio management app. Make sure to configure Firebase security rules appropriately for production use.