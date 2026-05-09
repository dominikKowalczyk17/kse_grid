import React from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';
import type { SwitchState } from '@/types/network';

interface SwitchItemProps {
  sw: SwitchState;
  onToggle: (switchId: number, closed: boolean) => void;
  disabled?: boolean;
}

export function SwitchItem({ sw, onToggle, disabled = false }: SwitchItemProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.indicator, { backgroundColor: sw.closed ? COLORS.good : COLORS.bad }]} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {sw.name || `Łącznik #${sw.id}`}
        </Text>
        <Text style={styles.meta}>
          Bus {sw.bus} · {sw.etType.toUpperCase()} #{sw.element}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.stateText, { color: sw.closed ? COLORS.good : COLORS.bad }]}>
          {sw.closed ? 'ZAM' : 'OTW'}
        </Text>
        <Switch
          value={sw.closed}
          onValueChange={(val) => onToggle(sw.id, val)}
          disabled={disabled}
          trackColor={{ false: COLORS.bad + '55', true: COLORS.good + '55' }}
          thumbColor={sw.closed ? COLORS.good : COLORS.bad}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 10,
  },
  indicator: {
    width: 6,
    height: 36,
    borderRadius: 3,
    flexShrink: 0,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  meta: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
    gap: 2,
  },
  stateText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
