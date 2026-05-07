/**
 * Bend interactions for selected line in edit-mode.
 *
 *   - drag a handle  → updates line.waypointsGraph[i]
 *   - SHIFT-click handle → removes that waypoint
 *   - click ghost (segment midpoint) → inserts new waypoint at that position
 *
 * After any mutation we ask the lines/switches/arrows layers to re-derive
 * geometry for the affected line.
 */

export function setupBend ({
    canvas, viewport, network,
    linesLayer, switchesLayer, arrowsLayer, selectionLayer, bendLayer,
    isEditMode,
}) {
    let drag = null; // { lineId, index, pointerId }
    let raf = 0;
    let pendingWorld = null;

    function attach () {
        for (const h of bendLayer._handles) {
            h.sprite.on('pointerdown', onHandleDown);
        }
        for (const g of bendLayer._ghosts) {
            g.sprite.on('pointerdown', onGhostDown);
        }
    }
    function detach () {
        for (const h of bendLayer._handles) h.sprite.off('pointerdown', onHandleDown);
        for (const g of bendLayer._ghosts) g.sprite.off('pointerdown', onGhostDown);
    }

    function onHandleDown (evt) {
        if (!isEditMode()) return;
        const native = evt.nativeEvent || evt.data?.originalEvent;
        if (native) native.__pixiHandled = true;
        const sp = evt.currentTarget || evt.target;
        const lineId = sp.__pixiLineId;
        const index = sp.__pixiIndex;
        if (native?.shiftKey) {
            removeWaypoint(lineId, index);
            return;
        }
        drag = { lineId, index, pointerId: native?.pointerId ?? -1 };
        sp.cursor = 'grabbing';
    }

    function onGhostDown (evt) {
        if (!isEditMode()) return;
        const native = evt.nativeEvent || evt.data?.originalEvent;
        if (native) native.__pixiHandled = true;
        const sp = evt.currentTarget || evt.target;
        const lineId = sp.__pixiLineId;
        const segIdx = sp.__pixiSegIdx;
        // Insert a new waypoint at the ghost's world position
        const ln = network.lines.find(l => l.id === lineId);
        if (!ln) return;
        if (!Array.isArray(ln.waypointsGraph)) ln.waypointsGraph = [];
        // Determine insertion index in waypointsGraph: ghost between extended pts (i-1) and i
        // pts = [from, ...wps, to], so segIdx 0 → before first wp; segIdx k → between wp[k-1] and wp[k];
        // segIdx wps.length → after last wp.
        const insertAt = segIdx; // index into waypointsGraph
        const newWp = { x: sp.position.x, y: -sp.position.y };
        ln.waypointsGraph.splice(insertAt, 0, newWp);
        applyMutation(lineId);
    }

    function onMove (e) {
        if (!drag) return;
        if (drag.pointerId !== -1 && e.pointerId !== drag.pointerId) return;
        const rect = canvas.getBoundingClientRect();
        pendingWorld = viewport.toWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        if (raf) return;
        raf = requestAnimationFrame(commit);
    }

    function commit () {
        raf = 0;
        if (!drag || !pendingWorld) return;
        const ln = network.lines.find(l => l.id === drag.lineId);
        if (!ln || !Array.isArray(ln.waypointsGraph)) return;
        const wp = ln.waypointsGraph[drag.index];
        if (!wp) return;
        wp.x = pendingWorld.x;
        wp.y = -pendingWorld.y;
        // partial update: only this line
        applyMutation(drag.lineId);
    }

    function onUp (e) {
        if (!drag) return;
        if (drag.pointerId !== -1 && e.pointerId !== drag.pointerId) return;
        if (raf) { cancelAnimationFrame(raf); raf = 0; commit(); }
        drag = null;
    }

    function removeWaypoint (lineId, index) {
        const ln = network.lines.find(l => l.id === lineId);
        if (!ln || !Array.isArray(ln.waypointsGraph)) return;
        ln.waypointsGraph.splice(index, 1);
        applyMutation(lineId);
    }

    function applyMutation (lineId) {
        linesLayer.updateLinePoints(lineId);
        linesLayer.redrawDirty();
        switchesLayer.updateSwitchesForLine(lineId);
        arrowsLayer.updateOne(`line:${lineId}`);
        selectionLayer.refresh();
        bendLayer.refresh();
        // re-attach handlers since refresh recreates sprites
        detach(); attach();
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
}
