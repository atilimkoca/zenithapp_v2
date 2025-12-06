# Google Play Console Setup Guide for Zenith Studio

This guide will help you prepare and upload your Zenith Studio app to Google Play Console.

## Current Configuration

- **Package Name**: `com.zenithstudio.app`
- **Version Name**: `1.0.0`
- **Version Code**: `1`
- **App Name**: Zenith Studio

## Prerequisites Checklist

### 1. Firebase Setup for Android ⚠️ REQUIRED

You need to download the `google-services.json` file from Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `zenithstudio-97468`
3. Click the gear icon → **Project Settings**
4. Under "Your apps", click **Add app** → **Android**
5. Enter package name: `com.zenithstudio.app`
6. Download `google-services.json`
7. Place it in the project root: `/zenithapp_v2/google-services.json`

### 2. EAS Account Setup

Make sure you're logged in to EAS:
```bash
cd /Users/omeratilimkoca/Desktop/zenith/zenithapp_v2
eas login
```

### 3. Generate Upload Keystore (For First-time Upload)

When you run `eas build`, EAS will automatically:
- Generate a keystore for you (recommended for new apps)
- Store it securely on Expo's servers
- Use it for all future builds

⚠️ **Important**: Google Play requires you to use the same keystore for all app updates!

## Build Commands

### Development Build (for testing)
```bash
cd /Users/omeratilimkoca/Desktop/zenith/zenithapp_v2
eas build --platform android --profile development
```

### Production Build (AAB for Google Play)
```bash
cd /Users/omeratilimkoca/Desktop/zenith/zenithapp_v2
eas build --platform android --profile production
```

This will generate an `.aab` (Android App Bundle) file which is required by Google Play Console.

## Upload to Google Play Console

### Option 1: Manual Upload
1. Go to [Google Play Console](https://play.google.com/console/)
2. Select your app or create a new app with package: `com.zenithstudio.app`
3. Navigate to **Release** → **Production** (or Internal testing for first test)
4. Click **Create new release**
5. Upload the `.aab` file downloaded from EAS
6. Fill in release notes
7. Review and submit

### Option 2: Automated Submit with EAS (Optional)

1. Create a service account in Google Cloud Console
2. Download the JSON key file
3. Rename to `google-play-service-account.json` and place in project root
4. Run:
```bash
eas submit --platform android --profile production
```

## Store Listing Requirements

Before publishing, ensure you have:

### Required Assets
- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500 PNG)
- [ ] Phone screenshots (min 2, max 8) - 16:9 ratio recommended
- [ ] 7-inch tablet screenshots (if supporting tablets)
- [ ] 10-inch tablet screenshots (if supporting tablets)

### Required Information
- [ ] Short description (max 80 characters)
- [ ] Full description (max 4000 characters)
- [ ] App category
- [ ] Content rating questionnaire completed
- [ ] Privacy policy URL (use your support website)

### Suggested Content

**Short Description:**
```
Manage your dance/yoga studio - bookings, members, packages & more!
```

**Full Description (Turkish studio focus):**
```
Zenith Studio helps studio owners manage their business efficiently.

Features:
• Member Management - Track all your students and their information
• Lesson Booking - Easy scheduling and booking system
• Package Management - Flexible membership packages
• Attendance Tracking - Know who attended which class
• Push Notifications - Keep your members informed

Perfect for yoga studios, dance schools, pilates centers, and more.

Download now and simplify your studio management!
```

## Data Safety Declaration

For Google Play's Data Safety section, declare the following based on your app:

**Data Collected:**
- Name (Required for accounts)
- Email address (Required for accounts)
- Phone number (Optional, for contact)
- User IDs (For authentication)

**Data Usage:**
- App functionality only
- Not shared with third parties
- Not used for advertising

**Privacy Policy URL:**
Use your support website: `https://zenith-studio-support.web.app/privacy.html` or similar

## Quick Commands Reference

```bash
# Navigate to project
cd /Users/omeratilimkoca/Desktop/zenith/zenithapp_v2

# Check EAS login status
eas whoami

# Build for production
eas build --platform android --profile production

# Submit to Google Play (after setting up service account)
eas submit --platform android
```

## After Upload

1. Complete the content rating questionnaire
2. Set pricing (Free or Paid)
3. Select countries/regions for distribution
4. Review all store listing information
5. Submit for review

Google Play review typically takes 1-3 days for new apps.

---

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
eas build --platform android --profile production --clear-cache
```

### Version Code Issues
If you get "version code already exists" error, update `versionCode` in `app.config.js`

### Keystore Issues
If you need to manage your keystore:
```bash
eas credentials --platform android
```

---

**Note:** Your iOS app is at build 8. When updating both platforms simultaneously, consider syncing version numbers for consistency.
