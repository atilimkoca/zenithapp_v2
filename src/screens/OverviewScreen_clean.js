import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';

const { width } = Dimensions.get('window');

export default function OverviewScreen() {
  const { userData } = useAuth();

  const quickStats = [
    { title: 'Bu Ay', value: '8', subtitle: 'Ders', icon: 'calendar-outline', color: colors.primary },
    { title: 'Toplam', value: '32', subtitle: 'Ders', icon: 'trophy-outline', color: colors.success },
    { title: 'Aktif', value: '2', subtitle: 'Rezervasyon', icon: 'time-outline', color: colors.warning },
  ];

  const upcomingClasses = [
    { id: 1, name: 'Hatha Yoga', instructor: 'Ayşe Hoca', time: '09:00', date: '2 Eylül' },
    { id: 2, name: 'Pilates', instructor: 'Mehmet Hoca', time: '18:30', date: '3 Eylül' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Simple Page Header */}
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Zénith Yoga</Text>
          <Text style={styles.pageSubtitle}>Yoga yolculuğunuza hoş geldiniz</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Özet</Text>
          <View style={styles.statsContainer}>
            {quickStats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + '15' }]}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statTitle}>{stat.title}</Text>
                <Text style={styles.statSubtitle}>{stat.subtitle}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Upcoming Classes */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Yaklaşan Dersler</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Tümünü Gör</Text>
            </TouchableOpacity>
          </View>
          
          {upcomingClasses.map((classItem) => (
            <View key={classItem.id} style={styles.classCard}>
              <View style={styles.classInfo}>
                <Text style={styles.className}>{classItem.name}</Text>
                <Text style={styles.instructorName}>{classItem.instructor}</Text>
                <View style={styles.classDetails}>
                  <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                  <Text style={styles.classTime}>{classItem.time}</Text>
                  <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} style={styles.calendarIcon} />
                  <Text style={styles.classDate}>{classItem.date}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.joinButton}>
                <Text style={styles.joinButtonText}>Katıl</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="add-circle-outline" size={32} color={colors.primary} />
              <Text style={styles.actionText}>Ders Rezervasyonu</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="calendar-outline" size={32} color={colors.primary} />
              <Text style={styles.actionText}>Takvim</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.actionCard}>
              <Ionicons name="person-outline" size={32} color={colors.primary} />
              <Text style={styles.actionText}>Profil</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Studio Info */}
        <View style={styles.section}>
          <View style={styles.studioCard}>
            <View style={styles.studioHeader}>
              <Image
                source={{ uri: 'https://via.placeholder.com/48x48/6B7F6A/FFFFFF?text=ZY' }}
                style={styles.studioLogo}
              />
              <View style={styles.studioInfo}>
                <Text style={styles.studioName}>Zénith Yoga Studio</Text>
                <Text style={styles.studioSubtitle}>Premium yoga deneyimi</Text>
              </View>
            </View>
            
            <View style={styles.studioActions}>
              <TouchableOpacity style={styles.studioAction}>
                <Ionicons name="call-outline" size={16} color={colors.primary} />
                <Text style={styles.studioActionText}>Ara</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.studioAction}>
                <Ionicons name="location-outline" size={16} color={colors.primary} />
                <Text style={styles.studioActionText}>Konum</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.studioAction}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                <Text style={styles.studioActionText}>Bilgi</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Bottom spacing for tab bar */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  
  // Simple Page Header
  pageHeader: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  
  section: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  statCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statTitle: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: 10,
    color: colors.textSecondary,
  },
  
  // Classes
  classCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  instructorName: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  classDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  classTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  calendarIcon: {
    marginLeft: 12,
  },
  classDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  joinButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinButtonText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  
  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  actionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionText: {
    fontSize: 14,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  
  // Studio
  studioCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  studioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  studioLogo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  studioInfo: {
    flex: 1,
  },
  studioName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  studioSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  studioActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  studioAction: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  studioActionText: {
    fontSize: 14,
    color: colors.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
});
