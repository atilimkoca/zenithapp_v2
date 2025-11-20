import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { colors } from '../constants/colors';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminUserManagementScreen from '../screens/admin/AdminUserManagementScreen';
import AdminLessonManagementScreen from '../screens/admin/AdminLessonManagementScreen';
import AdminPackagesScreen from '../screens/admin/AdminPackagesScreen';

const Tab = createBottomTabNavigator();

export default function AdminTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'AdminDashboard') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'AdminUsers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'AdminLessons') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'AdminPackages') {
            iconName = focused ? 'gift' : 'gift-outline';
          }

          return <Ionicons name={iconName} size={focused ? 26 : 24} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 0.5,
          borderTopColor: colors.gray,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 20 : 8,
          height: Platform.OS === 'ios' ? 85 : 70,
          elevation: 10,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -3,
          },
          shadowOpacity: 0.15,
          shadowRadius: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
          marginBottom: 2,
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="AdminDashboard" 
        component={AdminDashboardScreen}
        options={{ 
          tabBarLabel: 'Panel',
          tabBarAccessibilityLabel: 'Admin Paneli',
        }}
      />
      <Tab.Screen 
        name="AdminUsers" 
        component={AdminUserManagementScreen}
        options={{ 
          tabBarLabel: 'Üyeler',
          tabBarAccessibilityLabel: 'Üye Yönetimi',
        }}
      />
      <Tab.Screen 
        name="AdminLessons" 
        component={AdminLessonManagementScreen}
        options={{ 
          tabBarLabel: 'Dersler',
          tabBarAccessibilityLabel: 'Ders Yönetimi',
        }}
      />
      <Tab.Screen 
        name="AdminPackages" 
        component={AdminPackagesScreen}
        options={{ 
          tabBarLabel: 'Paketler',
          tabBarAccessibilityLabel: 'Paket Yönetimi',
        }}
      />
    </Tab.Navigator>
  );
}