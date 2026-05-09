import React from 'react';
import { Text } from 'react-native';

// Minimal SVG-based icon set using Unicode characters and React Native Text.
// In production, replace with a proper icon library like @expo/vector-icons.
const ICONS: Record<string, string> = {
  grid: '⊞',
  zap: '⚡',
  activity: '~',
  'toggle-left': '⊙',
  settings: '⚙',
  'chevron-right': '›',
  'check-circle': '✓',
  'alert-triangle': '⚠',
  'x-circle': '✕',
  'refresh-cw': '↻',
  wifi: '◎',
  'wifi-off': '⊗',
  filter: '⊿',
  search: '⌕',
};

interface TabBarIconProps {
  name: string;
  color: string;
  size?: number;
}

export function TabBarIcon({ name, color, size = 22 }: TabBarIconProps) {
  return (
    <Text style={{ color, fontSize: size, fontWeight: '600' }}>
      {ICONS[name] ?? '●'}
    </Text>
  );
}
