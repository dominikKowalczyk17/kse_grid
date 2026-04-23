import { createApp, ref, computed, onMounted, watch, nextTick } from 'vue';
import { buildTraces } from '/traces.js';
import {
    IconActivity, IconSearch, IconRotate,
    IconCable, IconZap, IconCircleDot, IconClose, IconBolt,
} from '/icons.js';

const FOCUS_ZOOM_RATIO = 0.12;
const HIGHLIGHT_SCALE = 2.2;

function coordKeys (viewMode) {
    return (viewMode === 'geo' || viewMode === 'atlas') ? { x: 'lon', y: 'lat' } : { x: 'x', y: 'y' };
}

const ATLAS_DEFAULT_VIEW = {
    center: { lon: 19.5, lat: 52.0 },
    zoom: 5.4,
    focusZoom: 8,
};

const ATLAS_LINE_STYLES = {
    osp: { color: 'rgba(255, 80,  80,  0.95)', width: 2.4 },
    osd: { color: 'rgba(120, 200, 255, 0.85)', width: 1.2 },
    jw: { color: 'rgba(255, 220, 120, 0.85)', width: 1.0, dash: '4,3' },
};
const ATLAS_POINT_STYLES = {
    osp: { color: 'rgba(255, 80,  80,  1.0)', radius: 4.5, stroke: { color: 'rgba(20, 20, 20, 0.9)', radius: 5.6 } },
    osd: { color: 'rgba(120, 200, 255, 1.0)', radius: 3.0, stroke: { color: 'rgba(20, 20, 20, 0.9)', radius: 3.9 } },
    jw: { color: 'rgba(255, 220, 120, 1.0)', radius: 3.2, stroke: { color: 'rgba(20, 20, 20, 0.9)', radius: 4.1 } },
};
const ATLAS_CATEGORIES = ['osd', 'osp', 'jw'];

let _atlasCache = null;
async function loadAtlas () {
    if (_atlasCache) return _atlasCache;
    const [points, lines] = await Promise.all([
        fetch('/kse_atlas_points.geojson').then(r => r.json()),
        fetch('/kse_atlas_lines.geojson').then(r => r.json()),
    ]);
    const splitByCategory = (fc) => {
        const out = { osp: [], osd: [], jw: [] };
        for (const f of fc.features || []) {
            const cat = f.properties?.category;
            if (out[cat]) out[cat].push(f);
        }
        const wrap = (features) => ({ type: 'FeatureCollection', features });
        return { osp: wrap(out.osp), osd: wrap(out.osd), jw: wrap(out.jw) };
    };
    _atlasCache = {
        points: splitByCategory(points),
        lines: splitByCategory(lines),
    };
    return _atlasCache;
}

function voltageColorVar (kv) {
    if (kv >= 380) return 'var(--grid-400)';
    if (kv >= 200) return 'var(--grid-220)';
    if (kv >= 100) return 'var(--grid-110)';
    return 'var(--grid-mv)';
}

function voltageStatus (vmPu) {
    if (vmPu == null) return '';
    if (vmPu >= 0.95 && vmPu <= 1.05) return 'good';
    if (vmPu >= 0.9 && vmPu <= 1.1) return 'warn';
    return 'bad';
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

const Sidebar = {
    components: { IconSearch, IconRotate, IconCable, IconZap, IconCircleDot },
    props: {
        stats: Object,
        voltageLevels: Array,
        defaultVoltageFilter: Array,
        selectedVoltages: Array,
        selectedTypes: Array,
        buses: Array,
        hasResults: Boolean,
        viewMode: String,
        geoAvailable: Boolean,
        atlasCategories: Array,
    },
    emits: ['update:selectedVoltages', 'update:selectedTypes', 'update:viewMode', 'update:atlasCategories', 'reset-view', 'select-bus'],
    setup (props, { emit }) {
        const search = ref('');
        const showSuggestions = ref(false);

        const suggestions = computed(() => {
            const q = search.value.trim().toLowerCase();
            if (!q) return [];
            return props.buses
                .filter(b =>
                    b.name.toLowerCase().includes(q) &&
                    (props.viewMode !== 'geo' || (b.lat != null && b.lon != null))
                )
                .slice(0, 30)
                .sort((a, b) => b.vn_kv - a.vn_kv);
        });

        const corePreset = computed(() => new Set(props.defaultVoltageFilter));
        const mediumPreset = computed(() => new Set(props.voltageLevels.filter(v => v <= 110)));
        const allPreset = computed(() => new Set(props.voltageLevels));
        const selectedSet = computed(() => new Set(props.selectedVoltages));

        const isCore = computed(() =>
            selectedSet.value.size === corePreset.value.size &&
            [...selectedSet.value].every(v => corePreset.value.has(v))
        );
        const isAll = computed(() =>
            selectedSet.value.size === allPreset.value.size &&
            [...selectedSet.value].every(v => allPreset.value.has(v))
        );
        const isMediumVoltage = computed(() => props.selectedVoltages.some(v => v <= 110));
        const isNone = computed(() => selectedSet.value.size === 0);

        function applyPreset (name) {
            const next = name === 'core' ? [...props.defaultVoltageFilter]
                : name === 'all' ? [...props.voltageLevels]
                    : name === 'medium' ? [...props.voltageLevels.filter(v => v <= 110)]
                        : [];
            emit('update:selectedVoltages', next);
        }

        function toggleVoltage (v) {
            const next = selectedSet.value.has(v)
                ? props.selectedVoltages.filter(x => x !== v)
                : [...props.selectedVoltages, v];
            emit('update:selectedVoltages', next);
        }

        function toggleType (t) {
            const next = props.selectedTypes.includes(t)
                ? props.selectedTypes.filter(x => x !== t)
                : [...props.selectedTypes, t];
            emit('update:selectedTypes', next);
        }

        function pickSuggestion (bus) {
            search.value = '';
            showSuggestions.value = false;
            emit('select-bus', bus.id);
        }

        function blurLater () {
            setTimeout(() => { showSuggestions.value = false; }, 200);
        }

        function setViewMode (mode) {
            if (mode === 'geo' && !props.geoAvailable) return;
            emit('update:viewMode', mode);
        }

        function toggleAtlasCategory (cat) {
            const set = new Set(props.atlasCategories);
            if (set.has(cat)) set.delete(cat); else set.add(cat);
            emit('update:atlasCategories', [...set]);
        }

        return {
            search, showSuggestions, suggestions,
            isCore, isAll, isMediumVoltage, isNone,
            applyPreset, toggleVoltage, toggleType, pickSuggestion, blurLater, setViewMode,
            toggleAtlasCategory,
            voltageColorVar,
        };
    },
    template: `
    <aside class="sidebar">

        <!-- Summary -->
        <section class="section-card">
            <h3 class="section-title">Podsumowanie</h3>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-label">Szyny</div>
                    <div class="metric-value tabular">{{ stats.nBus }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Linie</div>
                    <div class="metric-value tabular">{{ stats.nLine }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Trafo</div>
                    <div class="metric-value tabular">{{ stats.nTrafo }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Generatory</div>
                    <div class="metric-value tabular">{{ stats.nGen }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Maks. obc.</div>
                    <div class="metric-value tabular" :class="stats.loadClass">{{ stats.maxLoading }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Naruszenia U</div>
                    <div class="metric-value tabular" :class="stats.violClass">{{ stats.nViol }}</div>
                </div>
            </div>
        </section>

        <!-- Search -->
        <section class="section-card">
            <h3 class="section-title">Wyszukaj szynę</h3>
            <div class="search-wrap">
                <IconSearch />
                <input
                    v-model="search"
                    @focus="showSuggestions = true"
                    @blur="blurLater"
                    class="search-input"
                    placeholder="Nazwa szyny..."
                    type="text" />
            </div>
            <div v-if="showSuggestions && suggestions.length" class="suggestions">
                <button
                    v-for="b in suggestions"
                    :key="b.id"
                    class="suggestion-item"
                    @mousedown.prevent="pickSuggestion(b)">
                    <span>{{ b.name }}</span>
                    <span class="meta">{{ b.vn_kv.toFixed(0) }} kV</span>
                </button>
            </div>
            <div class="btn-search-row">
                <button class="btn btn-block" @click="$emit('reset-view')">
                    <IconRotate />
                    Reset widoku
                </button>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Widok</h3>
            <div class="chip-row">
                <button class="chip" :class="{ active: viewMode === 'graph' }" @click="setViewMode('graph')">Graf</button>
                <button
                    class="chip"
                    :class="{ active: viewMode === 'geo' }"
                    :disabled="!geoAvailable"
                    @click="setViewMode('geo')">
                    OpenStreetMap
                </button>
                <button
                    class="chip"
                    :class="{ active: viewMode === 'atlas' }"
                    @click="setViewMode('atlas')">
                    Atlas KSE
                </button>
            </div>
            <p class="helper">
                {{ viewMode === 'atlas'
                    ? 'Widok referencyjny KSE 2019: stacje i linie z OpenInfraMap (przesył NN czerwony, dystrybucja 110 kV niebieska, JW szara). Bez modelu pandapower.'
                    : geoAvailable
                        ? 'Tryb mapowy używa współrzędnych WGS84 z datasetu.'
                        : 'Tryb mapowy włączy się automatycznie, gdy case dostarczy geometrię WGS84.' }}
            </p>
            <div v-if="viewMode === 'atlas'" class="chip-row" style="margin-top:8px;">
                <button
                    class="chip"
                    :class="{ active: atlasCategories.includes('osp') }"
                    @click="toggleAtlasCategory('osp')"
                    title="Sieć przesyłowa NN (PSE) – 220/400 kV"
                ><span class="v-dot" style="background:#ff5050"></span>NN przesył</button>
                <button
                    class="chip"
                    :class="{ active: atlasCategories.includes('osd') }"
                    @click="toggleAtlasCategory('osd')"
                    title="Sieć dystrybucyjna 110 kV (OSD)"
                ><span class="v-dot" style="background:#78c8ff"></span>110 kV</button>
                <button
                    class="chip"
                    :class="{ active: atlasCategories.includes('jw') }"
                    @click="toggleAtlasCategory('jw')"
                    title="Linie blokowe / jednostki wytwórcze"
                ><span class="v-dot" style="background:#ffdc78"></span>JW</button>
            </div>
        </section>

        <!-- Voltage levels -->
        <section class="section-card">
            <h3 class="section-title">Poziomy napięć</h3>
            <div class="chip-row">
                <button class="chip" :class="{ active: isCore }" @click="applyPreset('core')">400/220 kV</button>
                <button class="chip" :class="{ active: isMediumVoltage }" @click="applyPreset('medium')">110 kV</button>
                <button class="chip" :class="{ active: isAll }"  @click="applyPreset('all')">WSZYSTKO</button>
            </div>
            <div class="check-list">
                <label class="check-row" v-for="v in voltageLevels" :key="v">
                    <input type="checkbox" :checked="selectedVoltages.includes(v)" @change="toggleVoltage(v)" />
                    <span class="v-dot" :style="{ background: voltageColorVar(v) }"></span>
                    <span class="v-text">{{ v.toFixed(0) }} kV</span>
                </label>
            </div>
        </section>

        <!-- Elements -->
        <section class="section-card">
            <h3 class="section-title">Elementy</h3>
            <div class="check-list">
                <label class="check-row">
                    <input type="checkbox" :checked="selectedTypes.includes('line')" @change="toggleType('line')" />
                    <span class="label">Linie</span>
                </label>
                <label class="check-row">
                    <input type="checkbox" :checked="selectedTypes.includes('trafo')" @change="toggleType('trafo')" />
                    <span class="label">Transformatory</span>
                </label>
                <label class="check-row">
                    <input type="checkbox" :checked="selectedTypes.includes('bus')" @change="toggleType('bus')" />
                    <span class="label">Szyny</span>
                </label>
            </div>
        </section>

        <!-- Loading legend -->
        <section class="section-card">
            <h3 class="section-title">Obciążenie linii</h3>
            <div class="legend-bar"></div>
            <div class="legend-scale">
                <span>0%</span><span>50%</span><span>100%</span><span>150%</span>
            </div>
        </section>

        <!-- Bus voltage legend -->
        <section class="section-card">
            <h3 class="section-title">Napięcie szyn (Um)</h3>
            <ul class="legend-list">
                <li><span class="dot" style="background:#6A1B9A"></span>&lt; 0.90 p.u.</li>
                <li><span class="dot" style="background:#1E88E5"></span>0.90 – 0.95</li>
                <li><span class="dot" style="background:#43A047"></span>0.95 – 1.05 (OK)</li>
                <li><span class="dot" style="background:#FB8C00"></span>1.05 – 1.10</li>
                <li><span class="dot" style="background:#D32F2F"></span>&gt; 1.10 p.u.</li>
            </ul>
        </section>

    </aside>
    `,
};

// ---------------------------------------------------------------------------
// Selection card
// ---------------------------------------------------------------------------

const SelectionCard = {
    components: { IconClose },
    props: { selection: Object, hasResults: Boolean },
    emits: ['close'],
    setup (props) {
        const rows = computed(() => {
            if (!props.selection) return [];
            const sel = props.selection;
            if (sel.kind === 'bus') {
                const bus = sel.payload;
                const items = [];
                if (bus.type) items.push({ label: 'Type', value: bus.type });
                items.push({ label: 'Vn', value: `${bus.vn_kv.toFixed(0)} kV` });
                if (props.hasResults && bus.vmPu != null) {
                    items.push({ label: 'Vm', value: `${bus.vmPu.toFixed(4)} p.u.`, status: voltageStatus(bus.vmPu) });
                    items.push({ label: 'Va', value: `${bus.vaDeg.toFixed(2)} °` });
                }
                if (bus.genMw > 0) items.push({ label: 'P gen', value: `${bus.genMw.toFixed(1)} MW`, status: 'good' });
                if (bus.genMvar != null) items.push({ label: 'Q gen', value: `${bus.genMvar.toFixed(1)} Mvar`, status: 'good' });
                if (bus.loadMw > 0) items.push({ label: 'P load', value: `${bus.loadMw.toFixed(1)} MW` });
                if (bus.loadMvar) items.push({ label: 'Q load', value: `${bus.loadMvar.toFixed(1)} Mvar` });
                return items;
            }
            if (sel.kind === 'line') {
                const ln = sel.payload;
                const lengthLabel = ln.lengthSource === 'geo'
                    ? `${ln.lengthKm.toFixed(1)} km (geo)`
                    : `${ln.lengthKm.toFixed(1)} km (model)`;
                const items = [
                    { label: 'Un', value: `${ln.voltage.toFixed(0)} kV` },
                    { label: 'Długość', value: lengthLabel },
                ];
                if (props.hasResults) {
                    items.push({ label: 'Obciążenie', value: `${(ln.loading ?? 0).toFixed(1)}%` });
                    if (ln.pFromMw != null) items.push({ label: 'P from', value: `${ln.pFromMw.toFixed(1)} MW` });
                }
                return items;
            }
            if (sel.kind === 'trafo') {
                const tr = sel.payload;
                const items = [
                    { label: 'Trafo', value: `${tr.vnHvKv.toFixed(0)}/${tr.vnLvKv.toFixed(0)} kV` },
                    { label: 'Sn', value: `${tr.snMva.toFixed(0)} MVA` },
                ];
                if (props.hasResults) {
                    items.push({ label: 'Obciążenie', value: `${(tr.loading ?? 0).toFixed(1)}%` });
                    if (tr.pHvMw != null) items.push({ label: 'P HV', value: `${tr.pHvMw.toFixed(1)} MW` });
                }
                return items;
            }
            return [];
        });

        const title = computed(() => props.selection?.payload?.name || '');
        const subtitle = computed(() => {
            const sel = props.selection;
            if (!sel) return '';
            const id = sel.payload?.id;
            if (id == null) return '';
            return sel.kind === 'bus' ? `Bus #${id}`
                : sel.kind === 'line' ? `Line #${id}`
                    : sel.kind === 'trafo' ? `Trafo #${id}` : '';
        });
        const kindLabel = computed(() => {
            const k = props.selection?.kind;
            return k === 'bus' ? 'Szyna'
                : k === 'line' ? 'Linia'
                    : k === 'trafo' ? 'Transformator' : '';
        });

        return { rows, title, subtitle, kindLabel };
    },
    template: `
    <div v-if="selection" class="selection-card">
        <div class="selection-header">
            <div>
                <div class="selection-kind">{{ kindLabel }}</div>
                <div class="selection-title">{{ title }}</div>
                <div v-if="subtitle" class="selection-subtitle">{{ subtitle }}</div>
            </div>
            <button class="card-close" @click="$emit('close')" aria-label="Zamknij">
                <IconClose />
            </button>
        </div>
        <div v-for="(row, i) in rows" :key="i" class="selection-row">
            <span class="lbl">{{ row.label }}</span>
            <span class="val" :class="row.status">{{ row.value }}</span>
        </div>
    </div>
    `,
};

// ---------------------------------------------------------------------------
// Plotly graph
// ---------------------------------------------------------------------------

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

const GraphPanel = {
    components: { SelectionCard },
    props: {
        network: Object,
        selectedVoltages: Array,
        selectedTypes: Array,
        viewMode: String,
        atlasCategories: Array,
    },
    emits: ['stats-changed'],
    setup (props, { emit }) {
        const graphEl = ref(null);
        const traceMeta = ref([]);
        const allTraces = ref([]);
        const selection = ref(null);
        const defaultRange = ref(null);
        const defaultMapView = ref(null);
        const focusHalf = ref({ x: 1, y: 1 });
        const ready = ref(false);
        const onMouseDown = () => graphEl.value?.classList.add('is-dragging');
        const onMouseUp = () => graphEl.value?.classList.remove('is-dragging');

        const visibleCounts = computed(() => {
            const vSet = new Set(props.selectedVoltages);
            const tSet = new Set(props.selectedTypes);
            const total = { bus: props.network.buses.length, line: props.network.lines.length };
            const buses = tSet.has('bus')
                ? props.network.buses.filter(b => vSet.has(b.vn_kv) && (props.viewMode !== 'geo' || (b.lat != null && b.lon != null))).length
                : 0;
            const lines = tSet.has('line')
                ? props.network.lines.filter(l => vSet.has(l.voltage)).length
                : 0;
            return { buses, lines, totalBuses: total.bus, totalLines: total.line };
        });

        const atlasData = ref(null);

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
                for (const cat of ATLAS_CATEGORIES) {
                    if (!enabled.has(cat)) continue;
                    const lineStyle = ATLAS_LINE_STYLES[cat];
                    const lineFc = atlasData.value.lines[cat];
                    if (lineFc?.features?.length) {
                        const lineSpec = { width: lineStyle.width };
                        if (lineStyle.dash) lineSpec.dash = lineStyle.dash;
                        layers.push({
                            sourcetype: 'geojson',
                            source: lineFc,
                            type: 'line',
                            color: lineStyle.color,
                            line: lineSpec,
                            below: 'traces',
                        });
                    }
                }
                for (const cat of ATLAS_CATEGORIES) {
                    if (!enabled.has(cat)) continue;
                    const pointStyle = ATLAS_POINT_STYLES[cat];
                    const pointFc = atlasData.value.points[cat];
                    if (pointFc?.features?.length && pointStyle.stroke) {
                        layers.push({
                            sourcetype: 'geojson',
                            source: pointFc,
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
            for (const cat of ATLAS_CATEGORIES) {
                const fc = atlasData.value.points[cat];
                if (!fc?.features?.length) continue;
                const ps = ATLAS_POINT_STYLES[cat];
                const lon = [], lat = [], text = [];
                for (const f of fc.features) {
                    const c = f.geometry?.coordinates;
                    if (!c) continue;
                    lon.push(c[0]);
                    lat.push(c[1]);
                    text.push(f.properties?.name || '');
                }
                traces.push({
                    type: 'scattermapbox',
                    mode: 'markers',
                    lon, lat, text,
                    name: labelMap[cat],
                    marker: { size: ps.radius * 2, color: ps.color, opacity: 1 },
                    hovertemplate: '<b>%{text}</b><br>' + labelMap[cat] + '<extra></extra>',
                    visible: enabled.has(cat) ? true : 'legendonly',
                    showlegend: false,
                    meta: { kind: 'atlas-station', category: cat },
                });
                meta.push({ kind: 'atlas-station', category: cat });
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
                } catch (e) {
                    console.error('Atlas KSE load failed', e);
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
            const vSet = new Set(props.selectedVoltages);
            const tSet = new Set(props.selectedTypes);
            const update = traceMeta.value.map(m => {
                if (m.kind === 'selection' || m.kind === 'atlas-station') return undefined;
                return tSet.has(m.kind) && vSet.has(m.voltage);
            });
            const indices = update.map((_, i) => i).filter(i => update[i] !== undefined);
            const values = indices.map(i => update[i]);
            if (indices.length) Plotly.restyle(graphEl.value, { visible: values }, indices);
        }

        function selectionTraceIndices () {
            const out = [];
            traceMeta.value.forEach((m, i) => { if (m.kind === 'selection') out.push(i); });
            return out;
        }

        function clearHighlight () {
            const idxs = selectionTraceIndices();
            if (!idxs.length) return;
            const keys = coordKeys(props.viewMode);
            Plotly.restyle(graphEl.value, {
                [keys.x]: idxs.map(() => []),
                [keys.y]: idxs.map(() => []),
            }, idxs);
        }

        function highlightAt (x, y, baseSize) {
            const idxs = selectionTraceIndices();
            if (!idxs.length) return;
            const outerRingSize = Math.max(baseSize * 1.3, 16);
            const innerRingSize = Math.max(baseSize * 0.9, 10);
            const sizes = idxs.map((_, i) =>
                i === 0 ? outerRingSize :
                    innerRingSize
            );
            const keys = coordKeys(props.viewMode);
            Plotly.restyle(graphEl.value, {
                [keys.x]: idxs.map(() => [x]),
                [keys.y]: idxs.map(() => [y]),
                'marker.size': sizes,
            }, idxs);
        }

        function onPlotClick (evt) {
            const point = evt?.points?.[0];
            if (!point) return;
            const meta = traceMeta.value[point.curveNumber];
            if (!meta) return;

            if (meta.kind === 'bus') {
                selectBus(meta.ids[point.pointIndex], false);
            } else if (meta.kind === 'line') {
                const id = meta.ids[point.pointIndex];
                const ln = props.network.lines.find(l => l.id === id);
                const keys = coordKeys(props.viewMode);
                if (ln) { selection.value = { kind: 'line', payload: ln }; highlightAt(point[keys.x], point[keys.y], 14); }
            } else if (meta.kind === 'trafo') {
                const id = meta.ids[point.pointIndex];
                const tr = props.network.trafos.find(t => t.id === id);
                const keys = coordKeys(props.viewMode);
                if (tr) { selection.value = { kind: 'trafo', payload: tr }; highlightAt(point[keys.x], point[keys.y], 14); }
            }
        }

        function findBusTraceIndex (voltage) {
            return traceMeta.value.findIndex(m => m.kind === 'bus' && m.voltage === voltage);
        }

        function selectBus (busId, focus) {
            const bus = props.network.buses.find(b => b.id === busId);
            if (!bus) return;
            selection.value = { kind: 'bus', payload: bus };

            const traceIdx = findBusTraceIndex(bus.vn_kv);
            const baseSize = traceIdx >= 0 ? allTraces.value[traceIdx].marker.size : 12;
            const keys = coordKeys(props.viewMode);
            const targetX = bus[keys.x];
            const targetY = bus[keys.y];
            if (targetX == null || targetY == null) return;
            highlightAt(targetX, targetY, baseSize);

            if (focus) {
                if (props.viewMode === 'geo' && props.network.geoView) {
                    Plotly.relayout(graphEl.value, {
                        'mapbox.center': { lon: bus.lon, lat: bus.lat },
                        'mapbox.zoom': props.network.geoView.focusZoom,
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
                traceMeta.value.forEach((m, idx) => {
                    if (m.kind === 'atlas-station') {
                        Plotly.restyle(graphEl.value, { visible: enabled.has(m.category) ? true : 'legendonly' }, [idx]);
                    }
                });
                Plotly.relayout(graphEl.value, { 'mapbox.layers': buildMapboxLayers() });
            }
        }, { deep: true });

        function onKey (e) {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.key === 'Escape') clearSelection();
            if (e.key.toLowerCase() === 'r') resetView();
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

// ---------------------------------------------------------------------------
// App root
// ---------------------------------------------------------------------------

const App = {
    components: { Sidebar, GraphPanel, IconActivity },
    setup () {
        const network = ref(null);
        const error = ref(null);
        const selectedVoltages = ref([]);
        const selectedTypes = ref(['line', 'trafo', 'bus']);
        const viewMode = ref('graph');
        const atlasCategories = ref(['osp', 'osd', 'jw']);
        const graphPanelRef = ref(null);

        fetch('/api/network')
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(data => {
                network.value = data;
                selectedVoltages.value = [...data.defaultVoltageFilter];
                viewMode.value = data.defaultViewMode || 'graph';
                document.title = `${data.name} – kse_grid`;
            })
            .catch(e => { error.value = String(e); });

        const stats = computed(() => network.value?.stats || {});
        const statusClass = computed(() => network.value?.hasResults ? 'good' : 'warn');

        function onSelectBus (busId) { graphPanelRef.value?.selectBus(busId, true); }
        function onResetView () { graphPanelRef.value?.resetView(); }

        return {
            network, error, stats, statusClass,
            selectedVoltages, selectedTypes, viewMode, atlasCategories, graphPanelRef,
            onSelectBus, onResetView,
        };
    },
    template: `
    <div class="app-shell" v-if="network">
        <header class="app-header">
            <div class="brand">
                <div class="brand-mark"><IconActivity /></div>
                <span class="brand-title"><span class="accent">kse</span><span class="sep">_</span>grid</span>
            </div>
            <div class="header-divider"></div>
            <span class="case-name">{{ network.name }}</span>

            <div class="header-spacer"></div>

            <div class="header-stats">
                <span class="header-stat"><span class="v tabular">{{ stats.nBus }}</span> szyn</span>
                <span class="header-stat"><span class="v tabular">{{ stats.nLine }}</span> linii</span>
                <span class="header-stat"><span class="v tabular">{{ stats.nTrafo }}</span> trafo</span>
            </div>
        </header>
        <div class="app-body">
            <Sidebar
                :stats="stats"
                :voltage-levels="network.voltageLevels"
                :default-voltage-filter="network.defaultVoltageFilter"
                :buses="network.buses"
                :has-results="network.hasResults"
                :view-mode="viewMode"
                :geo-available="network.geoAvailable"
                v-model:selected-voltages="selectedVoltages"
                v-model:selected-types="selectedTypes"
                v-model:view-mode="viewMode"
                v-model:atlas-categories="atlasCategories"
                @reset-view="onResetView"
                @select-bus="onSelectBus" />
            <GraphPanel
                ref="graphPanelRef"
                :network="network"
                :view-mode="viewMode"
                :atlas-categories="atlasCategories"
                :selected-voltages="selectedVoltages"
                :selected-types="selectedTypes" />
        </div>
    </div>
    <div v-else-if="error" class="overlay">
        <span class="err">Błąd ładowania danych: {{ error }}</span>
    </div>
    <div v-else class="overlay">
        <div class="spinner"></div>
        <span>Ładowanie sieci...</span>
    </div>
    `,
};

createApp(App).mount('#app');
