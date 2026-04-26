export const HISTOGRAM_BIN_WIDTH = 0.01;
export const HISTOGRAM_MIN = 0.85;
export const HISTOGRAM_MAX = 1.15;

export function voltageColorVar (kv) {
    if (kv >= 380) return 'var(--grid-400)';
    if (kv >= 200) return 'var(--grid-220)';
    if (kv >= 100) return 'var(--grid-110)';
    return 'var(--grid-mv)';
}

export function voltageStatus (vmPu) {
    if (vmPu == null) return '';
    if (vmPu >= 0.95 && vmPu <= 1.05) return 'good';
    if (vmPu >= 0.9 && vmPu <= 1.1) return 'warn';
    return 'bad';
}

export function formatMw (value) {
    if (value == null) return '—';
    const numeric = Number(value);
    return Math.abs(numeric) >= 1000 ? `${(numeric / 1000).toFixed(2)} GW` : `${numeric.toFixed(1)} MW`;
}
