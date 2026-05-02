import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '../ThemeProvider';

interface SurfaceProps {
  children: React.ReactNode;
  style?: ViewStyle;
  tilt?: number;
  elevated?: boolean;
}

export default function Surface({ children, style, tilt = 0, elevated = false }: SurfaceProps) {
  const { palette, radii, shadows } = useTheme();

  return (
    <View
      style={[
        styles.outer,
        { borderRadius: radii.lg, borderColor: palette.landEdge },
        elevated ? shadows.lift : shadows.card,
        tilt ? { transform: [{ rotate: `${tilt}deg` }] } : undefined,
        style,
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            backgroundColor: palette.cream,
            borderRadius: radii.lg - 1,
            borderColor: palette.landFill,
          },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 1.5,
    overflow: 'visible',
  },
  inner: {
    borderWidth: 1,
    overflow: 'hidden',
  },
});
