import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UniqueHeader from '../../components/UniqueHeader';
import { colors } from '../../constants/colors';
import { userLessonService } from '../../services/userLessonService';

export default function AdminUserPastLessonsScreen({ route, navigation }) {
  const { userId, userName } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [allLessons, setAllLessons] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(30);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'upcoming', 'completed'

  const fetchLessons = useCallback(async (force = false) => {
    if (!userId) return;
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const result = await userLessonService.getUserLessons(userId, { forceRefresh: force });
      if (result.success) {
        // Combine all lessons
        const upcoming = result.lessons?.upcoming || [];
        const completed = result.lessons?.completed || [];
        const cancelled = result.lessons?.cancelled || [];
        
        // Merge and sort by date (newest first for completed, soonest first for upcoming)
        const all = [...upcoming, ...completed, ...cancelled];
        
        // Sort: upcoming lessons first (by date ascending), then completed (by date descending)
        all.sort((a, b) => {
          // First sort by status - upcoming first
          if (a.userStatus === 'upcoming' && b.userStatus !== 'upcoming') return -1;
          if (a.userStatus !== 'upcoming' && b.userStatus === 'upcoming') return 1;
          
          // Within same status, sort by date
          const dateA = new Date(a.scheduledDate);
          const dateB = new Date(b.scheduledDate);
          
          if (a.userStatus === 'upcoming') {
            // Upcoming: earliest first
            return dateA - dateB;
          } else {
            // Completed/cancelled: most recent first
            return dateB - dateA;
          }
        });
        
        setAllLessons(all);
      } else {
        setError(result.message || 'Dersler yüklenemedi.');
        setAllLessons([]);
      }
    } catch (e) {
      setError('Dersler yüklenemedi.');
      setAllLessons([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [userId, refreshing]);

  useEffect(() => {
    fetchLessons(true);
  }, [fetchLessons]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLessons(true);
  };

  // Filter lessons based on active tab
  const filteredLessons = useMemo(() => {
    if (activeTab === 'all') return allLessons;
    if (activeTab === 'upcoming') return allLessons.filter(l => l.userStatus === 'upcoming');
    if (activeTab === 'completed') return allLessons.filter(l => l.userStatus === 'completed' || l.userStatus === 'cancelled');
    return allLessons;
  }, [allLessons, activeTab]);

  // Count for tabs
  const upcomingCount = useMemo(() => allLessons.filter(l => l.userStatus === 'upcoming').length, [allLessons]);
  const completedCount = useMemo(() => allLessons.filter(l => l.userStatus === 'completed' || l.userStatus === 'cancelled').length, [allLessons]);

  const renderItem = ({ item }) => {
    const bg = (item.typeInfo?.color || '#6B7280') + '20';
    const iconColor = item.typeInfo?.color || '#6B7280';
    const isUpcoming = item.userStatus === 'upcoming';
    const isCancelled = item.userStatus === 'cancelled';
    
    return (
      <View style={[styles.row, isCancelled && styles.cancelledRow]}>
        <View style={[styles.icon, { backgroundColor: bg }]}> 
          <Ionicons name={item.typeInfo?.icon || 'calendar-outline'} size={18} color={iconColor} />
        </View>
        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, isCancelled && styles.cancelledText]} numberOfLines={1}>
              {item.title || 'Ders'}
            </Text>
            {isUpcoming && (
              <View style={styles.upcomingBadge}>
                <Text style={styles.upcomingBadgeText}>Yaklaşan</Text>
              </View>
            )}
            {isCancelled && (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>İptal</Text>
              </View>
            )}
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {(item.formattedDate || item.scheduledDate) + (item.formattedTime ? ' • ' + item.formattedTime : '')}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={styles.instructor} numberOfLines={1}>
            {item.instructor || item.trainerName || 'Eğitmen Bilgisi Yok'}
          </Text>
        </View>
      </View>
    );
  };

  const keyExtractor = (item) => item.id;

  const visibleData = useMemo(() => filteredLessons.slice(0, limit), [filteredLessons, limit]);

  const onEndReached = () => {
    if (limit < filteredLessons.length) {
      setLimit((prev) => Math.min(prev + 30, filteredLessons.length));
    }
  };

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'all' && styles.activeTab]}
        onPress={() => { setActiveTab('all'); setLimit(30); }}
      >
        <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
          Tümü ({allLessons.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'upcoming' && styles.activeTab]}
        onPress={() => { setActiveTab('upcoming'); setLimit(30); }}
      >
        <Text style={[styles.tabText, activeTab === 'upcoming' && styles.activeTabText]}>
          Yaklaşan ({upcomingCount})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
        onPress={() => { setActiveTab('completed'); setLimit(30); }}
      >
        <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
          Geçmiş ({completedCount})
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Kullanıcı Dersleri"
        subtitle={userName || ''}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
        backgroundColor={[colors.primary, colors.primaryLight, colors.secondary]}
      />

      {renderTabs()}

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loaderText}>Dersler yükleniyor...</Text>
        </View>
      ) : error ? (
        <View style={styles.loader}>
          <Ionicons name="alert-circle" size={42} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleData}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          onEndReachedThreshold={0.4}
          onEndReached={onEndReached}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming' ? 'Yaklaşan ders bulunamadı.' : 
               activeTab === 'completed' ? 'Geçmiş ders bulunamadı.' : 
               'Ders bulunamadı.'}
            </Text>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 4,
    backgroundColor: colors.background,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  activeTabText: {
    color: colors.white,
    fontWeight: '600',
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 15,
  },
  errorText: {
    marginTop: 12,
    color: colors.error,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 40,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(15, 24, 16, 0.08)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  cancelledRow: {
    opacity: 0.6,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  info: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginRight: 6,
  },
  cancelledText: {
    textDecorationLine: 'line-through',
    color: colors.textSecondary,
  },
  upcomingBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  upcomingBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.success,
  },
  cancelledBadge: {
    backgroundColor: colors.error + '20',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  cancelledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.error,
  },
  meta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  right: {
    marginLeft: 8,
    maxWidth: 140,
  },
  instructor: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'right',
  },
});
