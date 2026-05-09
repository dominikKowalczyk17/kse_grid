import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';

interface StatsCardProps {
  label: string;
  value: string | number;
  accent?: string;
  sub?: string;
}

export function StatsCard({ label, value, accent, sub }: StatsCardProps) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, accent ? { color: accent } : null]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    margin: 4,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  label: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  sub: {
    fontSize: 10,
    color: COLORS.textFaint,
    marginTop: 1,
    textAlign: 'center',
  },
});
