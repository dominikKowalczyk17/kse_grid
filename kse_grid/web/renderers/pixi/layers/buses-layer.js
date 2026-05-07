/**
 * Buses layer — one Sprite per bus. Texture is per (voltage, color) keyed.
 */

import { Sprite } from 'pixi.js';
import { BUS_MARKER_STROKE_WIDTH } from '/traces/constants.js';
import { busColor, busSize } from '/traces/styling.js';
import { busPos } from '../geometry.js';

export class BusesLayer {
    constructor ({ container, viewport, network, busById, textures, palette, project }) {
        this.container = container;
        this.viewport = viewport;
        this.network = network;
        this.busById = busById;
        this.textures = textures;
        this.palette = palette;
        this.project = project;
        this.viewMode = 'graph';
        this._sprites = new Map(); // busId -> Sprite
    }

    setViewMode (m) { this.viewMode = m; }
    setPalette (p) { this.palette = p; }

    rebuildAll (filterCtx) {
        for (const s of this._sprites.values()) s.destroy();
        this._sprites.clear();
        const hasResults = !!this.network.hasResults;
        for (const bus of this.network.buses) {
            if (!filterCtx.busPasses(bus)) continue;
            const pos = busPos(bus, this.viewMode, this.project);
            if (!pos) continue;
            const size = busSize(bus.vn_kv);
            const fill = hasResults ? busColor(bus.vmPu ?? 1.0) : this.palette.busNoResults;
            const tex = this.textures.busCircle(
                size,
                parseColor(fill),
                parseColor(this.palette.busStroke),
                BUS_MARKER_STROKE_WIDTH,
            );
            const sp = Sprite.from(tex);
            sp.anchor.set(0.5);
            sp.eventMode = 'static';
            sp.cursor = 'pointer';
            sp.__pixiKind = 'bus';
            sp.__pixiId = bus.id;
            sp.position.set(pos.x, pos.y);
            this.container.addChild(sp);
            this._sprites.set(bus.id, sp);
        }
        this.applyZoom();
    }

    /** Update only one bus position (after drag). */
    updateBusPosition (busId) {
        const sp = this._sprites.get(busId);
        if (!sp) return;
        const bus = this.busById.get(busId);
        const pos = busPos(bus, this.viewMode, this.project);
        if (pos) sp.position.set(pos.x, pos.y);
    }

    applyZoom () {
        const inv = 1 / this.viewport.scale;
        for (const sp of this._sprites.values()) sp.scale.set(inv);
    }

    onZoom () { this.applyZoom(); }

    getSprite (busId) { return this._sprites.get(busId); }

    destroy () {
        for (const s of this._sprites.values()) s.destroy();
        this._sprites.clear();
    }
}

function parseColor (hex) {
    return parseInt(hex.replace('#', ''), 16);
}
