import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';
import { StatusDot } from './StatusDot';
import { formatLoading, formatMw } from '@/utils/formatters';
import type { LineResult, TrafoResult } from '@/types/network';

type LineOrTrafo =
  | (LineResult & { kind: 'line' })
  | (TrafoResult & { kind: 'trafo' });

interface LineItemProps {
  element: LineOrTrafo;
}

export function LineItem({ element }: LineItemProps) {
  const isTrafo = element.kind === 'trafo';
  const labelColor = isTrafo ? COLORS.grid220 : COLORS.grid110;
  const typeLabel = isTrafo ? 'TRAFO' : 'LINIA';
  const powerValue = isTrafo
    ? (element as TrafoResult).pHvMw
    : (element as LineResult).pFromMw;

  return (
    <View style={styles.row}>
      <View style={[styles.typeBadge, { borderColor: labelColor }]}>
        <Text style={[styles.typeText, { color: labelColor }]}>{typeLabel}</Text>
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {element.name || `#${element.id}`}
        </Text>
        <Text style={styles.power}>{formatMw(powerValue)}</Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.loading}>{formatLoading(element.loading)}</Text>
        <StatusDot mode="loading" value={element.loading} size={10} />
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
  typeBadge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 50,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  power: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  loading: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
});
