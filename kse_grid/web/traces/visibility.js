/**
 * Predykaty widoczności gałęzi i zbieranie identyfikatorów rozłączonych przez switche.
 */

import { loadingValue } from '/traces/formatters.js';

/**
 * Identyfikatory linii i trafosów z otwartym switchem (rysujemy je przerywaną linią).
 * @param {Array} switches
 * @returns {{line: Set<string|number>, trafo: Set<string|number>}}
 */
export function disconnectedBranchIds(switches = []) {
    const disconnected = {
        line: new Set(),
        trafo: new Set(),
    };
    for (const sw of switches) {
        if ((sw.parentKind === 'line' || sw.parentKind === 'trafo') && sw.closed === false) {
            disconnected[sw.parentKind].add(sw.elementId);
        }
    }
    return disconnected;
}

export function lineVisible(line, voltageSet, minLineLoading, branchPasses) {
    return voltageSet.has(line.voltage)
        && loadingValue(line.loading) >= minLineLoading
        && branchPasses(line);
}

export function trafoVisible(trafo, voltageSet, minLineLoading, branchPasses) {
    return voltageSet.has(trafo.vnHvKv)
        && voltageSet.has(trafo.vnLvKv)
        && loadingValue(trafo.loading) >= minLineLoading
        && branchPasses(trafo);
}
