import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useNotifications } from '../context/NotificationContext';

const { width } = Dimensions.get('window');

export default function UniqueHeader({
  title,
  subtitle,
  showNotification = true,
  showStats = false,
  stats = [],
  leftIcon = null,
  rightIcon = "notifications-outline",
  onLeftPress = () => {},
  onRightPress = () => {},
  backgroundColor = [colors.primary, colors.primaryLight, colors.secondary],
  children,
}) {
  const { unreadCount } = useNotifications();
  
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />
      
      {/* Unique Background with floating shapes */}
      <LinearGradient
        colors={backgroundColor}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerContainer}
      >
        {/* Floating decorative elements */}
        <View style={[styles.floatingCircle, styles.circle1]} />
        <View style={[styles.floatingCircle, styles.circle2]} />
        <View style={[styles.floatingCircle, styles.circle3]} />
        
        {/* Custom wave shape */}
        <View style={styles.waveContainer}>
          <View style={styles.wave} />
        </View>
        
        <SafeAreaView>
          <View style={styles.headerContent}>
            {/* Top navigation row */}
            <View style={styles.headerTop}>
              <View style={styles.leftSection}>
                {leftIcon ? (
                  <TouchableOpacity style={styles.iconButton} onPress={onLeftPress}>
                    <Ionicons name={leftIcon} size={24} color={colors.white} />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.brandContainer}>
                    <View style={styles.brandIcon}>
                      <Image 
                        source={require('../../assets/zenith_logo_rounded.png')} 
                        style={styles.logoImage}
                        resizeMode="cover"
                      />
                    </View>
                    <View style={styles.brandDot} />
                  </View>
                )}
              </View>

              <View style={styles.centerSection}>
                <View style={styles.titleContainer}>
                  <Text style={styles.headerTitle}>{title}</Text>
                  {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
                </View>
              </View>

              <View style={styles.rightSection}>
                {showNotification && (
                  <TouchableOpacity style={styles.notificationContainer} onPress={onRightPress}>
                    <View style={styles.notificationButton}>
                      <Ionicons name={rightIcon} size={22} color={colors.white} />
                      {unreadCount > 0 && (
                        <View style={styles.notificationBadge}>
                          <Text style={styles.notificationBadgeText}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Stats section if provided */}
            {showStats && stats.length > 0 && (
              <View style={styles.statsSection}>
                <View style={styles.statsContainer}>
                  {stats.map((stat, index) => (
                    <View key={index} style={styles.statCard}>
                      <View style={styles.statIconWrapper}>
                        <View style={[styles.statIconBg, { backgroundColor: stat.color || colors.white + '20' }]}>
                          <Ionicons name={stat.icon} size={18} color={colors.white} />
                        </View>
                      </View>
                      <Text style={styles.statValue}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                      {stat.sublabel && <Text style={styles.statSublabel}>{stat.sublabel}</Text>}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Custom children content */}
            {children}
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  headerContainer: {
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: colors.black,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 12,
  },
  
  // Floating decorative elements
  floatingCircle: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 100,
  },
  circle1: {
    width: 120,
    height: 120,
    top: -60,
    right: -20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  circle2: {
    width: 80,
    height: 80,
    top: 50,
    left: -40,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  circle3: {
    width: 60,
    height: 60,
    bottom: 20,
    right: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  
  // Wave decoration
  waveContainer: {
    position: 'absolute',
    bottom: -5,
    left: 0,
    right: 0,
    height: 20,
  },
  wave: {
    backgroundColor: colors.background,
    height: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  
  headerContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    position: 'relative',
    zIndex: 10,
  },
  
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    minHeight: 40,
  },
  
  leftSection: {
    width: 50,
    alignItems: 'flex-start',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    overflow: 'hidden',
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    position: 'absolute',
    top: -2,
    right: -2,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  
  centerSection: {
    flex: 1,
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
    marginTop: 2,
    textAlign: 'center',
  },
  
  rightSection: {
    width: 50,
    alignItems: 'flex-end',
  },
  notificationContainer: {
    position: 'relative',
  },
  notificationButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF4757',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  notificationBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  pulseAnimation: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF4757',
    opacity: 0.8,
  },
  
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  
  // Stats section
  statsSection: {
    marginTop: 12,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    marginHorizontal: 4,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    position: 'relative',
    overflow: 'hidden',
  },
  statIconWrapper: {
    marginBottom: 6,
  },
  statIconBg: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.95)',
    fontWeight: '600',
    textAlign: 'center',
  },
  statSublabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
    textAlign: 'center',
  },
});