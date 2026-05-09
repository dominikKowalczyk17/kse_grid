import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';
import { voltageStatus, loadingStatus } from '@/utils/formatters';

interface StatusDotProps {
  /** Tryb 'voltage' — bazuje na vmPu; tryb 'loading' — bazuje na loading (%). */
  mode: 'voltage' | 'loading';
  value: number | null;
  size?: number;
}

export function StatusDot({ mode, value, size = 10 }: StatusDotProps) {
  let status: 'good' | 'warn' | 'bad' | '' = '';
  if (mode === 'voltage') {
    status = voltageStatus(value);
  } else {
    status = value != null ? loadingStatus(value) : '';
  }

  const color =
    status === 'good'
      ? COLORS.good
      : status === 'warn'
        ? COLORS.warn
        : status === 'bad'
          ? COLORS.bad
          : COLORS.textMuted;

  return (
    <View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    flexShrink: 0,
  },
});
