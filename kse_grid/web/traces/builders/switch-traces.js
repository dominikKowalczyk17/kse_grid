/**
 * Builder traces dla switchy: grupowanie po (poziom napięcia × parentKind).
 */

import {
    SWITCH_MARKER_OPACITY,
    SWITCH_MARKER_SIZE,
    SWITCH_MARKER_STROKE_WIDTH,
} from '/traces/constants.js';
import { switchMarkerCoords } from '/traces/geometry.js';
import { switchHover } from '/traces/hover.js';
import { lineVisible, trafoVisible } from '/traces/visibility.js';

export function buildSwitchTraces(ctx) {
    const {
        switches, busById, lineById, trafoById, keys, viewMode,
        voltageLevels, voltageSet, minLineLoading, branchPasses, palette,
    } = ctx;

    const traces = [];
    const meta = [];

    for (const level of voltageLevels) {
        const atLevel = switches.filter(sw => {
            if (sw.voltage !== level) return false;
            if (sw.parentKind === 'line') {
                const parent = lineById[sw.elementId];
                return parent ? lineVisible(parent, voltageSet, minLineLoading, branchPasses) : false;
            }
            if (sw.parentKind === 'trafo') {
                const parent = trafoById[sw.elementId];
                return parent ? trafoVisible(parent, voltageSet, minLineLoading, branchPasses) : false;
            }
            return false;
        });

        for (const parentKind of ['line', 'trafo']) {
            const inParent = atLevel.filter(sw => sw.parentKind === parentKind);
            if (!inParent.length) continue;

            const xs = [];
            const ys = [];
            const hovers = [];
            const ids = [];
            for (const sw of inParent) {
                const coords = switchMarkerCoords(sw, busById, viewMode);
                if (!coords) continue;
                xs.push(coords.x);
                ys.push(coords.y);
                hovers.push(switchHover(sw));
                ids.push(sw.id);
            }
            if (!ids.length) continue;

            traces.push({
                type: keys.traceType,
                [keys.x]: xs,
                [keys.y]: ys,
                mode: 'markers',
                marker: {
                    size: SWITCH_MARKER_SIZE,
                    color: palette.switchFill,
                    opacity: SWITCH_MARKER_OPACITY,
                    line: { width: SWITCH_MARKER_STROKE_WIDTH, color: palette.switchStroke },
                },
                text: hovers,
                hovertemplate: '%{text}<extra></extra>',
                showlegend: false,
            });
            meta.push({ kind: 'switch', parentKind, voltage: level, ids });
        }
    }

    return { traces, meta };
}
