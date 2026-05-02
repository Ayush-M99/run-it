import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

interface SecondaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

export default function SecondaryButton({ label, onPress, disabled, style }: SecondaryButtonProps) {
  const { palette, radii } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        {
          borderColor: palette.landEdge,
          borderRadius: radii.md,
          opacity: disabled ? 0.55 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <Text style={[styles.label, { color: palette.parchmentInk }]}>{label.toUpperCase()}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  label: { fontFamily: 'BebasNeue', fontSize: 18, letterSpacing: 1.2 },
});
