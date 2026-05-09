import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { COLORS } from '@/constants/colors';
import { voltageColorHex } from '@/utils/formatters';

interface VoltageFilterBarProps {
  voltageLevels: number[];
  selectedVoltages: number[];
  defaultVoltageFilter: number[];
  onChange: (selected: number[]) => void;
}

export function VoltageFilterBar({
  voltageLevels,
  selectedVoltages,
  defaultVoltageFilter,
  onChange,
}: VoltageFilterBarProps) {
  const selectedSet = new Set(selectedVoltages);

  function toggleLevel(kv: number) {
    const next = selectedSet.has(kv)
      ? selectedVoltages.filter((v) => v !== kv)
      : [...selectedVoltages, kv];
    onChange(next);
  }

  function selectAll() {
    onChange([...voltageLevels]);
  }

  function selectCore() {
    onChange([...defaultVoltageFilter]);
  }

  function selectMedium() {
    onChange(voltageLevels.filter((v) => v <= 110));
  }

  const isCore =
    selectedSet.size === defaultVoltageFilter.length &&
    defaultVoltageFilter.every((v) => selectedSet.has(v));
  const isAll = selectedSet.size === voltageLevels.length;

  return (
    <View style={styles.container}>
      <View style={styles.presets}>
        <TouchableOpacity
          style={[styles.preset, isCore && styles.presetActive]}
          onPress={selectCore}
        >
          <Text style={[styles.presetText, isCore && styles.presetTextActive]}>
            KSE Core
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.preset, isAll && styles.presetActive]}
          onPress={selectAll}
        >
          <Text style={[styles.presetText, isAll && styles.presetTextActive]}>
            Wszystkie
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.preset} onPress={selectMedium}>
          <Text style={styles.presetText}>SN i niżej</Text>
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.levels}>
        {voltageLevels.map((kv) => {
          const active = selectedSet.has(kv);
          const color = voltageColorHex(kv);
          return (
            <TouchableOpacity
              key={kv}
              style={[
                styles.chip,
                { borderColor: color },
                active && { backgroundColor: color + '33' },
              ]}
              onPress={() => toggleLevel(kv)}
            >
              <Text style={[styles.chipText, { color: active ? color : COLORS.textMuted }]}>
                {kv} kV
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  presets: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  preset: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  presetActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '22',
  },
  presetText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  presetTextActive: {
    color: COLORS.accent,
  },
  levels: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 6,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
