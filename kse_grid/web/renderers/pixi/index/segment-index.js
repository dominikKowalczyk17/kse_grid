/**
 * RBush spatial index of line segments for fast hover hit-testing.
 * Each entry: { minX, minY, maxX, maxY, lineId, segIdx, ax, ay, bx, by }.
 */

import RBush from 'rbush';

export class SegmentIndex {
    constructor () {
        this.tree = new RBush();
        this._byLine = new Map();
    }

    addLine (lineId, pts) {
        const items = [];
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            items.push({
                minX: Math.min(a.x, b.x),
                minY: Math.min(a.y, b.y),
                maxX: Math.max(a.x, b.x),
                maxY: Math.max(a.y, b.y),
                lineId,
                segIdx: i - 1,
                ax: a.x, ay: a.y, bx: b.x, by: b.y,
            });
        }
        this._byLine.set(lineId, items);
        this.tree.load(items);
    }

    removeLine (lineId) {
        const items = this._byLine.get(lineId);
        if (!items) return;
        for (const it of items) this.tree.remove(it);
        this._byLine.delete(lineId);
    }

    updateLine (lineId, pts) {
        this.removeLine(lineId);
        this.addLine(lineId, pts);
    }

    /**
     * Find the closest line within `threshold` world units of (x,y).
     * Returns { lineId, distance } or null.
     */
    pick (x, y, threshold) {
        const t = threshold;
        const candidates = this.tree.search({
            minX: x - t, minY: y - t, maxX: x + t, maxY: y + t,
        });
        let best = null;
        for (const c of candidates) {
            const d = pointSegmentDistance(x, y, c.ax, c.ay, c.bx, c.by);
            if (d <= t && (!best || d < best.distance)) {
                best = { lineId: c.lineId, distance: d, segIdx: c.segIdx };
            }
        }
        return best;
    }

    clear () {
        this.tree.clear();
        this._byLine.clear();
    }
}

export function pointSegmentDistance (px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(px - ax, py - ay);
    let t = ((px - ax) * dx + (py - ay) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const cx = ax + dx * t;
    const cy = ay + dy * t;
    return Math.hypot(px - cx, py - cy);
}
