/**
 * Lines layer.
 *
 * One Graphics per (voltage, bin, dash) — rebuilt on demand. Stroke width is
 * baseline `lineWidth(voltage)` divided by viewport.scale to stay screen-px
 * sized regardless of zoom.
 *
 * Also maintains the segment spatial index for hover hit-testing.
 */

import { Graphics } from 'pixi.js';
import { LINE_BINS } from '/traces/constants.js';
import { loadingValue } from '/traces/formatters.js';
import { lineWidth } from '/traces/styling.js';
import { linePoints } from '../geometry.js';

export class LinesLayer {
    constructor ({ container, viewport, network, busById, segmentIndex, project }) {
        this.container = container;
        this.viewport = viewport;
        this.network = network;
        this.busById = busById;
        this.segmentIndex = segmentIndex;
        this.project = project;
        this.viewMode = 'graph';
        // bin key -> { graphic, lines: Set<id>, voltage, color, dash }
        this._bins = new Map();
        // lineId -> bin key
        this._lineToBin = new Map();
        // lineId -> world points (cached)
        this._linePts = new Map();
        this._dirty = new Set(); // bin keys
    }

    setViewMode (mode) { this.viewMode = mode; }

    _binKey (voltage, binIdx, disconnected) {
        return `${voltage}|${binIdx}|${disconnected ? 'd' : 's'}`;
    }

    /**
     * Rebuild bin assignments from filters. Called on initial draw and any
     * filter change. Returns set of dirty bin keys (all of them).
     */
    rebuildAll (filterCtx, disconnectedIds) {
        for (const b of this._bins.values()) {
            b.graphic.destroy();
        }
        this._bins.clear();
        this._lineToBin.clear();
        this._linePts.clear();
        this.segmentIndex.clear();
        this._dirty.clear();

        for (const ln of this.network.lines) {
            if (!filterCtx.lineOk(ln)) continue;
            const fromBus = this.busById.get(ln.fromBus);
            const toBus = this.busById.get(ln.toBus);
            const pts = linePoints(ln, fromBus, toBus, this.viewMode, this.project);
            if (!pts) continue;

            const lv = loadingValue(ln.loading);
            let binIdx = 0;
            for (let i = 0; i < LINE_BINS.length; i++) {
                if (lv >= LINE_BINS[i].lower && lv < LINE_BINS[i].upper) { binIdx = i; break; }
            }
            const disconnected = disconnectedIds.line.has(ln.id);
            const key = this._binKey(ln.voltage, binIdx, disconnected);
            let bin = this._bins.get(key);
            if (!bin) {
                bin = {
                    voltage: ln.voltage,
                    color: LINE_BINS[binIdx].color,
                    dash: disconnected,
                    graphic: new Graphics(),
                    lines: new Set(),
                };
                this.container.addChild(bin.graphic);
                this._bins.set(key, bin);
            }
            bin.lines.add(ln.id);
            this._lineToBin.set(ln.id, key);
            this._linePts.set(ln.id, pts);
            this.segmentIndex.addLine(ln.id, pts);
            this._dirty.add(key);
        }
        this.redrawDirty();
    }

    /**
     * Update points for a single line (e.g. bus drag) and mark its bin dirty.
     * Caller must invoke `redrawDirty()` to commit.
     */
    updateLinePoints (lineId) {
        const ln = this.network.lines.find(l => l.id === lineId);
        if (!ln) return;
        const fromBus = this.busById.get(ln.fromBus);
        const toBus = this.busById.get(ln.toBus);
        const pts = linePoints(ln, fromBus, toBus, this.viewMode, this.project);
        if (!pts) return;
        this._linePts.set(lineId, pts);
        this.segmentIndex.updateLine(lineId, pts);
        const key = this._lineToBin.get(lineId);
        if (key) this._dirty.add(key);
    }

    markDirty (lineIds) {
        for (const id of lineIds) {
            const k = this._lineToBin.get(id);
            if (k) this._dirty.add(k);
        }
    }

    onZoom () {
        // All bins need stroke width refresh.
        for (const k of this._bins.keys()) this._dirty.add(k);
        this.redrawDirty();
    }

    redrawDirty () {
        if (!this._dirty.size) return;
        const inv = 1 / this.viewport.scale;
        for (const key of this._dirty) {
            const bin = this._bins.get(key);
            if (!bin) continue;
            const g = bin.graphic;
            g.clear();
            const baseW = lineWidth(bin.voltage);
            const strokeOpts = {
                color: bin.color,
                width: baseW * inv,
                cap: 'round',
                join: 'round',
            };
            // Dashed lines: emulate by drawing dashed segments manually.
            for (const lineId of bin.lines) {
                const pts = this._linePts.get(lineId);
                if (!pts || pts.length < 2) continue;
                if (bin.dash) {
                    drawDashedPolyline(g, pts, baseW * 3 * inv, baseW * 2 * inv);
                } else {
                    g.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
                }
            }
            g.stroke(strokeOpts);
        }
        this._dirty.clear();
    }

    getLinePoints (lineId) { return this._linePts.get(lineId) || null; }

    destroy () {
        for (const b of this._bins.values()) b.graphic.destroy();
        this._bins.clear();
        this._lineToBin.clear();
        this._linePts.clear();
    }
}

function drawDashedPolyline (g, pts, dashLen, gapLen) {
    let remainInDash = dashLen;
    let drawing = true;
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const b = pts[i];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let segLen = Math.hypot(dx, dy);
        if (segLen === 0) continue;
        let ux = dx / segLen;
        let uy = dy / segLen;
        let cx = a.x;
        let cy = a.y;
        while (segLen > 0) {
            const step = Math.min(segLen, remainInDash);
            if (drawing) {
                g.moveTo(cx, cy);
                g.lineTo(cx + ux * step, cy + uy * step);
            }
            cx += ux * step;
            cy += uy * step;
            segLen -= step;
            remainInDash -= step;
            if (remainInDash <= 0) {
                drawing = !drawing;
                remainInDash = drawing ? dashLen : gapLen;
            }
        }
    }
}
