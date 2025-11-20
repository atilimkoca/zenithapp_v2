import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  TextInput,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import UniqueHeader from '../../components/UniqueHeader';
import BottomSheetModal from '../../components/BottomSheetModal';
import NotificationScreen from '../NotificationScreen';
import packageService from '../../services/packageService';

const { width } = Dimensions.get('window');
const colorPalette = ['#6B7F6A', '#8FA08E', '#10B981', '#F59E0B', '#3B82F6', '#7C8F7B'];

const getCardColors = (pkg, index) => {
  const base = typeof pkg?.color === 'string' && pkg.color.startsWith('#')
    ? pkg.color
    : typeof pkg?.themeColor === 'string' && pkg.themeColor.startsWith('#')
    ? pkg.themeColor
    : colorPalette[index % colorPalette.length];
  return [base, `${base}CC`];
};

const formatCurrency = (value) =>
  `₺${Number(value || 0).toLocaleString('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

const getSalesCount = (pkg) =>
  Number(pkg?.totalSales ?? pkg?.sales ?? pkg?.purchaseCount ?? pkg?.sold ?? 0);

const defaultFormValues = {
  name: '',
  classes: '',
  price: '',
  description: '',
  packageType: 'group',
};

export default function AdminPackagesScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [formValues, setFormValues] = useState(defaultFormValues);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async (silent = false) => {
    try {
      if (!silent) {
        setLoading(true);
      }
      const result = await packageService.getAllPackages();
      if (result.success) {
        setPackages(Array.isArray(result.data) ? result.data : []);
      } else {
        Alert.alert('Hata', result.error || 'Paketler alınamadı.');
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      Alert.alert('Hata', 'Paketler yüklenirken bir sorun oluştu.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPackages(true);
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setEditingPackage(null);
    setFormValues(defaultFormValues);
    setFormError('');
    setModalVisible(true);
  };

  const openEditModal = (pkg) => {
    setEditingPackage(pkg);
    setFormValues({
      name: pkg?.name || '',
      classes: String(pkg?.classes ?? pkg?.sessions ?? ''),
      price: pkg?.price != null ? String(pkg.price) : '',
      description: pkg?.description || '',
      packageType: pkg?.packageType || 'group',
    });
    setFormError('');
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) {
      return;
    }

    setModalVisible(false);
    setEditingPackage(null);
    setFormError('');
    setFormValues(defaultFormValues);
  };

  const handleSavePackage = async () => {
    if (saving) {
      return;
    }

    const name = formValues.name.trim();
    const classesValue = parseInt(formValues.classes, 10);
    const priceValue = parseFloat(String(formValues.price).replace(',', '.'));

    if (!name) {
      setFormError('Lütfen paket adını girin.');
      return;
    }
    if (!Number.isFinite(classesValue) || classesValue <= 0) {
      setFormError('Lütfen geçerli bir ders hakkı girin.');
      return;
    }
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setFormError('Lütfen geçerli bir fiyat girin.');
      return;
    }

    const payload = {
      name,
      description: formValues.description.trim(),
      classes: classesValue,
      sessions: classesValue,
      price: priceValue,
      duration: editingPackage?.duration ?? 1,
      features: Array.isArray(editingPackage?.features) ? editingPackage.features : [],
      isActive: editingPackage?.isActive ?? true,
      packageType: formValues.packageType || 'group',
    };

    try {
      setSaving(true);
      const result = editingPackage
        ? await packageService.updatePackage(editingPackage.id, payload)
        : await packageService.createPackage(payload);

      if (result.success) {
        Alert.alert('Başarılı', editingPackage ? 'Paket güncellendi.' : 'Paket oluşturuldu.');
        setModalVisible(false);
        setEditingPackage(null);
        setFormValues(defaultFormValues);
        await loadPackages(true);
      } else {
        Alert.alert('Hata', result.error || 'Paket kaydedilemedi.');
      }
    } catch (error) {
      console.error('Error saving package:', error);
      Alert.alert('Hata', 'Paket kaydedilirken bir sorun oluştu.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (pkg) => {
    setUpdatingId(pkg.id);
    try {
      const result = await packageService.updatePackage(pkg.id, {
        ...pkg,
        isActive: !pkg.isActive,
      });

      if (result.success) {
        await loadPackages(true);
      } else {
        Alert.alert('Hata', result.error || 'Paket güncellenemedi.');
      }
    } catch (error) {
      console.error('Error toggling package status:', error);
      Alert.alert('Hata', 'Paket durumu değiştirilirken bir sorun oluştu.');
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDeletePackage = (pkg) => {
    Alert.alert(
      'Paketi Sil',
      `'${pkg.name}' paketini silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => handleDeletePackage(pkg),
        },
      ]
    );
  };

  const handleDeletePackage = async (pkg) => {
    setDeletingId(pkg.id);
    try {
      const result = await packageService.deletePackage(pkg.id);
      if (result.success) {
        Alert.alert('Başarılı', 'Paket silindi.');
        await loadPackages(true);
      } else {
        Alert.alert('Hata', result.error || 'Paket silinemedi.');
      }
    } catch (error) {
      console.error('Error deleting package:', error);
      Alert.alert('Hata', 'Paket silinirken bir sorun oluştu.');
    } finally {
      setDeletingId(null);
    }
  };

  const stats = useMemo(() => {
    const activeCount = packages.filter((pkg) => pkg.isActive !== false).length;
    const totalSales = packages.reduce((sum, pkg) => sum + getSalesCount(pkg), 0);
    const totalRevenue = packages.reduce(
      (sum, pkg) => sum + getSalesCount(pkg) * Number(pkg.price || 0),
      0
    );
    const averagePrice =
      packages.length > 0
        ? packages.reduce((sum, pkg) => sum + Number(pkg.price || 0), 0) / packages.length
        : 0;

    return {
      activeCount,
      totalSales,
      totalRevenue,
      averagePrice,
    };
  }, [packages]);

  const PackageCard = ({ pkg, index }) => {
    const [primaryColor, secondaryColor] = getCardColors(pkg, index);
    const classCount = pkg?.classes ?? pkg?.sessions ?? 0;
    const classesLabel = classCount >= 999 ? 'Sınırsız ders' : `${classCount} ders`;
    const durationLabel = `${pkg?.duration ?? 1} ay`;
    const salesCount = getSalesCount(pkg);
    const packageTypeLabel = pkg?.packageType === 'individual' ? 'Bire Bir Ders' : 'Grup Dersi';

    return (
      <View style={styles.packageCard}>
        <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.packageGradient}>
          <View style={styles.packageHeader}>
            <View style={styles.packageInfo}>
              <Text style={styles.packageName}>{pkg?.name || 'Paketsiz'}</Text>
              <Text style={styles.packagePrice}>{formatCurrency(pkg?.price)}</Text>
            </View>
            <TouchableOpacity
              style={[
                styles.statusToggle,
                pkg?.isActive !== false ? styles.statusToggleActive : styles.statusToggleInactive,
              ]}
              onPress={() => handleToggleStatus(pkg)}
              disabled={updatingId === pkg.id || deletingId === pkg.id}
            >
              {updatingId === pkg.id ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons
                    name={pkg?.isActive !== false ? 'pause-outline' : 'play-outline'}
                    size={16}
                    color={colors.white}
                  />
                  <Text style={styles.statusToggleText}>
                    {pkg?.isActive !== false ? 'Pasifleştir' : 'Aktif Et'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {pkg?.description ? (
            <Text style={styles.packageDescription}>{pkg.description}</Text>
          ) : null}

          <View style={styles.packageDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="layers-outline" size={16} color={colors.white} />
              <Text style={styles.detailText}>{packageTypeLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="barbell-outline" size={16} color={colors.white} />
              <Text style={styles.detailText}>{classesLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.white} />
              <Text style={styles.detailText}>{durationLabel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={16} color={colors.white} />
              <Text style={styles.detailText}>{salesCount} satış</Text>
            </View>
          </View>

          <View style={styles.packageActions}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => openEditModal(pkg)}
              disabled={saving || updatingId === pkg.id || deletingId === pkg.id}
            >
              <Ionicons name="create-outline" size={16} color={colors.white} />
              <Text style={styles.actionText}>Düzenle</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonDanger]}
              onPress={() => confirmDeletePackage(pkg)}
              disabled={deletingId === pkg.id || updatingId === pkg.id}
            >
              {deletingId === pkg.id ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={16} color={colors.white} />
                  <Text style={styles.actionText}>Sil</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Paket Yönetimi"
          subtitle="Üyelik paketleri ve fiyatları"
          onRightPress={() => navigation.navigate('Notifications')}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Paketler yükleniyor...</Text>
        </View>
      </View>
    );
  }

  const totalRevenueFormatted = formatCurrency(stats.totalRevenue);
  const averagePriceFormatted = formatCurrency(stats.averagePrice);

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Paket Yönetimi"
        subtitle="Üyelik paketleri ve fiyatları"
        onRightPress={() => setNotificationModalVisible(true)}
        showStats
        stats={[
          {
            value: stats.activeCount.toString(),
            label: 'Aktif Paket',
            icon: 'checkmark-circle-outline',
            color: 'rgba(255, 255, 255, 0.28)',
          },
          {
            value: averagePriceFormatted,
            label: 'Ortalama Paket Ücreti',
            icon: 'pricetag-outline',
            color: 'rgba(255, 255, 255, 0.22)',
          },
        ]}
      />

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Tüm Paketler</Text>
            <TouchableOpacity onPress={openCreateModal} style={styles.addButton}>
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.addButtonText}>Yeni Paket</Text>
            </TouchableOpacity>
          </View>

          {packages.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cube-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Henüz paket bulunmuyor</Text>
              <Text style={styles.emptySubtitle}>
                Üyelere sunmak istediğiniz paketleri buradan oluşturabilirsiniz.
              </Text>
              <TouchableOpacity style={styles.createButtonSecondary} onPress={openCreateModal}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <Text style={styles.createButtonSecondaryText}>İlk Paketi Oluştur</Text>
              </TouchableOpacity>
            </View>
          ) : (
            packages.map((pkg, index) => <PackageCard key={pkg.id} pkg={pkg} index={index} />)
          )}
        </View>

        <View style={styles.noticeSection}>
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={24} color={colors.info} />
            <View style={styles.noticeText}>
              <Text style={styles.noticeTitle}>Paket Yönetimi</Text>
              <Text style={styles.noticeDescription}>
                Paketlerinizi aktif/pasif hale getirebilir, üyelerinize yeni paketler
                sunabilirsiniz.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <PackageModal
        visible={modalVisible}
        onClose={closeModal}
        formValues={formValues}
        setFormValues={setFormValues}
        onSubmit={handleSavePackage}
        loading={saving}
        error={formError}
        editing={Boolean(editingPackage)}
      />

      <NotificationScreen
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
        navigation={navigation}
      />
    </View>
  );
}

const PackageModal = ({
  visible,
  onClose,
  formValues,
  setFormValues,
  onSubmit,
  loading,
  error,
  editing,
}) => {
  const handleChange = (field) => (value) => {
    setFormValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePackageTypeChange = (type) => {
    setFormValues((prev) => ({
      ...prev,
      packageType: type,
    }));
  };

  const classesCount = Number(formValues.classes);
  const hasClasses = Number.isFinite(classesCount) && classesCount > 0;
  const classesPreview = hasClasses
    ? classesCount >= 999
      ? 'Sınırsız ders'
      : `${classesCount} ders`
    : 'Ders hakkı belirleyin';
  const priceNumber = parseFloat(String(formValues.price || '').replace(',', '.'));
  const hasPrice = Number.isFinite(priceNumber) && priceNumber >= 0;
  const pricePreview = hasPrice
    ? `₺${priceNumber.toLocaleString('tr-TR', {
        minimumFractionDigits: priceNumber % 1 === 0 ? 0 : 2,
        maximumFractionDigits: priceNumber % 1 === 0 ? 0 : 2,
      })}`
    : 'Ücret girin';
  const packageTypeLabel = formValues.packageType === 'individual' ? 'Bire Bir Ders' : 'Grup Dersi';
  const summarySubtitle = editing
    ? 'Paketinizi güncelleyip tekrar parlatın.'
    : 'Üyeleriniz için çekici bir paket oluşturun.';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={editing ? 'Paketi Güncelle' : 'Yeni Paket Oluştur'}
      subtitle="Üyelerinize sunulacak paket detaylarını düzenleyin."
      accentIcon="pricetag-outline"
      footer={
        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.modalActionButton, styles.modalActionGhost, styles.modalActionSpacing]}
            onPress={onClose}
            disabled={loading}
          >
            <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
            <Text style={styles.modalActionGhostText}>İptal</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modalActionButton,
              styles.modalActionPrimary,
              loading && styles.modalButtonDisabled,
            ]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color={colors.white} />
                <Text style={styles.modalActionPrimaryText}>
                  {editing ? 'Güncelle' : 'Kaydet'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.modalBody}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.modalIntro}>
          <View style={styles.modalIntroIcon}>
            <Ionicons name="sparkles-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.modalIntroText}>
            <Text style={styles.modalIntroTitle}>
              {editing ? 'Paketi yeniden şekillendirin' : 'Yeni paket oluşturma'}
            </Text>
            <Text style={styles.modalIntroSubtitle}>{summarySubtitle}</Text>

            <View style={styles.modalIntroPills}>
              <View style={styles.modalIntroPill}>
                <Ionicons name="layers-outline" size={16} color={colors.primary} />
                <Text style={styles.modalIntroPillText}>{packageTypeLabel}</Text>
              </View>
              <View style={styles.modalIntroPill}>
                <Ionicons name="barbell-outline" size={16} color={colors.primary} />
                <Text style={styles.modalIntroPillText}>{classesPreview}</Text>
              </View>
              <View style={styles.modalIntroPill}>
                <Ionicons name="pricetag-outline" size={16} color={colors.primary} />
                <Text style={styles.modalIntroPillText}>{pricePreview}</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.modalCard}>
          <View style={styles.sectionHeaderWithIcon}>
            <View style={styles.sectionIconContainer}>
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.sectionIconGradient}
              >
                <Ionicons name="layers-outline" size={18} color={colors.white} />
              </LinearGradient>
            </View>
            <View style={styles.sectionHeaderText}>
              <Text style={styles.modalCardTitle}>Paket Tipi</Text>
              <Text style={styles.modalCardSubtitle}>
                Üyelerinizin hangi tip derslere erişeceğini belirleyin.
              </Text>
            </View>
          </View>

          <View style={styles.chipContainer}>
            <TouchableOpacity
              style={[
                styles.chip,
                formValues.packageType === 'group' && styles.chipActive,
              ]}
              onPress={() => handlePackageTypeChange('group')}
              disabled={loading}
            >
              {formValues.packageType === 'group' && (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.chipGradient}
                >
                  <Text style={styles.chipTextActive}>Grup Dersi Paketi</Text>
                </LinearGradient>
              )}
              {formValues.packageType !== 'group' && (
                <Text style={styles.chipText}>Grup Dersi Paketi</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.chip,
                formValues.packageType === 'individual' && styles.chipActive,
              ]}
              onPress={() => handlePackageTypeChange('individual')}
              disabled={loading}
            >
              {formValues.packageType === 'individual' && (
                <LinearGradient
                  colors={[colors.primary, colors.primaryDark]}
                  style={styles.chipGradient}
                >
                  <Text style={styles.chipTextActive}>Bire Bir Ders Paketi</Text>
                </LinearGradient>
              )}
              {formValues.packageType !== 'individual' && (
                <Text style={styles.chipText}>Bire Bir Ders Paketi</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.modalCard}>
          <Text style={styles.modalCardTitle}>Temel Bilgiler</Text>
          <Text style={styles.modalCardSubtitle}>
            Üyeleriniz uygulamada bu adı, açıklamayı ve fiyatı görecek.
          </Text>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Paket Adı *</Text>
            <TextInput
              style={styles.modalInput}
              value={formValues.name}
              onChangeText={handleChange('name')}
              placeholder="Örn: Premium Üyelik"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={styles.modalFieldRow}>
            <View style={[styles.modalField, styles.modalFieldHalf]}>
              <Text style={styles.modalLabel}>Aylık Ders Hakkı *</Text>
              <TextInput
                style={styles.modalInput}
                value={formValues.classes}
                onChangeText={handleChange('classes')}
                placeholder="12"
                keyboardType="number-pad"
              />
              <Text style={styles.modalHelper}>Sınırsız için 999 girin</Text>
            </View>
            <View style={[styles.modalField, styles.modalFieldHalf, styles.modalFieldHalfSpacing]}>
              <Text style={styles.modalLabel}>Ücret (₺) *</Text>
              <TextInput
                style={styles.modalInput}
                value={formValues.price}
                onChangeText={handleChange('price')}
                placeholder="600"
                keyboardType="decimal-pad"
              />
              <Text style={styles.modalHelper}>KDV dahil fiyatı girin.</Text>
            </View>
          </View>

          <View style={styles.modalField}>
            <Text style={styles.modalLabel}>Açıklama</Text>
            <TextInput
              style={[styles.modalInput, styles.modalTextarea]}
              value={formValues.description}
              onChangeText={handleChange('description')}
              placeholder="Paket hakkında kısa bilgi"
              placeholderTextColor={colors.textSecondary}
              multiline
              textAlignVertical="top"
            />
            <Text style={styles.modalHelper}>Üyeleriniz pakete ait detayları burada okuyacak.</Text>
          </View>
        </View>

        {Boolean(error) && <Text style={styles.modalError}>{error}</Text>}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
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
  section: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...colors.shadow,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  packageCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    ...colors.shadow,
  },
  packageGradient: {
    padding: 20,
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 4,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.white,
  },
  statusToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 130,
    justifyContent: 'center',
  },
  statusToggleActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.75)',
  },
  statusToggleInactive: {
    backgroundColor: 'rgba(34, 197, 94, 0.75)',
  },
  statusToggleText: {
    marginLeft: 8,
    fontSize: 13,
    fontWeight: '600',
    color: colors.white,
  },
  packageDetails: {
    marginBottom: 16,
    opacity: 0.95,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    color: colors.white,
    fontSize: 14,
    marginLeft: 8,
    opacity: 0.9,
  },
  packageDescription: {
    color: colors.white,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
    opacity: 0.85,
  },
  packageActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    minHeight: 44,
    marginHorizontal: 4,
  },
  actionButtonSecondary: {
    backgroundColor: 'rgba(59, 130, 246, 0.32)',
  },
  actionButtonDanger: {
    backgroundColor: 'rgba(239, 68, 68, 0.32)',
  },
  actionText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textAlign: 'center',
    flexShrink: 0,
  },
  noticeSection: {
    marginBottom: 40,
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 16,
    padding: 16,
  },
  noticeText: {
    marginLeft: 12,
    flex: 1,
  },
  noticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noticeDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.transparentGreen,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.transparentGreenLight,
  },
  createButtonSecondaryText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  modalBody: {
    paddingBottom: 28,
  },
  modalIntro: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.transparentGreenLight,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.transparentGreen,
  },
  modalIntroIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.transparentGreen,
    marginRight: 12,
  },
  modalIntroText: {
    flex: 1,
  },
  modalIntroTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalIntroSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  modalIntroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  modalIntroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.transparentGreen,
    marginRight: 8,
    marginBottom: 8,
  },
  modalIntroPillText: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  modalCard: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.transparentGreen,
    ...colors.shadow,
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modalCardSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: 18,
  },
  modalField: {
    marginBottom: 18,
  },
  modalFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalFieldHalf: {
    flex: 1,
  },
  modalFieldHalfSpacing: {
    marginLeft: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.transparentGreen,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    backgroundColor: colors.lightGray,
  },
  modalTextarea: {
    minHeight: 110,
    paddingTop: 14,
  },
  modalHelper: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textSecondary,
  },
  modalError: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    color: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  modalActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActionSpacing: {
    marginRight: 12,
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  modalActionGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  modalActionGhostText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalActionPrimary: {
    backgroundColor: colors.primary,
  },
  modalActionPrimaryText: {
    marginLeft: 8,
    fontSize: 15,
    fontWeight: '600',
    color: colors.white,
  },
  sectionHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  sectionIconContainer: {
    marginRight: 12,
  },
  sectionIconGradient: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeaderText: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.transparentGreen,
    backgroundColor: colors.white,
    overflow: 'hidden',
    minHeight: 44,
  },
  chipActive: {
    borderColor: colors.primary,
  },
  chipGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chipTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
});
