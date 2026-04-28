/**
 * Builduje listę traces dla Plotly z surowych danych sieci.
 * Zachowuje wzorzec dwóch traces na grupę (polyline + niewidoczne markery do hovera).
 */

const BUS_BINS = [
    { label: '< 0.90 (krytycznie niskie)', test: v => v < 0.90,                color: '#6A1B9A' },
    { label: '0.90–0.95 (niskie)',          test: v => v >= 0.90 && v < 0.95,  color: '#1E88E5' },
    { label: '0.95–1.05 (OK)',              test: v => v >= 0.95 && v <= 1.05, color: '#43A047' },
    { label: '1.05–1.10 (wysokie)',         test: v => v > 1.05  && v <= 1.10, color: '#FB8C00' },
    { label: '> 1.10 (krytycznie wysokie)', test: v => v > 1.10,                color: '#D32F2F' },
];

function busColor(vmPu) {
    for (const bin of BUS_BINS) if (bin.test(vmPu)) return bin.color;
    return '#9aa4b2';
}

const LINE_BINS = [
    { label: '0-40%',   lower: 0,   upper: 40,       color: '#43A047' },
    { label: '40-70%',  lower: 40,  upper: 70,       color: '#F9A825' },
    { label: '70-100%', lower: 70,  upper: 100,      color: '#FB8C00' },
    { label: '>100%',   lower: 100, upper: Infinity, color: '#D32F2F' },
];

const TRAFO_BINS = [
    { label: '0-40%',   lower: 0,   upper: 40,       color: '#90CAF9' },
    { label: '40-70%',  lower: 40,  upper: 70,       color: '#26A69A' },
    { label: '70-100%', lower: 70,  upper: 100,      color: '#FFB300' },
    { label: '>100%',   lower: 100, upper: Infinity, color: '#C62828' },
];

function lineWidth(voltage) {
    if (voltage >= 400) return 3.6;
    if (voltage >= 220) return 2.6;
    if (voltage >= 110) return 1.7;
    return 1.2;
}

function busSize(voltage) {
    if (voltage >= 400) return 14;
    if (voltage >= 220) return 12;
    if (voltage >= 110) return 10;
    return 8;
}

function fmt(value, digits = 1) {
    if (value === null || value === undefined) return '—';
    return Number(value).toFixed(digits);
}

function lineHover(line, hasResults) {
    const lines = [
        `<b>${line.name}</b>`,
        `Napięcie: ${line.voltage.toFixed(0)} kV`,
        `Długość: ${fmt(line.lengthKm)} km${line.lengthSource === 'model' ? ' (model)' : ''}`,
    ];
    if (hasResults) {
        lines.push(`Obciążenie: ${fmt(line.loading)}%`);
        lines.push(`P od strony from: ${fmt(line.pFromMw)} MW`);
    }
    return lines.join('<br>');
}

function trafoHover(trafo, hasResults) {
    const lines = [
        `<b>${trafo.name}</b>`,
        `Trafo ${trafo.vnHvKv.toFixed(0)}/${trafo.vnLvKv.toFixed(0)} kV`,
        `Moc znamionowa: ${fmt(trafo.snMva, 0)} MVA`,
    ];
    if (hasResults) {
        lines.push(`Obciążenie: ${fmt(trafo.loading)}%`);
        lines.push(`P po stronie HV: ${fmt(trafo.pHvMw)} MW`);
    }
    return lines.join('<br>');
}

function busHover(bus, hasResults) {
    const lines = [
        `<b>${bus.name}</b>`,
        `Napięcie znamionowe: ${bus.vn_kv.toFixed(0)} kV`,
    ];
    if (hasResults) {
        lines.push(`Um: ${fmt(bus.vmPu, 4)} p.u.`);
        lines.push(`Kąt: ${fmt(bus.vaDeg, 2)}°`);
    }
    if (bus.genMw > 0) lines.push(`Generacja: ${fmt(bus.genMw)} MW`);
    if (bus.loadMw > 0) lines.push(`Obciążenie: ${fmt(bus.loadMw)} MW`);
    return lines.join('<br>');
}

function isGeoMode(viewMode) {
    return viewMode === 'geo';
}

function pointKeys(viewMode) {
    return isGeoMode(viewMode) ? { x: 'lon', y: 'lat', traceType: 'scattermapbox' }
                               : { x: 'x', y: 'y', traceType: 'scattergl' };
}

function busCoords(bus, viewMode) {
    const keys = pointKeys(viewMode);
    const x = bus[keys.x];
    const y = bus[keys.y];
    return x == null || y == null ? null : { x, y };
}

function trafoSymbolCoords(from, to, viewMode) {
    const midX = (from.x + to.x) / 2;
    const midY = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);

    // Offset jest dobrany tak, żeby przy domyślnym zoomie dwa kółka
    // mocno się zachodziły, tworząc jeden zwarty symbol IEC 60417-5156.
    // Wartość = ~30% promienia markera w danych (size=18 → r≈9px, separacja środków ≈ 6px).
    const baseOffset = viewMode === 'geo' ? 0.0014 : 0.0045;

    let tx, ty;
    if (length < 1e-9) {
        tx = 0;
        ty = 1;
    } else {
        tx = dx / length;
        ty = dy / length;
    }
    const offset = length < 1e-9 ? baseOffset : Math.min(baseOffset, length * 0.45);
    return {
        coilA: { x: midX - tx * offset, y: midY - ty * offset },
        coilB: { x: midX + tx * offset, y: midY + ty * offset },
    };
}

function trafoShapeCircles(from, to, color, radius) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    let tx, ty;
    if (len < 1e-9) {
        tx = 0;
        ty = 1;
    } else {
        tx = dx / len;
        ty = dy / len;
    }
    const sep = radius * 0.6;
    const cAx = mx - tx * sep;
    const cAy = my - ty * sep;
    const cBx = mx + tx * sep;
    const cBy = my + ty * sep;
    const lineSpec = { color, width: 1.6 };
    return [
        {
            type: 'circle', xref: 'x', yref: 'y',
            x0: cAx - radius, x1: cAx + radius,
            y0: cAy - radius, y1: cAy + radius,
            line: lineSpec,
            fillcolor: 'rgba(0,0,0,0)',
            layer: 'above',
        },
        {
            type: 'circle', xref: 'x', yref: 'y',
            x0: cBx - radius, x1: cBx + radius,
            y0: cBy - radius, y1: cBy + radius,
            line: lineSpec,
            fillcolor: 'rgba(0,0,0,0)',
            layer: 'above',
        },
    ];
}

export function buildTraces(network, viewMode = 'graph') {
    const { buses, lines, trafos, voltageLevels, hasResults, graphBounds } = network;
    const busById = Object.fromEntries(buses.map(b => [b.id, b]));
    const keys = pointKeys(viewMode);

    const traces = [];
    const meta = [];
    const shapes = [];

    let trafoRadius = 0.04;
    if (viewMode !== 'geo' && graphBounds?.x) {
        const dx = graphBounds.x[1] - graphBounds.x[0];
        trafoRadius = Math.max(dx * 0.00008, 0.00002);
    }

    // ----- linie
    for (const level of voltageLevels) {
        const linesAtLevel = lines.filter(l => l.voltage === level);
        for (const bin of LINE_BINS) {
            const inBin = linesAtLevel.filter(l => l.loading >= bin.lower && l.loading < bin.upper);
            if (!inBin.length) continue;

            const xs = [], ys = [], midX = [], midY = [], hovers = [], ids = [];
            for (const ln of inBin) {
                const f = busById[ln.fromBus], t = busById[ln.toBus];
                const from = f ? busCoords(f, viewMode) : null;
                const to = t ? busCoords(t, viewMode) : null;
                if (!from || !to) continue;
                xs.push(from.x, to.x, null);
                ys.push(from.y, to.y, null);
                midX.push((from.x + to.x) / 2);
                midY.push((from.y + to.y) / 2);
                hovers.push(lineHover({ ...ln }, hasResults));
                ids.push(ln.id);
            }
            if (!ids.length) continue;

            traces.push({
                type: keys.traceType, [keys.x]: xs, [keys.y]: ys, mode: 'lines',
                line: { color: bin.color, width: lineWidth(level) },
                hoverinfo: 'skip',
                showlegend: false,
            });
            meta.push({ kind: 'line', voltage: level, ids: [] });

            traces.push({
                type: keys.traceType, [keys.x]: midX, [keys.y]: midY, mode: 'markers',
                marker: { size: Math.max(lineWidth(level) * 2.5, 8), color: bin.color, opacity: 0.25 },
                text: hovers,
                hovertemplate: '%{text}<extra></extra>',
                showlegend: false,
            });
            meta.push({ kind: 'line', voltage: level, ids });
        }
    }

    // ----- transformatory (grupa po napięciu LV)
    const useShapes = viewMode !== 'geo';
    const lvLevels = [...new Set(trafos.map(t => t.vnLvKv))].sort((a, b) => b - a);
    for (const lv of lvLevels) {
        const atLv = trafos.filter(t => t.vnLvKv === lv);
        for (const bin of TRAFO_BINS) {
            const inBin = atLv.filter(t => t.loading >= bin.lower && t.loading < bin.upper);
            if (!inBin.length) continue;

            const xs = [], ys = [], midX = [], midY = [], hovers = [], ids = [];
            for (const tr of inBin) {
                const hv = busById[tr.hvBus], lvBus = busById[tr.lvBus];
                const from = hv ? busCoords(hv, viewMode) : null;
                const to = lvBus ? busCoords(lvBus, viewMode) : null;
                if (!from || !to) continue;
                xs.push(from.x, to.x, null);
                ys.push(from.y, to.y, null);
                const mx = (from.x + to.x) / 2;
                const my = (from.y + to.y) / 2;
                midX.push(mx);
                midY.push(my);
                hovers.push(trafoHover(tr, hasResults));
                ids.push(tr.id);
                if (useShapes) {
                    shapes.push(...trafoShapeCircles(from, to, bin.color, trafoRadius));
                }
            }
            if (!ids.length) continue;

            // linia kropkowana między szynami
            traces.push({
                type: keys.traceType, [keys.x]: xs, [keys.y]: ys, mode: 'lines',
                line: { color: bin.color, width: 2.2, dash: 'dot' },
                hoverinfo: 'skip',
                showlegend: false,
            });
            meta.push({ kind: 'trafo', voltage: lv, ids: [] });

            // pojedynczy punkt hovera/klikania nad symbolem IEC (jeden tooltip per trafo)
            // - w trybie graph: niewidoczny (symbol rysowany przez layout.shapes)
            // - w trybie geo: widoczny marker (mapbox nie wspiera shapes)
            const hoverMarker = useShapes
                ? { size: 24, color: 'rgba(0,0,0,0)', line: { width: 0 } }
                : { size: 12, color: bin.color, opacity: 0.9, symbol: 'circle' };
            traces.push({
                type: keys.traceType, [keys.x]: midX, [keys.y]: midY, mode: 'markers',
                marker: hoverMarker,
                text: hovers,
                hovertemplate: '%{text}<extra></extra>',
                showlegend: false,
            });
            meta.push({ kind: 'trafo', voltage: lv, ids });
        }
    }

    // ----- szyny
    let firstBusTrace = true;
    for (const level of voltageLevels) {
        const busesAtLevel = buses.filter(b => b.vn_kv === level && busCoords(b, viewMode));
        if (!busesAtLevel.length) continue;

        const xs = busesAtLevel.map(b => b[keys.x]);
        const ys = busesAtLevel.map(b => b[keys.y]);
        const colors = busesAtLevel.map(b => hasResults ? busColor(b.vmPu ?? 1.0) : '#5b6472');
        const hovers = busesAtLevel.map(b => busHover(b, hasResults));
        const ids = busesAtLevel.map(b => b.id);

        const marker = {
            size: busSize(level),
            color: colors,
            line: { color: '#0e1116', width: 1.2 },
        };

        firstBusTrace = false;

        traces.push({
            type: keys.traceType, [keys.x]: xs, [keys.y]: ys, mode: 'markers',
            text: hovers,
            hovertemplate: '%{text}<extra></extra>',
            marker,
            showlegend: false,
        });
        meta.push({ kind: 'bus', voltage: level, ids });
    }

    // ----- ślad podświetlenia selekcji (na końcu = na wierzchu)
    // 1) zewnętrzny krzyż w kolorze chłodnego akcentu
    traces.push({
        type: keys.traceType, [keys.x]: [], [keys.y]: [], mode: 'markers',
        marker: {
            size: 18,
            color: '#8fc7ea',
            symbol: 'cross',
        },
        hoverinfo: 'skip',
        showlegend: false,
    });
    meta.push({ kind: 'selection', voltage: 0, ids: [] });

    // 2) wewnętrzny krzyż akcentowy
    traces.push({
        type: keys.traceType, [keys.x]: [], [keys.y]: [], mode: 'markers',
        marker: {
            size: 12,
            color: '#4ea1ff',
            symbol: 'x',
        },
        hoverinfo: 'skip',
        showlegend: false,
    });
    meta.push({ kind: 'selection', voltage: 0, ids: [] });

    return { traces, meta, shapes };
}

export const SELECTION_TRACE_KIND = 'selection';
