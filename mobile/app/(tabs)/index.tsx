import React from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetwork } from '@/context/NetworkContext';
import { StatsCard } from '@/components/StatsCard';
import { DiagnosticRow } from '@/components/DiagnosticRow';
import { LoadingOverlay, ErrorBanner, OfflineBanner } from '@/components/Feedback';
import { formatMw } from '@/utils/formatters';
import { COLORS } from '@/constants/colors';

export default function NetworkScreen() {
  const {
    network,
    isLoading,
    isOffline,
    error,
    topologyBusy,
    topologyError,
    reload,
    handleResetTopology,
  } = useNetwork();

  if (isLoading && !network) return <LoadingOverlay />;
  if (error && !network) return <ErrorBanner message={error} onRetry={reload} />;

  const stats = network!.stats;
  const totals = network!.totals;
  const diag = network!.diagnostics;
  const topology = network!.topology;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {isOffline && <OfflineBanner />}
      {topologyError ? <ErrorBanner message={topologyError} /> : null}

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={reload}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* Nagłówek sieci */}
        <View style={styles.section}>
          <Text style={styles.networkName}>{network!.name}</Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: topology.lastRunSucceeded ? COLORS.good + '22' : COLORS.bad + '22' },
          ]}>
            <Text style={[
              styles.statusText,
              { color: topology.lastRunSucceeded ? COLORS.good : COLORS.bad },
            ]}>
              {topology.lastRunSucceeded ? '✓ Rozpływ OK' : '✕ Rozpływ nieudany'}
            </Text>
          </View>
          {topology.lastRunMessage && !topology.lastRunSucceeded && (
            <Text style={styles.statusMessage}>{topology.lastRunMessage}</Text>
          )}
        </View>

        {/* Statystyki elementów sieci */}
        <Text style={styles.sectionTitle}>Elementy sieci</Text>
        <View style={styles.statsGrid}>
          <StatsCard label="Szyny" value={stats.nBus} />
          <StatsCard label="Linie" value={stats.nLine} />
          <StatsCard label="Trafo" value={stats.nTrafo} />
          <StatsCard label="Generatory" value={stats.nGen} />
          <StatsCard label="Obciążenia" value={stats.nLoad} />
          <StatsCard label="Łączniki" value={stats.nSwitch} />
        </View>

        {/* Bilans mocy */}
        {network!.hasResults && (
          <>
            <Text style={styles.sectionTitle}>Bilans mocy</Text>
            <View style={styles.statsGrid}>
              <StatsCard label="Generacja" value={formatMw(totals.genMw)} accent={COLORS.good} />
              <StatsCard label="Obciążenie" value={formatMw(totals.loadMw)} accent={COLORS.warn} />
              <StatsCard label="Straty" value={formatMw(totals.lossMw)} accent={COLORS.bad} />
            </View>
          </>
        )}

        {/* Diagnostyka */}
        {network!.hasResults && (
          <>
            <Text style={styles.sectionTitle}>Diagnostyka</Text>
            <View style={styles.diagCard}>
              <DiagnosticRow
                label="Napięcia"
                ok={diag.voltage.ok}
                warn={diag.voltage.warn}
                bad={diag.voltage.bad}
                extra={diag.voltage.disconnected}
                extraLabel="⊗"
              />
              <DiagnosticRow
                label="Obciążenia"
                ok={diag.loading.ok}
                warn={diag.loading.warn}
                bad={diag.loading.bad}
              />
            </View>
          </>
        )}

        {/* Parametry rozpływu */}
        <Text style={styles.sectionTitle}>Parametry rozpływu</Text>
        <View style={styles.diagCard}>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Algorytm</Text>
            <Text style={styles.paramValue}>{topology.powerflowOptions.algorithm.toUpperCase()}</Text>
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Max iteracje</Text>
            <Text style={styles.paramValue}>{topology.powerflowOptions.max_iteration}</Text>
          </View>
          <View style={styles.paramRow}>
            <Text style={styles.paramLabel}>Tolerancja</Text>
            <Text style={styles.paramValue}>{topology.powerflowOptions.tolerance_mva} MVA</Text>
          </View>
        </View>

        {/* Akcje */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, topologyBusy && styles.buttonDisabled]}
            onPress={handleResetTopology}
            disabled={topologyBusy}
          >
            <Text style={styles.buttonText}>
              {topologyBusy ? '↻ Przeliczam…' : '↻ Reset topologii'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    paddingBottom: 32,
  },
  section: {
    padding: 16,
    alignItems: 'flex-start',
    gap: 8,
  },
  networkName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusMessage: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  diagCard: {
    marginHorizontal: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  paramLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  paramValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  actions: {
    padding: 16,
    gap: 10,
  },
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
