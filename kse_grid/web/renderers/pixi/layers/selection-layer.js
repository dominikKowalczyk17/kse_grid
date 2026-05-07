/**
 * Selection highlight — outer + inner ring sprite around the selected element.
 * For lines/trafos uses the polyline midpoint; for buses/switches uses the
 * sprite position. Always drawn on top of everything else.
 */

import { Sprite } from 'pixi.js';
import { SELECTION_INNER_SIZE, SELECTION_OUTER_SIZE } from '/traces/constants.js';
import { busPos, midpoint, polylineMidpointAndTangent } from '../geometry.js';

export class SelectionLayer {
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
        this.outer = null;
        this.inner = null;
        this.current = null; // { kind, id }
    }

    setViewMode (m) { this.viewMode = m; }

    setPalette (p) {
        this.palette = p;
        this._rebuildSprites();
    }

    _rebuildSprites () {
        if (this.outer) this.outer.destroy();
        if (this.inner) this.inner.destroy();
        const outerR = SELECTION_OUTER_SIZE / 2;
        const innerR = SELECTION_INNER_SIZE / 2;
        this.outer = Sprite.from(this.textures.ring(outerR, parseColor(this.palette.selectionOuter), 2.5));
        this.inner = Sprite.from(this.textures.ring(innerR, parseColor(this.palette.selectionInner), 2));
        this.outer.anchor.set(0.5);
        this.inner.anchor.set(0.5);
        this.outer.visible = false;
        this.inner.visible = false;
        this.container.addChild(this.outer, this.inner);
    }

    init () { this._rebuildSprites(); }

    setSelection (selection) {
        this.current = selection;
        this.refresh();
    }

    refresh () {
        if (!this.outer || !this.inner) return;
        if (!this.current) {
            this.outer.visible = false;
            this.inner.visible = false;
            return;
        }
        const pos = this._currentPos();
        if (!pos) {
            this.outer.visible = false;
            this.inner.visible = false;
            return;
        }
        this.outer.visible = true;
        this.inner.visible = true;
        this.outer.position.set(pos.x, pos.y);
        this.inner.position.set(pos.x, pos.y);
        this.applyZoom();
    }

    _currentPos () {
        const sel = this.current;
        if (!sel) return null;
        if (sel.kind === 'bus') {
            const bus = this.busById.get(sel.id);
            return busPos(bus, this.viewMode, this.project);
        }
        if (sel.kind === 'line') {
            const pts = this.getLinePoints(sel.id);
            if (pts && pts.length >= 2) return polylineMidpointAndTangent(pts).mid;
            const ln = this.network.lines.find(l => l.id === sel.id);
            if (!ln) return null;
            const a = busPos(this.busById.get(ln.fromBus), this.viewMode, this.project);
            const b = busPos(this.busById.get(ln.toBus), this.viewMode, this.project);
            return a && b ? midpoint(a, b) : null;
        }
        if (sel.kind === 'trafo') {
            const tr = this.network.trafos.find(t => t.id === sel.id);
            if (!tr) return null;
            const a = busPos(this.busById.get(tr.hvBus), this.viewMode, this.project);
            const b = busPos(this.busById.get(tr.lvBus), this.viewMode, this.project);
            return a && b ? midpoint(a, b) : null;
        }
        if (sel.kind === 'switch') {
            const sw = (this.network.switches || []).find(s => s.id === sel.id);
            if (!sw) return null;
            const bus = this.busById.get(sw.busId);
            return busPos(bus, this.viewMode, this.project);
        }
        return null;
    }

    applyZoom () {
        const inv = 1 / this.viewport.scale;
        if (this.outer) this.outer.scale.set(inv);
        if (this.inner) this.inner.scale.set(inv);
    }

    onZoom () { this.applyZoom(); }

    destroy () {
        if (this.outer) this.outer.destroy();
        if (this.inner) this.inner.destroy();
        this.outer = null;
        this.inner = null;
    }
}

function parseColor (hex) { return parseInt(hex.replace('#', ''), 16); }
