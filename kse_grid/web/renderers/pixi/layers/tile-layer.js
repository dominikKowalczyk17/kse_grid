/**
 * Raster XYZ tile layer for Pixi geo mode.
 *
 * - Fetches Carto Positron/Darkmatter tiles (same source Plotly mapbox used).
 * - One Sprite per tile, positioned in world coords via projection.tileBounds().
 * - Picks tile zoom from viewport.scale; culls off-screen tiles each frame.
 * - LRU eviction (kept generous: ~256 sprites — Poland easily fits).
 *
 * Triggers refresh on viewport `zoomed` and `moved` events.
 */

import { Assets, Sprite } from 'pixi.js';
import { pickTileZoom, tileBounds, TILE_SIZE, unprojectXY } from '../projection.js';

const TILE_URLS = {
    light: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
    dark: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
};
const MAX_CACHE = 256;

export class TileLayer {
    constructor ({ container, viewport, theme = 'dark' }) {
        this.container = container;
        this.viewport = viewport;
        this.theme = theme;
        this.sprites = new Map();      // key "z/x/y" -> Sprite
        this.loading = new Set();
        this.refreshScheduled = false;
        this._onView = () => this.scheduleRefresh();
        viewport.on('moved', this._onView);
        viewport.on('zoomed', this._onView);
    }

    setTheme (theme) {
        if (theme === this.theme) return;
        this.theme = theme;
        this.clear();
        this.scheduleRefresh();
    }

    clear () {
        for (const s of this.sprites.values()) {
            s.destroy({ children: true, texture: false });
        }
        this.sprites.clear();
    }

    scheduleRefresh () {
        if (this.refreshScheduled) return;
        this.refreshScheduled = true;
        requestAnimationFrame(() => {
            this.refreshScheduled = false;
            this.refresh();
        });
    }

    refresh () {
        const v = this.viewport;
        if (!v || !v.screenWidth || !v.screenHeight) return;
        const z = pickTileZoom(v.scale);
        const n = Math.pow(2, z);
        const tileWorld = TILE_SIZE / n;

        // World bounds of the current screen rectangle
        const tl = v.toWorld({ x: 0, y: 0 });
        const br = v.toWorld({ x: v.screenWidth, y: v.screenHeight });
        const txMin = Math.max(0, Math.floor(tl.x / tileWorld) - 1);
        const tyMin = Math.max(0, Math.floor(tl.y / tileWorld) - 1);
        const txMax = Math.min(n - 1, Math.floor(br.x / tileWorld) + 1);
        const tyMax = Math.min(n - 1, Math.floor(br.y / tileWorld) + 1);

        const wanted = new Set();
        for (let tx = txMin; tx <= txMax; tx++) {
            for (let ty = tyMin; ty <= tyMax; ty++) {
                wanted.add(`${z}/${tx}/${ty}`);
                this.ensureTile(z, tx, ty);
            }
        }

        // Cull tiles outside the viewport or at a different zoom (with LRU headroom).
        if (this.sprites.size > MAX_CACHE) {
            for (const [key, sprite] of this.sprites) {
                if (!wanted.has(key)) {
                    sprite.destroy({ children: true, texture: false });
                    this.sprites.delete(key);
                    if (this.sprites.size <= MAX_CACHE * 0.8) break;
                }
            }
        }

        // Hide tiles not in current zoom level (keep them cached briefly to avoid
        // re-fetching during pinch-zoom flutter).
        for (const [key, sprite] of this.sprites) {
            sprite.visible = wanted.has(key);
        }
    }

    ensureTile (z, tx, ty) {
        const key = `${z}/${tx}/${ty}`;
        if (this.sprites.has(key)) return;
        if (this.loading.has(key)) return;

        const url = TILE_URLS[this.theme].replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
        this.loading.add(key);
        Assets.load(url).then(texture => {
            this.loading.delete(key);
            if (!this.container || this.container.destroyed) return;
            const sprite = new Sprite(texture);
            const b = tileBounds(tx, ty, z);
            sprite.x = b.x;
            sprite.y = b.y;
            sprite.width = b.size;
            sprite.height = b.size;
            sprite.eventMode = 'none';
            this.container.addChild(sprite);
            this.sprites.set(key, sprite);
        }).catch(() => {
            this.loading.delete(key);
        });
    }

    destroy () {
        this.viewport.off('moved', this._onView);
        this.viewport.off('zoomed', this._onView);
        this.clear();
    }
}
