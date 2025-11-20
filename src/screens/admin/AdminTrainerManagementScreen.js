import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { trainerService } from '../../services/trainerService';
import UniqueHeader from '../../components/UniqueHeader';

export default function AdminTrainerManagementScreen({ navigation }) {
  const { user, userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trainers, setTrainers] = useState([]);
  const [filteredTrainers, setFilteredTrainers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadTrainers();
  }, []);

  useEffect(() => {
    filterTrainers();
  }, [trainers, searchTerm, filterStatus]);

  const loadTrainers = async () => {
    try {
      setLoading(true);
      const result = await trainerService.getAllTrainers();
      
      if (result.success) {
        setTrainers(result.trainers);
      } else {
        Alert.alert('Hata', result.message || 'Eğitmenler yüklenemedi');
      }
    } catch (error) {
      console.error('Error loading trainers:', error);
      Alert.alert('Hata', 'Eğitmenler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const filterTrainers = () => {
    let filtered = trainers.filter(trainer => {
      const matchesSearch = 
        trainer.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        trainer.specializations?.some(spec => 
          spec.toLowerCase().includes(searchTerm.toLowerCase())
        );

      let matchesStatus = true;
      if (filterStatus === 'active') {
        matchesStatus = trainer.status === 'active' || trainer.isActive;
      } else if (filterStatus === 'inactive') {
        matchesStatus = trainer.status === 'inactive' || !trainer.isActive;
      }

      return matchesSearch && matchesStatus;
    });

    setFilteredTrainers(filtered);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTrainers();
    setRefreshing(false);
  };

  const handleToggleTrainerStatus = async (trainerId, trainerName, currentStatus) => {
    const newStatus = currentStatus ? 'inactive' : 'active';
    const actionText = currentStatus ? 'devre dışı bırakmak' : 'aktifleştirmek';
    
    Alert.alert(
      'Eğitmen Durumu',
      `${trainerName} adlı eğitmeni ${actionText} istediğinizden emin misiniz?`,
      [
        { text: 'Hayır', style: 'cancel' },
        {
          text: 'Evet',
          onPress: async () => {
            try {
              const result = await trainerService.updateTrainerStatus(trainerId, newStatus, user.uid);
              
              if (result.success) {
                await loadTrainers();
                Alert.alert('Başarılı', `Eğitmen durumu ${newStatus === 'active' ? 'aktif' : 'pasif'} olarak güncellendi`);
              } else {
                Alert.alert('Hata', result.message || 'Eğitmen durumu güncellenemedi');
              }
            } catch (error) {
              console.error('Error updating trainer status:', error);
              Alert.alert('Hata', 'Eğitmen durumu güncellenirken hata oluştu');
            }
          }
        }
      ]
    );
  };

  const showTrainerDetails = (trainer) => {
    setSelectedTrainer(trainer);
    setShowDetailsModal(true);
  };

  const closeTrainerDetails = () => {
    setShowDetailsModal(false);
    setSelectedTrainer(null);
  };

  const getStatusColor = (trainer) => {
    if (trainer.status === 'active' || trainer.isActive) return colors.success;
    return colors.error;
  };

  const getStatusText = (trainer) => {
    if (trainer.status === 'active' || trainer.isActive) return 'Aktif';
    return 'Pasif';
  };

  const TrainerCard = ({ trainer }) => (
    <TouchableOpacity 
      style={styles.trainerCard}
      onPress={() => showTrainerDetails(trainer)}
    >
      <View style={styles.trainerHeader}>
        <View style={styles.trainerInfo}>
          <View style={styles.trainerAvatar}>
            <Text style={styles.avatarText}>
              {trainer.displayName ? trainer.displayName.split(' ').map(n => n[0]).join('') : 'EĞ'}
            </Text>
          </View>
          <View style={styles.trainerDetails}>
            <Text style={styles.trainerName}>{trainer.displayName}</Text>
            <Text style={styles.trainerEmail}>{trainer.email}</Text>
            <View style={styles.specializationsContainer}>
              {trainer.specializations?.slice(0, 2).map((spec, index) => (
                <View key={index} style={styles.specializationTag}>
                  <Text style={styles.specializationText}>{spec}</Text>
                </View>
              ))}
              {trainer.specializations?.length > 2 && (
                <View style={styles.specializationTag}>
                  <Text style={styles.specializationText}>+{trainer.specializations.length - 2}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(trainer) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(trainer) }]}>
            {getStatusText(trainer)}
          </Text>
        </View>
      </View>

      <View style={styles.trainerStats}>
        <View style={styles.statItem}>
          <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.statText}>
            {trainer.totalLessons || 0} ders
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="star-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.statText}>
            {trainer.rating || 'N/A'} puan
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
          <Text style={styles.statText}>
            {trainer.experience || 'Belirtilmemiş'}
          </Text>
        </View>
      </View>

      <View style={styles.trainerActions}>
        <TouchableOpacity
          style={[
            styles.actionButton, 
            trainer.status === 'active' || trainer.isActive ? styles.deactivateButton : styles.activateButton
          ]}
          onPress={(e) => {
            e.stopPropagation();
            handleToggleTrainerStatus(
              trainer.id, 
              trainer.displayName, 
              trainer.status === 'active' || trainer.isActive
            );
          }}
        >
          <Ionicons 
            name={trainer.status === 'active' || trainer.isActive ? "pause-circle-outline" : "play-circle-outline"} 
            size={20} 
            color={colors.white} 
          />
          <Text style={styles.actionButtonText}>
            {trainer.status === 'active' || trainer.isActive ? 'Devre Dışı' : 'Aktifleştir'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const FilterButton = ({ status, label, count }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        filterStatus === status && styles.activeFilterButton
      ]}
      onPress={() => setFilterStatus(status)}
    >
      <Text style={[
        styles.filterButtonText,
        filterStatus === status && styles.activeFilterButtonText
      ]}>
        {label} {count !== undefined && `(${count})`}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Eğitmen Yönetimi"
          subtitle="Tüm eğitmenler"
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Eğitmenler yükleniyor...</Text>
        </View>
      </View>
    );
  }

  const activeCount = trainers.filter(t => t.status === 'active' || t.isActive).length;
  const inactiveCount = trainers.filter(t => t.status === 'inactive' || !t.isActive).length;

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Eğitmen Yönetimi"
        subtitle={`${trainers.length} eğitmen`}
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        onRightPress={() => navigation.navigate('Notifications')}
        showStats={true}
        stats={[
          { value: activeCount.toString(), label: 'Aktif', icon: 'checkmark-circle-outline', color: 'rgba(255, 255, 255, 0.3)' },
          { value: inactiveCount.toString(), label: 'Pasif', icon: 'pause-circle-outline', color: 'rgba(255, 255, 255, 0.3)' },
        ]}
      />

      <View style={styles.content}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Eğitmen ara..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor={colors.textSecondary}
          />
          {searchTerm.length > 0 && (
            <TouchableOpacity onPress={() => setSearchTerm('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Buttons */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.filterContainer}
        >
          <FilterButton status="all" label="Tümü" count={trainers.length} />
          <FilterButton status="active" label="Aktif" count={activeCount} />
          <FilterButton status="inactive" label="Pasif" count={inactiveCount} />
        </ScrollView>

        {/* Trainers List */}
        <ScrollView
          style={styles.trainersList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {filteredTrainers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="school-outline" size={64} color={colors.textSecondary} />
              <Text style={styles.emptyTitle}>Eğitmen bulunamadı</Text>
              <Text style={styles.emptyText}>
                {searchTerm ? 'Arama kriterlerinize uygun eğitmen bulunamadı.' : 'Henüz eğitmen bulunmuyor.'}
              </Text>
            </View>
          ) : (
            filteredTrainers.map((trainer) => (
              <TrainerCard key={trainer.id} trainer={trainer} />
            ))
          )}
        </ScrollView>
      </View>

      {/* Trainer Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeTrainerDetails}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedTrainer && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{selectedTrainer.displayName}</Text>
                  <TouchableOpacity onPress={closeTrainerDetails}>
                    <Ionicons name="close" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody}>
                  <View style={styles.detailRow}>
                    <Ionicons name="mail" size={20} color={colors.primary} />
                    <Text style={styles.detailLabel}>E-posta:</Text>
                    <Text style={styles.detailValue}>{selectedTrainer.email}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="flag" size={20} color={colors.primary} />
                    <Text style={styles.detailLabel}>Durum:</Text>
                    <Text style={[styles.detailValue, { color: getStatusColor(selectedTrainer) }]}>
                      {getStatusText(selectedTrainer)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="time" size={20} color={colors.primary} />
                    <Text style={styles.detailLabel}>Deneyim:</Text>
                    <Text style={styles.detailValue}>{selectedTrainer.experience || 'Belirtilmemiş'}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Ionicons name="star" size={20} color={colors.primary} />
                    <Text style={styles.detailLabel}>Puan:</Text>
                    <Text style={styles.detailValue}>{selectedTrainer.rating || 'Henüz değerlendirilmedi'}</Text>
                  </View>

                  {selectedTrainer.specializations && selectedTrainer.specializations.length > 0 && (
                    <View style={styles.specializationsSection}>
                      <Text style={styles.sectionTitle}>Uzmanlık Alanları:</Text>
                      <View style={styles.specializationsGrid}>
                        {selectedTrainer.specializations.map((spec, index) => (
                          <View key={index} style={styles.specializationTag}>
                            <Text style={styles.specializationText}>{spec}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {selectedTrainer.bio && (
                    <View style={styles.bioSection}>
                      <Text style={styles.sectionTitle}>Hakkında:</Text>
                      <Text style={styles.bioText}>{selectedTrainer.bio}</Text>
                    </View>
                  )}

                  {selectedTrainer.certifications && selectedTrainer.certifications.length > 0 && (
                    <View style={styles.certificationsSection}>
                      <Text style={styles.sectionTitle}>Sertifikalar:</Text>
                      {selectedTrainer.certifications.map((cert, index) => (
                        <View key={index} style={styles.certificationItem}>
                          <Ionicons name="medal-outline" size={16} color={colors.primary} />
                          <Text style={styles.certificationText}>{cert}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
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

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 16,
    marginBottom: 16,
    ...colors.shadow,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: colors.textPrimary,
  },

  // Filters
  filterContainer: {
    marginBottom: 16,
  },
  filterButton: {
    backgroundColor: colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeFilterButton: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeFilterButtonText: {
    color: colors.white,
  },

  // Trainers List
  trainersList: {
    flex: 1,
  },
  trainerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...colors.shadow,
  },
  trainerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  trainerInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  trainerAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.primary,
  },
  trainerDetails: {
    flex: 1,
  },
  trainerName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  trainerEmail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  specializationsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  specializationTag: {
    backgroundColor: colors.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  specializationText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  trainerStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  trainerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  activateButton: {
    backgroundColor: colors.success,
  },
  deactivateButton: {
    backgroundColor: colors.warning,
  },
  actionButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  modalBody: {
    padding: 20,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginLeft: 12,
    width: 80,
  },
  detailValue: {
    fontSize: 16,
    color: colors.textSecondary,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
    marginTop: 16,
  },
  specializationsSection: {
    marginTop: 16,
  },
  specializationsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  bioSection: {
    marginTop: 16,
  },
  bioText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  certificationsSection: {
    marginTop: 16,
  },
  certificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  certificationText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
});