/** Kolory aplikacji KSE Grid Mobile — dopasowane do palety web. */
export const COLORS = {
  background: '#0a0f1e',
  surface: '#111827',
  surfaceElevated: '#1a2232',
  border: '#1e2d3d',
  borderLight: '#2a3f57',

  text: '#e2e8f0',
  textMuted: '#64748b',
  textFaint: '#334155',

  accent: '#3b82f6',
  accentLight: '#60a5fa',

  good: '#22c55e',
  warn: '#f59e0b',
  bad: '#ef4444',

  /** Kolory poziomów napięcia — odpowiadają --grid-* z style.css */
  grid400: '#e040fb',
  grid220: '#f06292',
  grid110: '#4dd0e1',
  gridMv: '#aed581',
} as const;

export type ColorKey = keyof typeof COLORS;
