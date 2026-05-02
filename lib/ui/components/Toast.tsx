import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';

interface ToastProps {
  message: string;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

export default function Toast({ message, visible, onHide, duration = 2500 }: ToastProps) {
  const { palette, radii, z } = useTheme();
  const translateY = useSharedValue(-80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 260 });
      opacity.value = withTiming(1, { duration: 200 });
      opacity.value = withDelay(
        duration,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished) runOnJS(onHide)();
        }),
      );
      translateY.value = withDelay(duration, withTiming(-80, { duration: 300 }));
    }
  }, [visible, duration, translateY, opacity, onHide]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          backgroundColor: palette.ink,
          borderRadius: radii.pill,
          borderColor: palette.glowGold,
          zIndex: z.toast,
        },
        animStyle,
      ]}
    >
      <Text style={[styles.text, { color: palette.cream }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  text: { fontFamily: 'Inter-Bold', fontSize: 13, letterSpacing: 0.3 },
});
