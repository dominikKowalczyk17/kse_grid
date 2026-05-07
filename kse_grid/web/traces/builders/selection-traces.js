/**
 * Placeholdery podświetlenia selekcji: dwa puste markery (zewnętrzny + wewnętrzny krzyż),
 * dorzucane na końcu listy traces, żeby były rysowane na wierzchu.
 */

import {
    SELECTION_INNER_SIZE,
    SELECTION_OUTER_SIZE,
    SELECTION_TRACE_KIND,
} from '/traces/constants.js';

export function buildSelectionTraces(ctx) {
    const { keys, palette } = ctx;
    const traces = [];
    const meta = [];

    // 1) zewnętrzny krzyż w kolorze chłodnego akcentu
    traces.push({
        type: keys.traceType, [keys.x]: [], [keys.y]: [], mode: 'markers',
        marker: {
            size: SELECTION_OUTER_SIZE,
            color: palette.selectionOuter,
            symbol: 'cross',
        },
        hoverinfo: 'skip',
        showlegend: false,
    });
    meta.push({ kind: SELECTION_TRACE_KIND, voltage: 0, ids: [] });

    // 2) wewnętrzny krzyż akcentowy
    traces.push({
        type: keys.traceType, [keys.x]: [], [keys.y]: [], mode: 'markers',
        marker: {
            size: SELECTION_INNER_SIZE,
            color: palette.selectionInner,
            symbol: 'x',
        },
        hoverinfo: 'skip',
        showlegend: false,
    });
    meta.push({ kind: SELECTION_TRACE_KIND, voltage: 0, ids: [] });

    return { traces, meta };
}
