/**
 * Paleta kolorów zależna od motywu (dark/light) używana przez wszystkie buildery traces.
 */

import { TRAFO_BINS } from '/traces/constants.js';

const TRAFO_BINS_LIGHT = [
    { label: '0-60%',     lower: 0,   upper: 60,       color: '#1565C0' },
    { label: '60-100%',   lower: 60,  upper: 100,      color: '#00695C' },
    { label: '100-150%',  lower: 100, upper: 150,      color: '#B26A00' },
    { label: '>150%',     lower: 150, upper: Infinity, color: '#B71C1C' },
];

/**
 * Zwraca paletę kolorów dopasowaną do motywu UI.
 * @param {'dark'|'light'} [theme]
 * @returns {{
 *   trafoBins: Array<{label:string, lower:number, upper:number, color:string}>,
 *   switchFill: string, switchStroke: string,
 *   busNoResults: string, busStroke: string,
 *   selectionOuter: string, selectionInner: string,
 * }}
 */
export function tracePalette(theme = 'dark') {
    const isLight = theme === 'light';
    return {
        trafoBins: isLight ? TRAFO_BINS_LIGHT : TRAFO_BINS,
        switchFill: isLight ? '#0EA5E9' : '#38BDF8',
        switchStroke: isLight ? '#0C4A6E' : '#0C4A6E',
        busNoResults: isLight ? '#64748B' : '#5b6472',
        busStroke: isLight ? '#F8FAFC' : '#0e1116',
        selectionOuter: isLight ? '#2563EB' : '#8fc7ea',
        selectionInner: isLight ? '#1D4ED8' : '#4ea1ff',
    };
}
