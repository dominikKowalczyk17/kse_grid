/**
 * Hover interactions:
 *  - Pixi-native pointerover/out on bus & switch sprites for tooltips.
 *  - For lines/trafos we hit-test in raw pointermove (rAF-throttled) using
 *    the segment R-Bush index and trafo midpoint distance check.
 *  - A single absolutely-positioned <div> tooltip is updated on hover.
 */

import { busHover, lineHover, switchHover, trafoHover } from '/traces/hover.js';

const HOVER_PX = 14;

export function setupHover ({
    canvas, container, viewport, network, busById,
    linesLayer, trafosLayer, busesLayer, switchesLayer,
    segmentIndex,
}) {
    const tooltip = document.createElement('div');
    tooltip.className = 'pixi-tooltip';
    Object.assign(tooltip.style, {
        position: 'absolute',
        pointerEvents: 'none',
        background: 'rgba(20,24,32,0.92)',
        color: '#e6edf3',
        font: '12px Inter, system-ui, sans-serif',
        padding: '6px 8px',
        borderRadius: '4px',
        border: '1px solid #3a4357',
        zIndex: '10',
        maxWidth: '280px',
        lineHeight: '1.35',
        display: 'none',
        whiteSpace: 'pre-wrap',
    });
    container.appendChild(tooltip);

    let raf = 0;
    let lastEvent = null;
    let currentKind = null;
    let currentId = null;

    function setTip (html, screenX, screenY) {
        if (!html) {
            tooltip.style.display = 'none';
            currentKind = null;
            currentId = null;
            return;
        }
        tooltip.innerHTML = html;
        tooltip.style.display = 'block';
        const rect = container.getBoundingClientRect();
        const x = screenX - rect.left + 12;
        const y = screenY - rect.top + 12;
        tooltip.style.transform = `translate(${x}px, ${y}px)`;
    }

    function applyTheme (theme) {
        if (theme === 'light') {
            tooltip.style.background = 'rgba(255,255,255,0.97)';
            tooltip.style.color = '#1f2937';
            tooltip.style.borderColor = '#d1d5db';
        } else {
            tooltip.style.background = 'rgba(20,24,32,0.92)';
            tooltip.style.color = '#e6edf3';
            tooltip.style.borderColor = '#3a4357';
        }
    }

    function hitTest () {
        const e = lastEvent;
        if (!e) return;
        // Skip if hovering a sprite that already has an attached eventMode handler
        // (busesLayer/switchesLayer set their own); but for parity we still update tooltip on lines/trafos.
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const world = viewport.toWorld({ x: sx, y: sy });

        // Try lines first (most common)
        const tol = HOVER_PX / viewport.scale;
        const line = segmentIndex.pick(world.x, world.y, tol);
        if (line) {
            const ln = network.lines.find(l => l.id === line.lineId);
            if (ln) {
                if (currentKind !== 'line' || currentId !== ln.id) {
                    setTip(lineHover(ln, !!network.hasResults), e.clientX, e.clientY);
                    currentKind = 'line'; currentId = ln.id;
                } else {
                    setTip(tooltip.innerHTML, e.clientX, e.clientY);
                }
                return;
            }
        }
        // Trafos
        const trHit = trafosLayer.pickAt(world.x, world.y, HOVER_PX);
        if (trHit) {
            if (currentKind !== 'trafo' || currentId !== trHit.trafo.id) {
                setTip(trafoHover(trHit.trafo, !!network.hasResults), e.clientX, e.clientY);
                currentKind = 'trafo'; currentId = trHit.trafo.id;
            } else {
                setTip(tooltip.innerHTML, e.clientX, e.clientY);
            }
            return;
        }
        setTip('', 0, 0);
    }

    function onMove (e) {
        // If a sprite is currently displaying its tooltip, let pointerout
        // dismiss it — don't fight with the canvas hit-test.
        if (currentKind === 'bus' || currentKind === 'switch') return;
        lastEvent = e;
        if (raf) return;
        raf = requestAnimationFrame(() => {
            raf = 0;
            hitTest();
        });
    }
    function onLeave () {
        setTip('', 0, 0);
    }

    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    // Bus / switch sprite hovers — set tooltip directly.
    function attachIconHovers () {
        attachKind(busesLayer, 'bus', bus => busHover(bus, !!network.hasResults), id => busById.get(id));
        attachKind(switchesLayer, 'switch', sw => switchHover(sw),
            id => (network.switches || []).find(s => s.id === id));
    }
    function attachKind (layer, kind, render, lookup) {
        if (!layer || !layer._sprites) return;
        for (const sp of layer._sprites.values()) {
            sp.on('pointerover', evt => {
                const obj = lookup(sp.__pixiId);
                if (!obj) return;
                const native = evt.nativeEvent || evt.data?.originalEvent || evt;
                setTip(render(obj), native.clientX, native.clientY);
                currentKind = kind;
                currentId = sp.__pixiId;
            });
            sp.on('pointerout', () => setTip('', 0, 0));
            sp.on('pointermove', evt => {
                const native = evt.nativeEvent || evt.data?.originalEvent || evt;
                if (currentKind === kind && currentId === sp.__pixiId) {
                    setTip(tooltip.innerHTML, native.clientX, native.clientY);
                }
            });
        }
    }

    attachIconHovers();

    function destroy () {
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        if (raf) cancelAnimationFrame(raf);
        tooltip.remove();
    }

    return { destroy, applyTheme, refreshAttachments: attachIconHovers };
}
