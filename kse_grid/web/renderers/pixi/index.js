/**
 * Pixi renderer controller — public API for graph-panel.js.
 *
 *   const ctrl = await mountPixi(container, network, opts);
 *   ctrl.render({ filters, theme, viewMode });
 *   ctrl.setSelection({ kind, id } | null);
 *   ctrl.setFilters(filters);
 *   ctrl.setEditMode(bool);
 *   ctrl.setTheme('dark'|'light');
 *   ctrl.refreshSelection();
 *   ctrl.focus({ kind, id });
 *   ctrl.resetView();
 *   ctrl.destroy();
 *
 * Wires together the scene, layers, indices and interaction modules. Owns
 * the BusIndex/SegmentIndex/lookup maps for the lifetime of one network.
 */

import { tracePalette } from '/traces/palette.js';
import { disconnectedBranchIds } from '/traces/visibility.js';
import { createScene } from './scene.js';
import { makeFilterContext } from './filters.js';
import { BusIndex } from './index/bus-index.js';
import { SegmentIndex } from './index/segment-index.js';
import { LinesLayer } from './layers/lines-layer.js';
import { TrafosLayer } from './layers/trafos-layer.js';
import { BusesLayer } from './layers/buses-layer.js';
import { SwitchesLayer } from './layers/switches-layer.js';
import { ArrowsLayer } from './layers/arrows-layer.js';
import { SelectionLayer } from './layers/selection-layer.js';
import { BendLayer } from './layers/bend-layer.js';
import { setupHover } from './interactions/hover.js';
import { setupSelection } from './interactions/selection.js';
import { setupBusDrag } from './interactions/drag-bus.js';
import { setupBend } from './interactions/bend.js';

export async function mountPixi (container, network, opts = {}) {
    const theme = opts.theme || 'dark';
    const viewMode = opts.viewMode || 'graph';
    const onSelect = opts.onSelect || (() => {});

    const scene = await createScene({ container, theme });
    const { app, viewport, layers, textures } = scene;

    let palette = tracePalette(theme);
    let filterCtx = makeFilterContext(network, opts.filters || {});
    let disc = disconnectedBranchIds(network.switches || []);
    let editMode = !!opts.editMode;
    let currentTheme = theme;
    let currentViewMode = viewMode;

    const busById = new Map(network.buses.map(b => [b.id, b]));
    const lineById = new Map(network.lines.map(l => [l.id, l]));
    const trafoById = new Map(network.trafos.map(t => [t.id, t]));

    const busIndex = BusIndex.build(network);
    const segmentIndex = new SegmentIndex();

    const project = null; // graph view; geo overlay would supply one

    const linesLayer = new LinesLayer({
        container: layers.lines, viewport, network, busById, segmentIndex, project,
    });
    const trafosLayer = new TrafosLayer({
        linesContainer: layers.trafoLines, coilsContainer: layers.trafoCoils,
        viewport, network, busById, textures, palette, project,
    });
    const busesLayer = new BusesLayer({
        container: layers.buses, viewport, network, busById, textures, palette, project,
    });
    const switchesLayer = new SwitchesLayer({
        container: layers.switches, viewport, network, busById, lineById, textures, palette, project,
    });
    const arrowsLayer = new ArrowsLayer({
        container: layers.arrows, viewport, network, busById, textures, palette, project,
        getLinePoints: id => linesLayer.getLinePoints(id),
    });
    const selectionLayer = new SelectionLayer({
        container: layers.selection, viewport, network, busById, textures, palette, project,
        getLinePoints: id => linesLayer.getLinePoints(id),
    });
    selectionLayer.init();
    const bendLayer = new BendLayer({
        container: layers.bend, viewport, network, busById, textures, project,
        getLinePoints: id => linesLayer.getLinePoints(id),
    });

    function setViewMode (m) {
        currentViewMode = m;
        for (const layer of [linesLayer, trafosLayer, busesLayer, switchesLayer, arrowsLayer, selectionLayer, bendLayer]) {
            layer.setViewMode?.(m);
        }
    }
    setViewMode(viewMode);

    function rebuildAll () {
        linesLayer.rebuildAll(filterCtx, disc);
        trafosLayer.rebuildAll(filterCtx, disc);
        switchesLayer.rebuildAll(filterCtx, lineById, trafoById);
        busesLayer.rebuildAll(filterCtx);
        arrowsLayer.rebuildAll(filterCtx, disc);
        selectionLayer.refresh();
        // re-attach hover/select to new sprites
        hover.refreshAttachments();
        selection.refreshAttachments();
        drag.refreshAttachments();
        // fit on first build
        if (!firstFitDone) {
            fitToContent();
            firstFitDone = true;
        }
    }

    let firstFitDone = false;
    function fitToContent () {
        const bbox = computeBBox(network);
        if (bbox) viewport.fit(bbox, 32);
        applyZoomAll();
    }

    // Honour caller-supplied initial viewport (e.g. when remounting after a
    // network swap): skip first fit and restore the previous camera state.
    if (opts.initialView && Number.isFinite(opts.initialView.scale)) {
        firstFitDone = true;
    }

    function applyZoomAll () {
        linesLayer.onZoom();
        trafosLayer.onZoom();
        busesLayer.onZoom();
        switchesLayer.onZoom();
        arrowsLayer.onZoom();
        selectionLayer.onZoom();
        bendLayer.onZoom();
    }

    viewport.on('zoomed', applyZoomAll);

    // Resize observer
    const ro = new ResizeObserver(() => {
        scene.resize();
        app.renderer.resize(container.clientWidth, container.clientHeight);
    });
    ro.observe(container);

    // Interactions
    const canvas = app.canvas;
    const hover = setupHover({
        canvas, container, viewport, network, busById,
        linesLayer, trafosLayer, busesLayer, switchesLayer, segmentIndex,
    });
    hover.applyTheme(theme);

    const selection = setupSelection({
        canvas, viewport, network, segmentIndex, trafosLayer, busesLayer, switchesLayer,
        onSelect: sel => {
            selectionLayer.setSelection(sel);
            onSelect(sel);
            if (editMode && sel?.kind === 'line') {
                bendLayer.show(sel.id);
                bend.refreshAttachments();
            } else {
                bendLayer.hide();
            }
        },
    });

    const drag = setupBusDrag({
        canvas, viewport, network, busById, busIndex,
        busesLayer, linesLayer, trafosLayer, switchesLayer, arrowsLayer, selectionLayer, bendLayer,
        isGeo: () => currentViewMode === 'geo',
        isEditMode: () => editMode,
        onMoved: () => {},
    });

    const bend = setupBend({
        canvas, viewport, network,
        linesLayer, switchesLayer, arrowsLayer, selectionLayer, bendLayer,
        isEditMode: () => editMode,
    });

    // Initial draw
    rebuildAll();
    if (opts.initialView && Number.isFinite(opts.initialView.scale)) {
        viewport.setView(opts.initialView);
        applyZoomAll();
    }

    return {
        render ({ filters, theme: th, viewMode: vm } = {}) {
            if (filters) filterCtx = makeFilterContext(network, filters);
            if (th && th !== currentTheme) {
                currentTheme = th;
                palette = tracePalette(th);
                trafosLayer.setPalette(palette);
                busesLayer.setPalette(palette);
                switchesLayer.setPalette(palette);
                arrowsLayer.setPalette(palette);
                selectionLayer.setPalette(palette);
                scene.setBackground(th);
                hover.applyTheme(th);
            }
            if (vm && vm !== currentViewMode) setViewMode(vm);
            disc = disconnectedBranchIds(network.switches || []);
            rebuildAll();
        },
        setFilters (filters) {
            filterCtx = makeFilterContext(network, filters);
            rebuildAll();
        },
        setSelection (sel) {
            selectionLayer.setSelection(sel);
            if (editMode && sel?.kind === 'line') {
                bendLayer.show(sel.id);
                bend.refreshAttachments();
            } else {
                bendLayer.hide();
            }
        },
        refreshSelection () { selectionLayer.refresh(); },
        setEditMode (on) {
            editMode = !!on;
            if (!editMode) bendLayer.hide();
        },
        setTheme (th) {
            currentTheme = th;
            palette = tracePalette(th);
            trafosLayer.setPalette(palette);
            busesLayer.setPalette(palette);
            switchesLayer.setPalette(palette);
            arrowsLayer.setPalette(palette);
            selectionLayer.setPalette(palette);
            scene.setBackground(th);
            hover.applyTheme(th);
            rebuildAll();
        },
        focus ({ kind, id }) {
            const pos = locate(kind, id, busById, network, currentViewMode);
            if (!pos) return;
            // Center the world point on screen, keep current zoom.
            viewport.container.x = scene.app.canvas.width / 2 / (window.devicePixelRatio || 1) - pos.x * viewport.scale;
            viewport.container.y = scene.app.canvas.height / 2 / (window.devicePixelRatio || 1) - pos.y * viewport.scale;
            applyZoomAll();
            selectionLayer.refresh();
        },
        resetView () { fitToContent(); },
        getView () { return viewport.getView(); },
        destroy () {
            ro.disconnect();
            hover.destroy();
            selection.destroy();
            drag.destroy();
            bend.destroy();
            linesLayer.destroy();
            trafosLayer.destroy();
            busesLayer.destroy();
            switchesLayer.destroy();
            arrowsLayer.destroy();
            selectionLayer.destroy();
            bendLayer.destroy();
            scene.destroy();
        },
    };
}

function computeBBox (network) {
    let minX = +Infinity, minY = +Infinity, maxX = -Infinity, maxY = -Infinity, n = 0;
    for (const b of network.buses) {
        if (b.x == null || b.y == null) continue;
        if (b.x < minX) minX = b.x;
        if (b.x > maxX) maxX = b.x;
        const y = -b.y;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        n++;
    }
    if (!n) return null;
    return { minX, minY, maxX, maxY };
}

function locate (kind, id, busById, network, viewMode) {
    const isGeo = viewMode === 'geo';
    function pos (b) {
        if (!b) return null;
        if (isGeo) return b.lon == null ? null : { x: b.lon, y: -b.lat };
        return b.x == null ? null : { x: b.x, y: -b.y };
    }
    if (kind === 'bus') return pos(busById.get(id));
    if (kind === 'line') {
        const ln = network.lines.find(l => l.id === id);
        if (!ln) return null;
        const a = pos(busById.get(ln.fromBus));
        const b = pos(busById.get(ln.toBus));
        return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    }
    if (kind === 'trafo') {
        const tr = network.trafos.find(t => t.id === id);
        if (!tr) return null;
        const a = pos(busById.get(tr.hvBus));
        const b = pos(busById.get(tr.lvBus));
        return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    }
    if (kind === 'switch') {
        const sw = (network.switches || []).find(s => s.id === id);
        return pos(busById.get(sw?.busId));
    }
    return null;
}
