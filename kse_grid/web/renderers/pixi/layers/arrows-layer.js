/**
 * Flow direction arrows layer — triangle sprites at the polyline midpoint,
 * rotated along the local tangent in the direction of sign(P).
 *
 * Skipped for branches without sufficient |P| or that are disconnected.
 */

import { Sprite } from 'pixi.js';
import {
    FLOW_ARROW_MIN_MW,
    FLOW_ARROW_OUTLINE_WIDTH,
    FLOW_ARROW_SIZE_LINE,
    FLOW_ARROW_SIZE_TRAFO,
    LINE_BINS,
} from '/traces/constants.js';
import { loadingValue } from '/traces/formatters.js';
import { busPos, midpoint, polylineMidpointAndTangent, unitVector } from '../geometry.js';

export class ArrowsLayer {
    constructor ({ container, viewport, network, busById, textures, palette, project, getLinePoints }) {
        this.container = container;
        this.viewport = viewport;
        this.network = network;
        this.busById = busById;
        this.textures = textures;
        this.palette = palette;
        this.project = project;
        this.getLinePoints = getLinePoints;
        this.viewMode = 'graph';
        this._sprites = new Map(); // key (`line:id`/`trafo:id`) -> Sprite
        this._meta = new Map();    // key -> { kind, id, color, sign, size }
    }

    setViewMode (m) { this.viewMode = m; }
    setPalette (p) { this.palette = p; }

    rebuildAll (filterCtx, disconnectedIds) {
        for (const s of this._sprites.values()) s.destroy();
        this._sprites.clear();
        this._meta.clear();
        const hasResults = !!this.network.hasResults;
        if (!hasResults) { this.applyZoom(); return; }

        for (const ln of this.network.lines) {
            if (!filterCtx.lineOk(ln)) continue;
            if (disconnectedIds.line.has(ln.id)) continue;
            const p = ln.pFromMw;
            if (!Number.isFinite(p) || Math.abs(p) < FLOW_ARROW_MIN_MW) continue;
            const sign = p >= 0 ? 1 : -1;
            const lv = loadingValue(ln.loading);
            const bin = pickBinByLoading(LINE_BINS, lv);
            const tex = this.textures.arrowTriangle(
                FLOW_ARROW_SIZE_LINE,
                parseColor(bin.color),
                0x000000,
                FLOW_ARROW_OUTLINE_WIDTH,
            );
            const sp = Sprite.from(tex);
            sp.anchor.set(0.5);
            this.container.addChild(sp);
            const key = `line:${ln.id}`;
            this._sprites.set(key, sp);
            this._meta.set(key, { kind: 'line', id: ln.id, sign, size: FLOW_ARROW_SIZE_LINE });
        }
        for (const tr of this.network.trafos) {
            if (!filterCtx.trafoOk(tr)) continue;
            if (disconnectedIds.trafo.has(tr.id)) continue;
            const p = tr.pHvMw;
            if (!Number.isFinite(p) || Math.abs(p) < FLOW_ARROW_MIN_MW) continue;
            const sign = p >= 0 ? 1 : -1;
            const lv = loadingValue(tr.loading);
            const bin = pickBinByLoading(this.palette.trafoBins, lv);
            const tex = this.textures.arrowTriangle(
                FLOW_ARROW_SIZE_TRAFO,
                parseColor(bin.color),
                0x000000,
                FLOW_ARROW_OUTLINE_WIDTH,
            );
            const sp = Sprite.from(tex);
            sp.anchor.set(0.5);
            this.container.addChild(sp);
            const key = `trafo:${tr.id}`;
            this._sprites.set(key, sp);
            this._meta.set(key, { kind: 'trafo', id: tr.id, sign, size: FLOW_ARROW_SIZE_TRAFO });
        }
        this.applyZoom();
        this.updateAllPositions();
    }

    updateAllPositions () {
        for (const key of this._sprites.keys()) this.updateOne(key);
    }

    updateOne (key) {
        const sp = this._sprites.get(key);
        const meta = this._meta.get(key);
        if (!sp || !meta) return;
        let mid, tangent;
        if (meta.kind === 'line') {
            const pts = this.getLinePoints(meta.id);
            if (!pts || pts.length < 2) return;
            const mt = polylineMidpointAndTangent(pts);
            mid = mt.mid;
            tangent = mt.tangent;
        } else {
            const tr = this.network.trafos.find(t => t.id === meta.id);
            if (!tr) return;
            const hv = this.busById.get(tr.hvBus);
            const lvBus = this.busById.get(tr.lvBus);
            const from = busPos(hv, this.viewMode, this.project);
            const to = busPos(lvBus, this.viewMode, this.project);
            if (!from || !to) return;
            mid = midpoint(from, to);
            tangent = unitVector(from, to);
        }
        sp.position.set(mid.x, mid.y);
        if (tangent.len !== 0) {
            const dx = tangent.x * meta.sign;
            const dy = tangent.y * meta.sign;
            // texture points "up" (negative-y); we rotate so up aligns with (dx,dy)
            sp.rotation = Math.atan2(dy, dx) + Math.PI / 2;
        }
    }

    onBusMoved (busIds) {
        for (const [key, meta] of this._meta) {
            if (meta.kind === 'line') {
                const ln = this.network.lines.find(l => l.id === meta.id);
                if (ln && (busIds.has(ln.fromBus) || busIds.has(ln.toBus))) this.updateOne(key);
            } else {
                const tr = this.network.trafos.find(t => t.id === meta.id);
                if (tr && (busIds.has(tr.hvBus) || busIds.has(tr.lvBus))) this.updateOne(key);
            }
        }
    }

    applyZoom () {
        const inv = 1 / this.viewport.scale;
        for (const sp of this._sprites.values()) sp.scale.set(inv);
    }

    onZoom () { this.applyZoom(); }

    destroy () {
        for (const s of this._sprites.values()) s.destroy();
        this._sprites.clear();
        this._meta.clear();
    }
}

function pickBinByLoading (bins, lv) {
    for (const b of bins) if (lv >= b.lower && lv < b.upper) return b;
    return bins[0];
}
function parseColor (hex) { return parseInt(hex.replace('#', ''), 16); }
