import { computed } from 'vue';

function loadingValue(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function lineVisible(line, voltageSet, minLoad, branchOk) {
    return voltageSet.has(line.voltage)
        && loadingValue(line.loading) >= minLoad
        && branchOk(line);
}

function trafoVisible(trafo, voltageSet, minLoad, branchOk) {
    return voltageSet.has(trafo.vnHvKv)
        && voltageSet.has(trafo.vnLvKv)
        && loadingValue(trafo.loading) >= minLoad
        && branchOk(trafo);
}

export function useVisibilityCounts(props) {
    const visibleCounts = computed(() => {
        const voltageSet = new Set(props.selectedVoltages);
        const typeSet = new Set(props.selectedTypes);
        const total = {
            bus: props.network.buses.length,
            line: props.network.lines.length,
            switch: props.network.switches?.length || 0,
        };
        const minLoad = Math.max(0, Number(props.minLineLoading) || 0);
        const minPow = Math.max(0, Number(props.minBusPower) || 0);
        const passesBusPower = bus => minPow <= 0
            || Math.max(Math.abs(bus.loadMw ?? 0), Math.abs(bus.genMw ?? 0)) >= minPow;
        const visibleBusIds = new Set(props.network.buses.filter(passesBusPower).map(bus => bus.id));
        const branchOk = el => visibleBusIds.has(el.fromBus ?? el.hvBus) && visibleBusIds.has(el.toBus ?? el.lvBus);
        const lineById = Object.fromEntries(props.network.lines.map(line => [line.id, line]));
        const trafoById = Object.fromEntries(props.network.trafos.map(trafo => [trafo.id, trafo]));

        let connected = null;
        if (minLoad > 0) {
            connected = new Set();
            for (const ln of props.network.lines) {
                if (lineVisible(ln, voltageSet, minLoad, branchOk)) {
                    connected.add(ln.fromBus); connected.add(ln.toBus);
                }
            }
            for (const tr of props.network.trafos) {
                if (trafoVisible(tr, voltageSet, minLoad, branchOk)) {
                    connected.add(tr.hvBus); connected.add(tr.lvBus);
                }
            }
        }

        const isMapMode = props.viewMode === 'geo' || props.viewMode === 'atlas';
        const buses = typeSet.has('bus')
            ? props.network.buses.filter(bus => voltageSet.has(bus.vn_kv)
                && visibleBusIds.has(bus.id)
                && (connected === null || connected.has(bus.id))
                && (!isMapMode || (bus.lat != null && bus.lon != null))).length
            : 0;
        const lines = typeSet.has('line')
            ? props.network.lines.filter(line => lineVisible(line, voltageSet, minLoad, branchOk)).length
            : 0;
        const switches = props.showSwitches
            ? (props.network.switches || []).filter(sw => {
                if (!voltageSet.has(sw.voltage)) return false;
                if (sw.parentKind === 'line') {
                    const parent = lineById[sw.elementId];
                    return typeSet.has('line') && parent ? lineVisible(parent, voltageSet, minLoad, branchOk) : false;
                }
                if (sw.parentKind === 'trafo') {
                    const parent = trafoById[sw.elementId];
                    return typeSet.has('trafo') && parent ? trafoVisible(parent, voltageSet, minLoad, branchOk) : false;
                }
                return false;
            }).length
            : 0;

        return {
            buses,
            lines,
            switches,
            totalBuses: total.bus,
            totalLines: total.line,
            totalSwitches: total.switch,
        };
    });

    return { visibleCounts };
}
