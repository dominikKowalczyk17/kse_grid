/**
 * Geometria pozycji elementów sieci na płaszczyźnie graph/geo:
 * wybór pól współrzędnych, środki/offsety markerów oraz okręgi symbolu trafa.
 */

import {
    GEOMETRY_EPSILON,
    SWITCH_MAX_OFFSET_GEO,
    SWITCH_MAX_OFFSET_GRAPH,
    SWITCH_MIN_OFFSET_GEO,
    SWITCH_MIN_OFFSET_GRAPH,
    SWITCH_OFFSET_LENGTH_FACTOR,
    TRAFO_SHAPE_LINE_WIDTH,
    TRAFO_SHAPE_SEPARATION_FACTOR,
    TRAFO_SYMBOL_MAX_LENGTH_FRACTION,
    TRAFO_SYMBOL_OFFSET_GEO,
    TRAFO_SYMBOL_OFFSET_GRAPH,
} from '/traces/constants.js';

export function isGeoMode(viewMode) {
    return viewMode === 'geo';
}

/**
 * Mapuje tryb widoku na nazwy pól współrzędnych w obiekcie busa oraz typ trace Plotly.
 * @param {string} viewMode
 * @returns {{x:string, y:string, traceType:string}}
 */
export function pointKeys(viewMode) {
    return isGeoMode(viewMode) ? { x: 'lon', y: 'lat', traceType: 'scattermapbox' }
                               : { x: 'x', y: 'y', traceType: 'scattergl' };
}

/**
 * Zwraca {x, y} dla busa w aktywnym trybie widoku, lub null jeśli brak współrzędnych.
 */
export function busCoords(bus, viewMode) {
    const keys = pointKeys(viewMode);
    const x = bus[keys.x];
    const y = bus[keys.y];
    return x == null || y == null ? null : { x, y };
}

/**
 * Zwraca pozycje dwóch cewek symbolu trafa rozmieszczonych wzdłuż odcinka from–to.
 */
export function trafoSymbolCoords(from, to, viewMode) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);

    // Offset jest dobrany tak, żeby przy domyślnym zoomie dwa kółka
    // mocno się zachodziły, tworząc jeden zwarty symbol IEC 60417-5156.
    // Wartość = ~30% promienia markera w danych (size=18 → r≈9px, separacja środków ≈ 6px).
    const baseOffset = isGeoMode(viewMode) ? TRAFO_SYMBOL_OFFSET_GEO : TRAFO_SYMBOL_OFFSET_GRAPH;

    let tx, ty;
    if (length < GEOMETRY_EPSILON) {
        tx = 0;
        ty = 1;
    } else {
        tx = dx / length;
        ty = dy / length;
    }
    const offset = length < GEOMETRY_EPSILON
        ? baseOffset
        : Math.min(baseOffset, length * TRAFO_SYMBOL_MAX_LENGTH_FRACTION);
    return {
        coilA: { x: midX - tx * offset, y: midY - ty * offset },
        coilB: { x: midX + tx * offset, y: midY + ty * offset },
    };
}

/**
 * Buduje parę okręgów (layout.shapes) reprezentujących symbol trafa
 * pomiędzy busami `from` i `to`.
 */
export function trafoShapeCircles(from, to, color, radius) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    let tx, ty;
    if (len < GEOMETRY_EPSILON) {
        tx = 0;
        ty = 1;
    } else {
        tx = dx / len;
        ty = dy / len;
    }
    const sep = radius * TRAFO_SHAPE_SEPARATION_FACTOR;
    const cAx = mx - tx * sep;
    const cAy = my - ty * sep;
    const cBx = mx + tx * sep;
    const cBy = my + ty * sep;
    const lineSpec = { color, width: TRAFO_SHAPE_LINE_WIDTH };
    return [
        {
            type: 'circle', xref: 'x', yref: 'y',
            x0: cAx - radius, x1: cAx + radius,
            y0: cAy - radius, y1: cAy + radius,
            line: lineSpec,
            fillcolor: 'rgba(0,0,0,0)',
            layer: 'above',
        },
        {
            type: 'circle', xref: 'x', yref: 'y',
            x0: cBx - radius, x1: cBx + radius,
            y0: cBy - radius, y1: cBy + radius,
            line: lineSpec,
            fillcolor: 'rgba(0,0,0,0)',
            layer: 'above',
        },
    ];
}

/**
 * Pozycja markera switcha „przy busie” – mały offset wzdłuż odcinka do drugiego końca.
 */
export function switchMarkerCoords(sw, busById, viewMode) {
    const bus = busById[sw.busId];
    if (!bus) return null;

    const from = busCoords(bus, viewMode);
    if (!from) return null;

    const remoteBus = sw.remoteBusId == null ? null : busById[sw.remoteBusId];
    const to = remoteBus ? busCoords(remoteBus, viewMode) : null;
    if (!to) return from;

    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < GEOMETRY_EPSILON) return from;

    const ux = dx / length;
    const uy = dy / length;
    // Switch ma być czytelnie "przy busie", a nie w połowie gałęzi.
    // Trzymamy więc mały offset zależny od długości odcinka, ale z ciasnymi
    // ograniczeniami min/max, żeby marker nadal był łatwy do kliknięcia.
    const minOffset = isGeoMode(viewMode) ? SWITCH_MIN_OFFSET_GEO : SWITCH_MIN_OFFSET_GRAPH;
    const maxOffset = isGeoMode(viewMode) ? SWITCH_MAX_OFFSET_GEO : SWITCH_MAX_OFFSET_GRAPH;
    const offset = Math.min(Math.max(length * SWITCH_OFFSET_LENGTH_FACTOR, minOffset), maxOffset);
    return { x: from.x + ux * offset, y: from.y + uy * offset };
}

/**
 * Maksymalna |moc| (load lub generacja) busa – używana do filtru widoczności.
 */
export function busPower(bus) {
    const load = Math.abs(bus.loadMw ?? 0);
    const gen = Math.abs(bus.genMw ?? 0);
    return Math.max(load, gen);
}
