# Testing Guide - Package Management System

## 🧪 Test Scenarios

### Test 1: Approve User with Package ✅

**Prerequisites:**
- At least one active package in database
- At least one pending user

**Steps:**
1. Open mobile app as admin
2. Navigate to "Üye Yönetimi"
3. Find a pending user
4. Click the ✓ (approve) button
5. In the modal, click "Onayla"
6. Package selection modal should appear
7. Select a package (e.g., "8 Ders Paketi")
8. Click "Paket ile Onayla"

**Expected Results:**
- User status changes to 'approved'
- User card now shows:
  - 🎫 Kalan Ders: 8 (or selected package amount)
  - 📅 Bitiş date (30 days from now)
  - Green color indicator
- User can now access the app
- Database updated with packageInfo

**Pass/Fail:** ___

---

### Test 2: Approve User WITHOUT Package ✅

**Steps:**
1. Open mobile app as admin
2. Navigate to "Üye Yönetimi"
3. Find a pending user
4. Click the ✓ (approve) button
5. In the modal, click "Onayla"
6. Package selection modal should appear
7. **Don't select any package**
8. Click "Paketsiz Onayla" (button text should change)

**Expected Results:**
- User status changes to 'approved'
- User card shows:
  - 🎫 Kalan Ders: 0
  - 📅 Bitiş date still set (30 days from now)
- User can access app but cannot book lessons
- Database has packageInfo with lessonCount: 0

**Pass/Fail:** ___

---

### Test 3: Renew Package - Active User ✅

**Prerequisites:**
- At least one approved user with package

**Steps:**
1. Navigate to "Üye Yönetimi"
2. Find an approved user
3. Note their current remaining lessons
4. Click the ↻ (renew) button
5. Select a different package
6. Click "Paketi Yenile"

**Expected Results:**
- Old lesson credits replaced with new package credits
- New expiry date calculated (30 days from renewal)
- User card updated immediately
- Color indicator reflects new status
- Database packageInfo updated with renewedBy field

**Pass/Fail:** ___

---

### Test 4: Package Expiry Warning (7 days) ⚠️

**Prerequisites:**
- User with package expiring in ≤ 7 days

**To Create Test Data:**
```javascript
// In Firebase Console or script
packageInfo: {
  expiryDate: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString() // 5 days from now
}
```

**Steps:**
1. Navigate to "Üye Yönetimi"
2. Find the test user
3. Observe the user card

**Expected Results:**
- ⚠️ Warning icon appears
- Text color changes to yellow/orange
- Shows days remaining (e.g., "5 gün")
- Renew button visible and functional

**Pass/Fail:** ___

---

### Test 5: Package Expired 🔴

**Prerequisites:**
- User with expired package

**To Create Test Data:**
```javascript
// In Firebase Console or script
packageInfo: {
  expiryDate: new Date(Date.now() - (1 * 24 * 60 * 60 * 1000)).toISOString() // 1 day ago
}
```

**Steps:**
1. Navigate to "Üye Yönetimi"
2. Find the test user
3. Observe the user card

**Expected Results:**
- 🔴 Red color
- Shows "Paket Süresi Doldu" message
- Renew button still available
- User can still login but cannot book new lessons

**Pass/Fail:** ___

---

### Test 6: Search and Filter with Package Info ✅

**Steps:**
1. Navigate to "Üye Yönetimi"
2. Enter user name in search box
3. Try different filters: Tümü, Bekleyen, Onaylı, Reddedilen
4. Verify package info displays correctly for all filtered results

**Expected Results:**
- Search works with package information visible
- Filters work correctly
- Package info displays for approved users only
- No errors or missing data

**Pass/Fail:** ___

---

### Test 7: Reject User from Approval Modal ✅

**Steps:**
1. Navigate to "Üye Yönetimi"
2. Find a pending user
3. Click ✓ button
4. In modal, click "Reddet" instead
5. Optionally enter rejection reason
6. Confirm rejection

**Expected Results:**
- User status changes to 'rejected'
- User cannot access app
- No package assigned
- Rejection reason saved (if provided)

**Pass/Fail:** ___

---

### Test 8: Re-approve Rejected User ✅

**Prerequisites:**
- At least one rejected user

**Steps:**
1. Navigate to "Üye Yönetimi"
2. Filter by "Reddedilen"
3. Find a rejected user
4. Click ↻ (re-approve) button
5. Select a package
6. Confirm approval

**Expected Results:**
- User status changes to 'approved'
- Package assigned
- 30-day period starts fresh
- User can now access app

**Pass/Fail:** ___

---

### Test 9: Multiple Package Changes ✅

**Steps:**
1. Approve user with 4-lesson package
2. User card shows 4 lessons, 30 days
3. Renew to 8-lesson package
4. User card shows 8 lessons, new 30 days
5. Renew again to 12-lesson package
6. User card shows 12 lessons, new 30 days

**Expected Results:**
- Each renewal replaces previous package completely
- Credits always match current package
- Expiry date always 30 days from last renewal
- No leftover credits from previous packages

**Pass/Fail:** ___

---

### Test 10: Date Formatting (Turkish Locale) ✅

**Steps:**
1. Check multiple user cards
2. Verify date format

**Expected Results:**
- Dates show in DD.MM.YYYY format
- Turkish month names (if applicable)
- Correct timezone handling
- No date parsing errors

**Pass/Fail:** ___

---

## 🔍 Edge Cases to Test

### Edge Case 1: Package with 0 Lessons
- Create package with lessonCount: 0
- Assign to user
- Verify user cannot book lessons
- Expiry date still calculated

### Edge Case 2: Very Long Package Names
- Create package with 50+ character name
- Verify UI doesn't break
- Text truncation works correctly

### Edge Case 3: Rapid Multiple Renewals
- Renew package
- Immediately renew again
- Verify data consistency
- No race conditions

### Edge Case 4: Offline/Online Sync
- Approve user while offline
- Go online
- Verify sync completes correctly

---

## 🎯 Performance Tests

### Load Test 1: Many Users
- Test with 100+ users in list
- Scroll performance
- Search performance
- Filter performance

### Load Test 2: Many Packages
- Test with 20+ packages
- Modal scroll performance
- Package selection responsiveness

---

## 🐛 Known Issues to Check

- [ ] Package modal scroll on small screens
- [ ] Long package names overflow
- [ ] Time zone differences
- [ ] Expired package user experience
- [ ] Missing package data fallback

---

## ✅ Checklist - All Tests Must Pass

### Core Functionality
- [ ] Approve with package
- [ ] Approve without package
- [ ] Renew package
- [ ] Reject user
- [ ] Re-approve rejected user

### UI Display
- [ ] Remaining lessons display
- [ ] Expiry date display
- [ ] Color coding (green/yellow/red)
- [ ] Days remaining calculation
- [ ] Package info in modal

### Data Integrity
- [ ] Database updates correctly
- [ ] Credits match package
- [ ] Expiry dates calculate correctly
- [ ] Old data cleaned on renewal

### Edge Cases
- [ ] Zero lesson package
- [ ] Expired package
- [ ] Multiple rapid renewals
- [ ] Missing package data

---

## 📊 Test Results Template

```
Test Date: _______________
Tester: _______________
Device: _______________
OS Version: _______________

Test 1: [ ] Pass [ ] Fail - Notes: _______________
Test 2: [ ] Pass [ ] Fail - Notes: _______________
Test 3: [ ] Pass [ ] Fail - Notes: _______________
Test 4: [ ] Pass [ ] Fail - Notes: _______________
Test 5: [ ] Pass [ ] Fail - Notes: _______________
Test 6: [ ] Pass [ ] Fail - Notes: _______________
Test 7: [ ] Pass [ ] Fail - Notes: _______________
Test 8: [ ] Pass [ ] Fail - Notes: _______________
Test 9: [ ] Pass [ ] Fail - Notes: _______________
Test 10: [ ] Pass [ ] Fail - Notes: _______________

Overall Status: [ ] All Pass [ ] Some Failures

Issues Found:
1. _______________
2. _______________
3. _______________
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All tests pass
- [ ] No console errors
- [ ] Database indexes updated
- [ ] Backup created
- [ ] Documentation complete
- [ ] Admin training complete
- [ ] Rollback plan ready

---

## 📝 Test Data Setup Script

```javascript
// Create test users with different package states
const testUsers = [
  {
    status: 'pending',
    name: 'Test User Pending'
  },
  {
    status: 'approved',
    remainingClasses: 8,
    packageInfo: {
      expiryDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
    },
    name: 'Test User Active'
  },
  {
    status: 'approved',
    remainingClasses: 3,
    packageInfo: {
      expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()
    },
    name: 'Test User Warning'
  },
  {
    status: 'approved',
    remainingClasses: 2,
    packageInfo: {
      expiryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    },
    name: 'Test User Expired'
  },
  {
    status: 'rejected',
    name: 'Test User Rejected'
  }
];
```

---

**Happy Testing! 🎉**
