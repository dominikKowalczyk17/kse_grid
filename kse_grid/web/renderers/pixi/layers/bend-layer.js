/**
 * Bend handles for selected line in edit-mode.
 *  - one filled circle at each waypoint (drag to move; SHIFT-click to remove)
 *  - one ghost circle at each segment midpoint (click to insert waypoint)
 *
 * The layer is otherwise empty; the actual hit handling lives in
 * `interactions/bend.js` which queries the layer for sprites & their meta.
 */

import { Sprite } from 'pixi.js';
import { busPos } from '../geometry.js';

const HANDLE_R = 6;
const GHOST_R = 5;
const HANDLE_LINE_W = 1.4;

export class BendLayer {
    constructor ({ container, viewport, network, busById, textures, project, getLinePoints }) {
        this.container = container;
        this.viewport = viewport;
        this.network = network;
        this.busById = busById;
        this.textures = textures;
        this.project = project;
        this.getLinePoints = getLinePoints;
        this.viewMode = 'graph';
        this.lineId = null;
        this._handles = []; // { sprite, index }
        this._ghosts = [];  // { sprite, segIdx, point }
    }

    setViewMode (m) { this.viewMode = m; }

    show (lineId) {
        this.lineId = lineId;
        this.refresh();
    }

    hide () {
        this.lineId = null;
        this._clear();
    }

    _clear () {
        for (const h of this._handles) h.sprite.destroy();
        for (const g of this._ghosts) g.sprite.destroy();
        this._handles.length = 0;
        this._ghosts.length = 0;
    }

    refresh () {
        this._clear();
        if (this.lineId == null) return;
        const ln = this.network.lines.find(l => l.id === this.lineId);
        if (!ln) return;
        const pts = this.getLinePoints(ln.id);
        if (!pts || pts.length < 2) return;
        const wps = Array.isArray(ln.waypointsGraph) ? ln.waypointsGraph : [];

        const handleTex = this.textures.busCircle(HANDLE_R * 2, 0xfacc15, 0x111111, HANDLE_LINE_W);
        const ghostTex = this.textures.busCircle(GHOST_R * 2, 0xffffff, 0x666666, 1);

        for (let i = 0; i < wps.length; i++) {
            const w = wps[i];
            if (!w || !Number.isFinite(w.x) || !Number.isFinite(w.y)) continue;
            const sp = Sprite.from(handleTex);
            sp.anchor.set(0.5);
            sp.eventMode = 'static';
            sp.cursor = 'grab';
            sp.alpha = 0.95;
            sp.__pixiKind = 'bend-handle';
            sp.__pixiLineId = ln.id;
            sp.__pixiIndex = i;
            sp.position.set(w.x, -w.y);
            this.container.addChild(sp);
            this._handles.push({ sprite: sp, index: i });
        }

        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1];
            const b = pts[i];
            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const sp = Sprite.from(ghostTex);
            sp.anchor.set(0.5);
            sp.eventMode = 'static';
            sp.cursor = 'crosshair';
            sp.alpha = 0.6;
            sp.__pixiKind = 'bend-ghost';
            sp.__pixiLineId = ln.id;
            sp.__pixiSegIdx = i - 1; // segment between waypoint (i-1) and i (in extended pts)
            sp.position.set(mx, my);
            this.container.addChild(sp);
            this._ghosts.push({ sprite: sp, segIdx: i - 1, point: { x: mx, y: -my } });
        }

        this.applyZoom();
        // hint busPos used implicitly via getLinePoints/network
        void busPos;
    }

    applyZoom () {
        const inv = 1 / this.viewport.scale;
        for (const h of this._handles) h.sprite.scale.set(inv);
        for (const g of this._ghosts) g.sprite.scale.set(inv);
    }

    onZoom () { this.applyZoom(); }

    destroy () {
        this._clear();
    }
}
