import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { buildTraces } from '/traces.js';
import { SelectionCard } from '/components/selection-card.js';
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
    template: 'plotly_dark',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', color: '#e6edf3', size: 12 },
    hovermode: 'closest',
    dragmode: 'pan',
    clickmode: 'event',
    hoverdistance: 18,
    autosize: true,
    showlegend: false,
    uirevision: 'kse-grid',
    margin: { l: 0, r: 0, t: 0, b: 0 },
    hoverlabel: {
        bgcolor: '#1a1f2c',
        bordercolor: '#3a4357',
        font: { family: 'Inter, system-ui, sans-serif', color: '#e6edf3', size: 12 },
    },
    xaxis: { visible: false },
    yaxis: { visible: false, scaleanchor: 'x', scaleratio: 1 },
};

const PLOT_CONFIG = { displayModeBar: false, scrollZoom: true, responsive: true };

export const GraphPanel = {
    components: { SelectionCard },
    props: {
        network: Object,
        selectedVoltages: Array,
        selectedTypes: Array,
        viewMode: String,
        atlasCategories: Array,
    },
    setup (props) {
        const graphEl = ref(null);
        const traceMeta = ref([]);
        const allTraces = ref([]);
        const selection = ref(null);
        const defaultRange = ref(null);
        const defaultMapView = ref(null);
        const focusHalf = ref({ x: 1, y: 1 });
        const ready = ref(false);
        const atlasData = ref(null);

        const onMouseDown = () => graphEl.value?.classList.add('is-dragging');
        const onMouseUp = () => graphEl.value?.classList.remove('is-dragging');

        const visibleCounts = computed(() => {
            const voltageSet = new Set(props.selectedVoltages);
            const typeSet = new Set(props.selectedTypes);
            const total = { bus: props.network.buses.length, line: props.network.lines.length };
            const buses = typeSet.has('bus')
                ? props.network.buses.filter(bus => voltageSet.has(bus.vn_kv) && ((props.viewMode !== 'geo' && props.viewMode !== 'atlas') || (bus.lat != null && bus.lon != null))).length
                : 0;
            const lines = typeSet.has('line')
                ? props.network.lines.filter(line => voltageSet.has(line.voltage)).length
                : 0;
            return { buses, lines, totalBuses: total.bus, totalLines: total.line };
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
            if (props.viewMode === 'geo' || props.viewMode === 'atlas') {
                const view = mapboxView();
                return {
                    ...PLOT_LAYOUT_BASE,
                    mapbox: {
                        style: props.viewMode === 'atlas' ? 'open-street-map' : 'carto-positron',
                        center: { ...view.center },
                        zoom: view.zoom,
                        layers: buildMapboxLayers(),
                    },
                };
            }
            return {
                ...PLOT_LAYOUT_BASE,
                xaxis: { ...PLOT_LAYOUT_BASE.xaxis, range: props.network.graphBounds.x },
                yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: props.network.graphBounds.y },
            };
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
            ready.value = false;
            selection.value = null;
            traceMeta.value = [];
            allTraces.value = [];

            Plotly.purge(graphEl.value);

            if (props.viewMode === 'atlas' && !atlasData.value) {
                try {
                    atlasData.value = await loadAtlas();
                } catch (error) {
                    console.error('Atlas KSE load failed', error);
                }
            }

            const { traces, meta } = props.viewMode === 'atlas'
                ? buildAtlasTraces()
                : buildTraces(props.network, props.viewMode);
            allTraces.value = traces;
            traceMeta.value = meta;

            const layout = initialLayout();
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
            ready.value = true;
        }

        function applyVisibility () {
            if (!ready.value && allTraces.value.length === 0) return;
            const voltageSet = new Set(props.selectedVoltages);
            const typeSet = new Set(props.selectedTypes);
            const update = traceMeta.value.map(meta => {
                if (meta.kind === 'selection' || meta.kind === 'atlas-station') return undefined;
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
            const indices = selectionTraceIndices();
            if (!indices.length) return;
            const keys = coordKeys(props.viewMode);
            Plotly.restyle(graphEl.value, {
                [keys.x]: indices.map(() => []),
                [keys.y]: indices.map(() => []),
            }, indices);
        }

        function highlightAt (x, y, baseSize) {
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
            }
        }

        function findBusTraceIndex (voltage) {
            return traceMeta.value.findIndex(meta => meta.kind === 'bus' && meta.voltage === voltage);
        }

        function selectBus (busId, focus) {
            const bus = props.network.buses.find(item => item.id === busId);
            if (!bus) return;
            selection.value = { kind: 'bus', payload: bus };

            const traceIndex = findBusTraceIndex(bus.vn_kv);
            const baseSize = traceIndex >= 0 ? allTraces.value[traceIndex].marker.size : 12;
            const keys = coordKeys(props.viewMode);
            const targetX = bus[keys.x];
            const targetY = bus[keys.y];
            if (targetX == null || targetY == null) return;
            highlightAt(targetX, targetY, baseSize);

            if (focus) {
                if ((props.viewMode === 'geo' || props.viewMode === 'atlas') && bus.lon != null && bus.lat != null) {
                    const zoom = props.viewMode === 'geo' && props.network.geoView
                        ? props.network.geoView.focusZoom
                        : ATLAS_DEFAULT_VIEW.focusZoom;
                    Plotly.relayout(graphEl.value, {
                        'mapbox.center': { lon: bus.lon, lat: bus.lat },
                        'mapbox.zoom': zoom,
                    });
                } else {
                    Plotly.relayout(graphEl.value, {
                        'xaxis.range': [bus.x - focusHalf.value.x, bus.x + focusHalf.value.x],
                        'yaxis.range': [bus.y - focusHalf.value.y, bus.y + focusHalf.value.y],
                    });
                }
            }
        }

        function resetView () {
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

        watch(() => [props.selectedVoltages, props.selectedTypes], () => {
            if (ready.value) applyVisibility();
        }, { deep: true });

        watch(() => props.viewMode, async () => {
            await buildPlot();
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
                if (ready.value) Plotly.Plots.resize(graphEl.value);
            });
        });

        return { graphEl, selection, clearSelection, selectBus, resetView, visibleCounts };
    },
    template: `
    <div class="graph-panel">
        <div ref="graphEl" class="graph-canvas"></div>
        <SelectionCard :selection="selection" :has-results="network.hasResults" @close="clearSelection" />
        <div class="graph-hud">
            pokazano {{ visibleCounts.buses }}/{{ visibleCounts.totalBuses }} szyn ·
            {{ visibleCounts.lines }}/{{ visibleCounts.totalLines }} gałęzi
        </div>
        <div class="kbd-hint">
            <span class="kbd">R</span> reset
            <span class="kbd">Esc</span> wyczyść
        </div>
    </div>
    `,
};
