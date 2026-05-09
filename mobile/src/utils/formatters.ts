/** Thresholds matching serializer.py and formatters.js */
export const VOLTAGE_OK_MIN = 0.95;
export const VOLTAGE_OK_MAX = 1.05;
export const VOLTAGE_WARN_MIN = 0.9;
export const VOLTAGE_WARN_MAX = 1.1;
export const OVERLOAD_WARN_PCT = 100.0;
export const OVERLOAD_BAD_PCT = 150.0;
export const CORE_VOLTAGE_KV = 220.0;

/** Formaty wartości MW/GW — odpowiednik formatMw() z formatters.js. */
export function formatMw(value: number | null | undefined): string {
  if (value == null) return '—';
  return Math.abs(value) >= 1000
    ? `${(value / 1000).toFixed(2)} GW`
    : `${value.toFixed(1)} MW`;
}

/** Status napięcia węzła — odpowiednik voltageStatus() z formatters.js. */
export function voltageStatus(vmPu: number | null): 'good' | 'warn' | 'bad' | '' {
  if (vmPu == null) return '';
  if (vmPu >= VOLTAGE_OK_MIN && vmPu <= VOLTAGE_OK_MAX) return 'good';
  if (vmPu >= VOLTAGE_WARN_MIN && vmPu <= VOLTAGE_WARN_MAX) return 'warn';
  return 'bad';
}

/** Status obciążenia linii/trafo. */
export function loadingStatus(loading: number): 'good' | 'warn' | 'bad' {
  if (loading >= OVERLOAD_BAD_PCT) return 'bad';
  if (loading >= OVERLOAD_WARN_PCT) return 'warn';
  return 'good';
}

/** Kolor poziomu napięcia — odpowiednik voltageColorVar() z formatters.js. */
export function voltageColorHex(kv: number): string {
  if (kv >= 380) return '#e040fb'; // --grid-400 purple
  if (kv >= 200) return '#f06292'; // --grid-220 pink/red
  if (kv >= 100) return '#4dd0e1'; // --grid-110 teal
  return '#aed581';               // --grid-mv green
}

/** Formatowanie procenta obciążenia. */
export function formatLoading(loading: number): string {
  return `${loading.toFixed(1)} %`;
}

/** Formatowanie napięcia p.u. */
export function formatVmPu(vmPu: number | null): string {
  if (vmPu == null) return '—';
  return vmPu.toFixed(4) + ' p.u.';
}
