import { VOLTAGE_OK_MIN, VOLTAGE_OK_MAX, VOLTAGE_WARN_MIN, VOLTAGE_WARN_MAX } from '/lib/thresholds.js';

export function voltageColorVar (kv) {
    if (kv >= 380) return 'var(--grid-400)';
    if (kv >= 200) return 'var(--grid-220)';
    if (kv >= 100) return 'var(--grid-110)';
    return 'var(--grid-mv)';
}

export function voltageStatus (vmPu) {
    if (vmPu == null) return '';
    if (vmPu >= VOLTAGE_OK_MIN && vmPu <= VOLTAGE_OK_MAX) return 'good';
    if (vmPu >= VOLTAGE_WARN_MIN && vmPu <= VOLTAGE_WARN_MAX) return 'warn';
    return 'bad';
}

export function formatMw (value) {
    if (value == null) return '—';
    const numeric = Number(value);
    return Math.abs(numeric) >= 1000 ? `${(numeric / 1000).toFixed(2)} GW` : `${numeric.toFixed(1)} MW`;
}
