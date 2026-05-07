/**
 * Pixi scene scaffolding: Application, viewport, and named layer Containers.
 * Layers are added in the order: lines → trafos → switches → arrows → buses
 * → bend → selection (top).
 */

import { Application, Container } from 'pixi.js';
import { Viewport } from './interactions/pan-zoom.js';
import { TextureCache } from './textures.js';

const LAYER_ORDER = [
    'lines',
    'trafoLines',
    'trafoCoils',
    'switches',
    'arrows',
    'buses',
    'bend',
    'selection',
];

export async function createScene ({ container, theme }) {
    const app = new Application();
    const bg = theme === 'light' ? 0xf8fafc : 0x0e1116;
    await app.init({
        background: bg,
        antialias: true,
        autoDensity: true,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        resizeTo: container,
    });
    container.appendChild(app.canvas);
    app.canvas.style.touchAction = 'none';
    app.canvas.style.display = 'block';
    app.canvas.style.width = '100%';
    app.canvas.style.height = '100%';

    const viewport = new Viewport({
        app,
        screenWidth: container.clientWidth,
        screenHeight: container.clientHeight,
    });
    app.stage.addChild(viewport.container);

    const layers = {};
    // Two parents per icon-style layer:
    //  - `*Anchor` is positioned in world space (untransformed children would
    //    keep world scale — too small/large at extreme zooms).
    //  - icon sprites live as children that we re-position on view changes,
    //    while their *scale* is kept zoom-invariant by setting a per-layer
    //    invariant container (for sprites we adjust each sprite individually
    //    to support per-element scale).
    for (const name of LAYER_ORDER) {
        const c = new Container();
        viewport.container.addChild(c);
        layers[name] = c;
    }

    const textures = new TextureCache(app.renderer);

    function destroy () {
        textures.destroy();
        app.destroy(true, { children: true, texture: false });
    }

    function setBackground (newTheme) {
        app.renderer.background.color = newTheme === 'light' ? 0xf8fafc : 0x0e1116;
    }

    function resize () {
        viewport.resize(container.clientWidth, container.clientHeight);
    }

    return { app, viewport, layers, textures, destroy, setBackground, resize };
}
