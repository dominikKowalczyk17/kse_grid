import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { buildTraces } from '/traces.js';
import { SelectionCard } from '/components/selection-card.js';
import { mountPixi } from '/renderers/pixi/index.js';
import {
    ATLAS_CATEGORIES,
    ATLAS_DEFAULT_VIEW,
    ATLAS_LINE_STYLES,
    ATLAS_POINT_STYLES,
    loadAtlas,
} from '/lib/atlas.js';
import { coordKeys } from '/lib/view-mode.js';

const FOCUS_ZOOM_RATIO = 0.12;

const PLOT_LAYOUT_BASE = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', size: 12 },
    hovermode: 'closest',
    dragmode: 'pan',
    clickmode: 'event',
    hoverdistance: 18,
    autosize: true,
    showlegend: false,
    uirevision: 'kse-grid',
    margin: { l: 0, r: 0, t: 0, b: 0 },
    xaxis: { visible: false },
    yaxis: { visible: false, scaleanchor: 'x', scaleratio: 1 },buildTraces
};

function themedLayout (theme) {
    const isLight = theme === 'light';
    return {
        ...PLOT_LAYOUT_BASE,
        template: isLight ? 'plotly_white' : 'plotly_dark',
        font: { ...PLOT_LAYOUT_BASE.font, color: isLight ? '#1f2937' : '#e6edf3' },
        hoverlabel: {
            bgcolor: isLight ? '#ffffff' : '#1a1f2c',
            bordercolor: isLight ? '#d1d5db' : '#3a4357',
            font: {
                family: 'Inter, system-ui, sans-serif',
                color: isLight ? '#1f2937' : '#e6edf3',
                size: 12,
            },
        },
    };
}

const PLOT_CONFIG = { displayModeBar: false, scrollZoom: true, responsive: true };

function loadingValue(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
}

function lineVisible(line, voltageSet, minLoad, branchOk) {
    return voltageSet.has(line.voltage)
        && loadingValue(line.loading) >= minLoad
        && branchOk(line);
}

function trafoVisible(trafo, voltageSet, minLoad, branchOk) {
    return voltageSet.has(trafo.vnHvKv)
        && voltageSet.has(trafo.vnLvKv)
        && loadingValue(trafo.loading) >= minLoad
        && branchOk(trafo);
}

export const GraphPanel = {
    components: { SelectionCard },
    props: {
        network: Object,
        selectedVoltages: Array,
        selectedTypes: Array,
        viewMode: String,
        atlasCategories: Array,
        theme: { type: String, default: 'dark' },
        minLineLoading: { type: Number, default: 0 },
        minBusPower: { type: Number, default: 0 },
        showSwitches: { type: Boolean, default: false },
        topologyBusy: { type: Boolean, default: false },
        topologyRevision: { type: Number, default: 0 },
        editMode: { type: Boolean, default: false },
        elementSchema: { type: Object, default: () => ({}) },
        elementParams: { type: Object, default: null },
        editError: { type: String, default: '' },
        editBusy: { type: Boolean, default: false },
    },
    emits: ['set-switch-state', 'set-switches-state', 'request-edit-params', 'submit-edit', 'cancel-edit'],
    setup (props) {
        const graphEl = ref(null);
        const traceMeta = ref([]);
        const allTraces = ref([]);
        const selection = ref(null);
        const defaultRange = ref(null);
        const defaultMapView = ref(null);
        const focusHalf = ref({ x: 1, y: 1 });
        const preservedViewport = ref(null);
        const ready = ref(false);
        const atlasData = ref(null);
        // Pixi controller is non-null when the WebGL renderer is active
        // (currently for viewMode === 'graph'). Atlas/geo stay on Plotly.
        const pixiCtrl = ref(null);
        const usePixi = computed(() => props.viewMode === 'graph');

        function pixiFilters () {
            return {
                selectedVoltages: props.selectedVoltages,
                selectedTypes: props.selectedTypes,
                minLineLoading: props.minLineLoading,
                minBusPower: props.minBusPower,
                showSwitches: props.showSwitches,
            };
        }

        const onMouseDown = () => graphEl.value?.classList.add('is-dragging');
        const onMouseUp = () => graphEl.value?.classList.remove('is-dragging');

        const visibleCounts = computed(() => {
            const voltageSet = new Set(props.selectedVoltages);
            const typeSet = new Set(props.selectedTypes);
            const total = {
                bus: props.network.buses.length,
                line: props.network.lines.length,
                switch: props.network.switches?.length || 0,
            };
            const minLoad = Math.max(0, Number(props.minLineLoading) || 0);
            const minPow = Math.max(0, Number(props.minBusPower) || 0);
            const passesBusPower = bus => minPow <= 0
                || Math.max(Math.abs(bus.loadMw ?? 0), Math.abs(bus.genMw ?? 0)) >= minPow;
            const visibleBusIds = new Set(props.network.buses.filter(passesBusPower).map(bus => bus.id));
            const branchOk = el => visibleBusIds.has(el.fromBus ?? el.hvBus) && visibleBusIds.has(el.toBus ?? el.lvBus);
            const lineById = Object.fromEntries(props.network.lines.map(line => [line.id, line]));
            const trafoById = Object.fromEntries(props.network.trafos.map(trafo => [trafo.id, trafo]));
            let connected = null;
            if (minLoad > 0) {
                connected = new Set();
                for (const ln of props.network.lines) {
                    if (lineVisible(ln, voltageSet, minLoad, branchOk)) {
                        connected.add(ln.fromBus); connected.add(ln.toBus);
                    }
                }
                for (const tr of props.network.trafos) {
                    if (trafoVisible(tr, voltageSet, minLoad, branchOk)) {
                        connected.add(tr.hvBus); connected.add(tr.lvBus);
                    }
                }
            }
            const buses = typeSet.has('bus')
                ? props.network.buses.filter(bus => voltageSet.has(bus.vn_kv)
                    && visibleBusIds.has(bus.id)
                    && (connected === null || connected.has(bus.id))
                    && ((props.viewMode !== 'geo' && props.viewMode !== 'atlas') || (bus.lat != null && bus.lon != null))).length
                : 0;
            const lines = typeSet.has('line')
                ? props.network.lines.filter(line => lineVisible(line, voltageSet, minLoad, branchOk)).length
                : 0;
            const switches = props.showSwitches
                ? (props.network.switches || []).filter(sw => {
                    if (!voltageSet.has(sw.voltage)) return false;
                    if (sw.parentKind === 'line') {
                        const parent = lineById[sw.elementId];
                        return typeSet.has('line') && parent ? lineVisible(parent, voltageSet, minLoad, branchOk) : false;
                    }
                    if (sw.parentKind === 'trafo') {
                        const parent = trafoById[sw.elementId];
                        return typeSet.has('trafo') && parent ? trafoVisible(parent, voltageSet, minLoad, branchOk) : false;
                    }
                    return false;
                }).length
                : 0;
            return {
                buses,
                lines,
                switches,
                totalBuses: total.bus,
                totalLines: total.line,
                totalSwitches: total.switch,
            };
        });

        function buildMapboxLayers () {
            const layers = [];
            if (props.viewMode === 'atlas') {
                layers.push({
                    sourcetype: 'raster',
                    sourceattribution: 'Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
                    source: [
                        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                    ],
                    minzoom: 0,
                    maxzoom: 19,
                    below: 'traces',
                });
            }
            layers.push({
                sourcetype: 'geojson',
                source: 'poland_border.geojson',
                type: 'line',
                color: props.viewMode === 'atlas' ? 'rgba(255,255,255,0.85)' : '#1f2937',
                line: { width: 2 },
                below: 'traces',
            });
            if (props.viewMode === 'atlas' && atlasData.value) {
                const enabled = new Set(props.atlasCategories || ATLAS_CATEGORIES);
                for (const category of ATLAS_CATEGORIES) {
                    if (!enabled.has(category)) continue;
                    const lineStyle = ATLAS_LINE_STYLES[category];
                    const lineFeatureCollection = atlasData.value.lines[category];
                    if (lineFeatureCollection?.features?.length) {
                        const lineSpec = { width: lineStyle.width };
                        if (lineStyle.dash) lineSpec.dash = lineStyle.dash;
                        layers.push({
                            sourcetype: 'geojson',
                            source: lineFeatureCollection,
                            type: 'line',
                            color: lineStyle.color,
                            line: lineSpec,
                            below: 'traces',
                        });
                    }
                }
                for (const category of ATLAS_CATEGORIES) {
                    if (!enabled.has(category)) continue;
                    const pointStyle = ATLAS_POINT_STYLES[category];
                    const pointFeatureCollection = atlasData.value.points[category];
                    if (pointFeatureCollection?.features?.length && pointStyle.stroke) {
                        layers.push({
                            sourcetype: 'geojson',
                            source: pointFeatureCollection,
                            type: 'circle',
                            circle: { radius: pointStyle.stroke.radius },
                            color: pointStyle.stroke.color,
                            below: 'traces',
                        });
                    }
                }
            }
            return layers;
        }

        function mapboxView () {
            if (props.viewMode === 'geo' && props.network.geoView) return props.network.geoView;
            return ATLAS_DEFAULT_VIEW;
        }

        function initialLayout () {
            const base = themedLayout(props.theme);
            if (props.viewMode === 'geo' || props.viewMode === 'atlas') {
                const view = mapboxView();
                const isLight = props.theme === 'light';
                const mapStyle = props.viewMode === 'atlas'
                    ? 'open-street-map'
                    : (isLight ? 'carto-positron' : 'carto-darkmatter');
                return {
                    ...base,
                    mapbox: {
                        style: mapStyle,
                        center: { ...view.center },
                        zoom: view.zoom,
                        layers: buildMapboxLayers(),
                    },
                };
            }
            return {
                ...base,
                xaxis: { ...base.xaxis, range: props.network.graphBounds.x },
                yaxis: { ...base.yaxis, range: props.network.graphBounds.y },
            };
        }

        function captureViewport () {
            if (!graphEl.value?.layout) return null;
            if (props.viewMode === 'geo' || props.viewMode === 'atlas') {
                const mapbox = graphEl.value.layout.mapbox;
                if (!mapbox?.center) return null;
                return {
                    kind: 'map',
                    center: { lon: mapbox.center.lon, lat: mapbox.center.lat },
                    zoom: mapbox.zoom,
                };
            }
            const xRange = graphEl.value.layout.xaxis?.range;
            const yRange = graphEl.value.layout.yaxis?.range;
            if (!xRange || !yRange) return null;
            return {
                kind: 'graph',
                x: [...xRange],
                y: [...yRange],
            };
        }

        function applyPreservedViewport () {
            const viewport = preservedViewport.value;
            if (!viewport) return;
            if (viewport.kind === 'map' && (props.viewMode === 'geo' || props.viewMode === 'atlas')) {
                Plotly.relayout(graphEl.value, {
                    'mapbox.center': viewport.center,
                    'mapbox.zoom': viewport.zoom,
                });
                return;
            }
            if (viewport.kind === 'graph' && props.viewMode !== 'geo' && props.viewMode !== 'atlas') {
                Plotly.relayout(graphEl.value, {
                    'xaxis.range': viewport.x,
                    'yaxis.range': viewport.y,
                });
            }
        }

        function buildAtlasTraces () {
            if (!atlasData.value) return { traces: [], meta: [] };
            const enabled = new Set(props.atlasCategories || ATLAS_CATEGORIES);
            const traces = [];
            const meta = [];
            const labelMap = { osp: 'NN przesył', osd: '110 kV', jw: 'JW / blokowe' };
            for (const category of ATLAS_CATEGORIES) {
                const featureCollection = atlasData.value.points[category];
                if (!featureCollection?.features?.length) continue;
                const pointStyle = ATLAS_POINT_STYLES[category];
                const lon = [];
                const lat = [];
                const text = [];
                for (const feature of featureCollection.features) {
                    const coordinates = feature.geometry?.coordinates;
                    if (!coordinates) continue;
                    lon.push(coordinates[0]);
                    lat.push(coordinates[1]);
                    text.push(feature.properties?.name || '');
                }
                traces.push({
                    type: 'scattermapbox',
                    mode: 'markers',
                    lon,
                    lat,
                    text,
                    name: labelMap[category],
                    marker: { size: pointStyle.radius * 2, color: pointStyle.color, opacity: 1 },
                    hovertemplate: `<b>%{text}</b><br>${labelMap[category]}<extra></extra>`,
                    visible: enabled.has(category) ? true : 'legendonly',
                    showlegend: false,
                    meta: { kind: 'atlas-station', category },
                });
                meta.push({ kind: 'atlas-station', category });
            }
            return { traces, meta };
        }

        async function buildPlot () {
            // Każdy redraw — po filtrach, zmianie payloadu, motywie czy przełącznikach —
            // powinien zachować aktualny viewport, jeśli użytkownik sam nie poprosił
            // o reset. Dlatego snapshot kamery/range robimy centralnie tutaj.
            if (ready.value && !pixiCtrl.value) {
                preservedViewport.value = captureViewport();
            }
            // Pixi: capture camera before destroy so remount restores it.
            const prevPixiView = pixiCtrl.value ? pixiCtrl.value.getView() : null;

            ready.value = false;
            selection.value = null;
            traceMeta.value = [];
            allTraces.value = [];

            // Dispose any previously-active backend so we can switch cleanly.
            if (pixiCtrl.value) {
                pixiCtrl.value.destroy();
                pixiCtrl.value = null;
            }
            if (graphEl.value) Plotly.purge(graphEl.value);

            if (usePixi.value) {
                await buildPixi(prevPixiView);
                ready.value = true;
                return;
            }

            if (props.viewMode === 'atlas' && !atlasData.value) {
                try {
                    atlasData.value = await loadAtlas();
                } catch (error) {
                    console.error('Atlas KSE load failed', error);
                }
            }

            const built = props.viewMode === 'atlas'
                ? buildAtlasTraces()
                : buildTraces(props.network, props.viewMode, {
                    minLineLoading: props.minLineLoading,
                    minBusPower: props.minBusPower,
                    selectedVoltages: props.selectedVoltages,
                }, props.theme);
            const traces = built.traces;
            const meta = built.meta;
            const shapes = built.shapes || [];
            allTraces.value = traces;
            traceMeta.value = meta;

            const layout = initialLayout();
            if (shapes.length && !(props.viewMode === 'geo' || props.viewMode === 'atlas')) {
                layout.shapes = shapes;
            }
            if ((props.viewMode === 'geo' || props.viewMode === 'atlas') && layout.mapbox) {
                defaultMapView.value = {
                    center: { ...layout.mapbox.center },
                    zoom: layout.mapbox.zoom,
                };
                defaultRange.value = null;
            } else {
                defaultRange.value = { x: [...layout.xaxis.range], y: [...layout.yaxis.range] };
                defaultMapView.value = null;
                const dx = defaultRange.value.x[1] - defaultRange.value.x[0];
                const dy = defaultRange.value.y[1] - defaultRange.value.y[0];
                focusHalf.value = { x: dx * FOCUS_ZOOM_RATIO, y: dy * FOCUS_ZOOM_RATIO };
            }

            await Plotly.newPlot(graphEl.value, traces, layout, PLOT_CONFIG);
            graphEl.value.on('plotly_click', onPlotClick);
            graphEl.value.on('plotly_hover', () => graphEl.value.classList.add('is-hovering-target'));
            graphEl.value.on('plotly_unhover', () => graphEl.value.classList.remove('is-hovering-target'));
            applyVisibility();
            applyPreservedViewport();
            ready.value = true;
        }

        async function buildPixi (initialView = null) {
            // Mount the Pixi renderer onto the same container; it manages its
            // own canvas. Selection events are routed through `setSelection`
            // so the SelectionCard sees the same shape as the Plotly path.
            pixiCtrl.value = await mountPixi(graphEl.value, props.network, {
                theme: props.theme,
                viewMode: props.viewMode,
                editMode: props.editMode,
                filters: pixiFilters(),
                initialView,
                onSelect: sel => {
                    if (!sel) { selection.value = null; return; }
                    if (sel.kind === 'bus') {
                        const bus = props.network.buses.find(b => b.id === sel.id);
                        if (bus) selection.value = { kind: 'bus', payload: bus };
                    } else if (sel.kind === 'line') {
                        const line = props.network.lines.find(l => l.id === sel.id);
                        if (line) selection.value = { kind: 'line', payload: line };
                    } else if (sel.kind === 'trafo') {
                        const trafo = props.network.trafos.find(t => t.id === sel.id);
                        if (trafo) selection.value = { kind: 'trafo', payload: trafo };
                    } else if (sel.kind === 'switch') {
                        const sw = (props.network.switches || []).find(s => s.id === sel.id);
                        if (sw) selection.value = { kind: 'switch', payload: sw };
                    }
                },
            });
        }

        function applyVisibility () {
            if (pixiCtrl.value) {
                pixiCtrl.value.setFilters(pixiFilters());
                return;
            }
            if (!ready.value && allTraces.value.length === 0) return;
            const voltageSet = new Set(props.selectedVoltages);
            const typeSet = new Set(props.selectedTypes);
            const update = traceMeta.value.map(meta => {
                if (meta.kind === 'selection' || meta.kind === 'atlas-station') return undefined;
                if (meta.kind === 'switch') return props.showSwitches && typeSet.has(meta.parentKind) && voltageSet.has(meta.voltage);
                if (meta.kind === 'flow-arrow') return typeSet.has(meta.parentKind) && voltageSet.has(meta.voltage);
                return typeSet.has(meta.kind) && voltageSet.has(meta.voltage);
            });
            const indices = update.map((_, index) => index).filter(index => update[index] !== undefined);
            const values = indices.map(index => update[index]);
            if (indices.length) Plotly.restyle(graphEl.value, { visible: values }, indices);
        }

        function selectionTraceIndices () {
            const indices = [];
            traceMeta.value.forEach((meta, index) => {
                if (meta.kind === 'selection') indices.push(index);
            });
            return indices;
        }

        function clearHighlight () {
            if (pixiCtrl.value) { pixiCtrl.value.setSelection(null); return; }
            const indices = selectionTraceIndices();
            if (!indices.length) return;
            const keys = coordKeys(props.viewMode);
            Plotly.restyle(graphEl.value, {
                [keys.x]: indices.map(() => []),
                [keys.y]: indices.map(() => []),
            }, indices);
        }

        function highlightAt (x, y, baseSize) {
            if (pixiCtrl.value) { pixiCtrl.value.refreshSelection(); return; }
            const indices = selectionTraceIndices();
            if (!indices.length) return;
            const outerRingSize = Math.max(baseSize * 1.3, 16);
            const innerRingSize = Math.max(baseSize * 0.9, 10);
            const sizes = indices.map((_, index) => (index === 0 ? outerRingSize : innerRingSize));
            const keys = coordKeys(props.viewMode);
            Plotly.restyle(graphEl.value, {
                [keys.x]: indices.map(() => [x]),
                [keys.y]: indices.map(() => [y]),
                'marker.size': sizes,
            }, indices);
        }

        function onPlotClick (event) {
            const point = event?.points?.[0];
            if (!point) return;
            const meta = traceMeta.value[point.curveNumber];
            if (!meta) return;

            if (meta.kind === 'bus') {
                selectBus(meta.ids[point.pointIndex], false);
            } else if (meta.kind === 'line') {
                const id = meta.ids[point.pointIndex];
                const line = props.network.lines.find(item => item.id === id);
                const keys = coordKeys(props.viewMode);
                if (line) {
                    selection.value = { kind: 'line', payload: line };
                    highlightAt(point[keys.x], point[keys.y], 14);
                }
            } else if (meta.kind === 'trafo') {
                const id = meta.ids[point.pointIndex];
                const trafo = props.network.trafos.find(item => item.id === id);
                const keys = coordKeys(props.viewMode);
                if (trafo) {
                    selection.value = { kind: 'trafo', payload: trafo };
                    highlightAt(point[keys.x], point[keys.y], 14);
                }
            } else if (meta.kind === 'switch') {
                const id = meta.ids[point.pointIndex];
                const sw = props.network.switches.find(item => item.id === id);
                const keys = coordKeys(props.viewMode);
                if (sw) {
                    selection.value = { kind: 'switch', payload: sw };
                    highlightAt(point[keys.x], point[keys.y], 11);
                }
            }
        }

        function findBusTraceIndex (voltage) {
            return traceMeta.value.findIndex(meta => meta.kind === 'bus' && meta.voltage === voltage);
        }

        function focusPoint (targetX, targetY, focus) {
            if (!focus) return;
            if (pixiCtrl.value) return; // Pixi focus handled via ctrl.focus()
            if (props.viewMode === 'geo' || props.viewMode === 'atlas') {
                Plotly.relayout(graphEl.value, {
                    'mapbox.center': { lon: targetX, lat: targetY },
                    'mapbox.zoom': props.viewMode === 'geo' && props.network.geoView
                        ? props.network.geoView.focusZoom
                        : ATLAS_DEFAULT_VIEW.focusZoom,
                });
                return;
            }
            Plotly.relayout(graphEl.value, {
                'xaxis.range': [targetX - focusHalf.value.x, targetX + focusHalf.value.x],
                'yaxis.range': [targetY - focusHalf.value.y, targetY + focusHalf.value.y],
            });
        }

        function selectBus (busId, focus) {
            const bus = props.network.buses.find(item => item.id === busId);
            if (!bus) return;
            selection.value = { kind: 'bus', payload: bus };

            if (pixiCtrl.value) {
                pixiCtrl.value.setSelection({ kind: 'bus', id: busId });
                if (focus) pixiCtrl.value.focus({ kind: 'bus', id: busId });
                return;
            }

            const traceIndex = findBusTraceIndex(bus.vn_kv);
            const baseSize = traceIndex >= 0 ? allTraces.value[traceIndex].marker.size : 12;
            const keys = coordKeys(props.viewMode);
            const targetX = bus[keys.x];
            const targetY = bus[keys.y];
            if (targetX == null || targetY == null) return;
            highlightAt(targetX, targetY, baseSize);
            focusPoint(targetX, targetY, focus);
        }

        function selectLine (lineId, focus) {
            const line = props.network.lines.find(item => item.id === lineId);
            if (!line) return;
            if (pixiCtrl.value) {
                selection.value = { kind: 'line', payload: line };
                pixiCtrl.value.setSelection({ kind: 'line', id: lineId });
                if (focus) pixiCtrl.value.focus({ kind: 'line', id: lineId });
                return;
            }
            const from = props.network.buses.find(item => item.id === line.fromBus);
            const to = props.network.buses.find(item => item.id === line.toBus);
            if (!from || !to) return;
            const keys = coordKeys(props.viewMode);
            const targetX = ((from[keys.x] ?? 0) + (to[keys.x] ?? 0)) / 2;
            const targetY = ((from[keys.y] ?? 0) + (to[keys.y] ?? 0)) / 2;
            selection.value = { kind: 'line', payload: line };
            highlightAt(targetX, targetY, 14);
            if (from[keys.x] == null || from[keys.y] == null || to[keys.x] == null || to[keys.y] == null) return;
            focusPoint(targetX, targetY, focus);
        }

        function selectTrafo (trafoId, focus) {
            const trafo = props.network.trafos.find(item => item.id === trafoId);
            if (!trafo) return;
            if (pixiCtrl.value) {
                selection.value = { kind: 'trafo', payload: trafo };
                pixiCtrl.value.setSelection({ kind: 'trafo', id: trafoId });
                if (focus) pixiCtrl.value.focus({ kind: 'trafo', id: trafoId });
                return;
            }
            const hv = props.network.buses.find(item => item.id === trafo.hvBus);
            const lv = props.network.buses.find(item => item.id === trafo.lvBus);
            if (!hv || !lv) return;
            const keys = coordKeys(props.viewMode);
            const targetX = ((hv[keys.x] ?? 0) + (lv[keys.x] ?? 0)) / 2;
            const targetY = ((hv[keys.y] ?? 0) + (lv[keys.y] ?? 0)) / 2;
            selection.value = { kind: 'trafo', payload: trafo };
            highlightAt(targetX, targetY, 14);
            if (hv[keys.x] == null || hv[keys.y] == null || lv[keys.x] == null || lv[keys.y] == null) return;
            focusPoint(targetX, targetY, focus);
        }

        function selectElement ({ kind, id, focus = true }) {
            if (kind === 'bus') {
                selectBus(id, focus);
            } else if (kind === 'line') {
                selectLine(id, focus);
            } else if (kind === 'trafo') {
                selectTrafo(id, focus);
            }
        }

        function resetView () {
            preservedViewport.value = null;
            if (pixiCtrl.value) {
                pixiCtrl.value.resetView();
                clearSelection();
                return;
            }
            if (props.viewMode === 'geo' || props.viewMode === 'atlas') {
                if (!defaultMapView.value) return;
                Plotly.relayout(graphEl.value, {
                    'mapbox.center': defaultMapView.value.center,
                    'mapbox.zoom': defaultMapView.value.zoom,
                });
            } else {
                if (!defaultRange.value) return;
                Plotly.relayout(graphEl.value, {
                    'xaxis.range': defaultRange.value.x,
                    'yaxis.range': defaultRange.value.y,
                });
            }
            clearSelection();
        }

        function clearSelection () {
            selection.value = null;
            clearHighlight();
        }

        function handleLayoutChange () {
            if (!ready.value || !graphEl.value || pixiCtrl.value) return;
            Plotly.Plots.resize(graphEl.value);
        }

        watch(() => [props.selectedVoltages, props.selectedTypes, props.showSwitches], () => {
            if (pixiCtrl.value) {
                pixiCtrl.value.setFilters(pixiFilters());
                return;
            }
            if (ready.value) buildPlot();
        }, { deep: true });

        watch(() => props.viewMode, async () => {
            await buildPlot();
        });

        watch(() => props.theme, async () => {
            await buildPlot();
        });

        watch(() => [props.minLineLoading, props.minBusPower], async () => {
            if (pixiCtrl.value) {
                pixiCtrl.value.setFilters(pixiFilters());
                return;
            }
            await buildPlot();
        });

        watch(() => props.editMode, on => {
            if (pixiCtrl.value) pixiCtrl.value.setEditMode(!!on);
        });

        watch(() => props.atlasCategories, () => {
            if (ready.value && props.viewMode === 'atlas') {
                const enabled = new Set(props.atlasCategories || ATLAS_CATEGORIES);
                traceMeta.value.forEach((meta, index) => {
                    if (meta.kind === 'atlas-station') {
                        Plotly.restyle(graphEl.value, { visible: enabled.has(meta.category) ? true : 'legendonly' }, [index]);
                    }
                });
                Plotly.relayout(graphEl.value, { 'mapbox.layers': buildMapboxLayers() });
            }
        }, { deep: true });

        watch(() => props.network, async () => {
            await buildPlot();
        });

        // Switch toggles mutate the network in place (preserving user layout
        // edits like dragged buses or bent lines), so the watcher above doesn't
        // fire. The revision counter triggers a rebuild for those updates.
        watch(() => props.topologyRevision, async () => {
            await buildPlot();
        });

        function onKey (event) {
            if (event.target && ['INPUT', 'TEXTAREA'].includes(event.target.tagName)) return;
            if (event.key === 'Escape') clearSelection();
            if (event.key.toLowerCase() === 'r') resetView();
        }

        onMounted(async () => {
            await nextTick();
            graphEl.value.addEventListener('mousedown', onMouseDown);
            await buildPlot();
            window.addEventListener('keydown', onKey);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('resize', () => {
                if (!ready.value) return;
                if (pixiCtrl.value) {
                    // Pixi scene's ResizeObserver handles internal resizing.
                    return;
                }
                Plotly.Plots.resize(graphEl.value);
            });
        });

        onBeforeUnmount(() => {
            if (pixiCtrl.value) {
                pixiCtrl.value.destroy();
                pixiCtrl.value = null;
            }
        });

        return { graphEl, selection, clearSelection, selectBus, selectLine, selectTrafo, selectElement, resetView, handleLayoutChange, visibleCounts };
    },
    template: `
    <div class="graph-panel">
        <div ref="graphEl" class="graph-canvas"></div>
        <SelectionCard
            :selection="selection"
            :switches="network.switches || []"
            :has-results="network.hasResults"
            :topology-busy="topologyBusy"
            :element-schema="elementSchema"
            :element-params="elementParams"
            :edit-error="editError"
            :edit-busy="editBusy"
            @close="clearSelection"
            @set-switch-state="$emit('set-switch-state', $event)"
            @set-switches-state="$emit('set-switches-state', $event)"
            @request-edit-params="$emit('request-edit-params', $event)"
            @submit-edit="$emit('submit-edit', $event)"
            @cancel-edit="$emit('cancel-edit')" />
        <div class="graph-hud">
            pokazano {{ visibleCounts.buses }}/{{ visibleCounts.totalBuses }} szyn ·
            {{ visibleCounts.lines }}/{{ visibleCounts.totalLines }} gałęzi
            <template v-if="showSwitches"> · {{ visibleCounts.switches }}/{{ visibleCounts.totalSwitches }} odłączników</template>
        </div>
        <div class="kbd-hint">
            <span class="kbd">R</span> reset
            <span class="kbd">Esc</span> wyczyść
        </div>
    </div>
    `,
};
