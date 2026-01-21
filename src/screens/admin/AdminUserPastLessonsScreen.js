import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UniqueHeader from '../../components/UniqueHeader';
import { colors } from '../../constants/colors';
import { userLessonService } from '../../services/userLessonService';

export default function AdminUserPastLessonsScreen({ route, navigation }) {
  const { userId, userName } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(30);

  const fetchLessons = useCallback(async (force = false) => {
    if (!userId) return;
    try {
      if (!refreshing) setLoading(true);
      setError(null);
      const result = await userLessonService.getUserLessons(userId, { forceRefresh: force });
      if (result.success) {
        const completed = result.lessons?.completed || [];
        setLessons(completed);
      } else {
        setError(result.message || 'Geçmiş dersler yüklenemedi.');
        setLessons([]);
      }
    } catch (e) {
      setError('Geçmiş dersler yüklenemedi.');
      setLessons([]);
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

  const renderItem = ({ item }) => {
    const bg = (item.typeInfo?.color || '#6B7280') + '20';
    const iconColor = item.typeInfo?.color || '#6B7280';
    return (
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: bg }]}> 
          <Ionicons name={item.typeInfo?.icon || 'calendar-outline'} size={18} color={iconColor} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>{item.title || 'Ders'}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {(item.formattedDate || item.scheduledDate) + (item.formattedTime ? ` • ${item.formattedTime}` : '')}
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

  const visibleData = useMemo(() => lessons.slice(0, limit), [lessons, limit]);

  const onEndReached = () => {
    if (limit < lessons.length) {
      setLimit((prev) => Math.min(prev + 30, lessons.length));
    }
  };

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Geçmiş Dersler"
        subtitle={userName || ''}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        showNotification={false}
        backgroundColor={[colors.primary, colors.primaryLight, colors.secondary]}
      />

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
            <Text style={styles.emptyText}>Geçmiş ders bulunamadı.</Text>
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
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
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
