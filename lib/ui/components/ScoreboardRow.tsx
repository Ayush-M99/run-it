import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import PlayerToken from './PlayerToken';

interface ScoreboardRowProps {
  rank: number;
  userId: string;
  displayName: string;
  points: number;
  distanceM: number;
  isMe: boolean;
  flash?: boolean;
}

export default function ScoreboardRow({
  rank,
  userId,
  displayName,
  points,
  distanceM,
  isMe,
  flash = false,
}: ScoreboardRowProps) {
  const { palette, radii } = useTheme();
  const bgOpacity = useSharedValue(0);

  useEffect(() => {
    if (!flash) return;
    bgOpacity.value = withTiming(1, { duration: 100 });
    bgOpacity.value = withDelay(500, withTiming(0, { duration: 500 }));
  }, [flash, bgOpacity]);

  const flashStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(245,200,66,${bgOpacity.value * 0.25})`,
  }));

  return (
    <Animated.View
      style={[
        styles.row,
        {
          borderBottomColor: palette.landEdge,
          borderLeftWidth: isMe ? 3 : 0,
          borderLeftColor: palette.glowGold,
        },
        flashStyle,
      ]}
    >
      <View
        style={[styles.rankChip, { backgroundColor: palette.landFill, borderRadius: radii.xs }]}
      >
        <Text
          style={[
            styles.rankText,
            { color: rank <= 3 ? palette.yellow : palette.parchmentMid, fontFamily: 'BebasNeue' },
          ]}
        >
          {String(rank).padStart(2, '0')}
        </Text>
      </View>
      <PlayerToken userId={userId} label={displayName} size="sm" pulse={isMe} />
      <Text style={[styles.name, { color: palette.ink }]} numberOfLines={1}>
        {displayName}
        {isMe ? ' (you)' : ''}
      </Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.points, { color: palette.blue, fontFamily: 'BebasNeue' }]}>
          {points}
        </Text>
        <Text style={[styles.dist, { color: palette.parchmentMid }]}>
          {(distanceM / 1000).toFixed(2)} km
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  rankChip: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { fontSize: 18, letterSpacing: 0.5 },
  name: { flex: 1, fontFamily: 'Inter', fontSize: 14 },
  points: { fontSize: 22, letterSpacing: 0.5 },
  dist: { fontSize: 11, fontFamily: 'Inter', marginTop: 1 },
});
