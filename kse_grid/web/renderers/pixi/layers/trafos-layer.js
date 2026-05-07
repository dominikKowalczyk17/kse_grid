/**
 * Trafos layer:
 *  - one Graphics for connector lines (per loading bin × dash), like lines layer
 *  - sprite pair (two coils) per trafo, drawn via TextureCache.coilRing
 *
 * Sprites are screen-px sized (zoom-invariant) by adjusting their `scale`
 * inversely to the viewport scale on every zoom event.
 */

import { Graphics, Sprite } from 'pixi.js';
import { TRAFO_LINE_WIDTH } from '/traces/constants.js';
import { loadingValue } from '/traces/formatters.js';
import { busPos, midpoint, unitVector } from '../geometry.js';

const COIL_RADIUS_PX = 8;
const COIL_LINE_WIDTH = 1.6;
const COIL_SEPARATION_PX = COIL_RADIUS_PX * 1.1; // half-overlap

export class TrafosLayer {
    constructor ({ linesContainer, coilsContainer, viewport, network, busById, textures, palette, project }) {
        this.linesContainer = linesContainer;
        this.coilsContainer = coilsContainer;
        this.viewport = viewport;
        this.network = network;
        this.busById = busById;
        this.textures = textures;
        this.palette = palette;
        this.project = project;
        this.viewMode = 'graph';

        // per-trafo state: { trafoId -> { color, dash, coilA, coilB, from, to } }
        this._state = new Map();
        this._dirtyConnectors = false; // cheap to redraw all connectors at once
        this._connectorG = new Graphics();
        this.linesContainer.addChild(this._connectorG);
    }

    setViewMode (m) { this.viewMode = m; }
    setPalette (p) { this.palette = p; }

    rebuildAll (filterCtx, disconnectedIds) {
        for (const s of this._state.values()) {
            s.coilA.destroy();
            s.coilB.destroy();
        }
        this._state.clear();

        for (const tr of this.network.trafos) {
            if (!filterCtx.trafoOk(tr)) continue;
            const hv = this.busById.get(tr.hvBus);
            const lvBus = this.busById.get(tr.lvBus);
            const from = busPos(hv, this.viewMode, this.project);
            const to = busPos(lvBus, this.viewMode, this.project);
            if (!from || !to) continue;

            const lv = loadingValue(tr.loading);
            const bin = pickBin(this.palette.trafoBins, lv);
            const disconnected = disconnectedIds.trafo.has(tr.id);

            const tex = this.textures.coilRing(COIL_RADIUS_PX, parseColor(bin.color), COIL_LINE_WIDTH);
            const coilA = Sprite.from(tex);
            const coilB = Sprite.from(tex);
            coilA.anchor.set(0.5);
            coilB.anchor.set(0.5);
            this.coilsContainer.addChild(coilA, coilB);

            const st = { trafo: tr, color: bin.color, dash: disconnected, coilA, coilB, from, to };
            this._state.set(tr.id, st);
        }
        this._dirtyConnectors = true;
        this.applyZoom();
        this.redraw();
    }

    /** Recompute endpoints for trafos incident to busId. */
    onBusMoved (busIds) {
        for (const st of this._state.values()) {
            const tr = st.trafo;
            if (!busIds.has(tr.hvBus) && !busIds.has(tr.lvBus)) continue;
            const hv = this.busById.get(tr.hvBus);
            const lvBus = this.busById.get(tr.lvBus);
            const from = busPos(hv, this.viewMode, this.project);
            const to = busPos(lvBus, this.viewMode, this.project);
            if (from && to) { st.from = from; st.to = to; }
        }
        this._dirtyConnectors = true;
    }

    applyZoom () {
        const inv = 1 / this.viewport.scale;
        for (const st of this._state.values()) {
            st.coilA.scale.set(inv);
            st.coilB.scale.set(inv);
        }
    }

    redraw () {
        // connectors
        if (this._dirtyConnectors) {
            const inv = 1 / this.viewport.scale;
            const g = this._connectorG;
            g.clear();
            for (const st of this._state.values()) {
                g.moveTo(st.from.x, st.from.y).lineTo(st.to.x, st.to.y);
            }
            // we draw all bins same-stroke for performance — colors are encoded by coils,
            // and the connector is just a thin tinted hint.
            g.stroke({
                color: 0x808890,
                width: TRAFO_LINE_WIDTH * inv,
                alpha: 0.55,
            });
            this._dirtyConnectors = false;
        }
        // coil positions
        const inv = 1 / this.viewport.scale;
        const sep = COIL_SEPARATION_PX * inv;
        for (const st of this._state.values()) {
            const mid = midpoint(st.from, st.to);
            const u = unitVector(st.from, st.to);
            const ux = u.len === 0 ? 0 : u.x;
            const uy = u.len === 0 ? 1 : u.y;
            st.coilA.position.set(mid.x - ux * sep, mid.y - uy * sep);
            st.coilB.position.set(mid.x + ux * sep, mid.y + uy * sep);
        }
    }

    onZoom () {
        this._dirtyConnectors = true;
        this.applyZoom();
        this.redraw();
    }

    pickAt (worldX, worldY, tolerancePx) {
        const tol = tolerancePx / this.viewport.scale;
        let best = null;
        for (const st of this._state.values()) {
            const mid = midpoint(st.from, st.to);
            const d = Math.hypot(worldX - mid.x, worldY - mid.y);
            if (d <= tol && (!best || d < best.distance)) best = { trafo: st.trafo, distance: d };
        }
        return best;
    }

    destroy () {
        for (const s of this._state.values()) {
            s.coilA.destroy();
            s.coilB.destroy();
        }
        this._state.clear();
        this._connectorG.destroy();
    }
}

function pickBin (bins, value) {
    for (const b of bins) if (value >= b.lower && value < b.upper) return b;
    return bins[0];
}

function parseColor (hex) {
    return parseInt(hex.replace('#', ''), 16);
}
