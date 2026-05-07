/**
 * Builder traces dla linii: jedna grupa (polyline + niewidoczne markery hovera)
 * na kombinację (poziom napięcia × bin obciążenia × stan połączenia).
 */

import {
    LINE_BINS,
    LINE_HOVER_MARKER_MIN_SIZE,
    LINE_HOVER_MARKER_OPACITY,
    LINE_HOVER_MARKER_WIDTH_FACTOR,
} from '/traces/constants.js';
import { loadingValue } from '/traces/formatters.js';
import { busCoords } from '/traces/geometry.js';
import { lineHover } from '/traces/hover.js';
import { lineWidth } from '/traces/styling.js';
import { lineVisible } from '/traces/visibility.js';

export function buildLineTraces(ctx) {
    const {
        lines, busById, keys, viewMode, voltageLevels, voltageSet,
        minLineLoading, branchPasses, disconnectedIds, hasResults,
    } = ctx;

    const traces = [];
    const meta = [];

    for (const level of voltageLevels) {
        const linesAtLevel = lines.filter(l =>
            l.voltage === level && lineVisible(l, voltageSet, minLineLoading, branchPasses)
        );
        for (const bin of LINE_BINS) {
            const inBin = linesAtLevel.filter(l =>
                loadingValue(l.loading) >= bin.lower && loadingValue(l.loading) < bin.upper
            );
            if (!inBin.length) continue;
            for (const disconnected of [false, true]) {
                const inState = inBin.filter(l => disconnectedIds.line.has(l.id) === disconnected);
                if (!inState.length) continue;

                const xs = [], ys = [], midX = [], midY = [], hovers = [], ids = [];
                for (const ln of inState) {
                    const f = busById[ln.fromBus], t = busById[ln.toBus];
                    const from = f ? busCoords(f, viewMode) : null;
                    const to = t ? busCoords(t, viewMode) : null;
                    if (!from || !to) continue;
                    xs.push(from.x, to.x, null);
                    ys.push(from.y, to.y, null);
                    midX.push((from.x + to.x) / 2);
                    midY.push((from.y + to.y) / 2);
                    hovers.push(lineHover({ ...ln }, hasResults));
                    ids.push(ln.id);
                }
                if (!ids.length) continue;

                traces.push({
                    type: keys.traceType, [keys.x]: xs, [keys.y]: ys, mode: 'lines',
                    line: { color: bin.color, width: lineWidth(level), dash: disconnected ? 'dot' : 'solid' },
                    hoverinfo: 'skip',
                    showlegend: false,
                });
                meta.push({ kind: 'line', voltage: level, ids: [] });

                traces.push({
                    type: keys.traceType, [keys.x]: midX, [keys.y]: midY, mode: 'markers',
                    marker: {
                        size: Math.max(lineWidth(level) * LINE_HOVER_MARKER_WIDTH_FACTOR, LINE_HOVER_MARKER_MIN_SIZE),
                        color: bin.color,
                        opacity: LINE_HOVER_MARKER_OPACITY,
                    },
                    text: hovers,
                    hovertemplate: '%{text}<extra></extra>',
                    showlegend: false,
                });
                meta.push({ kind: 'line', voltage: level, ids });
            }
        }
    }

    return { traces, meta };
}
