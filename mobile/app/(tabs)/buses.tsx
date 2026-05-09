import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetwork } from '@/context/NetworkContext';
import { VoltageFilterBar } from '@/components/VoltageFilterBar';
import { BusItem } from '@/components/BusItem';
import { LoadingOverlay, ErrorBanner, OfflineBanner } from '@/components/Feedback';
import { voltageStatus } from '@/utils/formatters';
import { COLORS } from '@/constants/colors';
import type { BusResult } from '@/types/network';

type FilterStatus = 'all' | 'good' | 'warn' | 'bad';

export default function BusesScreen() {
  const { network, isLoading, isOffline, error, reload } = useNetwork();
  const [selectedVoltages, setSelectedVoltages] = useState<number[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');

  if (isLoading && !network) return <LoadingOverlay />;
  if (error && !network) return <ErrorBanner message={error} onRetry={reload} />;

  const net = network!;
  const activeVoltages = selectedVoltages ?? net.defaultVoltageFilter;

  const filtered = useMemo(() => {
    const voltSet = new Set(activeVoltages);
    const query = search.trim().toLowerCase();

    return net.buses.filter((bus: BusResult) => {
      if (!voltSet.has(bus.vn_kv)) return false;
      if (query && !bus.name.toLowerCase().includes(query) && !String(bus.id).startsWith(query)) {
        return false;
      }
      if (statusFilter !== 'all') {
        const st = voltageStatus(bus.vmPu);
        if (st !== statusFilter) return false;
      }
      return true;
    });
  }, [net.buses, activeVoltages, search, statusFilter]);

  const statusFilters: { key: FilterStatus; label: string; color: string }[] = [
    { key: 'all', label: 'Wszystkie', color: COLORS.textMuted },
    { key: 'good', label: 'OK', color: COLORS.good },
    { key: 'warn', label: 'Ostrzeżenie', color: COLORS.warn },
    { key: 'bad', label: 'Przekroczenie', color: COLORS.bad },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isOffline && <OfflineBanner />}

      <VoltageFilterBar
        voltageLevels={net.voltageLevels}
        selectedVoltages={activeVoltages}
        defaultVoltageFilter={net.defaultVoltageFilter}
        onChange={setSelectedVoltages}
      />

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Szukaj szyny (nazwa lub ID)…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
      </View>

      {net.hasResults && (
        <View style={styles.statusRow}>
          {statusFilters.map((f) => (
            <Text
              key={f.key}
              style={[
                styles.statusChip,
                { color: f.color, borderColor: f.color },
                statusFilter === f.key && { backgroundColor: f.color + '22' },
              ]}
              onPress={() => setStatusFilter(f.key)}
            >
              {f.label}
            </Text>
          ))}
        </View>
      )}

      <Text style={styles.count}>
        {filtered.length} / {net.buses.length} szyn
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <BusItem bus={item} />}
        getItemLayout={(_, index) => ({ length: 57, offset: 57 * index, index })}
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        ListEmptyComponent={
          <Text style={styles.empty}>Brak szyn spełniających kryteria.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  searchRow: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusChip: {
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  count: {
    fontSize: 11,
    color: COLORS.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 4,
    backgroundColor: COLORS.background,
  },
  empty: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
});
