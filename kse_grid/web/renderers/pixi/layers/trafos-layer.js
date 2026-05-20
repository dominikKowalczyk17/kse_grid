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

// When HV and LV buses share the same geographic location (common for two
// voltage levels at one substation in geo mode), we synthesise a fixed screen
// offset so the IEC symbol sits visibly next to the bus instead of on top.
// Angle is derived per-trafo so multiple trafos at one node fan out.
const TRAFO_OFFSET_PX_FROM_BUS = 22;
const COINCIDENT_EPSILON = 1e-6;

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

            const coincident = Math.hypot(to.x - from.x, to.y - from.y) < COINCIDENT_EPSILON;
            const offsetAngle = coincident ? syntheticOffsetAngle(tr.id) : 0;
            const st = { trafo: tr, color: bin.color, dash: disconnected, coilA, coilB, from, to, coincident, offsetAngle };
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
            if (from && to) {
                st.from = from; st.to = to;
                st.coincident = Math.hypot(to.x - from.x, to.y - from.y) < COINCIDENT_EPSILON;
                if (st.coincident && !st.offsetAngle) st.offsetAngle = syntheticOffsetAngle(tr.id);
            }
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
        const inv = 1 / this.viewport.scale;
        // For coincident trafos: connector goes bus -> offset point, and both
        // coils cluster *around* that offset point (oriented along the offset
        // direction). For normal trafos: connector spans HV->LV, coils sit at
        // the midpoint oriented along HV->LV.
        const layouts = new Map();
        for (const st of this._state.values()) {
            if (st.coincident) {
                const ux = Math.cos(st.offsetAngle);
                const uy = Math.sin(st.offsetAngle);
                const center = {
                    x: st.from.x + ux * TRAFO_OFFSET_PX_FROM_BUS * inv,
                    y: st.from.y + uy * TRAFO_OFFSET_PX_FROM_BUS * inv,
                };
                layouts.set(st, { connFrom: st.from, connTo: center, center, ux, uy });
            } else {
                const u = unitVector(st.from, st.to);
                layouts.set(st, {
                    connFrom: st.from,
                    connTo: st.to,
                    center: midpoint(st.from, st.to),
                    ux: u.len === 0 ? 0 : u.x,
                    uy: u.len === 0 ? 1 : u.y,
                });
            }
        }

        if (this._dirtyConnectors) {
            const g = this._connectorG;
            g.clear();
            for (const st of this._state.values()) {
                const e = layouts.get(st);
                g.moveTo(e.connFrom.x, e.connFrom.y).lineTo(e.connTo.x, e.connTo.y);
            }
            g.stroke({
                color: 0x808890,
                width: TRAFO_LINE_WIDTH * inv,
                alpha: 0.55,
            });
            this._dirtyConnectors = false;
        }
        const sep = COIL_SEPARATION_PX * inv;
        for (const st of this._state.values()) {
            const e = layouts.get(st);
            st.coilA.position.set(e.center.x - e.ux * sep, e.center.y - e.uy * sep);
            st.coilB.position.set(e.center.x + e.ux * sep, e.center.y + e.uy * sep);
        }
    }

    onZoom () {
        this._dirtyConnectors = true;
        this.applyZoom();
        this.redraw();
    }

    pickAt (worldX, worldY, tolerancePx) {
        const tol = tolerancePx / this.viewport.scale;
        const inv = 1 / this.viewport.scale;
        let best = null;
        for (const st of this._state.values()) {
            let mid;
            if (st.coincident) {
                const dx = Math.cos(st.offsetAngle) * TRAFO_OFFSET_PX_FROM_BUS * inv;
                const dy = Math.sin(st.offsetAngle) * TRAFO_OFFSET_PX_FROM_BUS * inv;
                mid = { x: st.from.x + dx, y: st.from.y + dy };
            } else {
                mid = midpoint(st.from, st.to);
            }
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

function syntheticOffsetAngle (trafoId) {
    let h = 0;
    const s = String(trafoId);
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    const frac = ((h % 360) + 360) % 360;
    return (frac * Math.PI) / 180;
}
