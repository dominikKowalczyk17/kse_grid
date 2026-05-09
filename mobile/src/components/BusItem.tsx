import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';
import { StatusDot } from './StatusDot';
import { formatVmPu, voltageColorHex } from '@/utils/formatters';
import type { BusResult } from '@/types/network';

interface BusItemProps {
  bus: BusResult;
}

export function BusItem({ bus }: BusItemProps) {
  const kvColor = voltageColorHex(bus.vn_kv);
  return (
    <View style={styles.row}>
      <View style={[styles.kvBadge, { borderColor: kvColor }]}>
        <Text style={[styles.kvText, { color: kvColor }]}>{bus.vn_kv} kV</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {bus.name || `Bus #${bus.id}`}
        </Text>
        <Text style={styles.vmpu}>{formatVmPu(bus.vmPu)}</Text>
      </View>
      <StatusDot mode="voltage" value={bus.vmPu} size={10} />
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
  kvBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 56,
    alignItems: 'center',
  },
  kvText: {
    fontSize: 11,
    fontWeight: '600',
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  vmpu: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
