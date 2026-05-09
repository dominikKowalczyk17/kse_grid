import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

interface DiagnosticRowProps {
  label: string;
  ok: number;
  warn: number;
  bad: number;
  extra?: number;
  extraLabel?: string;
}

export function DiagnosticRow({ label, ok, warn, bad, extra, extraLabel }: DiagnosticRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.pills}>
        <View style={[styles.pill, { backgroundColor: COLORS.good + '22', borderColor: COLORS.good + '55' }]}>
          <Text style={[styles.pillText, { color: COLORS.good }]}>✓ {ok}</Text>
        </View>
        {warn > 0 && (
          <View style={[styles.pill, { backgroundColor: COLORS.warn + '22', borderColor: COLORS.warn + '55' }]}>
            <Text style={[styles.pillText, { color: COLORS.warn }]}>⚠ {warn}</Text>
          </View>
        )}
        {bad > 0 && (
          <View style={[styles.pill, { backgroundColor: COLORS.bad + '22', borderColor: COLORS.bad + '55' }]}>
            <Text style={[styles.pillText, { color: COLORS.bad }]}>✕ {bad}</Text>
          </View>
        )}
        {extra != null && extra > 0 && (
          <View style={[styles.pill, { backgroundColor: COLORS.textMuted + '22', borderColor: COLORS.textMuted + '55' }]}>
            <Text style={[styles.pillText, { color: COLORS.textMuted }]}>{extraLabel ?? '?'} {extra}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 10,
  },
  label: {
    width: 100,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  pills: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
