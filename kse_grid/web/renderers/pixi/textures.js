/**
 * Procedural texture generator for icon sprites (buses, switches, arrows,
 * trafo coils, selection ring). All textures render at a constant canonical
 * pixel size and are then scaled per-sprite. Cached by composite key.
 */

import { Graphics } from 'pixi.js';

export class TextureCache {
    constructor (renderer) {
        this.renderer = renderer;
        this._map = new Map();
    }

    _make (key, draw) {
        if (this._map.has(key)) return this._map.get(key);
        const g = new Graphics();
        draw(g);
        // Use a small padding via bounds so anti-aliased outlines aren't clipped.
        const tex = this.renderer.generateTexture({
            target: g,
            resolution: Math.min(2, window.devicePixelRatio || 1),
        });
        g.destroy();
        this._map.set(key, tex);
        return tex;
    }

    /** Filled circle with stroke. */
    busCircle (size, fill, stroke, strokeWidth) {
        const r = size / 2;
        const key = `bus|${size}|${fill}|${stroke}|${strokeWidth}`;
        return this._make(key, g => {
            g.circle(r + strokeWidth, r + strokeWidth, r)
                .fill({ color: fill })
                .stroke({ color: stroke, width: strokeWidth, alignment: 0.5 });
        });
    }

    /** Filled square with stroke (switch). */
    squareMarker (size, fill, stroke, strokeWidth) {
        const half = size / 2;
        const pad = strokeWidth;
        const key = `sq|${size}|${fill}|${stroke}|${strokeWidth}`;
        return this._make(key, g => {
            g.rect(pad, pad, size, size)
                .fill({ color: fill })
                .stroke({ color: stroke, width: strokeWidth, alignment: 0.5 });
        });
    }

    /** Equilateral upward triangle (anchored at sprite center). */
    arrowTriangle (size, fill, stroke, strokeWidth) {
        const key = `arr|${size}|${fill}|${stroke}|${strokeWidth}`;
        const pad = strokeWidth + 1;
        const w = size;
        const h = size;
        return this._make(key, g => {
            g.moveTo(pad + w / 2, pad)
                .lineTo(pad + w, pad + h)
                .lineTo(pad, pad + h)
                .lineTo(pad + w / 2, pad)
                .fill({ color: fill })
                .stroke({ color: stroke, width: strokeWidth, alignment: 0.5 });
        });
    }

    /** Hollow circle for trafo IEC coil. */
    coilRing (radius, color, lineWidth) {
        const key = `coil|${radius}|${color}|${lineWidth}`;
        const pad = lineWidth + 1;
        return this._make(key, g => {
            g.circle(pad + radius, pad + radius, radius)
                .stroke({ color, width: lineWidth, alignment: 0.5 });
        });
    }

    /** Selection ring (hollow circle, two-tone via outer+inner sprites). */
    ring (radius, color, lineWidth) {
        const key = `ring|${radius}|${color}|${lineWidth}`;
        const pad = lineWidth + 1;
        return this._make(key, g => {
            g.circle(pad + radius, pad + radius, radius)
                .stroke({ color, width: lineWidth, alignment: 0.5 });
        });
    }

    destroy () {
        for (const tex of this._map.values()) tex.destroy(true);
        this._map.clear();
    }
}
