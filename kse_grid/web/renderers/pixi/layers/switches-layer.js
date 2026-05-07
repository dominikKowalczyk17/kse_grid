/**
 * Switches layer — square sprites anchored near host bus (or first/last
 * line waypoint for lines that have one).
 */

import { Sprite } from 'pixi.js';
import { SWITCH_MARKER_OPACITY, SWITCH_MARKER_SIZE, SWITCH_MARKER_STROKE_WIDTH } from '/traces/constants.js';
import { switchAnchorPos } from '../geometry.js';

export class SwitchesLayer {
    constructor ({ container, viewport, network, busById, lineById, textures, palette, project }) {
        this.container = container;
        this.viewport = viewport;
        this.network = network;
        this.busById = busById;
        this.lineById = lineById;
        this.textures = textures;
        this.palette = palette;
        this.project = project;
        this.viewMode = 'graph';
        this._sprites = new Map(); // switchId -> Sprite
        this._switchById = new Map();
        for (const sw of (network.switches || [])) this._switchById.set(sw.id, sw);
    }

    setViewMode (m) { this.viewMode = m; }
    setPalette (p) { this.palette = p; }

    _texture () {
        return this.textures.squareMarker(
            SWITCH_MARKER_SIZE,
            parseColor(this.palette.switchFill),
            parseColor(this.palette.switchStroke),
            SWITCH_MARKER_STROKE_WIDTH,
        );
    }

    rebuildAll (filterCtx, lineByIdMap, trafoByIdMap) {
        for (const s of this._sprites.values()) s.destroy();
        this._sprites.clear();
        const tex = this._texture();
        for (const sw of (this.network.switches || [])) {
            if (!filterCtx.switchOk(sw, lineByIdMap, trafoByIdMap)) continue;
            const pos = switchAnchorPos(sw, this.busById, this.lineById, this.viewMode, this.project);
            if (!pos) continue;
            const sp = Sprite.from(tex);
            sp.anchor.set(0.5);
            sp.eventMode = 'static';
            sp.cursor = 'pointer';
            sp.alpha = SWITCH_MARKER_OPACITY;
            sp.__pixiKind = 'switch';
            sp.__pixiId = sw.id;
            sp.position.set(pos.x, pos.y);
            this.container.addChild(sp);
            this._sprites.set(sw.id, sp);
        }
        this.applyZoom();
    }

    updateSwitchesForBus (busIds) {
        for (const [id, sp] of this._sprites) {
            const sw = this._switchById.get(id);
            if (!sw) continue;
            if (!busIds.has(sw.busId) && !busIds.has(sw.remoteBusId)) continue;
            const pos = switchAnchorPos(sw, this.busById, this.lineById, this.viewMode, this.project);
            if (pos) sp.position.set(pos.x, pos.y);
        }
    }

    updateSwitchesForLine (lineId) {
        const ln = this.lineById.get(lineId);
        if (!ln) return;
        const busSet = new Set([ln.fromBus, ln.toBus]);
        for (const [id, sp] of this._sprites) {
            const sw = this._switchById.get(id);
            if (!sw) continue;
            if (sw.parentKind !== 'line' || sw.elementId !== lineId) continue;
            const pos = switchAnchorPos(sw, this.busById, this.lineById, this.viewMode, this.project);
            if (pos) sp.position.set(pos.x, pos.y);
            void busSet;
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
    }
}

function parseColor (hex) {
    return parseInt(hex.replace('#', ''), 16);
}
