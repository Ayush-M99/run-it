import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function CountdownBadge() {
  const { palette, radii } = useTheme();
  const [remaining, setRemaining] = useState(msUntilMidnight());

  useEffect(() => {
    const id = setInterval(() => setRemaining(msUntilMidnight()), 1000);
    return () => clearInterval(id);
  }, []);

  const urgent = remaining < 3_600_000;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: urgent ? 'rgba(232,64,64,0.12)' : palette.landFill,
          borderColor: urgent ? palette.red : palette.landEdge,
          borderRadius: radii.pill,
        },
      ]}
    >
      <Text style={[styles.label, { color: palette.parchmentMid }]}>Resets in</Text>
      <Text
        style={[
          styles.time,
          { fontFamily: 'BebasNeue', color: urgent ? palette.red : palette.parchmentInk },
        ]}
      >
        {fmt(remaining)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1.5,
  },
  label: { fontSize: 11, fontFamily: 'Inter', textTransform: 'uppercase', letterSpacing: 1 },
  time: { fontSize: 22, letterSpacing: 1 },
});
