/**
 * Filter / visibility adapter — mirrors the Plotly `applyVisibility` semantics
 * so the controller can ask "should this element be drawn?" given the current
 * UI filter state.
 */

import { loadingValue } from '/traces/formatters.js';
import { busPower } from '/traces/geometry.js';

export function makeFilterContext (network, filters) {
    const voltageSet = new Set(filters.selectedVoltages || network.voltageLevels);
    const typeSet = new Set(filters.selectedTypes || ['bus', 'line', 'trafo']);
    const minLineLoading = Math.max(0, Number(filters.minLineLoading) || 0);
    const minBusPower = Math.max(0, Number(filters.minBusPower) || 0);
    const showSwitches = !!filters.showSwitches;

    const visibleBusIds = new Set(
        network.buses
            .filter(b => minBusPower <= 0 || busPower(b) >= minBusPower)
            .map(b => b.id),
    );
    const branchPasses = el => visibleBusIds.has(el.fromBus ?? el.hvBus)
        && visibleBusIds.has(el.toBus ?? el.lvBus);

    let busHasVisibleBranch = null;
    if (minLineLoading > 0) {
        busHasVisibleBranch = new Set();
        for (const ln of network.lines) {
            if (lineVisible(ln, voltageSet, minLineLoading, branchPasses)) {
                busHasVisibleBranch.add(ln.fromBus);
                busHasVisibleBranch.add(ln.toBus);
            }
        }
        for (const tr of network.trafos) {
            if (trafoVisible(tr, voltageSet, minLineLoading, branchPasses)) {
                busHasVisibleBranch.add(tr.hvBus);
                busHasVisibleBranch.add(tr.lvBus);
            }
        }
    }

    const busPasses = bus => visibleBusIds.has(bus.id)
        && (busHasVisibleBranch === null || busHasVisibleBranch.has(bus.id))
        && voltageSet.has(bus.vn_kv)
        && typeSet.has('bus');

    return {
        voltageSet, typeSet, minLineLoading, minBusPower, showSwitches,
        visibleBusIds, branchPasses, busPasses,
        lineOk: ln => typeSet.has('line') && lineVisible(ln, voltageSet, minLineLoading, branchPasses),
        trafoOk: tr => typeSet.has('trafo') && trafoVisible(tr, voltageSet, minLineLoading, branchPasses),
        switchOk: (sw, lineById, trafoById) => {
            if (!showSwitches) return false;
            if (!voltageSet.has(sw.voltage)) return false;
            if (sw.parentKind === 'line') {
                if (!typeSet.has('line')) return false;
                const p = lineById.get(sw.elementId);
                return p ? lineVisible(p, voltageSet, minLineLoading, branchPasses) : false;
            }
            if (sw.parentKind === 'trafo') {
                if (!typeSet.has('trafo')) return false;
                const p = trafoById.get(sw.elementId);
                return p ? trafoVisible(p, voltageSet, minLineLoading, branchPasses) : false;
            }
            return false;
        },
    };
}

export function lineVisible (line, voltageSet, minLineLoading, branchPasses) {
    return voltageSet.has(line.voltage)
        && loadingValue(line.loading) >= minLineLoading
        && branchPasses(line);
}

export function trafoVisible (trafo, voltageSet, minLineLoading, branchPasses) {
    return voltageSet.has(trafo.vnHvKv)
        && voltageSet.has(trafo.vnLvKv)
        && loadingValue(trafo.loading) >= minLineLoading
        && branchPasses(trafo);
}
