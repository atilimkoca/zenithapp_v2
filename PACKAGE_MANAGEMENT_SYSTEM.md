# Package Management System - Paket Yönetim Sistemi

## 📦 Özet (Summary)

Üye onaylama sürecine entegre edilmiş paket yönetim sistemi. Üyeler onaylanırken paket atanır ve 30 günlük süre başlar.

## 🎯 Özellikler (Features)

### 1. Onaylama Sırasında Paket Atama
- Bekleyen üye onaylandığında paket seçim ekranı açılır
- Admin istediği paketi seçer veya paketsiz onaylar
- Paket seçilirse:
  - Üyeye belirlenen sayıda ders kredisi eklenir
  - 30 günlük paket süresi başlar
  - Bitiş tarihi otomatik hesaplanır

### 2. Üye Kartı Bilgileri
Onaylı üyeler için kart üzerinde görüntülenir:
- **Kalan Ders**: Üyenin kullanabileceği ders sayısı
- **Paket Bitiş Tarihi**: 30 günlük sürenin bitiş tarihi
- **Kalan Gün Sayısı**: Paketin dolmasına kaç gün kaldığı
- **Renk Kodlaması**:
  - 🟢 Yeşil: 7 günden fazla süre kaldıysa
  - 🟡 Sarı: 7 gün veya daha az süre kaldıysa
  - 🔴 Kırmızı: Süre dolduysa

### 3. Paket Yenileme
- Onaylı üyeler için "Yenile" butonu görünür
- Admin butona tıklayarak yeni paket seçer
- Yeni paket atandığında:
  - Eski kalan dersler silinir
  - Yeni paket dersleri atanır
  - Yeni 30 günlük süre başlar
  - Bitiş tarihi yeniden hesaplanır

## 📊 Veri Yapısı (Data Structure)

### User Document
```javascript
{
  // ... mevcut alanlar
  
  // Paket bilgileri
  packageInfo: {
    packageId: "paket-id",           // Seçilen paketin ID'si
    packageName: "8 Ders Paketi",    // Paket adı
    lessonCount: 8,                  // Paket ders sayısı
    assignedAt: "2025-01-08T10:00:00.000Z",  // Atanma tarihi
    expiryDate: "2025-02-07T10:00:00.000Z",  // Bitiş tarihi (30 gün sonra)
    renewedBy: "admin-uid"           // Yenileyen admin (opsiyonel)
  },
  
  // Kalan ders sayısı
  remainingClasses: 8,
  lessonCredits: 8,                  // Backward compatibility
  
  // ... diğer alanlar
}
```

## 🔄 İş Akışı (Workflow)

### Yeni Üye Onaylama
```
1. Admin "Üye Yönetimi" ekranına gider
2. Bekleyen üyeye "✓" butonuna tıklar
3. Onay modalı açılır → "Onayla" butonuna basar
4. Paket seçim ekranı açılır
5. Admin bir paket seçer (veya paketsiz onaylar)
6. "Paket ile Onayla" butonuna basar
7. Sistem:
   - Üyeyi onaylar (status: 'approved')
   - Seçilen paketi atar
   - 30 günlük süreyi başlatır
   - Bitiş tarihini hesaplar
```

### Paket Yenileme
```
1. Admin onaylı üyenin kartında "↻" butonuna tıklar
2. Paket yenileme modalı açılır
3. Admin yeni paketi seçer
4. "Paketi Yenile" butonuna basar
5. Sistem:
   - Eski paket bilgilerini siler
   - Yeni paketi atar
   - Yeni 30 günlük süreyi başlatır
   - Yeni bitiş tarihini hesaplar
```

## 🎨 UI Değişiklikleri (UI Changes)

### Üye Kartı - Bekleyen (Pending)
```
[Avatar] Ad Soyad
         email@example.com
         +90 555 123 45 67
         Kayıt: 05.01.2025
         
[Bekliyor]  [✓] [✗]
```

### Üye Kartı - Onaylı (Approved)
```
[Avatar] Ad Soyad
         email@example.com
         +90 555 123 45 67
         🎫 Kalan Ders: 8
         📅 Bitiş: 07.02.2025 (30 gün)
         
[Onaylandı]  [↻]
```

### Üye Kartı - Süresi Dolmuş (Expired)
```
[Avatar] Ad Soyad
         email@example.com
         +90 555 123 45 67
         🎫 Kalan Ders: 2
         ⚠️ Paket Süresi Doldu
         
[Onaylandı]  [↻]
```

## 🔧 API Fonksiyonları (API Functions)

### adminService.approveUser(userId, adminId, packageData)
```javascript
// Üyeyi onayla ve paket ata
const packageData = {
  id: "paket-id",
  name: "8 Ders Paketi",
  lessonCount: 8
};

const result = await adminService.approveUser(
  userId,
  adminId,
  packageData  // null olabilir (paketsiz onay için)
);
```

### adminService.renewUserPackage(userId, packageData, adminId)
```javascript
// Üyenin paketini yenile
const packageData = {
  id: "paket-id",
  name: "12 Ders Paketi",
  lessonCount: 12
};

const result = await adminService.renewUserPackage(
  userId,
  packageData,
  adminId
);
```

## ⚙️ Yapılandırma (Configuration)

### Paket Süresi
Paket süresi varsayılan olarak **30 gün**dır. Değiştirmek için:

```javascript
// adminService.js içinde
const expiryDate = new Date(now);
expiryDate.setDate(expiryDate.getDate() + 30);  // 30 gün yerine istediğiniz sayıyı yazın
```

### Süre Uyarı Eşiği
Süre dolma uyarısı varsayılan olarak **7 gün** önceden gösterilir:

```javascript
// AdminUserManagementScreen.js içinde
const daysRemaining = getDaysRemaining(packageExpiry);
// 7 gün veya daha azsa sarı renk gösterir
```

## 📝 Notlar (Notes)

1. **Paket Süresi**: 30 günlük süre, üye onaylandığı andan itibaren başlar
2. **Ders Kullanımı**: Üye süre içinde derslerini kullanmalı, yoksa süre dolar
3. **Yenileme**: Paket yenilendiğinde eski dersler kaybolur, yeni paket dersleri gelir
4. **Paketsiz Onay**: Admin paketsiz de onaylayabilir (0 ders, süre yine başlar)
5. **Geçmiş Kayıtlar**: Paket atamaları ve yenilemeleri user document'inde saklanır

## 🚀 Gelecek Geliştirmeler (Future Improvements)

- [ ] Paket geçmişi (hangi paketler ne zaman atandı)
- [ ] Otomatik süre dolumu bildirimleri
- [ ] Esnek paket süreleri (15/30/45/60 gün seçenekleri)
- [ ] Paket kullanım istatistikleri
- [ ] Toplu paket atama
- [ ] Paket indirimleri ve kampanyalar

## 📞 Destek (Support)

Sorularınız için:
- GitHub Issues
- Email: info@zenithstudio.com
