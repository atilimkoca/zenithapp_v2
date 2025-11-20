# Firebase Kurulum ve Veri Yapısı Rehberi

Bu rehber, Zenith Studio uygulaması için Firebase Firestore veritabanında gerekli koleksiyonları ve veri yapısını oluşturmanız için hazırlanmıştır.

## Gerekli Koleksiyonlar

### 1. `users` Koleksiyonu (Eğitmen Bilgileri)

Eğitmen bilgileri `users` koleksiyonunda `role: "instructor"` veya `role: "admin"` olan kullanıcılar olarak saklanır.

**Örnek eğitmen belgesi:**

```json
{
  "email": "ayse.yilmaz@zenithstudio.com",
  "displayName": "Ayşe Yılmaz",
  "firstName": "Ayşe",
  "lastName": "Yılmaz",
  "role": "instructor",
  "status": "active",
  "phoneNumber": "+905551234567",
  "profileImage": "https://example.com/profile-images/ayse.jpg",
  "trainerProfile": {
    "bio": "5 yıllık deneyimli yoga ve pilates eğitmeni. Uluslararası sertifikalara sahip.",
    "specializations": [
      "Hatha Yoga",
      "Pilates",
      "Meditasyon"
    ],
    "certifications": [
      {
        "name": "RYT 500 Yoga Alliance",
        "date": "2019-03-15",
        "institution": "Yoga Alliance"
      },
      {
        "name": "Mat Pilates Instructor",
        "date": "2020-01-10",
        "institution": "BASI Pilates"
      }
    ],
    "experience": "5+ yıl deneyim",
    "isActive": true,
    "rating": 4.8,
    "totalClasses": 450,
    "joinedDate": "2019-01-15"
  },
  "createdAt": "2019-01-15T10:30:00Z",
  "updatedAt": "2024-09-09T14:20:00Z"
}
```

### 2. `lessons` Koleksiyonu (Ders Bilgileri)

Her ders için ayrı bir belge oluşturulur.

**Örnek ders belgesi:**

```json
{
  "title": "Sabah Hatha Yoga",
  "type": "Hatha Yoga",
  "description": "Geleneksel hatha yoga pozları ile güne başlayın",
  "trainerId": "eğitmen_kullanıcı_id_buraya",
  "trainerName": "Ayşe Yılmaz",
  "dayOfWeek": "monday",
  "startTime": "09:00",
  "endTime": "10:15",
  "duration": 75,
  "scheduledDate": "2024-09-16T09:00:00Z",
  "maxParticipants": 15,
  "participants": [
    "öğrenci_id_1",
    "öğrenci_id_2"
  ],
  "level": "beginner",
  "price": 120,
  "status": "active",
  "isRecurring": true,
  "recurringSeriesId": "series_12345",
  "equipment": [
    "Yoga Matı",
    "Yoga Bloku"
  ],
  "createdAt": "2024-09-01T10:00:00Z",
  "updatedAt": "2024-09-09T15:30:00Z"
}
```

### 3. `settings` Koleksiyonu (Ders Türleri - İsteğe Bağlı)

Ders türlerini Firebase'de merkezi olarak yönetmek için kullanılabilir.

**settings/lessonTypes belgesi:**

```json
{
  "types": [
    {
      "id": "pilates",
      "name": "Pilates",
      "description": "Core güçlendirme ve postür düzeltme egzersizleri",
      "icon": "fitness-outline",
      "color": "#8B5CF6",
      "difficulty": ["beginner", "intermediate", "advanced"],
      "duration": [45, 60, 75],
      "maxParticipants": 12,
      "equipment": ["Pilates Matı", "Pilates Topu", "Resistance Band"],
      "benefits": ["Core Gücü", "Postür Düzeltme", "Esneklik", "Denge"]
    },
    {
      "id": "yoga",
      "name": "Yoga",
      "description": "Zihin ve beden uyumu için yoga pratiği",
      "icon": "leaf-outline",
      "color": "#10B981",
      "difficulty": ["beginner", "intermediate", "advanced"],
      "duration": [60, 75, 90],
      "maxParticipants": 15,
      "equipment": ["Yoga Matı", "Yoga Bloku", "Yoga Kayışı"],
      "benefits": ["Esneklik", "Zihin Dinginliği", "Stres Azaltma", "Güç"]
    }
  ],
  "updatedAt": "2024-09-09T12:00:00Z"
}
```

## Veri Ekleme Adımları

### 1. Firebase Console'dan Manuel Ekleme

1. Firebase Console'a gidin
2. Firestore Database bölümüne gidin
3. Yukarıdaki örneklere göre koleksiyonları ve belgeleri oluşturun

### 2. Admin Panel Üzerinden Ekleme

Admin paneli (zenithstudio) üzerinden:

1. **Eğitmen Ekleme**: Kullanıcı kayıt sistemi ile eğitmen hesapları oluşturun
2. **Ders Oluşturma**: Schedule bölümünden yeni dersler ekleyin
3. **Ders Türleri**: Kod içerisinde tanımlı varsayılan türler kullanılır

### 3. Test Verisi Ekleme

Hızlı test için aşağıdaki komutu çalıştırabilirsiniz:

```javascript
// Firebase console'da çalıştırılacak kod örneği
// Bu kod parçasını Firebase console'un "Rules playground" kısmında test edebilirsiniz

// Örnek eğitmen verisi
const trainerData = {
  email: "test@zenithstudio.com",
  displayName: "Test Eğitmen",
  firstName: "Test",
  lastName: "Eğitmen",
  role: "instructor",
  status: "active",
  trainerProfile: {
    bio: "Test eğitmeni",
    specializations: ["Yoga", "Pilates"],
    isActive: true
  },
  createdAt: new Date().toISOString()
};

// Örnek ders verisi
const lessonData = {
  title: "Test Yoga Dersi",
  type: "Yoga",
  trainerId: "test_trainer_id",
  trainerName: "Test Eğitmen",
  dayOfWeek: "monday",
  startTime: "10:00",
  endTime: "11:00",
  duration: 60,
  scheduledDate: "2024-09-16T10:00:00Z",
  maxParticipants: 15,
  participants: [],
  level: "beginner",
  status: "active",
  isRecurring: false,
  createdAt: new Date().toISOString()
};
```

## Veri Yapısı Kontrol Listesi

- [ ] `users` koleksiyonu oluşturuldu
- [ ] En az bir eğitmen (`role: "instructor"`) eklendi
- [ ] Eğitmen için `trainerProfile` alt objesi dolduruldu
- [ ] `lessons` koleksiyonu oluşturuldu
- [ ] En az bir aktif ders (`status: "active"`) eklendi
- [ ] Ders `scheduledDate` alanı bugünden sonraki bir tarih
- [ ] Ders `trainerId` alanı mevcut bir eğitmenin ID'si
- [ ] (İsteğe bağlı) `settings/lessonTypes` belgesi oluşturuldu

## Önemli Notlar

1. **Tarih Formatı**: Tüm tarihler ISO 8601 formatında string olarak saklanmalı
2. **Eğitmen ID'leri**: `lessons.trainerId` alanı mutlaka mevcut bir `users` belgesinin ID'si olmalı
3. **Ders Durumu**: Sadece `status: "active"` olan dersler mobil uygulamada görünür
4. **Eğitmen Durumu**: Sadece `status: "active"` olan eğitmenler listede görünür
5. **Gelecek Tarihler**: Sadece bugünden sonraki dersler mobil uygulamada görünür

## Hata Giderme

### Mobil Uygulamada Ders Görünmüyor

1. Ders `status: "active"` mi?
2. `scheduledDate` bugünden sonra mı?
3. `startTime` ve `endTime` alanları dolu mu?
4. `trainerId` geçerli bir eğitmen ID'si mi?

### Eğitmen Bilgileri Görünmüyor

1. Eğitmen `role: "instructor"` veya `role: "admin"` mi?
2. Eğitmen `status: "active"` mi?
3. `displayName` veya `firstName`/`lastName` alanları dolu mu?

### Konsol Hataları

Chrome Developer Tools > Console kısmından hata mesajlarını kontrol edin.
Uygulamada `console.log` mesajları ile veri akışını takip edebilirsiniz.
