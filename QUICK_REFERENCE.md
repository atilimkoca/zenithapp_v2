# Quick Reference Card - Package Management

## 🚀 Quick Start

### For Admins Using the App

1. **Approve New Member with Package**
   ```
   Navigate to "Üye Yönetimi"
   → Find pending user
   → Click ✓ button
   → Select package
   → Click "Paket ile Onayla"
   ```

2. **Renew Member Package**
   ```
   Navigate to "Üye Yönetimi"
   → Find approved user
   → Click ↻ button
   → Select new package
   → Click "Paketi Yenile"
   ```

---

## 📝 Key Functions Reference

### adminService Functions

```javascript
// Approve user with package
await adminService.approveUser(userId, adminId, {
  id: packageId,
  name: packageName,
  lessonCount: lessonCount
});

// Renew user package
await adminService.renewUserPackage(userId, {
  id: packageId,
  name: packageName,
  lessonCount: lessonCount
}, adminId);
```

---

## 📊 User Data Structure

```javascript
{
  status: 'approved',
  packageInfo: {
    packageId: 'pkg-xxx',
    packageName: '8 Ders Paketi',
    lessonCount: 8,
    assignedAt: '2025-01-08T10:00:00.000Z',
    expiryDate: '2025-02-07T10:00:00.000Z'
  },
  remainingClasses: 8,
  lessonCredits: 8
}
```

---

## 🎨 UI Components

### User Card States

| Status | Display | Action Button |
|--------|---------|---------------|
| Pending | Kayıt tarihi | ✓ Approve, ✗ Reject |
| Approved | Kalan ders + Bitiş tarihi | ↻ Renew |
| Rejected | Kayıt tarihi | ↻ Re-approve |

### Color Indicators

- 🟢 Green: > 7 days remaining
- 🟡 Yellow: ≤ 7 days remaining  
- 🔴 Red: Expired

---

## ⚙️ Configuration

### Change Package Duration
```javascript
// In adminService.js
expiryDate.setDate(expiryDate.getDate() + 30); // Change 30
```

### Change Warning Threshold
```javascript
// In AdminUserManagementScreen.js
daysRemaining <= 7 // Change 7
```

---

## 🔍 Troubleshooting

### Package not showing?
- Check if packageService is loaded
- Verify package is active in database

### Expiry date wrong?
- Check server time vs device time
- Verify date calculation in approveUser()

### Credits not updating?
- Check both remainingClasses and lessonCredits fields
- Verify package lessonCount is set correctly

---

## 📦 Database Fields

```javascript
// Required fields in users collection
{
  status: String,           // 'pending', 'approved', 'rejected'
  packageInfo: Object,      // See structure above
  remainingClasses: Number, // Main field
  lessonCredits: Number,    // Backup field
  approvedAt: String,       // ISO date
  updatedAt: String         // ISO date
}
```

---

## 🎯 Common Tasks

### Get user's remaining lessons
```javascript
const remainingLessons = user.remainingClasses || user.lessonCredits || 0;
```

### Check if package expired
```javascript
const isExpired = new Date(user.packageInfo?.expiryDate) < new Date();
```

### Calculate days remaining
```javascript
const daysRemaining = Math.max(0, Math.ceil(
  (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
));
```

### Format date for display
```javascript
const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};
```

---

## 🚨 Important Notes

1. **Package duration**: Fixed at 30 days
2. **Credits reset**: Old credits are replaced on renewal
3. **No auto-disable**: Expired packages show warning only
4. **Manual renewal**: Admin must manually renew packages
5. **Backward compatible**: Works with old lessonCredits field

---

## 📞 Support

- Check `PACKAGE_MANAGEMENT_SYSTEM.md` for full documentation
- Check `UI_VISUAL_GUIDE.md` for UI reference
- Check `PACKAGE_IMPLEMENTATION_SUMMARY.md` for changes made

---

**Version**: 1.0.0  
**Last Updated**: January 8, 2025
