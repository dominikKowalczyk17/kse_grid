import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '@/constants/colors';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>⚠</Text>
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
      {onRetry && (
        <TouchableOpacity style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Ponów</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function LoadingOverlay({ label = 'Ładowanie…' }: { label?: string }) {
  return (
    <View style={styles.overlay}>
      <ActivityIndicator size="large" color={COLORS.accent} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export function OfflineBanner() {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineText}>⊗ Tryb offline – dane z pamięci podręcznej</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    margin: 16,
    padding: 16,
    backgroundColor: COLORS.bad + '22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.bad + '55',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  icon: {
    fontSize: 20,
    color: COLORS.bad,
  },
  message: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  retry: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.bad,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: COLORS.background,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  offlineBanner: {
    backgroundColor: COLORS.warn + '22',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.warn + '55',
    padding: 8,
    alignItems: 'center',
  },
  offlineText: {
    fontSize: 12,
    color: COLORS.warn,
  },
});
