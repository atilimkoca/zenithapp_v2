/**
 * Sample Data Creation Script for Zenith Studio
 * 
 * Bu script'i Firebase Console'da Functions veya admin panelinde çalıştırarak
 * test verilerini Firestore'a ekleyebilirsiniz.
 * 
 * NOT: Bu script'i çalıştırmadan önce Firebase Admin SDK kurulumunu tamamlayın.
 */

import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase'; // Firebase config dosyanızın yolu

export const createSampleData = async () => {
  try {
    console.log('🚀 Sample data creation started...');

    // 1. Sample Trainers
    const trainers = [
      {
        email: "ayse.yilmaz@zenithstudio.com",
        displayName: "Ayşe Yılmaz",
        firstName: "Ayşe",
        lastName: "Yılmaz",
        role: "instructor",
        status: "active",
        phoneNumber: "+905551234567",
        trainerProfile: {
          bio: "5 yıllık deneyimli yoga ve pilates eğitmeni. Hatha Yoga ve Mat Pilates konularında uzmandır.",
          specializations: ["Hatha Yoga", "Mat Pilates", "Meditasyon"],
          certifications: [
            {
              name: "RYT 500 Yoga Alliance",
              date: "2019-03-15",
              institution: "Yoga Alliance"
            },
            {
              name: "Mat Pilates Instructor",
              date: "2020-01-10", 
              institution: "BASI Pilates"
            }
          ],
          experience: "5+ yıl",
          isActive: true,
          rating: 4.8,
          totalClasses: 450,
          joinedDate: "2019-01-15"
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        email: "mehmet.demir@zenithstudio.com",
        displayName: "Mehmet Demir",
        firstName: "Mehmet",
        lastName: "Demir",
        role: "instructor",
        status: "active",
        phoneNumber: "+905552345678",
        trainerProfile: {
          bio: "Reformer Pilates ve güçlendirme antrenmanları konusunda 7 yıllık deneyimli eğitmen.",
          specializations: ["Reformer Pilates", "Strength Training", "Rehabilitasyon"],
          certifications: [
            {
              name: "Comprehensive Reformer Instructor",
              date: "2017-06-20",
              institution: "BASI Pilates"
            }
          ],
          experience: "7+ yıl",
          isActive: true,
          rating: 4.9,
          totalClasses: 620,
          joinedDate: "2017-03-01"
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        email: "zeynep.kaya@zenithstudio.com",
        displayName: "Zeynep Kaya",
        firstName: "Zeynep",
        lastName: "Kaya",
        role: "instructor", 
        status: "active",
        phoneNumber: "+905553456789",
        trainerProfile: {
          bio: "Vinyasa Flow ve Yin Yoga konularında uzman. Meditasyon ve nefes teknikleri eğitmeni.",
          specializations: ["Vinyasa Yoga", "Yin Yoga", "Meditasyon", "Pranayama"],
          certifications: [
            {
              name: "RYT 200 Vinyasa",
              date: "2018-09-10",
              institution: "Yoga Alliance"
            },
            {
              name: "Yin Yoga Teacher Training",
              date: "2019-11-25",
              institution: "International Yin Yoga Association"
            }
          ],
          experience: "6+ yıl",
          isActive: true,
          rating: 4.7,
          totalClasses: 380,
          joinedDate: "2018-06-15"
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Add trainers to Firestore
    const trainerIds = [];
    for (const trainer of trainers) {
      const docRef = await addDoc(collection(db, 'users'), trainer);
      trainerIds.push(docRef.id);
      console.log(`✅ Trainer added: ${trainer.displayName} (ID: ${docRef.id})`);
    }

    // 2. Sample Lessons
    const getNextWeekDate = (dayOffset, timeString) => {
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7 + dayOffset);
      
      const [hours, minutes] = timeString.split(':').map(Number);
      nextWeek.setHours(hours, minutes, 0, 0);
      
      return nextWeek.toISOString();
    };

    const lessons = [
      {
        title: "Sabah Hatha Yoga",
        type: "Hatha Yoga", 
        description: "Geleneksel hatha yoga pozları ile güne enerjik başlangıç",
        trainerId: trainerIds[0], // Ayşe Yılmaz
        trainerName: "Ayşe Yılmaz",
        dayOfWeek: "monday",
        startTime: "09:00",
        endTime: "10:15",
        duration: 75,
        scheduledDate: getNextWeekDate(0, "09:00"), // Next Monday
        maxParticipants: 15,
        participants: [],
        level: "beginner",
        price: 120,
        status: "active",
        isRecurring: true,
        recurringSeriesId: "series_hatha_morning",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Reformer Pilates İleri",
        type: "Reformer Pilates",
        description: "Reformer cihazı ile ileri seviye pilates antrenmanı",
        trainerId: trainerIds[1], // Mehmet Demir
        trainerName: "Mehmet Demir",
        dayOfWeek: "tuesday",
        startTime: "18:00",
        endTime: "19:00",
        duration: 60,
        scheduledDate: getNextWeekDate(1, "18:00"), // Next Tuesday
        maxParticipants: 8,
        participants: [],
        level: "advanced",
        price: 180,
        status: "active",
        isRecurring: true,
        recurringSeriesId: "series_reformer_evening",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Vinyasa Flow",
        type: "Vinyasa Yoga",
        description: "Dinamik yoga akışları ile güç ve esneklik geliştirme",
        trainerId: trainerIds[2], // Zeynep Kaya
        trainerName: "Zeynep Kaya",
        dayOfWeek: "wednesday",
        startTime: "19:30",
        endTime: "21:00",
        duration: 90,
        scheduledDate: getNextWeekDate(2, "19:30"), // Next Wednesday  
        maxParticipants: 12,
        participants: [],
        level: "intermediate",
        price: 140,
        status: "active",
        isRecurring: true,
        recurringSeriesId: "series_vinyasa_evening",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Mat Pilates Başlangıç",
        type: "Mat Pilates",
        description: "Başlangıç seviyesi pilates egzersizleri",
        trainerId: trainerIds[0], // Ayşe Yılmaz
        trainerName: "Ayşe Yılmaz",
        dayOfWeek: "thursday",
        startTime: "10:30",
        endTime: "11:30",
        duration: 60,
        scheduledDate: getNextWeekDate(3, "10:30"), // Next Thursday
        maxParticipants: 15,
        participants: [],
        level: "beginner",
        price: 100,
        status: "active",
        isRecurring: true,
        recurringSeriesId: "series_mat_pilates",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Yin Yoga & Meditasyon",
        type: "Yin Yoga",
        description: "Derin gevşeme ve iç huzur için yin yoga ve meditasyon",
        trainerId: trainerIds[2], // Zeynep Kaya
        trainerName: "Zeynep Kaya",
        dayOfWeek: "friday",
        startTime: "20:00",
        endTime: "21:30",
        duration: 90,
        scheduledDate: getNextWeekDate(4, "20:00"), // Next Friday
        maxParticipants: 15,
        participants: [],
        level: "all",
        price: 130,
        status: "active",
        isRecurring: true,
        recurringSeriesId: "series_yin_meditation",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        title: "Hafta Sonu Pilates",
        type: "Pilates",
        description: "Hafta sonunda rahatlatıcı pilates seansı",
        trainerId: trainerIds[1], // Mehmet Demir
        trainerName: "Mehmet Demir", 
        dayOfWeek: "saturday",
        startTime: "11:00",
        endTime: "12:00",
        duration: 60,
        scheduledDate: getNextWeekDate(5, "11:00"), // Next Saturday
        maxParticipants: 12,
        participants: [],
        level: "intermediate",
        price: 110,
        status: "active",
        isRecurring: true,
        recurringSeriesId: "series_weekend_pilates",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Add lessons to Firestore
    for (const lesson of lessons) {
      const docRef = await addDoc(collection(db, 'lessons'), lesson);
      console.log(`✅ Lesson added: ${lesson.title} (ID: ${docRef.id})`);
    }

    // 3. Lesson Types Settings (optional)
    const lessonTypesSettings = {
      types: [
        {
          id: "hatha-yoga",
          name: "Hatha Yoga",
          description: "Geleneksel yoga pozları ve nefes çalışması",
          icon: "leaf-outline",
          color: "#6366F1",
          difficulty: ["beginner", "intermediate"],
          duration: [60, 75],
          maxParticipants: 15,
          equipment: ["Yoga Matı", "Yoga Bloku", "Yoga Kayışı"],
          benefits: ["Esneklik", "Denge", "Zihin Rahatlama", "Nefes Kontrolü"]
        },
        {
          id: "reformer-pilates",
          name: "Reformer Pilates",
          description: "Reformer cihazı ile pilates egzersizleri",
          icon: "barbell-outline",
          color: "#F59E0B",
          difficulty: ["intermediate", "advanced"],
          duration: [50, 60],
          maxParticipants: 8,
          equipment: ["Reformer Cihazı"],
          benefits: ["Tam Vücut Kondisyon", "Kas Tanımlama", "Esneklik", "Güç"]
        },
        {
          id: "vinyasa-yoga",
          name: "Vinyasa Yoga",
          description: "Akıcı yoga sekansları",
          icon: "flower-outline",
          color: "#F97316",
          difficulty: ["intermediate", "advanced"],
          duration: [75, 90],
          maxParticipants: 12,
          equipment: ["Yoga Matı", "Yoga Bloku"],
          benefits: ["Güç", "Koordinasyon", "Akış", "Kardiyovasküler Sağlık"]
        }
      ],
      updatedAt: new Date().toISOString()
    };

    // Add lesson types settings
    await setDoc(doc(db, 'settings', 'lessonTypes'), lessonTypesSettings);
    console.log('✅ Lesson types settings added');

    console.log('🎉 Sample data creation completed!');
    console.log(`📊 Created: ${trainers.length} trainers, ${lessons.length} lessons, 1 settings document`);
    
    return {
      success: true,
      message: `Successfully created ${trainers.length} trainers and ${lessons.length} lessons`,
      trainerIds,
      createdAt: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    return {
      success: false,
      error: error.message,
      details: error
    };
  }
};

// Helper function to run the script
export const runSampleDataCreation = () => {
  console.log('🔧 Starting sample data creation...');
  console.log('ℹ️  Make sure Firebase is properly configured before running this script');
  
  return createSampleData()
    .then(result => {
      if (result.success) {
        console.log('✅ Sample data creation successful!');
        console.log('📱 You can now test the mobile app with the created data');
      } else {
        console.log('❌ Sample data creation failed:', result.error);
      }
      return result;
    })
    .catch(error => {
      console.error('💥 Script execution failed:', error);
      return { success: false, error: error.message };
    });
};

// Example usage in admin panel or Firebase Functions
// runSampleDataCreation();
