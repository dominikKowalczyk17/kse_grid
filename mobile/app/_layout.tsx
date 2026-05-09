import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from '@/context/SettingsContext';
import { NetworkProvider } from '@/context/NetworkContext';

export default function RootLayout() {
  return (
    <SettingsProvider>
      <NetworkProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <StatusBar style="light" />
      </NetworkProvider>
    </SettingsProvider>
  );
}
