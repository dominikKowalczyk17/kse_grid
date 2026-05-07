/**
 * Geometry helpers for the Pixi renderer.
 *
 * Pixi works in screen-like coordinates where Y grows downwards. The Plotly
 * graph data uses mathematical Y (up). We negate Y when projecting so that
 * the picture stays the same as in Plotly.
 */

import {
    GEOMETRY_EPSILON,
    SWITCH_MAX_OFFSET_GEO,
    SWITCH_MAX_OFFSET_GRAPH,
    SWITCH_MIN_OFFSET_GEO,
    SWITCH_MIN_OFFSET_GRAPH,
    SWITCH_OFFSET_LENGTH_FACTOR,
} from '/traces/constants.js';

export function isGeo (viewMode) {
    return viewMode === 'geo';
}

export function busPos (bus, viewMode, project) {
    if (!bus) return null;
    if (project) return project(bus);
    if (isGeo(viewMode)) {
        if (bus.lon == null || bus.lat == null) return null;
        return { x: bus.lon, y: -bus.lat };
    }
    if (bus.x == null || bus.y == null) return null;
    return { x: bus.x, y: -bus.y };
}

export function midpoint (a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function unitVector (a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len < GEOMETRY_EPSILON) return { x: 0, y: 0, len: 0 };
    return { x: dx / len, y: dy / len, len };
}

/**
 * Returns the polyline of a line element in *world* coordinates,
 * applying any waypointsGraph (in graph view only — geo view ignores them).
 *
 * @param {object} line
 * @param {object} fromBus
 * @param {object} toBus
 * @param {string} viewMode
 * @param {(bus:object)=>{x:number,y:number}} [project]
 * @returns {{x:number,y:number}[]|null}
 */
export function linePoints (line, fromBus, toBus, viewMode, project) {
    const from = busPos(fromBus, viewMode, project);
    const to = busPos(toBus, viewMode, project);
    if (!from || !to) return null;
    const wps = (!isGeo(viewMode) && Array.isArray(line.waypointsGraph)) ? line.waypointsGraph : [];
    if (!wps.length) return [from, to];
    const pts = [from];
    for (const w of wps) {
        if (w && Number.isFinite(w.x) && Number.isFinite(w.y)) pts.push({ x: w.x, y: -w.y });
    }
    pts.push(to);
    return pts;
}

/** Total length of a polyline. */
export function polylineLength (pts) {
    let total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return total;
}

/**
 * Find the point at half-length along a polyline and the local tangent unit vector.
 */
export function polylineMidpointAndTangent (pts) {
    if (pts.length === 2) {
        const mid = midpoint(pts[0], pts[1]);
        const u = unitVector(pts[0], pts[1]);
        return { mid, tangent: u };
    }
    const total = polylineLength(pts);
    let target = total / 2;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        const seg = Math.hypot(b.x - a.x, b.y - a.y);
        if (seg >= target) {
            const t = seg < GEOMETRY_EPSILON ? 0 : target / seg;
            return {
                mid: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
                tangent: unitVector(a, b),
            };
        }
        target -= seg;
    }
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    return { mid: midpoint(a, b), tangent: unitVector(a, b) };
}

/**
 * Compute switch anchor world position. If the parent line has waypoints, the
 * switch on the from-bus side anchors near the first waypoint; on the to-bus
 * side near the last waypoint. Otherwise the standard small offset toward the
 * remote bus is used (mirrors Plotly switchMarkerCoords).
 */
export function switchAnchorPos (sw, busById, lineById, viewMode, project) {
    const bus = busById.get ? busById.get(sw.busId) : busById[sw.busId];
    if (!bus) return null;
    const from = busPos(bus, viewMode, project);
    if (!from) return null;

    let toPos = null;
    if (sw.parentKind === 'line' && lineById) {
        const ln = lineById.get ? lineById.get(sw.elementId) : lineById[sw.elementId];
        if (ln && !isGeo(viewMode) && Array.isArray(ln.waypointsGraph) && ln.waypointsGraph.length) {
            const fromBusObj = busById.get ? busById.get(ln.fromBus) : busById[ln.fromBus];
            const isFromSide = fromBusObj && fromBusObj.id === bus.id;
            const wp = isFromSide ? ln.waypointsGraph[0] : ln.waypointsGraph[ln.waypointsGraph.length - 1];
            if (wp && Number.isFinite(wp.x) && Number.isFinite(wp.y)) {
                toPos = { x: wp.x, y: -wp.y };
            }
        }
    }
    if (!toPos) {
        const remote = sw.remoteBusId == null
            ? null
            : (busById.get ? busById.get(sw.remoteBusId) : busById[sw.remoteBusId]);
        toPos = remote ? busPos(remote, viewMode, project) : null;
    }
    if (!toPos) return from;

    const u = unitVector(from, toPos);
    if (u.len === 0) return from;
    const minOffset = isGeo(viewMode) ? SWITCH_MIN_OFFSET_GEO : SWITCH_MIN_OFFSET_GRAPH;
    const maxOffset = isGeo(viewMode) ? SWITCH_MAX_OFFSET_GEO : SWITCH_MAX_OFFSET_GRAPH;
    const offset = Math.min(Math.max(u.len * SWITCH_OFFSET_LENGTH_FACTOR, minOffset), maxOffset);
    return { x: from.x + u.x * offset, y: from.y + u.y * offset };
}
