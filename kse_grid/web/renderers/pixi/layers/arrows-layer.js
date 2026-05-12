/**
 * Flow direction arrows layer — triangle sprites placed near each branch endpoint
 * (offset along the line tangent, like switch markers).
 *
 *   - red triangle near the "from" end (HV for trafo) — active power P
 *     direction = sign(p_from) × tangent_into_line
 *     i.e. arrow points INTO the line if power flows from from-bus into the line.
 *   - green triangle near the "to" end (LV for trafo) — reactive power Q
 *     direction = sign(q_to) × tangent_into_line (from the to-bus toward from-bus)
 *
 * Skipped per channel when the magnitude is below FLOW_ARROW_MIN_MW or the
 * branch is disconnected.
 */

import { Sprite } from 'pixi.js';
import {
    FLOW_ARROW_MIN_MW,
    FLOW_ARROW_OUTLINE_WIDTH,
    FLOW_ARROW_SIZE_LINE,
    FLOW_ARROW_SIZE_TRAFO,
    SWITCH_OFFSET_LENGTH_FACTOR,
    SWITCH_MIN_OFFSET_GEO,
    SWITCH_MAX_OFFSET_GEO,
    SWITCH_MIN_OFFSET_GRAPH,
    SWITCH_MAX_OFFSET_GRAPH,
} from '/traces/constants.js';
import { busPos, isGeo, unitVector } from '../geometry.js';

const COLOR_P = 0xEF4444; // red-500  — active power
const COLOR_Q = 0x22C55E; // green-500 — reactive power
const ARROW_OFFSET_FACTOR = 2.2;          // multiplier over switch offset
const ARROW_MAX_OFFSET_FRACTION = 0.45;   // never push past 45% of segment length

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
        this._sprites = new Map(); // key (`line:id:P` etc.) -> Sprite
        this._meta = new Map();    // key -> { kind, id, channel, sign, size, end: 'from'|'to' }
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
            this._addArrow('line', ln.id, 'P', ln.pFromMw, FLOW_ARROW_SIZE_LINE, COLOR_P, 'from');
            this._addArrow('line', ln.id, 'Q', ln.qToMvar, FLOW_ARROW_SIZE_LINE, COLOR_Q, 'to');
        }
        for (const tr of this.network.trafos) {
            if (!filterCtx.trafoOk(tr)) continue;
            if (disconnectedIds.trafo.has(tr.id)) continue;
            this._addArrow('trafo', tr.id, 'P', tr.pHvMw, FLOW_ARROW_SIZE_TRAFO, COLOR_P, 'from');
            this._addArrow('trafo', tr.id, 'Q', tr.qLvMvar, FLOW_ARROW_SIZE_TRAFO, COLOR_Q, 'to');
        }
        this.applyZoom();
        this.updateAllPositions();
    }

    _addArrow (kind, id, channel, value, size, color, end) {
        if (!Number.isFinite(value) || Math.abs(value) < FLOW_ARROW_MIN_MW) return;
        const sign = value >= 0 ? 1 : -1;
        const tex = this.textures.arrowTriangle(size, color, 0x000000, FLOW_ARROW_OUTLINE_WIDTH);
        const sp = Sprite.from(tex);
        sp.anchor.set(0.5);
        this.container.addChild(sp);
        const key = `${kind}:${id}:${channel}`;
        this._sprites.set(key, sp);
        this._meta.set(key, { kind, id, channel, sign, size, end });
    }

    updateAllPositions () {
        for (const key of this._sprites.keys()) this.updateOne(key);
    }

    /** Update all arrows belonging to a single branch (both P and Q channels). */
    updateBranch (kind, id) {
        const prefix = `${kind}:${id}:`;
        for (const key of this._sprites.keys()) {
            if (key.startsWith(prefix)) this.updateOne(key);
        }
    }

    /** Anchor a sprite at (busPoint + tangent_into_line × offset).
     *  Offset is ~2× the switch offset so arrows sit past the switch markers. */
    _endpointAnchor (busPoint, neighborPoint) {
        const u = unitVector(busPoint, neighborPoint);
        if (u.len === 0) return null;
        const minOffset = isGeo(this.viewMode) ? SWITCH_MIN_OFFSET_GEO : SWITCH_MIN_OFFSET_GRAPH;
        const maxOffset = isGeo(this.viewMode) ? SWITCH_MAX_OFFSET_GEO : SWITCH_MAX_OFFSET_GRAPH;
        const switchOffset = Math.min(Math.max(u.len * SWITCH_OFFSET_LENGTH_FACTOR, minOffset), maxOffset);
        const offset = Math.min(switchOffset * ARROW_OFFSET_FACTOR, u.len * ARROW_MAX_OFFSET_FRACTION);
        return {
            pos: { x: busPoint.x + u.x * offset, y: busPoint.y + u.y * offset },
            into: u,
        };
    }

    updateOne (key) {
        const sp = this._sprites.get(key);
        const meta = this._meta.get(key);
        if (!sp || !meta) return;

        let busPoint, neighborPoint;
        if (meta.kind === 'line') {
            const pts = this.getLinePoints(meta.id);
            if (!pts || pts.length < 2) return;
            if (meta.end === 'from') {
                busPoint = pts[0];
                neighborPoint = pts[1];
            } else {
                busPoint = pts[pts.length - 1];
                neighborPoint = pts[pts.length - 2];
            }
        } else {
            const tr = this.network.trafos.find(t => t.id === meta.id);
            if (!tr) return;
            const hv = busPos(this.busById.get(tr.hvBus), this.viewMode, this.project);
            const lv = busPos(this.busById.get(tr.lvBus), this.viewMode, this.project);
            if (!hv || !lv) return;
            if (meta.end === 'from') { busPoint = hv; neighborPoint = lv; }
            else                     { busPoint = lv; neighborPoint = hv; }
        }

        const anchor = this._endpointAnchor(busPoint, neighborPoint);
        if (!anchor) return;
        sp.position.set(anchor.pos.x, anchor.pos.y);

        const dx = anchor.into.x * meta.sign;
        const dy = anchor.into.y * meta.sign;
        // texture points "up" (negative-y); rotate so up aligns with (dx,dy)
        sp.rotation = Math.atan2(dy, dx) + Math.PI / 2;
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
