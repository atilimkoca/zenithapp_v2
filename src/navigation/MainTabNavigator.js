import React, { useRef, useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Animated, 
  Dimensions,
  Platform 
} from 'react-native';
import { colors } from '../constants/colors';
import { useI18n } from '../context/I18nContext';

// Import screens
import OverviewScreen from '../screens/OverviewScreen';
import ClassSelectionScreen from '../screens/ClassSelectionScreen';
import ClassHistoryScreen from '../screens/ClassHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// Compact, clean tab button with crisp icons
function CustomTabButton({ children, onPress, accessibilityState, route, label }) {
  const focused = accessibilityState.selected;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const backgroundOpacityAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    // Simple, clean animations
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.02 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 20,
      }),
      Animated.timing(backgroundOpacityAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  const handlePress = () => {
    // Subtle press feedback
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 0.95,
        useNativeDriver: true,
        tension: 400,
        friction: 10,
      }),
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.02 : 1,
        useNativeDriver: true,
        tension: 300,
        friction: 15,
      }),
    ]).start();
    
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 2,
      }}
      activeOpacity={1}
    >
      <Animated.View
        style={{
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 36,
          transform: [{ scale: scaleAnim }],
        }}
      >
        {/* Clean background for active state */}
        <Animated.View
          style={{
            position: 'absolute',
            top: -4,
            left: -8,
            right: -8,
            bottom: -4,
            borderRadius: 16,
            backgroundColor: colors.primary,
            opacity: backgroundOpacityAnim,
          }}
        />
        
        <View
          style={{
            marginBottom: 2,
            zIndex: 1,
          }}
        >
          {children}
        </View>
        
        <Text
          style={{
            fontSize: 9,
            fontWeight: focused ? '700' : '600',
            color: focused ? colors.white : colors.textSecondary,
            textAlign: 'center',
            zIndex: 1,
          }}
        >
          {label}
        </Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

// Compact, clean floating tab bar
function CustomTabBar({ state, descriptors, navigation }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;

  return (
    <View style={{ 
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: Platform.OS === 'ios' ? 24 : 12,
      paddingTop: 0,
      backgroundColor: 'transparent',
    }}>
      <Animated.View 
        style={{
          opacity: fadeAnim,
          flexDirection: 'row',
          backgroundColor: colors.white,
          marginHorizontal: 24,
          marginBottom: Platform.OS === 'ios' ? 0 : 12,
          borderRadius: 20,
          paddingTop: 4,
          paddingBottom: 4,
          paddingHorizontal: 4,
          shadowColor: colors.black,
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 15,
          borderWidth: 0.5,
          borderColor: 'rgba(0,0,0,0.03)',
        }}
      >
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel || route.name;
          const isFocused = state.index === index;

          let iconName;
          if (route.name === 'Overview') {
            iconName = isFocused ? 'home' : 'home-outline';
          } else if (route.name === 'ClassSelection') {
            iconName = isFocused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'ClassHistory') {
            iconName = isFocused ? 'time' : 'time-outline';
          } else if (route.name === 'Profile') {
            iconName = isFocused ? 'person' : 'person-outline';
          }

          const onPress = () => {
            // Clean feedback animation
            Animated.sequence([
              Animated.timing(fadeAnim, {
                toValue: 0.95,
                duration: 50,
                useNativeDriver: true,
              }),
              Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
              }),
            ]).start();

            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <CustomTabButton
              key={route.key}
              onPress={onPress}
              accessibilityState={{ selected: isFocused }}
              route={route}
              label={label}
            >
              <Ionicons 
                name={iconName} 
                size={20} 
                color={isFocused ? colors.white : colors.textSecondary}
                style={{ 
                  // Remove all shadow effects to prevent pixelation
                }}
              />
            </CustomTabButton>
          );
        })}
      </Animated.View>
    </View>
  );
}

export default function MainTabNavigator() {
  const { t } = useI18n();
  
  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarStyle: { display: 'none' }, // Hide default tab bar
        }}
      >
        <Tab.Screen 
          name="Overview" 
          component={OverviewScreen}
          options={{
            tabBarLabel: t('navigation.overview'),
          }}
        />
        <Tab.Screen 
          name="ClassSelection" 
          component={ClassSelectionScreen}
          options={{
            tabBarLabel: t('navigation.classSelection'),
          }}
        />
        <Tab.Screen 
          name="ClassHistory" 
          component={ClassHistoryScreen}
          options={{
            tabBarLabel: t('navigation.classHistory'),
          }}
        />
        <Tab.Screen 
          name="Profile" 
          component={ProfileScreen}
          options={{
            tabBarLabel: t('navigation.profile'),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}
