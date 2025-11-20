import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { adminService } from '../../services/adminService';
import UniqueHeader from '../../components/UniqueHeader';
import { useI18n } from '../../context/I18nContext';

const FILTER_OPTIONS = [
  { id: 'all', label: 'Tümü', icon: 'people-outline' },
  { id: 'approved', label: 'Aktif', icon: 'checkmark-circle-outline' },
  { id: 'pending', label: 'Beklemede', icon: 'time-outline' },
  { id: 'rejected', label: 'Reddedilen', icon: 'close-circle-outline' },
];

const getInitials = (user) => {
  const name = user?.displayName || `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
};

const buildUserName = (user) => {
  if (user?.displayName) return user.displayName;
  const name = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
  return name || user?.email || 'İsimsiz Üye';
};

const UserListItem = ({ user, onPress }) => {
  const avatarSource = user?.photoURL || user?.avatar;
  const isPending = user?.status === 'pending';
  const isRejected = user?.status === 'rejected';

  // Determine styling based on status
  const itemStyle = [
    styles.userItem,
    isPending && styles.userItemPending,
    isRejected && styles.userItemRejected
  ];

  const borderLeftStyle = isPending
    ? { borderLeftWidth: 4, borderLeftColor: '#FBBF24' }
    : isRejected
    ? { borderLeftWidth: 4, borderLeftColor: '#F87171' }
    : {};

  return (
    <TouchableOpacity style={styles.userItemWrapper} onPress={onPress} activeOpacity={0.85}>
      <View style={[...itemStyle, borderLeftStyle]}>
        <View style={styles.userAvatar}>
          {avatarSource ? (
            <Image source={{ uri: avatarSource }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{getInitials(user)}</Text>
            </View>
          )}
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName}>{buildUserName(user)}</Text>
            {isPending && (
              <View style={styles.statusBadge}>
                <Ionicons name="time-outline" size={12} color="#D97706" />
                <Text style={styles.statusBadgeText}>Beklemede</Text>
              </View>
            )}
            {isRejected && (
              <View style={[styles.statusBadge, styles.statusBadgeRejected]}>
                <Ionicons name="close-circle-outline" size={12} color="#DC2626" />
                <Text style={[styles.statusBadgeText, styles.statusBadgeTextRejected]}>Reddedildi</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.arrowContainer}>
          <View style={styles.arrowButton}>
            <Ionicons name="chevron-forward" size={18} color={colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default function AdminUserManagementScreen({ navigation }) {
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const result = await adminService.getAllUsers();
      if (result.success) {
        setUsers(result.users || []);
      }
    } catch (error) {
      console.error('Error loading admin users:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUsers();
    setRefreshing(false);
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      // Exclude deleted users - check multiple possible fields
      if (user.deleted === true ||
          user.isDeleted === true ||
          user.membershipStatus === 'deleted') {
        return false;
      }

      const matchesStatus = selectedFilter === 'all' ? true : user.status === selectedFilter;

      if (!matchesStatus) return false;

      if (!term) return true;

      const name = buildUserName(user).toLowerCase();
      const email = (user.email || '').toLowerCase();
      const phone = (user.phoneNumber || user.phone || '').toLowerCase();

      return name.includes(term) || email.includes(term) || phone.includes(term);
    });
  }, [users, searchTerm, selectedFilter]);

  const handleUserPress = (user) => {
    navigation.navigate('AdminUserDetail', {
      userId: user.id,
      initialUser: user,
    });
  };

  const renderUserItem = ({ item }) => (
    <UserListItem user={item} onPress={() => handleUserPress(item)} />
  );

  const searchPlaceholder = 'Üye ara...';

  // Count only non-deleted users
  const activeUserCount = users.filter(user =>
    !user.deleted &&
    !user.isDeleted &&
    user.membershipStatus !== 'deleted'
  ).length;

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Üyeler"
        subtitle={`${activeUserCount} kayıtlı üye`}
        showNotification={false}
      />

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={searchPlaceholder}
            placeholderTextColor={colors.textSecondary}
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterRow}>
          {FILTER_OPTIONS.map((filter) => {
            const isActive = selectedFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setSelectedFilter(filter.id)}
              >
                <Ionicons
                  name={filter.icon}
                  size={16}
                  color={isActive ? colors.white : colors.textSecondary}
                  style={styles.filterIcon}
                />
                <Text style={[styles.filterLabel, isActive && styles.filterLabelActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Üyeler yükleniyor...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredUsers}
            keyExtractor={(item) => item.id}
            renderItem={renderUserItem}
            contentContainerStyle={styles.listContent}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={56} color={colors.textSecondary} />
                <Text style={styles.emptyTitle}>Üye bulunamadı</Text>
                <Text style={styles.emptySubtitle}>
                  {searchTerm
                    ? 'Arama kriterlerine uygun üye bulunamadı.'
                    : 'Henüz kayıtlı üye bulunmuyor.'}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.15)',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 16,
    gap: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.1)',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  filterIcon: {
    marginRight: 6,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  filterLabelActive: {
    color: colors.white,
  },
  listContent: {
    paddingBottom: 40,
  },
  userItemWrapper: {
    marginBottom: 14,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.12)',
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.lightGray,
    borderWidth: 1,
    borderColor: 'rgba(107, 127, 106, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  userInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'capitalize',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  statusBadgeRejected: {
    backgroundColor: '#FEE2E2',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#D97706',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadgeTextRejected: {
    color: '#DC2626',
  },
  userItemPending: {
    backgroundColor: '#FFFBEB',
  },
  userItemRejected: {
    backgroundColor: '#FEF2F2',
    opacity: 0.7,
  },
  arrowContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    marginTop: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
