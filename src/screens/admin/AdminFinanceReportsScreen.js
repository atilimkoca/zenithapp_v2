import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { useAuth } from '../../context/AuthContext';
import { useI18n } from '../../context/I18nContext';
import UniqueHeader from '../../components/UniqueHeader';

const { width } = Dimensions.get('window');

export default function AdminFinanceReportsScreen({ navigation }) {
  const { user, userData } = useAuth();
  const { language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState({
    totalRevenue: 0,
    monthlyRevenue: 0,
    totalTransactions: 0,
    avgTransactionValue: 0,
    topPackages: [],
    recentTransactions: [],
  });

  useEffect(() => {
    loadFinanceReports();
  }, []);

  const loadFinanceReports = async () => {
    try {
      setLoading(true);
      
      // Mock data - In real implementation, fetch from your payment system
      const mockReports = {
        totalRevenue: 15750,
        monthlyRevenue: 4320,
        totalTransactions: 89,
        avgTransactionValue: 177,
        topPackages: [
          { name: 'Premium Paket', sales: 25, revenue: 7500 },
          { name: 'Temel Paket', sales: 35, revenue: 5250 },
          { name: 'Sınırsız Paket', sales: 15, revenue: 4500 },
        ],
        recentTransactions: [
          { id: 1, user: 'Ayşe Yılmaz', amount: 300, package: 'Premium Paket', date: '2025-10-03' },
          { id: 2, user: 'Mehmet Özkan', amount: 150, package: 'Temel Paket', date: '2025-10-02' },
          { id: 3, user: 'Fatma Kaya', amount: 500, package: 'Sınırsız Paket', date: '2025-10-01' },
        ],
      };

      setReports(mockReports);
      
    } catch (error) {
      console.error('Error loading finance reports:', error);
      Alert.alert('Hata', 'Finansal raporlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const RevenueCard = ({ title, amount, subtitle, icon, color }) => (
    <View style={styles.revenueCard}>
      <LinearGradient
        colors={[color, color + 'CC']}
        style={styles.revenueGradient}
      >
        <View style={styles.revenueContent}>
          <View style={styles.revenueInfo}>
            <Text style={styles.revenueTitle}>{title}</Text>
            <Text style={styles.revenueAmount}>₺{amount.toLocaleString('tr-TR')}</Text>
            {subtitle && <Text style={styles.revenueSubtitle}>{subtitle}</Text>}
          </View>
          <Ionicons name={icon} size={32} color={colors.white} />
        </View>
      </LinearGradient>
    </View>
  );

  const PackageCard = ({ packageData }) => (
    <View style={styles.packageCard}>
      <View style={styles.packageInfo}>
        <Text style={styles.packageName}>{packageData.name}</Text>
        <Text style={styles.packageSales}>{packageData.sales} satış</Text>
      </View>
      <Text style={styles.packageRevenue}>₺{packageData.revenue.toLocaleString('tr-TR')}</Text>
    </View>
  );

  const TransactionCard = ({ transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionUser}>{transaction.user}</Text>
        <Text style={styles.transactionPackage}>{transaction.package}</Text>
        <Text style={styles.transactionDate}>{new Date(transaction.date).toLocaleDateString(language === 'tr' ? 'tr-TR' : 'en-US')}</Text>
      </View>
      <Text style={styles.transactionAmount}>₺{transaction.amount}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <UniqueHeader
          title="Finansal Rapor"
          subtitle="Gelir ve satış raporları"
          leftIcon="arrow-back"
          onLeftPress={() => navigation.goBack()}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Finansal veriler yükleniyor...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <UniqueHeader
        title="Finansal Rapor"
        subtitle="Gelir ve satış raporları"
        leftIcon="arrow-back"
        onLeftPress={() => navigation.goBack()}
        rightIcon="refresh"
        onRightPress={loadFinanceReports}
        showStats={true}
        stats={[
          { value: `₺${reports.monthlyRevenue.toLocaleString('tr-TR')}`, label: 'Bu Ay', icon: 'trending-up-outline', color: 'rgba(255, 255, 255, 0.3)' },
          { value: reports.totalTransactions.toString(), label: 'İşlem', icon: 'card-outline', color: 'rgba(255, 255, 255, 0.3)' },
        ]}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Revenue Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gelir Özeti</Text>
          <View style={styles.revenueGrid}>
            <RevenueCard
              title="Toplam Gelir"
              amount={reports.totalRevenue}
              subtitle="Tüm zamanlar"
              icon="cash-outline"
              color={colors.success}
            />
            <RevenueCard
              title="Aylık Gelir"
              amount={reports.monthlyRevenue}
              subtitle="Bu ay"
              icon="trending-up-outline"
              color={colors.primary}
            />
            <RevenueCard
              title="Ortalama İşlem"
              amount={reports.avgTransactionValue}
              subtitle="İşlem başına"
              icon="analytics-outline"
              color={colors.warning}
            />
            <RevenueCard
              title="Toplam İşlem"
              amount={reports.totalTransactions}
              subtitle="Tüm işlemler"
              icon="card-outline"
              color={colors.info}
            />
          </View>
        </View>

        {/* Top Packages */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>En Çok Satan Paketler</Text>
            <TouchableOpacity onPress={() => Alert.alert('Bilgi', 'Detaylı paket analizi yakında!')}>
              <Text style={styles.sectionAction}>Detay</Text>
            </TouchableOpacity>
          </View>
          {reports.topPackages.map((packageData, index) => (
            <PackageCard key={index} packageData={packageData} />
          ))}
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Son İşlemler</Text>
            <TouchableOpacity onPress={() => Alert.alert('Bilgi', 'Tüm işlemler sayfası yakında!')}>
              <Text style={styles.sectionAction}>Tümü</Text>
            </TouchableOpacity>
          </View>
          {reports.recentTransactions.map((transaction) => (
            <TransactionCard key={transaction.id} transaction={transaction} />
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hızlı İşlemler</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => Alert.alert('Bilgi', 'Bu özellik yakında eklenecek!')}
            >
              <LinearGradient
                colors={[colors.primary, colors.primaryDark]}
                style={styles.actionGradient}
              >
                <Ionicons name="download-outline" size={24} color={colors.white} />
                <Text style={styles.actionText}>Rapor İndir</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => Alert.alert('Bilgi', 'Bu özellik yakında eklenecek!')}
            >
              <LinearGradient
                colors={[colors.success, colors.success + 'CC']}
                style={styles.actionGradient}
              >
                <Ionicons name="mail-outline" size={24} color={colors.white} />
                <Text style={styles.actionText}>E-posta Gönder</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>

        {/* Notice */}
        <View style={styles.noticeSection}>
          <View style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={24} color={colors.info} />
            <View style={styles.noticeText}>
              <Text style={styles.noticeTitle}>Finansal Entegrasyon</Text>
              <Text style={styles.noticeDescription}>
                Gerçek finansal veriler için ödeme sisteminizle entegrasyon gereklidir. 
                Şu anda örnek veriler gösterilmektedir.
              </Text>
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
  sectionAction: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },

  // Revenue Cards
  revenueGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  revenueCard: {
    width: (width - 80) / 2,
    marginBottom: 12,
    borderRadius: 16,
    overflow: 'hidden',
    ...colors.shadow,
  },
  revenueGradient: {
    padding: 16,
  },
  revenueContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  revenueInfo: {
    flex: 1,
  },
  revenueTitle: {
    fontSize: 12,
    color: colors.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  revenueAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.white,
    marginBottom: 2,
  },
  revenueSubtitle: {
    fontSize: 10,
    color: colors.white,
    opacity: 0.8,
  },

  // Package Cards
  packageCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  packageInfo: {
    flex: 1,
  },
  packageName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  packageSales: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  packageRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },

  // Transaction Cards
  transactionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    marginBottom: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionUser: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  transactionPackage: {
    fontSize: 14,
    color: colors.primary,
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.success,
  },

  // Actions
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    flex: 1,
    marginHorizontal: 6,
    borderRadius: 12,
    overflow: 'hidden',
    ...colors.shadow,
  },
  actionGradient: {
    padding: 16,
    alignItems: 'center',
  },
  actionText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },

  // Notice
  noticeSection: {
    marginBottom: 20,
  },
  noticeCard: {
    flexDirection: 'row',
    backgroundColor: colors.info + '15',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: colors.info,
  },
  noticeText: {
    flex: 1,
    marginLeft: 12,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  noticeDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
});