/**
 * Skalowanie wizualne (kolor, grubość, rozmiar markera) oparte o wielkości elektryczne.
 */

import { BUS_BINS, BUS_DEFAULT_COLOR } from '/traces/constants.js';

/**
 * Kolor markera busa wg modułu napięcia w p.u.
 * @param {number} vmPu
 * @returns {string}
 */
export function busColor(vmPu) {
    for (const bin of BUS_BINS) if (bin.test(vmPu)) return bin.color;
    return BUS_DEFAULT_COLOR;
}

/**
 * Grubość linii proporcjonalna do poziomu napięcia [kV].
 * @param {number} voltage
 * @returns {number}
 */
export function lineWidth(voltage) {
    if (voltage >= 400) return 3.6;
    if (voltage >= 220) return 2.6;
    if (voltage >= 110) return 1.7;
    return 1.2;
}

/**
 * Rozmiar markera busa proporcjonalny do poziomu napięcia [kV].
 * @param {number} voltage
 * @returns {number}
 */
export function busSize(voltage) {
    if (voltage >= 400) return 14;
    if (voltage >= 220) return 12;
    if (voltage >= 110) return 10;
    return 8;
}
