# 🎄 Christmas Effects - Quick Guide

## Overview
This document explains how to enable/disable the Christmas effects in the Zenith mobile app.

## Current Status: **ENABLED**

The Christmas effects include:
- ❄️ **Snowfall Animation** - Beautiful falling snowflakes across all screens
- 🎅 **Santa Hat** - Festive hat on the Zenith logo
- 🎄 **Christmas Greeting** - Festive banner on the Overview screen

---

## How to Disable Christmas Effects (After Christmas)

### Quick Method (Recommended)
Open the file `src/config/christmasConfig.js` and change:

```javascript
// Change this from true to false
enabled: true,  // ← Change to false
```

That's it! All Christmas effects will be disabled immediately.

### Alternative: Automatic Disable Date
The effects are already configured to automatically disable after **January 2nd, 2026**.
You can change this date in the config:

```javascript
autoDisableDate: new Date('2026-01-02'),
```

---

## Individual Effect Control

You can also enable/disable specific effects without removing others:

```javascript
effects: {
  snowfall: true,        // Falling snowflakes
  christmasColors: true, // Christmas accent colors
  santaHat: true,        // Santa hat on logo
  christmasGreeting: true, // Special greeting message
},
```

---

## Complete Removal (Optional)

If you want to completely remove the Christmas code after the holiday season:

### Step 1: Remove imports from App.js
Remove the ChristmasWrapper import and usage:
```javascript
// Remove this line:
import { ChristmasWrapper } from './src/components/christmas';

// And restore the NavigationContainer to:
<NavigationContainer>
  <StatusBar style="dark" backgroundColor={colors.background} />
  <Navigation />
</NavigationContainer>
```

### Step 2: Remove imports from other files
Remove SantaHat and ChristmasGreeting imports from:
- `src/components/UniqueHeader.js`
- `src/screens/OverviewScreen.js`
- `src/screens/LoginScreen.js`

### Step 3: Delete the Christmas folder
```bash
rm -rf src/components/christmas/
rm src/config/christmasConfig.js
```

### Step 4: Remove translations
Remove the `christmas` section from:
- `src/locales/tr.js`
- `src/locales/en.js`

---

## Files Modified for Christmas Effects

| File | What was added |
|------|----------------|
| `App.js` | ChristmasWrapper around Navigation |
| `src/components/UniqueHeader.js` | SantaHat on logo |
| `src/screens/OverviewScreen.js` | ChristmasGreeting banner |
| `src/screens/LoginScreen.js` | SantaHat on login logo |
| `src/locales/tr.js` | Christmas translations |
| `src/locales/en.js` | Christmas translations |

## Files Created for Christmas Effects

| File | Description |
|------|-------------|
| `src/config/christmasConfig.js` | Main configuration file |
| `src/components/christmas/Snowfall.js` | Snowflake animation |
| `src/components/christmas/ChristmasWrapper.js` | Wrapper component |
| `src/components/christmas/SantaHat.js` | Santa hat component |
| `src/components/christmas/ChristmasGreeting.js` | Greeting banner |
| `src/components/christmas/index.js` | Export file |

---

## Snowfall Configuration

You can adjust the snowfall effect in `christmasConfig.js`:

```javascript
snowfall: {
  snowflakeCount: 25,    // More = more snow
  minSize: 6,            // Minimum snowflake size
  maxSize: 16,           // Maximum snowflake size
  minDuration: 8000,     // Faster fall
  maxDuration: 15000,    // Slower fall
  opacity: 0.8,          // Visibility
},
```

---

**Happy Holidays! 🎄❄️🎅**
