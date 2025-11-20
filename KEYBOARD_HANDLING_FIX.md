# Keyboard Handling Fix - Lesson Creation Screen

## Issue
When entering a value in the "Diğer Haftalara Kopyala" (Copy to Future Weeks) input field, the keyboard would cover the input field, making it impossible to see what you're typing.

## Solution
Implemented keyboard-aware scrolling to automatically move the screen up when the keyboard appears.

## Changes Made

### 1. Added Keyboard Handling Imports
**File**: `/src/screens/admin/AdminCreateLessonScreen.js`

Added:
- `useRef` from React (for referencing ScrollView and input)
- `Keyboard` from React Native (for keyboard events)
- `KeyboardAvoidingView` from React Native (for automatic keyboard handling)

```javascript
import React, { useState, useEffect, useRef } from 'react';
import {
  // ... other imports
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
```

### 2. Created References
Added refs to track the ScrollView and copy weeks input:

```javascript
const scrollViewRef = useRef(null);
const copyWeeksInputRef = useRef(null);
```

### 3. Wrapped Container with KeyboardAvoidingView
Replaced the root `<View>` container with `<KeyboardAvoidingView>`:

```javascript
<KeyboardAvoidingView 
  style={styles.container}
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
>
  {/* Content */}
</KeyboardAvoidingView>
```

**Behavior**:
- **iOS**: Uses `padding` to push content up
- **Android**: Uses `height` to adjust container height
- **Offset**: Small vertical offset to account for header

### 4. Added ScrollView Reference
Added ref to ScrollView for programmatic scrolling:

```javascript
<ScrollView 
  ref={scrollViewRef}
  style={styles.content} 
  showsVerticalScrollIndicator={false}
  keyboardShouldPersistTaps="handled"
>
```

**keyboardShouldPersistTaps="handled"**: Allows tapping on other inputs while keyboard is open

### 5. Auto-Scroll on Input Focus
Added `onFocus` handler to the copy weeks input:

```javascript
<View style={styles.inputGroup} ref={copyWeeksInputRef}>
  <Text style={styles.label}>Diğer Haftalara Kopyala</Text>
  <View style={styles.copyInputRow}>
    <View style={styles.copyInputWrapper}>
      <TextInput
        style={styles.copyInput}
        value={copyWeeks}
        onChangeText={handleCopyWeeksChange}
        placeholder="0"
        placeholderTextColor={colors.textSecondary}
        keyboardType="number-pad"
        maxLength={2}
        onFocus={() => {
          // Scroll to make the input visible when keyboard opens
          setTimeout(() => {
            copyWeeksInputRef.current?.measureLayout(
              scrollViewRef.current,
              (x, y) => {
                scrollViewRef.current?.scrollTo({
                  y: y - 100,
                  animated: true
                });
              },
              () => {}
            );
          }, 100);
        }}
      />
      <Text style={styles.copyInputSuffix}>hafta</Text>
    </View>
  </View>
  <Text style={styles.helperText}>0 girerseniz yalnızca bu ders oluşturulur.</Text>
</View>
```

**How it works**:
1. When input is focused, `onFocus` is triggered
2. After 100ms delay (to let keyboard animation start)
3. Measure the input's position relative to ScrollView
4. Scroll to position minus 100px (to add some padding from top)
5. Animated scroll for smooth user experience

## Technical Details

### measureLayout()
```javascript
copyWeeksInputRef.current?.measureLayout(
  scrollViewRef.current,  // Relative to this container
  (x, y) => {            // Success callback with coordinates
    scrollViewRef.current?.scrollTo({
      y: y - 100,        // Scroll position (with 100px padding)
      animated: true     // Smooth animation
    });
  },
  () => {}              // Error callback
);
```

This method:
- Measures the element's position relative to a parent
- Returns x, y coordinates
- Allows precise scrolling to the element

### Why setTimeout()?
The 100ms delay ensures:
1. Keyboard animation has started
2. Layout has been measured
3. Scroll animation is smooth and not jarring

## Benefits
1. ✅ **Input Always Visible**: The field scrolls into view automatically
2. ✅ **Native Feel**: Smooth animations and platform-specific behavior
3. ✅ **No Manual Scrolling**: User doesn't need to scroll manually
4. ✅ **Cross-Platform**: Works on both iOS and Android

## Testing Scenarios

### Test 1: Direct Focus
1. Scroll to bottom of form
2. Tap on "Diğer Haftalara Kopyala" input
3. **Expected**: Input scrolls into view above keyboard

### Test 2: Tab Navigation
1. Fill in previous fields
2. Press "Next" on keyboard to reach copy weeks input
3. **Expected**: Screen automatically scrolls to show input

### Test 3: Quick Typing
1. Focus on input
2. Immediately start typing
3. **Expected**: Can see digits being typed

### Test 4: Keyboard Dismissal
1. After typing, tap outside or press "Done"
2. **Expected**: Keyboard dismisses, screen returns to normal scroll position

## Platform Differences

### iOS
- Uses `padding` behavior
- Keyboard pushes content up smoothly
- Native keyboard toolbar (Done button) works perfectly

### Android
- Uses `height` behavior
- Adjusts container height to accommodate keyboard
- Handles different keyboard types (number-pad, default, etc.)

## Files Modified
- `/src/screens/admin/AdminCreateLessonScreen.js`

## No Breaking Changes
- All existing functionality preserved
- Keyboard behavior is additive, not destructive
- Works with all other inputs on the form

---

**Date**: 7 Ekim 2025
**Issue**: Keyboard covering input field
**Solution**: KeyboardAvoidingView + Auto-scroll on focus
**Status**: ✅ Fixed and tested
