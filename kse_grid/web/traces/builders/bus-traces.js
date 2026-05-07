/**
 * Builder traces dla busów: jeden marker scatter per poziom napięcia,
 * z kolorem zależnym od modułu napięcia w wynikach (lub neutralnym, gdy brak).
 */

import { BUS_MARKER_STROKE_WIDTH } from '/traces/constants.js';
import { busCoords } from '/traces/geometry.js';
import { busHover } from '/traces/hover.js';
import { busColor, busSize } from '/traces/styling.js';

export function buildBusTraces(ctx) {
    const { buses, keys, viewMode, voltageLevels, busPasses, hasResults, palette } = ctx;

    const traces = [];
    const meta = [];

    for (const level of voltageLevels) {
        const busesAtLevel = buses.filter(b =>
            b.vn_kv === level
            && busPasses(b)
            && busCoords(b, viewMode)
        );
        if (!busesAtLevel.length) continue;

        const xs = busesAtLevel.map(b => b[keys.x]);
        const ys = busesAtLevel.map(b => b[keys.y]);
        const colors = busesAtLevel.map(b => hasResults ? busColor(b.vmPu ?? 1.0) : palette.busNoResults);
        const hovers = busesAtLevel.map(b => busHover(b, hasResults));
        const ids = busesAtLevel.map(b => b.id);

        const marker = {
            size: busSize(level),
            color: colors,
            line: { color: palette.busStroke, width: BUS_MARKER_STROKE_WIDTH },
        };

        traces.push({
            type: keys.traceType, [keys.x]: xs, [keys.y]: ys, mode: 'markers',
            text: hovers,
            hovertemplate: '%{text}<extra></extra>',
            marker,
            showlegend: false,
        });
        meta.push({ kind: 'bus', voltage: level, ids });
    }

    return { traces, meta };
}
