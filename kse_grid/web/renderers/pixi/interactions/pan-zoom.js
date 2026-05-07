/**
 * Minimal viewport: a Pixi Container with wheel/drag pan-zoom and pinch.
 * Avoids dependence on pixi-viewport (which lags Pixi v8 compatibility).
 *
 * API:
 *   const v = new Viewport({ app, screenWidth, screenHeight });
 *   app.stage.addChild(v.container);
 *   v.fit({ minX, minY, maxX, maxY });
 *   v.on('zoomed', cb);   // emitted (rAF-coalesced) when scale changes
 *   v.on('moved', cb);    // emitted (rAF-coalesced) on pan
 *   v.scale, v.x, v.y    // proxies on container
 *   v.toWorld({x,y}) / v.toScreen({x,y})
 */

import { Container } from 'pixi.js';

export class Viewport extends EventTarget {
    constructor ({ app, screenWidth, screenHeight, minScale = 1e-6, maxScale = 1e6 }) {
        super();
        this.app = app;
        this.screenWidth = screenWidth;
        this.screenHeight = screenHeight;
        this.minScale = minScale;
        this.maxScale = maxScale;
        this.container = new Container();
        this.container.sortableChildren = false;
        this._enabled = true;
        this._dragging = null;
        this._pinch = null;
        this._zoomScheduled = false;
        this._moveScheduled = false;
        this._lastScale = 1;
        this._installEvents();
    }

    get scale () { return this.container.scale.x; }

    on (type, listener) { this.addEventListener(type, listener); return this; }
    off (type, listener) { this.removeEventListener(type, listener); }
    _emit (type) { this.dispatchEvent(new Event(type)); }

    _installEvents () {
        const canvas = this.app.canvas;
        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', e => e.preventDefault());

        canvas.addEventListener('wheel', e => {
            if (!this._enabled) return;
            e.preventDefault();
            const factor = Math.exp(-e.deltaY * 0.0015);
            const rect = canvas.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            this.zoomAt(sx, sy, factor);
        }, { passive: false });

        canvas.addEventListener('pointerdown', e => {
            if (!this._enabled) return;
            // Only pan with primary button when target is empty space (no Pixi event captured it).
            // Layers add their own pointerdown listeners on sprites; if those .stopPropagation()
            // they prevent us from starting a pan.
        });

        // Use raw DOM events for panning so it works regardless of Pixi event mode.
        let panActive = false;
        let panLastX = 0;
        let panLastY = 0;
        let panPointerId = null;

        const onDown = e => {
            if (!this._enabled) return;
            // Skip if a child interaction has already grabbed this pointer
            // (we install this on canvas so child Pixi handlers can stopPropagation
            // by setting `e.__pixiHandled = true` on the native event).
            if (e.__pixiHandled) return;
            if (e.button !== 0 && e.button !== 1 && e.pointerType !== 'touch') return;
            panActive = true;
            panPointerId = e.pointerId;
            panLastX = e.clientX;
            panLastY = e.clientY;
            canvas.setPointerCapture(e.pointerId);
        };
        const onMove = e => {
            if (!panActive || e.pointerId !== panPointerId) return;
            const dx = e.clientX - panLastX;
            const dy = e.clientY - panLastY;
            panLastX = e.clientX;
            panLastY = e.clientY;
            this.container.x += dx;
            this.container.y += dy;
            this._scheduleMoved();
        };
        const onUp = e => {
            if (e.pointerId !== panPointerId) return;
            panActive = false;
            try { canvas.releasePointerCapture(e.pointerId); } catch (_) { /* noop */ }
        };

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
    }

    setEnabled (enabled) { this._enabled = !!enabled; }

    _scheduleZoomed () {
        if (this._zoomScheduled) return;
        this._zoomScheduled = true;
        requestAnimationFrame(() => {
            this._zoomScheduled = false;
            this._emit('zoomed');
        });
    }

    _scheduleMoved () {
        if (this._moveScheduled) return;
        this._moveScheduled = true;
        requestAnimationFrame(() => {
            this._moveScheduled = false;
            this._emit('moved');
        });
    }

    zoomAt (screenX, screenY, factor) {
        const c = this.container;
        const newScale = Math.max(this.minScale, Math.min(this.maxScale, c.scale.x * factor));
        const realFactor = newScale / c.scale.x;
        if (realFactor === 1) return;
        c.x = screenX - (screenX - c.x) * realFactor;
        c.y = screenY - (screenY - c.y) * realFactor;
        c.scale.set(newScale);
        this._scheduleZoomed();
        this._scheduleMoved();
    }

    resize (w, h) {
        this.screenWidth = w;
        this.screenHeight = h;
    }

    /** Fit a world-space bbox into the viewport (with padding). */
    fit (bbox, padding = 24) {
        const w = this.screenWidth - padding * 2;
        const h = this.screenHeight - padding * 2;
        const bw = bbox.maxX - bbox.minX || 1;
        const bh = bbox.maxY - bbox.minY || 1;
        const s = Math.min(w / bw, h / bh);
        this.container.scale.set(s);
        this.container.x = padding + (w - bw * s) / 2 - bbox.minX * s;
        this.container.y = padding + (h - bh * s) / 2 - bbox.minY * s;
        this._scheduleZoomed();
        this._scheduleMoved();
    }

    toWorld ({ x, y }) {
        return {
            x: (x - this.container.x) / this.container.scale.x,
            y: (y - this.container.y) / this.container.scale.y,
        };
    }

    toScreen ({ x, y }) {
        return {
            x: x * this.container.scale.x + this.container.x,
            y: y * this.container.scale.y + this.container.y,
        };
    }

    getView () {
        return { scale: this.container.scale.x, x: this.container.x, y: this.container.y };
    }

    setView ({ scale, x, y }) {
        if (Number.isFinite(scale)) this.container.scale.set(scale);
        if (Number.isFinite(x)) this.container.x = x;
        if (Number.isFinite(y)) this.container.y = y;
        this._scheduleZoomed();
        this._scheduleMoved();
    }
}
