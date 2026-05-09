import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { COLORS } from '@/constants/colors';
import { TabBarIcon } from '@/components/TabBarIcon';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
        },
        headerStyle: { backgroundColor: COLORS.background },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Sieć',
          tabBarIcon: ({ color }) => <TabBarIcon name="grid" color={color} />,
          headerTitle: 'KSE Grid – Przegląd sieci',
        }}
      />
      <Tabs.Screen
        name="buses"
        options={{
          title: 'Szyny',
          tabBarIcon: ({ color }) => <TabBarIcon name="zap" color={color} />,
          headerTitle: 'Szyny (węzły)',
        }}
      />
      <Tabs.Screen
        name="lines"
        options={{
          title: 'Linie',
          tabBarIcon: ({ color }) => <TabBarIcon name="activity" color={color} />,
          headerTitle: 'Linie i transformatory',
        }}
      />
      <Tabs.Screen
        name="switches"
        options={{
          title: 'Łączniki',
          tabBarIcon: ({ color }) => <TabBarIcon name="toggle-left" color={color} />,
          headerTitle: 'Sterowanie łącznikami',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ustawienia',
          tabBarIcon: ({ color }) => <TabBarIcon name="settings" color={color} />,
          headerTitle: 'Ustawienia',
        }}
      />
    </Tabs>
  );
}
