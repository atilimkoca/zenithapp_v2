import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import PendingApprovalScreen from './src/screens/PendingApprovalScreen';
import TermsScreen from './src/screens/TermsScreen';
import PrivacyScreen from './src/screens/PrivacyScreen';
import NotificationScreen from './src/screens/NotificationScreen';
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminUserManagementScreen from './src/screens/admin/AdminUserManagementScreen';
import AdminUserDetailScreen from './src/screens/admin/AdminUserDetailScreen';
import AdminUserMembershipScreen from './src/screens/admin/AdminUserMembershipScreen';
import AdminLessonManagementScreen from './src/screens/admin/AdminLessonManagementScreen';
import AdminCreateLessonScreen from './src/screens/admin/AdminCreateLessonScreen';
import AdminEditLessonScreen from './src/screens/admin/AdminEditLessonScreen';
import AdminAddStudentToLessonScreen from './src/screens/admin/AdminAddStudentToLessonScreen';
import AdminTrainerManagementScreen from './src/screens/admin/AdminTrainerManagementScreen';
import AdminNotificationsScreen from './src/screens/admin/AdminNotificationsScreen';
import AdminSettingsScreen from './src/screens/admin/AdminSettingsScreen';
import AdminFinanceReportsScreen from './src/screens/admin/AdminFinanceReportsScreen';
import MainTabNavigator from './src/navigation/MainTabNavigator';
import AdminTabNavigator from './src/navigation/AdminTabNavigator';
import { colors } from './src/constants/colors';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { I18nProvider, useI18n } from './src/context/I18nContext';
import { simplePushNotificationService } from './src/services/simplePushNotificationService';
import { setupNotificationListeners } from './src/services/pushNotificationService';
import { setupSimpleFirebaseListener } from './src/services/simpleFirebaseListener';
import FCMService from './src/services/fcmService';

const Stack = createStackNavigator();

// Main Navigation Component
function Navigation() {
  const { isAuthenticated, isApproved, isPending, isRejected, isAdmin, initializing, user } = useAuth();
  const { isLoading } = useI18n();

  // Setup push notifications when user is authenticated
  useEffect(() => {
    let cleanupNotificationListeners;
    let cleanupFirebaseListener;

    const initializePushNotifications = async () => {
      if (isAuthenticated && user?.uid && isApproved) {
        try {
          // Initialize FCM Service for true push notifications
          const fcmInitialized = await FCMService.initialize(user.uid);
          
          if (fcmInitialized) {
            // Test FCM notification - DISABLED to prevent confusion
            // setTimeout(() => {
            //   FCMService.sendTestNotification();
            // }, 2000);
            console.log('✅ FCM initialized successfully');
          }

          // Also register for push notifications using simple service (Expo Go compatible)
          const result = await simplePushNotificationService.registerForPushNotifications();

          // Setup notification listeners for the app
          cleanupNotificationListeners = setupNotificationListeners();
          
          // Setup Firebase notification listener for web admin panel notifications
          cleanupFirebaseListener = setupSimpleFirebaseListener(user.uid);
          
        } catch (error) {
          console.error('Error initializing notifications:', error);
        }
      }
    };

    initializePushNotifications();

    // Cleanup function
    return () => {
      if (cleanupNotificationListeners) {
        cleanupNotificationListeners();
      }
      if (cleanupFirebaseListener && typeof cleanupFirebaseListener === 'function') {
        cleanupFirebaseListener();
      }
    };
  }, [isAuthenticated, user?.uid, isApproved]);

  // Show loading screen while I18n is loading or while checking authentication state
  if (isLoading || initializing) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: colors.background 
      }}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 10, color: colors.text }}>
          {isLoading ? 'Loading translations...' : 'Loading...'}
        </Text>
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      {!isAuthenticated ? (
        // Auth screens
        <>
          <Stack.Screen 
            name="Login" 
            component={LoginScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="Register" 
            component={RegisterScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        </>
      ) : isPending || isRejected ? (
        // Pending approval screen
        <Stack.Screen 
          name="PendingApproval" 
          component={PendingApprovalScreen} 
        />
      ) : isAdmin ? (
        // Admin interface for admin/instructor users
        <>
          <Stack.Screen 
            name="AdminTabs" 
            component={AdminTabNavigator}
          />
          <Stack.Screen
            name="AdminUserDetail"
            component={AdminUserDetailScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen
            name="AdminUserMembership"
            component={AdminUserMembershipScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="CreateLesson" 
            component={AdminCreateLessonScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="EditLesson" 
            component={AdminEditLessonScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="AddStudentToLesson" 
            component={AdminAddStudentToLessonScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="AdminTrainerManagement" 
            component={AdminTrainerManagementScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="AdminSettings" 
            component={AdminSettingsScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="AdminFinanceReports" 
            component={AdminFinanceReportsScreen}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationScreen}
            options={{
              presentation: 'modal',
              animationTypeForReplace: 'push',
              cardStyle: { backgroundColor: 'transparent' },
              cardOverlayEnabled: true,
              cardStyleInterpolator: ({ current: { progress } }) => ({
                cardStyle: {
                  opacity: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              }),
            }}
          />
        </>
      ) : (
        // Main app screens for approved regular users
        <>
          <Stack.Screen 
            name="MainTabs" 
            component={MainTabNavigator}
          />
          <Stack.Screen 
            name="Notifications" 
            component={NotificationScreen}
            options={{
              presentation: 'modal',
              animationTypeForReplace: 'push',
              cardStyle: { backgroundColor: 'transparent' },
              cardOverlayEnabled: true,
              cardStyleInterpolator: ({ current: { progress } }) => ({
                cardStyle: {
                  opacity: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              }),
            }}
          />
        </>
      )}
      <Stack.Screen
        name="Terms"
        component={TermsScreen}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <NotificationProvider>
          <NavigationContainer>
            <StatusBar style="dark" backgroundColor={colors.background} />
            <Navigation />
          </NavigationContainer>
        </NotificationProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
