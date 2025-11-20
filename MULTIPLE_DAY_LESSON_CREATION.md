# Multiple Day Lesson Creation Feature

## Overview
Updated the lesson creation screen to allow selecting **multiple days** when creating a lesson. Previously, you could only select one day and copy it to future weeks. Now you can create the same lesson on different days of the week (e.g., Monday, Wednesday, Friday) in one operation.

## Changes Made

### 1. State Management
**File**: `/src/screens/admin/AdminCreateLessonScreen.js`

- Changed `selectedDay` (single string) to `selectedDays` (array of strings)
- Updated initial state to use an array: `[getDayKeyFromDate(new Date())]`

### 2. Day Selection Logic
**New behavior**:
- **Tap a day**: Adds it to selection (shows checkmark icon)
- **Tap again**: Removes it from selection
- **Minimum requirement**: At least one day must be selected

```javascript
const handleSelectDay = (dayKey) => {
  setSelectedDays((prev) => {
    if (prev.includes(dayKey)) {
      // Remove day if already selected (but keep at least one)
      return prev.length > 1 ? prev.filter(d => d !== dayKey) : prev;
    } else {
      // Add day to selection
      return [...prev, dayKey];
    }
  });
};
```

### 3. Lesson Creation Process
**Updated `handleCreate` function**:
- Loops through each selected day
- Creates a separate lesson for each day
- Each lesson is properly adjusted to the correct date for that weekday
- Still supports copying to future weeks for each day

```javascript
// Create lessons for each selected day
for (const dayKey of selectedDays) {
  let lessonData;
  try {
    lessonData = buildLessonPayload(dayKey);
  } catch (payloadError) {
    // Handle errors
  }

  const result = await adminLessonService.createLesson(lessonData);

  if (result.success) {
    totalCreated++;

    // Copy to future weeks if specified
    if (!Number.isNaN(extraWeeks) && extraWeeks > 0) {
      const copyResult = await adminLessonService.copyLessonToFutureWeeks(
        lessonData,
        extraWeeks
      );
      // Track copied lessons
    }
  }
}
```

### 4. Payload Builder
**Updated `buildLessonPayload` function**:
- Now accepts `dayKey` parameter
- Uses `adjustDateToDay()` to calculate the correct date for each day
- Each lesson gets the proper `dayOfWeek` and `scheduledDate`

### 5. UI Updates
**Day Selection Section**:
- Label changed to "Ders Günleri * (Çoklu Seçim)"
- Added checkmark icon when day is selected
- Helper text shows all selected days: "Seçilen günler: Pazartesi, Çarşamba, Cuma"

**Success Message**:
- Shows number of lessons created and which days
- Example: "3 ders başarıyla oluşturuldu (Pazartesi, Çarşamba, Cuma). 12 ders 4 hafta boyunca kopyalandı."

## Example Usage

### Scenario 1: Create a Yoga class on Monday, Wednesday, Friday
1. Fill in lesson details (title, type, trainer, etc.)
2. Select multiple days: Tap "Pzt", "Çar", "Cum"
3. Set time: 10:00 AM
4. Set copy weeks: 4 (optional)
5. Tap "Ders Oluştur"

**Result**: 
- 3 lessons created (one for each day this week)
- If copy weeks = 4, then 12 more lessons created (3 days × 4 weeks = 12)
- Total: 15 lessons created

### Scenario 2: Create weekend-only class
1. Select only "Cmt" (Saturday) and "Paz" (Sunday)
2. Configure lesson details
3. Create

**Result**: 2 lessons created for this week

## Validation
- At least one day must be selected (validation added)
- Cannot deselect the last remaining day
- All other validations remain the same (title, type, trainer, etc.)

## Technical Details

### Date Adjustment Logic
```javascript
const adjustDateToDay = (baseDate, targetKey) => {
  const targetIndex = WEEKDAY_KEYS.indexOf(targetKey);
  const result = new Date(baseDate);
  const currentIndex = result.getDay();
  let diff = targetIndex - currentIndex;
  if (diff < 0) {
    diff += 7; // Move to next week if day already passed
  }
  result.setDate(result.getDate() + diff);
  return result;
};
```

This ensures that if you create a lesson on Wednesday, and select Monday, Wednesday, Friday:
- Monday will be set to the next Monday
- Wednesday will be this Wednesday
- Friday will be this Friday

## Benefits
1. **Efficiency**: Create recurring weekly schedules in one operation
2. **Flexibility**: Mix and match any days of the week
3. **Time-saving**: No need to create lessons one day at a time
4. **User-friendly**: Visual feedback with checkmarks for selected days

## Files Modified
- `/src/screens/admin/AdminCreateLessonScreen.js`

## No Breaking Changes
- Existing lessons are not affected
- The lesson service (`lessonService.js`) did not need modifications
- All existing functionality (copy to future weeks, trainer selection, etc.) still works

---

**Date**: 7 Ekim 2025
**Feature**: Multiple Day Lesson Creation
**Status**: ✅ Implemented and tested
