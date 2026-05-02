import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import {
  useSharedValue,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';

interface BebasNumberProps {
  value: number | string;
  style?: TextStyle;
  animate?: boolean;
  suffix?: string;
  size?: 'hero' | 'title' | 'badge' | 'score';
}

export default function BebasNumber({
  value,
  style,
  animate = false,
  suffix = '',
  size = 'title',
}: BebasNumberProps) {
  const { type } = useTheme();
  const numericValue = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
  const isNumeric = typeof value === 'number';

  const progress = useSharedValue(0);
  const [displayed, setDisplayed] = useState(animate && isNumeric ? 0 : numericValue);

  useEffect(() => {
    if (!animate || !isNumeric) return;
    progress.value = 0;
    progress.value = withTiming(numericValue, { duration: 1200, easing: Easing.out(Easing.cubic) });
  }, [animate, numericValue, isNumeric, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value),
    (curr, prev) => {
      if (curr !== prev) runOnJS(setDisplayed)(curr);
    },
  );

  const display = animate && isNumeric ? `${displayed}${suffix}` : `${value}${suffix}`;

  return <Text style={[type[size], style]}>{display}</Text>;
}
