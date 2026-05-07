/**
 * Builder traces dla transformatorów: grupowanie po napięciu LV i binie obciążenia.
 * W trybie graph dorzuca też okręgi symbolu IEC do `shapes`.
 */

import {
    FLOW_ARROW_MIN_MW,
    FLOW_ARROW_OUTLINE_WIDTH,
    FLOW_ARROW_SIZE_TRAFO,
    TRAFO_HOVER_MARKER_GEO_OPACITY,
    TRAFO_HOVER_MARKER_GEO_SIZE,
    TRAFO_HOVER_MARKER_SHAPES_SIZE,
    TRAFO_LINE_WIDTH,
} from '/traces/constants.js';
import { loadingValue } from '/traces/formatters.js';
import { busCoords, trafoShapeCircles } from '/traces/geometry.js';
import { trafoHover } from '/traces/hover.js';
import { trafoVisible } from '/traces/visibility.js';

export function buildTrafoTraces(ctx) {
    const {
        trafos, busById, keys, viewMode, voltageSet, minLineLoading, branchPasses,
        disconnectedIds, hasResults, palette, lvLevels, useShapes, trafoRadius,
    } = ctx;

    const traces = [];
    const meta = [];
    const shapes = [];

    for (const lv of lvLevels) {
        const atLv = trafos.filter(t =>
            t.vnLvKv === lv && trafoVisible(t, voltageSet, minLineLoading, branchPasses)
        );
        for (const bin of palette.trafoBins) {
            const inBin = atLv.filter(t =>
                loadingValue(t.loading) >= bin.lower && loadingValue(t.loading) < bin.upper
            );
            if (!inBin.length) continue;
            for (const disconnected of [false, true]) {
                const inState = inBin.filter(t => disconnectedIds.trafo.has(t.id) === disconnected);
                if (!inState.length) continue;

                const xs = [], ys = [], midX = [], midY = [], hovers = [], ids = [];
                const arrX = [], arrY = [], arrAngle = [];
                for (const tr of inState) {
                    const hv = busById[tr.hvBus], lvBus = busById[tr.lvBus];
                    const from = hv ? busCoords(hv, viewMode) : null;
                    const to = lvBus ? busCoords(lvBus, viewMode) : null;
                    if (!from || !to) continue;
                    xs.push(from.x, to.x, null);
                    ys.push(from.y, to.y, null);
                    const mx = (from.x + to.x) / 2;
                    const my = (from.y + to.y) / 2;
                    midX.push(mx);
                    midY.push(my);
                    hovers.push(trafoHover(tr, hasResults));
                    ids.push(tr.id);
                    if (useShapes) {
                        shapes.push(...trafoShapeCircles(from, to, bin.color, trafoRadius));
                    }
                    if (!disconnected && Number.isFinite(tr.pHvMw) && Math.abs(tr.pHvMw) >= FLOW_ARROW_MIN_MW) {
                        const sign = tr.pHvMw >= 0 ? 1 : -1;
                        const dx = (to.x - from.x) * sign;
                        const dy = (to.y - from.y) * sign;
                        if (dx !== 0 || dy !== 0) {
                            arrX.push(mx);
                            arrY.push(my);
                            arrAngle.push(Math.atan2(dx, dy) * 180 / Math.PI);
                        }
                    }
                }
                if (!ids.length) continue;

                traces.push({
                    type: keys.traceType, [keys.x]: xs, [keys.y]: ys, mode: 'lines',
                    line: { color: bin.color, width: TRAFO_LINE_WIDTH, dash: disconnected ? 'dot' : 'solid' },
                    hoverinfo: 'skip',
                    showlegend: false,
                });
                meta.push({ kind: 'trafo', voltage: lv, ids: [] });

                // pojedynczy punkt hovera/klikania nad symbolem IEC (jeden tooltip per trafo)
                // - w trybie graph: niewidoczny (symbol rysowany przez layout.shapes)
                // - w trybie geo: widoczny marker (mapbox nie wspiera shapes)
                const hoverMarker = useShapes
                    ? { size: TRAFO_HOVER_MARKER_SHAPES_SIZE, color: 'rgba(0,0,0,0)', line: { width: 0 } }
                    : { size: TRAFO_HOVER_MARKER_GEO_SIZE, color: bin.color, opacity: TRAFO_HOVER_MARKER_GEO_OPACITY, symbol: 'circle' };
                traces.push({
                    type: keys.traceType, [keys.x]: midX, [keys.y]: midY, mode: 'markers',
                    marker: hoverMarker,
                    text: hovers,
                    hovertemplate: '%{text}<extra></extra>',
                    showlegend: false,
                });
                meta.push({ kind: 'trafo', voltage: lv, ids });

                if (arrX.length && keys.traceType !== 'scattermapbox') {
                    traces.push({
                        type: 'scatter', [keys.x]: arrX, [keys.y]: arrY, mode: 'markers',
                        marker: {
                            symbol: 'triangle-up',
                            size: FLOW_ARROW_SIZE_TRAFO,
                            angle: arrAngle,
                            angleref: 'up',
                            color: bin.color,
                            line: { color: '#000000', width: FLOW_ARROW_OUTLINE_WIDTH },
                        },
                        hoverinfo: 'skip',
                        showlegend: false,
                    });
                    meta.push({ kind: 'flow-arrow', parentKind: 'trafo', voltage: lv, ids: [] });
                }
            }
        }
    }

    return { traces, meta, shapes };
}
