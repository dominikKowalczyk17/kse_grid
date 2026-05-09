import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetwork } from '@/context/NetworkContext';
import { SwitchItem } from '@/components/SwitchItem';
import { LoadingOverlay, ErrorBanner, OfflineBanner } from '@/components/Feedback';
import { COLORS } from '@/constants/colors';
import type { SwitchState } from '@/types/network';

type ShowFilter = 'all' | 'open' | 'closed';

export default function SwitchesScreen() {
  const {
    network,
    isLoading,
    isOffline,
    error,
    topologyBusy,
    topologyError,
    reload,
    handleSetSwitch,
    handleResetTopology,
  } = useNetwork();

  const [search, setSearch] = useState('');
  const [showFilter, setShowFilter] = useState<ShowFilter>('all');

  if (isLoading && !network) return <LoadingOverlay />;
  if (error && !network) return <ErrorBanner message={error} onRetry={reload} />;

  const net = network!;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return net.switches.filter((sw: SwitchState) => {
      if (showFilter === 'open' && sw.closed) return false;
      if (showFilter === 'closed' && !sw.closed) return false;
      if (query && !sw.name.toLowerCase().includes(query) && !String(sw.id).startsWith(query)) {
        return false;
      }
      return true;
    });
  }, [net.switches, search, showFilter]);

  const openCount = net.switches.filter((sw: SwitchState) => !sw.closed).length;
  const closedCount = net.switches.length - openCount;

  function confirmReset() {
    Alert.alert(
      'Reset topologii',
      'Czy na pewno chcesz przywrócić wszystkie łączniki do stanu bazowego i przeliczyć nowy rozpływ?',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Resetuj', style: 'destructive', onPress: handleResetTopology },
      ],
    );
  }

  const showFilters: { key: ShowFilter; label: string }[] = [
    { key: 'all', label: `Wszystkie (${net.switches.length})` },
    { key: 'open', label: `Otwarte (${openCount})` },
    { key: 'closed', label: `Zamknięte (${closedCount})` },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isOffline && <OfflineBanner />}
      {topologyError ? <ErrorBanner message={topologyError} /> : null}

      <View style={styles.topBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Szukaj łącznika…"
          placeholderTextColor={COLORS.textMuted}
          value={search}
          onChangeText={setSearch}
          clearButtonMode="while-editing"
        />
        <TouchableOpacity
          style={[styles.resetBtn, topologyBusy && styles.btnDisabled]}
          onPress={confirmReset}
          disabled={topologyBusy}
        >
          <Text style={styles.resetBtnText}>
            {topologyBusy ? '↻' : '↺ Reset'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        {showFilters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, showFilter === f.key && styles.filterChipActive]}
            onPress={() => setShowFilter(f.key)}
          >
            <Text style={[styles.filterChipText, showFilter === f.key && styles.filterChipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.count}>
        {filtered.length} / {net.switches.length} łączników
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <SwitchItem
            sw={item}
            onToggle={handleSetSwitch}
            disabled={topologyBusy}
          />
        )}
        getItemLayout={(_, index) => ({ length: 64, offset: 64 * index, index })}
        initialNumToRender={20}
        maxToRenderPerBatch={30}
        ListEmptyComponent={
          <Text style={styles.empty}>Brak łączników spełniających kryteria.</Text>
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
  topBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetBtn: {
    backgroundColor: COLORS.bad,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  resetBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
    fontWeight: '600',
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
