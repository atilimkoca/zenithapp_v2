import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Dimensions,
  Platform 
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnUI,
} from 'react-native-reanimated';
import { colors } from '../constants/colors';

// Import screens
import OverviewScreen from '../screens/OverviewScreen';
import ClassSelectionScreen from '../screens/ClassSelectionScreen';
import ClassHistoryScreen from '../screens/ClassHistoryScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const { width } = Dimensions.get('window');

// Enhanced animated tab button with Reanimated
function EnhancedTabButton({ children, onPress, accessibilityState, route, label }) {
  const focused = accessibilityState.selected;
  
  // Shared values for animations
  const scale = useSharedValue(1);
  const opacity = useSharedValue(focused ? 1 : 0.6);
  const translateY = useSharedValue(0);
  const iconScale = useSharedValue(1);
  const labelOpacity = useSharedValue(focused ? 1 : 0.8);
  
  useEffect(() => {
    // Animate when focus state changes
    scale.value = withSpring(focused ? 1.05 : 1, {
      damping: 15,
      stiffness: 150,
    });
    
    opacity.value = withTiming(focused ? 1 : 0.6, {
      duration: 200,
    });
    
    translateY.value = withSpring(focused ? -1 : 0, {
      damping: 12,
      stiffness: 100,
    });
    
    iconScale.value = withSpring(focused ? 1.1 : 1, {
      damping: 15,
      stiffness: 200,
    });
    
    labelOpacity.value = withTiming(focused ? 1 : 0.8, {
      duration: 200,
    });
  }, [focused]);

  // Animated styles
  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: labelOpacity.value,
  }));

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    opacity: focused ? withTiming(1, { duration: 300 }) : withTiming(0, { duration: 300 }),
    transform: [
      { scale: focused ? withSpring(1, { damping: 12 }) : withSpring(0, { damping: 12 }) }
    ],
  }));

  const handlePress = () => {
    // Create press animation
    scale.value = withSpring(0.95, { damping: 15, stiffness: 200 }, (finished) => {
      if (finished) {
        scale.value = withSpring(focused ? 1.05 : 1, { damping: 15, stiffness: 150 });
      }
    });
    
    // Haptic feedback simulation with icon bounce
    iconScale.value = withSpring(0.8, { damping: 10, stiffness: 200 }, (finished) => {
      if (finished) {
        iconScale.value = withSpring(focused ? 1.1 : 1, { damping: 15, stiffness: 200 });
      }
    });
    
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
      }}
      activeOpacity={1}
    >
      <Animated.View
        style={[
          {
            alignItems: 'center',
            justifyContent: 'center',
          },
          animatedContainerStyle
        ]}
      >
        <Animated.View style={animatedIconStyle}>
          {children}
        </Animated.View>
        
        <Animated.Text
          style={[
            {
              fontSize: 10,
              fontWeight: focused ? '700' : '600',
              color: focused ? colors.primary : colors.textSecondary,
              marginTop: 6,
              textAlign: 'center',
            },
            animatedLabelStyle
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
      
      {/* Enhanced active indicator */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            bottom: 4,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
          },
          animatedIndicatorStyle
        ]}
      />
      
      {/* Background glow effect for focused state */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 8,
            left: 8,
            right: 8,
            bottom: 8,
            borderRadius: 20,
            backgroundColor: colors.transparentGreen,
          },
          animatedIndicatorStyle
        ]}
      />
    </TouchableOpacity>
  );
}

// Enhanced custom tab bar with sliding animations
function EnhancedTabBar({ state, descriptors, navigation }) {
  const tabWidth = width / state.routes.length;
  const indicatorPosition = useSharedValue(0);
  const indicatorScale = useSharedValue(1);
  
  useEffect(() => {
    indicatorPosition.value = withSpring(state.index * tabWidth, {
      damping: 20,
      stiffness: 120,
    });
  }, [state.index, tabWidth]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: indicatorPosition.value },
      { scale: indicatorScale.value }
    ],
  }));

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: colors.white,
      borderTopWidth: 0,
      paddingTop: 8,
      paddingBottom: Platform.OS === 'ios' ? 28 : 12,
      shadowColor: colors.black,
      shadowOffset: {
        width: 0,
        height: -6,
      },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 20,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      // Add subtle gradient effect
      borderTopColor: 'rgba(107, 127, 106, 0.1)',
      borderTopWidth: 1,
    }}>
      {/* Enhanced sliding background indicator */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 4,
            left: 8,
            width: tabWidth - 16,
            height: '85%',
            backgroundColor: colors.transparentGreen,
            borderRadius: 20,
            shadowColor: colors.primary,
            shadowOffset: {
              width: 0,
              height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          },
          animatedIndicatorStyle
        ]}
      />
      
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
          // Add a subtle scale animation to the indicator during press
          indicatorScale.value = withSpring(0.95, { damping: 15, stiffness: 200 }, (finished) => {
            if (finished) {
              indicatorScale.value = withSpring(1, { damping: 15, stiffness: 150 });
            }
          });
          
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
          <EnhancedTabButton
            key={route.key}
            onPress={onPress}
            accessibilityState={{ selected: isFocused }}
            route={route}
            label={label}
          >
            <Ionicons 
              name={iconName} 
              size={24} 
              color={isFocused ? colors.primary : colors.textSecondary}
              style={{ 
                marginBottom: 2,
                textShadowColor: isFocused ? 'rgba(107, 127, 106, 0.3)' : 'transparent',
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
            />
          </EnhancedTabButton>
        );
      })}
    </View>
  );
}

export default function EnhancedTabNavigator() {
  return (
    <Tab.Navigator
      tabBar={props => <EnhancedTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tab.Screen 
        name="Overview" 
        component={OverviewScreen}
        options={{
          tabBarLabel: 'Genel Bakış',
        }}
      />
      <Tab.Screen 
        name="ClassSelection" 
        component={ClassSelectionScreen}
        options={{
          tabBarLabel: 'Ders Seç',
        }}
      />
      <Tab.Screen 
        name="ClassHistory" 
        component={ClassHistoryScreen}
        options={{
          tabBarLabel: 'Derslerim',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profil',
        }}
      />
    </Tab.Navigator>
  );
}
