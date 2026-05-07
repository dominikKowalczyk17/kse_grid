/**
 * Orchestrator buildowania traces dla Plotly: składa wspólny `ctx` raz
 * i deleguje do wyspecjalizowanych builderów (linie, trafa, switche, busy, selekcja).
 *
 * Zachowuje wzorzec dwóch traces na grupę (polyline + niewidoczne markery do hovera)
 * oraz kolejność: linie → trafa → switche → busy → placeholdery selekcji.
 */

import {
    TRAFO_RADIUS_DEFAULT,
    TRAFO_RADIUS_GRAPH_FACTOR,
    TRAFO_RADIUS_GRAPH_MIN,
} from '/traces/constants.js';
import { busPower, isGeoMode, pointKeys } from '/traces/geometry.js';
import { tracePalette } from '/traces/palette.js';
import { disconnectedBranchIds, lineVisible, trafoVisible } from '/traces/visibility.js';
import { buildBusTraces } from '/traces/builders/bus-traces.js';
import { buildLineTraces } from '/traces/builders/line-traces.js';
import { buildSelectionTraces } from '/traces/builders/selection-traces.js';
import { buildSwitchTraces } from '/traces/builders/switch-traces.js';
import { buildTrafoTraces } from '/traces/builders/trafo-traces.js';

/**
 * Buduje listę traces, meta i shapes dla widoku sieci.
 * @param {object} network - zdekodowane dane sieci (buses, lines, trafos, switches, ...)
 * @param {'graph'|'geo'} [viewMode]
 * @param {{minLineLoading?:number, minBusPower?:number, selectedVoltages?:number[]}} [filters]
 * @param {'dark'|'light'} [theme]
 * @returns {{traces:Array, meta:Array, shapes:Array}}
 */
export function buildTraces(network, viewMode = 'graph', filters = {}, theme = 'dark') {
    const { buses, lines, trafos, switches = [], voltageLevels, hasResults, graphBounds } = network;
    const busById = Object.fromEntries(buses.map(b => [b.id, b]));
    const lineById = Object.fromEntries(lines.map(line => [line.id, line]));
    const trafoById = Object.fromEntries(trafos.map(trafo => [trafo.id, trafo]));
    const keys = pointKeys(viewMode);
    const palette = tracePalette(theme);
    const disconnectedIds = disconnectedBranchIds(switches);

    const minLineLoading = Math.max(0, Number(filters.minLineLoading) || 0);
    const minBusPower = Math.max(0, Number(filters.minBusPower) || 0);
    const voltageSet = new Set(filters.selectedVoltages || voltageLevels);

    const visibleBusIds = new Set(
        buses
            .filter(bus => minBusPower <= 0 || busPower(bus) >= minBusPower)
            .map(bus => bus.id)
    );
    const branchPasses = element => visibleBusIds.has(element.fromBus ?? element.hvBus)
        && visibleBusIds.has(element.toBus ?? element.lvBus);

    let busHasVisibleBranch = null;
    if (minLineLoading > 0) {
        busHasVisibleBranch = new Set();
        for (const ln of lines) {
            if (lineVisible(ln, voltageSet, minLineLoading, branchPasses)) {
                busHasVisibleBranch.add(ln.fromBus);
                busHasVisibleBranch.add(ln.toBus);
            }
        }
        for (const tr of trafos) {
            if (trafoVisible(tr, voltageSet, minLineLoading, branchPasses)) {
                busHasVisibleBranch.add(tr.hvBus);
                busHasVisibleBranch.add(tr.lvBus);
            }
        }
    }
    const busPasses = bus => visibleBusIds.has(bus.id)
        && (busHasVisibleBranch === null || busHasVisibleBranch.has(bus.id));

    const useShapes = !isGeoMode(viewMode);
    let trafoRadius = TRAFO_RADIUS_DEFAULT;
    if (useShapes && graphBounds?.x) {
        const dx = graphBounds.x[1] - graphBounds.x[0];
        trafoRadius = Math.max(dx * TRAFO_RADIUS_GRAPH_FACTOR, TRAFO_RADIUS_GRAPH_MIN);
    }

    const lvLevels = [...new Set(trafos.map(t => t.vnLvKv))].sort((a, b) => b - a);

    const ctx = {
        buses, lines, trafos, switches,
        busById, lineById, trafoById,
        keys, palette,
        viewMode, hasResults, voltageLevels,
        voltageSet, minLineLoading, branchPasses, busPasses,
        disconnectedIds,
        lvLevels, useShapes, trafoRadius,
    };

    const traces = [];
    const meta = [];
    const shapes = [];

    const lineRes = buildLineTraces(ctx);
    traces.push(...lineRes.traces);
    meta.push(...lineRes.meta);

    const trafoRes = buildTrafoTraces(ctx);
    traces.push(...trafoRes.traces);
    meta.push(...trafoRes.meta);
    shapes.push(...trafoRes.shapes);

    const switchRes = buildSwitchTraces(ctx);
    traces.push(...switchRes.traces);
    meta.push(...switchRes.meta);

    const busRes = buildBusTraces(ctx);
    traces.push(...busRes.traces);
    meta.push(...busRes.meta);

    const selectionRes = buildSelectionTraces(ctx);
    traces.push(...selectionRes.traces);
    meta.push(...selectionRes.meta);

    return { traces, meta, shapes };
}
