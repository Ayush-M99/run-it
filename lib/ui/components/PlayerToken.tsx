import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { userColorHex } from '../../colors';
import { useTheme } from '../ThemeProvider';

interface PlayerTokenProps {
  userId: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const SIZE = { sm: 28, md: 40, lg: 56 };
const FONT = { sm: 11, md: 16, lg: 22 };

export default function PlayerToken({
  userId,
  label,
  size = 'md',
  pulse = true,
}: PlayerTokenProps) {
  const { shadows } = useTheme();
  const color = userColorHex(userId);
  const dim = SIZE[size];
  const fontSize = FONT[size];
  const ringSize = dim * 1.6;

  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (!pulse) return;
    scale.value = withRepeat(
      withTiming(1.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse, scale, opacity]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const initials = label ? label.slice(0, 1).toUpperCase() : '?';

  return (
    <View style={[styles.container, { width: ringSize, height: ringSize }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: dim, height: dim, borderRadius: dim / 2, backgroundColor: color },
          ringStyle,
        ]}
      />
      <View
        style={[
          styles.token,
          {
            width: dim,
            height: dim,
            borderRadius: dim / 2,
            backgroundColor: color,
            ...shadows.token,
          },
        ]}
      >
        <Text style={[styles.label, { fontSize }]}>{initials}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
  token: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
  },
  label: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    lineHeight: undefined,
  },
});
