import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  danger?: boolean;
  style?: ViewStyle;
}

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  danger,
  style,
}: PrimaryButtonProps) {
  const { palette, radii } = useTheme();
  const bg = danger ? palette.red : palette.yellow;
  const fg = danger ? palette.white : palette.ink;

  return (
    <TouchableOpacity
      style={[
        styles.btn,
        { backgroundColor: bg, borderRadius: radii.md, opacity: disabled ? 0.55 : 1 },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label.toUpperCase()}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 16, paddingHorizontal: 24, alignItems: 'center' },
  label: { fontFamily: 'BebasNeue', fontSize: 20, letterSpacing: 1.5 },
});
