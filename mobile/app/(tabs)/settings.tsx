import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSettings } from '@/context/SettingsContext';
import { useNetwork } from '@/context/NetworkContext';
import { COLORS } from '@/constants/colors';

const PRESETS = [
  { label: 'Localhost (domyślny)', url: 'http://127.0.0.1:8050' },
  { label: 'Localhost :8080', url: 'http://127.0.0.1:8080' },
  { label: '10.0.2.2 (Android emulator)', url: 'http://10.0.2.2:8050' },
];

export default function SettingsScreen() {
  const { serverUrl, setServerUrl } = useSettings();
  const { reload, network } = useNetwork();
  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    const url = inputUrl.trim();
    if (!url) {
      Alert.alert('Błąd', 'Adres URL serwera nie może być pusty.');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      Alert.alert('Błąd', 'Adres URL musi zaczynać się od http:// lub https://');
      return;
    }
    await setServerUrl(url);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    await reload();
  }

  function selectPreset(url: string) {
    setInputUrl(url);
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.sectionTitle}>Adres serwera KSE Grid</Text>
        <View style={styles.card}>
          <Text style={styles.label}>URL serwera FastAPI</Text>
          <TextInput
            style={styles.input}
            value={inputUrl}
            onChangeText={setInputUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="http://127.0.0.1:8050"
            placeholderTextColor={COLORS.textMuted}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Text style={styles.hint}>
            Wpisz adres IP i port serwera, na którym uruchomiony jest kse_grid (np. przez komendę{' '}
            <Text style={styles.code}>uv run python main.py</Text>).
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Szybki wybór</Text>
        <View style={styles.card}>
          {PRESETS.map((preset) => (
            <TouchableOpacity
              key={preset.url}
              style={[styles.presetRow, inputUrl === preset.url && styles.presetRowActive]}
              onPress={() => selectPreset(preset.url)}
            >
              <View style={styles.presetInfo}>
                <Text style={styles.presetLabel}>{preset.label}</Text>
                <Text style={styles.presetUrl}>{preset.url}</Text>
              </View>
              {inputUrl === preset.url && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saved && styles.saveBtnSuccess]}
          onPress={handleSave}
        >
          <Text style={styles.saveBtnText}>
            {saved ? '✓ Zapisano i połączono' : 'Zapisz i połącz'}
          </Text>
        </TouchableOpacity>

        {network && (
          <>
            <Text style={styles.sectionTitle}>Aktywna sieć</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Nazwa</Text>
                <Text style={styles.infoValue}>{network.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Szyny</Text>
                <Text style={styles.infoValue}>{network.stats.nBus}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Linie</Text>
                <Text style={styles.infoValue}>{network.stats.nLine}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Serwer</Text>
                <Text style={styles.infoValue} numberOfLines={1}>{serverUrl}</Text>
              </View>
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Informacje</Text>
        <View style={styles.card}>
          <Text style={styles.about}>
            KSE Grid Mobile to mobilna aplikacja będąca rozszerzeniem narzędzia kse_grid do analizy
            sieci elektroenergetycznych. Łączy się z lokalnie uruchomionym serwerem FastAPI i
            umożliwia:
            {'\n\n'}• Przeglądanie wyników rozpływu mocy{'\n'}
            • Filtrowanie węzłów wg poziomu napięcia{'\n'}
            • Filtrowanie linii i trafo wg obciążenia{'\n'}
            • Sterowanie łącznikami (otwieranie/zamykanie){'\n'}
            • Przeglądanie danych w trybie offline (z pamięci podręcznej)
          </Text>
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
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 8,
  },
  card: {
    marginHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    padding: 14,
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  input: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    fontFamily: 'monospace',
  },
  hint: {
    fontSize: 12,
    color: COLORS.textMuted,
    lineHeight: 18,
  },
  code: {
    fontFamily: 'monospace',
    color: COLORS.accentLight,
  },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  presetRowActive: {
    backgroundColor: COLORS.accent + '11',
  },
  presetInfo: {
    flex: 1,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
  },
  presetUrl: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  checkmark: {
    fontSize: 16,
    color: COLORS.good,
    fontWeight: '700',
  },
  saveBtn: {
    marginHorizontal: 12,
    marginTop: 16,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnSuccess: {
    backgroundColor: COLORS.good,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    maxWidth: '60%',
  },
  about: {
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 20,
  },
});
