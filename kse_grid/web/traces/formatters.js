/**
 * Czyste helpery formatujące wartości liczbowe w hover-tekstach.
 */

/**
 * Formatuje wartość do napisu z `digits` miejscami po przecinku, lub "—" jeśli brak danych.
 * @param {*} value
 * @param {number} [digits]
 * @returns {string}
 */
export function fmt(value, digits = 1) {
    if (value === null || value === undefined) return '—';
    const num = Number(value);
    return Number.isFinite(num) ? num.toFixed(digits) : '—';
}

/**
 * Bezpieczny rzut wartości obciążenia (procent) do liczby; nie-liczby traktujemy jako 0.
 * @param {*} value
 * @returns {number}
 */
export function loadingValue(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}
