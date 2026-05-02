import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useTheme } from '../ThemeProvider';
import PlayerToken from './PlayerToken';

interface ChallengeCardProps {
  visible: boolean;
  regionName: string;
  ownerUserId?: string;
  ownerName?: string;
  points?: number;
  distanceKm?: number;
  onOpenLeaderboard: () => void;
  onDismiss: () => void;
}

export default function ChallengeCard({
  visible,
  regionName,
  ownerUserId,
  ownerName,
  points,
  distanceKm,
  onOpenLeaderboard,
  onDismiss,
}: ChallengeCardProps) {
  const { palette, radii, shadows } = useTheme();
  const translateY = useSharedValue(300);

  useEffect(() => {
    translateY.value = withSpring(visible ? 0 : 300, { damping: 20, stiffness: 200 });
  }, [visible, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible && translateY.value >= 299) return null;

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onDismiss} />
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: palette.cream,
            borderColor: palette.landEdge,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            ...shadows.lift,
          },
          animStyle,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.landEdge }]} />

        <View style={styles.header}>
          {ownerUserId && <PlayerToken userId={ownerUserId} label={ownerName} size="sm" />}
          <View style={{ flex: 1 }}>
            <Text style={[styles.category, { color: palette.blue }]}>Territory</Text>
            <Text style={[styles.regionName, { color: palette.ink }]}>{regionName}</Text>
          </View>
        </View>

        {ownerName && (
          <View
            style={[styles.statRow, { backgroundColor: palette.landFill, borderRadius: radii.md }]}
          >
            <StatChip label="Leader" value={ownerName} color={palette.parchmentInk} />
            {points != null && (
              <StatChip label="Points" value={String(points)} color={palette.blue} />
            )}
            {distanceKm != null && (
              <StatChip
                label="Distance"
                value={`${distanceKm.toFixed(1)} km`}
                color={palette.parchmentInk}
              />
            )}
          </View>
        )}

        {!ownerName && (
          <Text style={[styles.unclaimed, { color: palette.parchmentMid }]}>
            No one has claimed this territory yet. Be the first!
          </Text>
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: palette.yellow, borderRadius: radii.md }]}
          onPress={onOpenLeaderboard}
          activeOpacity={0.85}
        >
          <Text style={[styles.primaryBtnText, { color: palette.ink }]}>Open leaderboard</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
          <Text style={[styles.dismissText, { color: palette.parchmentMid }]}>Dismiss</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  const { palette } = useTheme();
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipLabel, { color: palette.parchmentMid }]}>{label}</Text>
      <Text style={[styles.chipValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,26,46,0.3)',
  },
  card: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderWidth: 1.5,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  category: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  regionName: {
    fontFamily: 'BebasNeue',
    fontSize: 28,
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    marginBottom: 16,
  },
  chip: { alignItems: 'center' },
  chipLabel: { fontSize: 10, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1 },
  chipValue: { fontSize: 16, fontFamily: 'Inter-Bold', marginTop: 2 },
  unclaimed: {
    fontSize: 13,
    fontFamily: 'Inter',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  primaryBtn: {
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontFamily: 'Inter-Bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  dismissBtn: { alignItems: 'center', padding: 8 },
  dismissText: { fontFamily: 'Inter', fontSize: 13 },
});
