/**
 * Index from busId → incident lines/trafos/switches/arrows.
 * Used so dragging a bus only marks affected layers dirty.
 */

export class BusIndex {
    constructor () {
        this._map = new Map();
    }

    _entry (busId) {
        let e = this._map.get(busId);
        if (!e) {
            e = { lineIds: new Set(), trafoIds: new Set(), switchIds: new Set(), arrowIds: new Set() };
            this._map.set(busId, e);
        }
        return e;
    }

    addLine (busId, lineId) { this._entry(busId).lineIds.add(lineId); }
    addTrafo (busId, trafoId) { this._entry(busId).trafoIds.add(trafoId); }
    addSwitch (busId, switchId) { this._entry(busId).switchIds.add(switchId); }
    addArrow (busId, arrowKey) { this._entry(busId).arrowIds.add(arrowKey); }

    get (busId) { return this._map.get(busId); }

    clear () { this._map.clear(); }

    static build (network) {
        const idx = new BusIndex();
        for (const ln of network.lines) {
            idx.addLine(ln.fromBus, ln.id);
            idx.addLine(ln.toBus, ln.id);
            idx.addArrow(ln.fromBus, `line:${ln.id}`);
            idx.addArrow(ln.toBus, `line:${ln.id}`);
        }
        for (const tr of network.trafos) {
            idx.addTrafo(tr.hvBus, tr.id);
            idx.addTrafo(tr.lvBus, tr.id);
            idx.addArrow(tr.hvBus, `trafo:${tr.id}`);
            idx.addArrow(tr.lvBus, `trafo:${tr.id}`);
        }
        for (const sw of (network.switches || [])) {
            idx.addSwitch(sw.busId, sw.id);
            if (sw.remoteBusId != null) idx.addSwitch(sw.remoteBusId, sw.id);
        }
        return idx;
    }
}
