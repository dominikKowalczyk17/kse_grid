/**
 * Live bus drag (edit mode). Updates the bus position in the network object
 * (mutates `bus.x` / `bus.y` in graph view; `bus.lon` / `bus.lat` in geo) and
 * redraws only incident layers via the bus-index.
 *
 * In geo mode positions are projected by the leaflet overlay; we still mutate
 * lon/lat and ask the project() callback to invalidate.
 */

export function setupBusDrag ({
    canvas, viewport, network, busById, busIndex,
    busesLayer, linesLayer, trafosLayer, switchesLayer, arrowsLayer, selectionLayer, bendLayer,
    onMoved,
    isGeo,
    isEditMode,
}) {
    let dragging = null; // { busId, sprite, pointerId }
    let raf = 0;
    let pendingPos = null;

    function attach () {
        for (const sp of busesLayer._sprites.values()) {
            sp.cursor = 'pointer';
            sp.on('pointerdown', onSpriteDown);
        }
    }
    function detach () {
        for (const sp of busesLayer._sprites.values()) sp.off('pointerdown', onSpriteDown);
    }

    function onSpriteDown (evt) {
        if (!isEditMode()) return;
        const native = evt.nativeEvent || evt.data?.originalEvent;
        if (native) native.__pixiHandled = true;
        const sp = evt.currentTarget || evt.target;
        const busId = sp.__pixiId;
        dragging = { busId, sprite: sp, pointerId: native?.pointerId ?? -1 };
        sp.cursor = 'grabbing';
        if (native) native.preventDefault();
    }

    function onMove (e) {
        if (!dragging) return;
        if (dragging.pointerId !== -1 && e.pointerId !== dragging.pointerId) return;
        const rect = canvas.getBoundingClientRect();
        const world = viewport.toWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        pendingPos = world;
        if (raf) return;
        raf = requestAnimationFrame(commit);
    }

    function commit () {
        raf = 0;
        if (!dragging || !pendingPos) return;
        const bus = busById.get(dragging.busId);
        if (!bus) return;
        // World y is negated relative to bus.y/lat
        if (isGeo()) {
            bus.lon = pendingPos.x;
            bus.lat = -pendingPos.y;
        } else {
            bus.x = pendingPos.x;
            bus.y = -pendingPos.y;
        }
        const movedSet = new Set([bus.id]);

        busesLayer.updateBusPosition(bus.id);
        const entry = busIndex.get(bus.id);
        if (entry) {
            for (const lineId of entry.lineIds) linesLayer.updateLinePoints(lineId);
            linesLayer.redrawDirty();
        }
        trafosLayer.onBusMoved(movedSet);
        trafosLayer.redraw();
        switchesLayer.updateSwitchesForBus(movedSet);
        arrowsLayer.onBusMoved(movedSet);
        selectionLayer.refresh();
        bendLayer.refresh();
    }

    function onUp (e) {
        if (!dragging) return;
        if (dragging.pointerId !== -1 && e.pointerId !== dragging.pointerId) return;
        const sp = dragging.sprite;
        const id = dragging.busId;
        sp.cursor = 'pointer';
        dragging = null;
        if (raf) { cancelAnimationFrame(raf); raf = 0; commit(); }
        onMoved?.(id);
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    attach();

    return {
        destroy () {
            canvas.removeEventListener('pointermove', onMove);
            canvas.removeEventListener('pointerup', onUp);
            canvas.removeEventListener('pointercancel', onUp);
            detach();
        },
        refreshAttachments: () => { detach(); attach(); },
    };
    void network;
}
