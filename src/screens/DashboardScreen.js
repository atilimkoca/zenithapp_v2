import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profileService';
import UniqueHeader from '../components/UniqueHeader';

const { width } = Dimensions.get('window');

export default function DashboardScreen() {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    stats: {
      totalLessons: 0,
      completedLessons: 0,
      upcomingLessons: 0,
      totalHours: 0,
    },
    recentActivity: [],
    upcomingClasses: [],
    achievements: [],
  });

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Load user statistics
      const statsResult = await profileService.getUserStats(user.uid);
      if (statsResult.success) {
        setDashboardData(prev => ({
          ...prev,
          stats: statsResult.stats,
        }));
      }
      
      // TODO: Load other dynamic data from Firebase
      // - Recent activity
      // - Upcoming classes
      // - Achievements
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const StatCard = ({ icon, value, label, color = colors.primary }) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <UniqueHeader 
          title="Genel Bakış" 
          subtitle="Veriler yükleniyor..." 
          rightIcon="refresh"
          onRightPress={loadDashboardData}
        />
        
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Veriler yükleniyor...</Text>
        </View>
      </View>
    );
  }

  const headerStats = [
    { value: (dashboardData.stats.completedLessons || 0).toString(), label: 'Tamamlanan', icon: 'checkmark-circle-outline', color: 'rgba(255, 255, 255, 0.3)' },
    { value: (dashboardData.stats.upcomingLessons || 0).toString(), label: 'Yaklaşan', icon: 'time-outline', color: 'rgba(255, 255, 255, 0.3)' },
    { value: `${dashboardData.stats.totalHours || 0}h`, label: 'Toplam Saat', icon: 'hourglass-outline', color: 'rgba(255, 255, 255, 0.3)' },
  ];

  return (
    <View style={styles.container}>
      <UniqueHeader 
        title="Genel Bakış" 
        subtitle="Yoga yolculuğunuzdaki ilerleyişiniz"
        rightIcon="notifications-outline"
        onRightPress={() => {}}
        showStats={true}
        stats={headerStats}
      />

      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.innerContent}>
          {/* Welcome Section */}
          <View style={styles.welcomeSection}>
            <View style={styles.userAvatar}>
              <Ionicons name="person" size={28} color={colors.primary} />
            </View>
            <View style={styles.welcomeContent}>
              <Text style={styles.welcomeTitle}>
                {userData?.displayName || `${userData?.firstName} ${userData?.lastName}` || 'Zénith Kullanıcısı'}
              </Text>
              <Text style={styles.welcomeSubtitle}>
                {userData?.membershipType === 'premium' ? 'Premium Üye' : 'Standart Üye'}
              </Text>
            </View>
          </View>

          {/* Statistics Grid */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>İstatistikler</Text>
            <View style={styles.statsGrid}>
              <StatCard 
                icon="checkmark-circle" 
                value={dashboardData.stats.completedLessons || 0}
                label="Tamamlanan Ders"
                color={colors.success}
              />
              <StatCard 
                icon="time" 
                value={dashboardData.stats.upcomingLessons || 0}
                label="Yaklaşan Ders"
                color={colors.warning}
              />
              <StatCard 
                icon="trophy" 
                value={dashboardData.stats.totalHours || 0}
                label="Toplam Saat"
                color={colors.secondary}
              />
              <StatCard 
                icon="calendar" 
                value={dashboardData.stats.totalLessons || 0}
                label="Bu Ay"
                color={colors.primary}
              />
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Hızlı Erişim</Text>
            <View style={styles.actionGrid}>
              <TouchableOpacity style={styles.actionCard}>
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.actionGradient}
                >
                  <Ionicons name="calendar-outline" size={28} color={colors.white} />
                  <Text style={styles.actionTitle}>Ders Seç</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard}>
                <LinearGradient
                  colors={[colors.success, colors.success + 'CC']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="list-outline" size={28} color={colors.white} />
                  <Text style={styles.actionTitle}>Geçmiş</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard}>
                <LinearGradient
                  colors={[colors.warning, colors.warning + 'CC']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="person-outline" size={28} color={colors.white} />
                  <Text style={styles.actionTitle}>Profil</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard}>
                <LinearGradient
                  colors={[colors.secondary, colors.secondary + 'CC']}
                  style={styles.actionGradient}
                >
                  <Ionicons name="settings-outline" size={28} color={colors.white} />
                  <Text style={styles.actionTitle}>Ayarlar</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Recent Activity */}
          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>Son Aktiviteler</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>Yoga Dersi Tamamlandı</Text>
                  <Text style={styles.activityTime}>2 gün önce</Text>
                </View>
              </View>
              
              <View style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="calendar" size={20} color={colors.primary} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>Pilates Dersi Rezerve Edildi</Text>
                  <Text style={styles.activityTime}>1 hafta önce</Text>
                </View>
              </View>

              <View style={styles.activityItem}>
                <View style={styles.activityIcon}>
                  <Ionicons name="person-add" size={20} color={colors.warning} />
                </View>
                <View style={styles.activityContent}>
                  <Text style={styles.activityTitle}>Hesap Oluşturuldu</Text>
                  <Text style={styles.activityTime}>2 hafta önce</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.textSecondary,
  },
  // Content Styles
  content: {
    flex: 1,
    backgroundColor: colors.background,
  },
  innerContent: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  // Welcome Section
  welcomeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    ...colors.shadow,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Stats Section
  statsSection: {
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 60) / 2,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    ...colors.shadow,
  },
  statIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  // Actions Section
  actionsSection: {
    marginBottom: 24,
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    width: (width - 60) / 2,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    ...colors.shadow,
  },
  actionGradient: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
  },
  actionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
    marginTop: 8,
    textAlign: 'center',
  },
  // Activity Section
  activitySection: {
    marginBottom: 24,
  },
  activityCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    ...colors.shadow,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.background,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  // Simple header styles
  headerStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  headerStatItem: {
    alignItems: 'center',
  },
  headerStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  headerStatLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
});
