/**
 * Click-to-select. Pixi sprites for bus/switch dispatch directly via their
 * pointertap; lines & trafos are picked via the spatial / midpoint tests on
 * canvas pointertap.
 */

const CLICK_TOL_PX = 14;

export function setupSelection ({
    canvas, viewport, network, segmentIndex, trafosLayer, busesLayer, switchesLayer, onSelect, onError,
}) {
    function emit (sel) {
        try {
            onSelect(sel);
        } catch (err) {
            if (typeof onError === 'function') onError(err);
        }
    }

    function attachIcons () {
        for (const sp of busesLayer._sprites.values()) {
            sp.on('pointertap', evt => {
                const native = evt.nativeEvent || evt.data?.originalEvent;
                if (native) native.__pixiHandled = true;
                emit({ kind: 'bus', id: sp.__pixiId });
            });
        }
        for (const sp of switchesLayer._sprites.values()) {
            sp.on('pointertap', evt => {
                const native = evt.nativeEvent || evt.data?.originalEvent;
                if (native) native.__pixiHandled = true;
                emit({ kind: 'switch', id: sp.__pixiId });
            });
        }
    }
    attachIcons();

    let downAt = null;
    function onPointerDown (e) {
        if (e.button !== 0) return;
        downAt = { x: e.clientX, y: e.clientY };
    }
    function onPointerUp (e) {
        if (!downAt) return;
        const dx = e.clientX - downAt.x;
        const dy = e.clientY - downAt.y;
        downAt = null;
        if (Math.hypot(dx, dy) > 4) return; // it was a drag
        if (e.__pixiHandled) return;
        const rect = canvas.getBoundingClientRect();
        const world = viewport.toWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        const tol = CLICK_TOL_PX / viewport.scale;
        const lineHit = segmentIndex.pick(world.x, world.y, tol);
        if (lineHit) { emit({ kind: 'line', id: lineHit.lineId }); return; }
        const trHit = trafosLayer.pickAt(world.x, world.y, CLICK_TOL_PX);
        if (trHit) { emit({ kind: 'trafo', id: trHit.trafo.id }); return; }
        // empty click — clear
        emit(null);
    }

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    return {
        destroy () {
            canvas.removeEventListener('pointerdown', onPointerDown);
            canvas.removeEventListener('pointerup', onPointerUp);
        },
        refreshAttachments: attachIcons,
    };
    void network;
}
