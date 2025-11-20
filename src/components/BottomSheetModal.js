import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  PanResponder,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../constants/colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { height } = Dimensions.get('window');

const BottomSheetModal = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  accentIcon,
  accentIconColor = colors.primary,
  maxHeightRatio = 0.9,
  showClose = true,
}) => {
  const animation = useRef(new Animated.Value(0)).current;
  const dragY = useRef(new Animated.Value(0)).current;
  const keyboardHeight = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      dragY.setValue(0);
      keyboardHeight.setValue(0);
      Animated.timing(animation, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(animation, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        // Reset keyboard height when modal is fully closed
        keyboardHeight.setValue(0);
      });
    }
  }, [visible, animation, keyboardHeight]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? e.duration : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      (e) => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? e.duration : 250,
          useNativeDriver: true,
        }).start();
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [keyboardHeight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          dragY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeThreshold = 90;
        const velocityThreshold = 0.4;

        if (gestureState.dy > swipeThreshold || gestureState.vy > velocityThreshold) {
          dragY.stopAnimation();
          animation.stopAnimation();

          // Dismiss keyboard when closing modal
          Keyboard.dismiss();

          Animated.parallel([
            Animated.timing(dragY, {
              toValue: height,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.timing(animation, {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }),
            Animated.timing(keyboardHeight, {
              toValue: 0,
              duration: 220,
              useNativeDriver: true,
            }),
          ]).start(() => {
            dragY.setValue(0);
            keyboardHeight.setValue(0);
            onClose();
          });
        } else {
          Animated.spring(dragY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 12,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start();
      },
    })
  ).current;

  const translateY = Animated.add(
    Animated.add(
      animation.interpolate({
        inputRange: [0, 1],
        outputRange: [height, 0],
      }),
      dragY
    ),
    keyboardHeight.interpolate({
      inputRange: [0, 1000],
      outputRange: [0, -1000],
    })
  );

  const overlayOpacity = Animated.multiply(
    animation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    dragY.interpolate({
      inputRange: [0, height],
      outputRange: [1, 0.2],
      extrapolate: 'clamp',
    })
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.dismissArea} />
        </TouchableWithoutFeedback>
      </Animated.View>

        <Animated.View
          style={[
            styles.sheetWrapper,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <View
            style={[
              styles.sheet,
              {
                maxHeight: height * maxHeightRatio,
                minHeight: Math.min(height * maxHeightRatio, height * 0.7),
                paddingBottom: 20 + insets.bottom,
              },
            ]}
          >
          <View style={styles.handleArea} {...panResponder.panHandlers}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {accentIcon ? (
                <View style={[styles.accentIconWrapper, { backgroundColor: `${accentIconColor}12` }]}>
                  <Ionicons name={accentIcon} size={20} color={accentIconColor} />
                </View>
              ) : null}
              <View style={styles.headerTextWrapper}>
                {title ? <Animated.Text style={styles.title}>{title}</Animated.Text> : null}
                {subtitle ? <Animated.Text style={styles.subtitle}>{subtitle}</Animated.Text> : null}
              </View>
            </View>

            {showClose ? (
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.content}>{children}</View>

          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  dismissArea: {
    flex: 1,
  },
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
    ...colors.shadow,
  },
  handleArea: {
    paddingTop: 12,
    paddingBottom: 20,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  accentIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTextWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textSecondary,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.transparentGreenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    marginTop: 20,
    flex: 1,
    flexGrow: 1,
    minHeight: 0,
  },
  footer: {
    marginTop: 20,
    gap: 12,
  },
});

export default BottomSheetModal;
