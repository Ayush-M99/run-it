import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';

interface CoinRowProps {
  points: number;
  animate?: boolean;
  maxCoins?: number;
  style?: import('react-native').ViewStyle;
}

const COIN_SIZE = 12;
const MAX_DISPLAY = 8;

function Coin({ index, filled, animate }: { index: number; filled: boolean; animate: boolean }) {
  const { palette } = useTheme();
  const scale = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    scale.value = withDelay(index * 80, withSpring(1, { damping: 12, stiffness: 200 }));
  }, [animate, index, scale]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.coin,
        {
          backgroundColor: filled ? palette.yellow : 'rgba(26,26,46,0.15)',
          opacity: filled ? 1 : 0.5,
        },
        animStyle,
      ]}
    />
  );
}

export default function CoinRow({
  points,
  animate = false,
  maxCoins = MAX_DISPLAY,
  style,
}: CoinRowProps) {
  const { palette } = useTheme();
  const coinsEarned = Math.min(Math.floor(points / 50), maxCoins);
  const overflow = points - coinsEarned * 50;

  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: maxCoins }).map((_, i) => (
        <Coin key={i} index={i} filled={i < coinsEarned} animate={animate} />
      ))}
      {overflow > 0 && coinsEarned >= maxCoins && (
        <Text style={[styles.overflow, { color: palette.parchmentMid }]}>+{overflow}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  coin: {
    width: COIN_SIZE,
    height: COIN_SIZE,
    borderRadius: COIN_SIZE / 2,
  },
  overflow: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    marginLeft: 2,
  },
});
