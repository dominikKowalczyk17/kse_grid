import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetwork } from '@/context/NetworkContext';
import { LineItem } from '@/components/LineItem';
import { LoadingOverlay, ErrorBanner, OfflineBanner } from '@/components/Feedback';
import { loadingStatus } from '@/utils/formatters';
import { COLORS } from '@/constants/colors';
import type { LineResult, TrafoResult } from '@/types/network';

type ElementKind = 'all' | 'line' | 'trafo';
type LoadStatus = 'all' | 'good' | 'warn' | 'bad';

const MIN_LOADING_STEPS = [0, 50, 75, 100];

export default function LinesScreen() {
  const { network, isLoading, isOffline, error, reload } = useNetwork();
  const [kindFilter, setKindFilter] = useState<ElementKind>('all');
  const [statusFilter, setStatusFilter] = useState<LoadStatus>('all');
  const [minLoading, setMinLoading] = useState(0);

  if (isLoading && !network) return <LoadingOverlay />;
  if (error && !network) return <ErrorBanner message={error} onRetry={reload} />;

  const net = network!;

  type MixedElement =
    | (LineResult & { kind: 'line' })
    | (TrafoResult & { kind: 'trafo' });

  const allElements = useMemo<MixedElement[]>(() => {
    const lines = net.lines.map((l: LineResult) => ({ ...l, kind: 'line' as const }));
    const trafos = net.trafos.map((t: TrafoResult) => ({ ...t, kind: 'trafo' as const }));
    return [...lines, ...trafos].sort((a, b) => b.loading - a.loading);
  }, [net.lines, net.trafos]);

  const filtered = useMemo(() => {
    return allElements.filter((el) => {
      if (kindFilter !== 'all' && el.kind !== kindFilter) return false;
      if (el.loading < minLoading) return false;
      if (statusFilter !== 'all') {
        const st = loadingStatus(el.loading);
        if (st !== statusFilter) return false;
      }
      return true;
    });
  }, [allElements, kindFilter, statusFilter, minLoading]);

  const kindButtons: { key: ElementKind; label: string }[] = [
    { key: 'all', label: 'Wszystkie' },
    { key: 'line', label: 'Linie' },
    { key: 'trafo', label: 'Trafo' },
  ];

  const statusButtons: { key: LoadStatus; label: string; color: string }[] = [
    { key: 'all', label: 'Wszystkie', color: COLORS.textMuted },
    { key: 'good', label: 'OK', color: COLORS.good },
    { key: 'warn', label: 'Przeciążone', color: COLORS.warn },
    { key: 'bad', label: 'Krytyczne', color: COLORS.bad },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isOffline && <OfflineBanner />}

      {/* Filtr rodzaju elementu */}
      <View style={styles.filterRow}>
        {kindButtons.map((b) => (
          <TouchableOpacity
            key={b.key}
            style={[styles.filterChip, kindFilter === b.key && styles.filterChipActive]}
            onPress={() => setKindFilter(b.key)}
          >
            <Text style={[styles.filterChipText, kindFilter === b.key && styles.filterChipTextActive]}>
              {b.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Filtr statusu obciążenia */}
      {net.hasResults && (
        <View style={styles.filterRow}>
          {statusButtons.map((b) => (
            <TouchableOpacity
              key={b.key}
              style={[
                styles.filterChip,
                { borderColor: b.color },
                statusFilter === b.key && { backgroundColor: b.color + '22' },
              ]}
              onPress={() => setStatusFilter(b.key)}
            >
              <Text style={[styles.filterChipText, { color: statusFilter === b.key ? b.color : COLORS.textMuted }]}>
                {b.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Filtr minimalnego obciążenia */}
      {net.hasResults && (
        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Min. obciążenie:</Text>
          {MIN_LOADING_STEPS.map((step) => (
            <TouchableOpacity
              key={step}
              style={[styles.filterChip, minLoading === step && styles.filterChipActive]}
              onPress={() => setMinLoading(step)}
            >
              <Text style={[styles.filterChipText, minLoading === step && styles.filterChipTextActive]}>
                {step}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.count}>
        {filtered.length} / {allElements.length} elementów
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        renderItem={({ item }) => <LineItem element={item} />}
        getItemLayout={(_, index) => ({ length: 57, offset: 57 * index, index })}
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        ListEmptyComponent={
          <Text style={styles.empty}>Brak elementów spełniających kryteria.</Text>
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
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  filterLabel: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent + '22',
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  filterChipTextActive: {
    color: COLORS.accent,
  },
  count: {
    fontSize: 11,
    color: COLORS.textMuted,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  empty: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 40,
  },
});
