/**
 * Poland border outline on Pixi geo mode.
 *
 * Loads /poland_border.geojson once, draws each ring as a polyline in
 * projected world coords (Web Mercator at tile zoom 0).
 *
 * Line width is kept zoom-invariant by re-stroking on viewport zoomed events.
 */

import { Graphics } from 'pixi.js';
import { projectLonLat } from '../projection.js';

const BORDER_WIDTH_SCREEN_PX = 1.4;

export class BorderLayer {
    constructor ({ container, viewport, theme = 'dark' }) {
        this.container = container;
        this.viewport = viewport;
        this.theme = theme;
        this.rings = null;
        this.g = new Graphics();
        this.g.eventMode = 'none';
        container.addChild(this.g);
        this._onZoom = () => this.redraw();
        viewport.on('zoomed', this._onZoom);
        this.load();
    }

    async load () {
        try {
            const resp = await fetch('/poland_border.geojson');
            const data = await resp.json();
            this.rings = extractRings(data);
            this.redraw();
        } catch (_) {
            this.rings = null;
        }
    }

    setTheme (theme) {
        if (this.theme === theme) return;
        this.theme = theme;
        this.redraw();
    }

    redraw () {
        if (!this.rings) return;
        const color = this.theme === 'light' ? 0x1f2937 : 0xd0d7e2;
        const width = BORDER_WIDTH_SCREEN_PX / Math.max(this.viewport.scale, 1e-6);
        this.g.clear();
        for (const ring of this.rings) {
            if (!ring.length) continue;
            const first = projectLonLat(ring[0][0], ring[0][1]);
            this.g.moveTo(first.x, first.y);
            for (let i = 1; i < ring.length; i++) {
                const p = projectLonLat(ring[i][0], ring[i][1]);
                this.g.lineTo(p.x, p.y);
            }
        }
        this.g.stroke({ color, width, alpha: 0.85 });
    }

    destroy () {
        this.viewport.off('zoomed', this._onZoom);
        this.g.destroy({ children: true, texture: false });
    }
}

function extractRings (geojson) {
    const rings = [];
    const features = geojson?.features || (geojson?.type === 'Feature' ? [geojson] : []);
    for (const f of features) {
        const g = f?.geometry;
        if (!g) continue;
        if (g.type === 'Polygon') {
            for (const ring of g.coordinates) rings.push(ring);
        } else if (g.type === 'MultiPolygon') {
            for (const poly of g.coordinates) {
                for (const ring of poly) rings.push(ring);
            }
        } else if (g.type === 'LineString') {
            rings.push(g.coordinates);
        } else if (g.type === 'MultiLineString') {
            for (const ls of g.coordinates) rings.push(ls);
        }
    }
    return rings;
}
