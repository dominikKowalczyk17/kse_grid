import { createApp, ref, computed, onMounted, watch, nextTick } from 'vue';
import { buildTraces } from '/traces.js';
import {
    IconActivity, IconSearch, IconRotate,
    IconCable, IconZap, IconCircleDot, IconClose, IconBolt,
} from '/icons.js';

const FOCUS_ZOOM_RATIO = 0.12;
const HIGHLIGHT_SCALE = 2.2;

function voltageColorVar(kv) {
    if (kv >= 380) return 'var(--grid-400)';
    if (kv >= 200) return 'var(--grid-220)';
    if (kv >= 100) return 'var(--grid-110)';
    return 'var(--grid-mv)';
}

function voltageStatus(vmPu) {
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
    },
    emits: ['update:selectedVoltages', 'update:selectedTypes', 'reset-view', 'select-bus'],
    setup(props, { emit }) {
        const search = ref('');
        const showSuggestions = ref(false);

        const suggestions = computed(() => {
            const q = search.value.trim().toLowerCase();
            if (!q) return [];
            return props.buses
                .filter(b => b.name.toLowerCase().includes(q))
                .slice(0, 30)
                .sort((a, b) => b.vn_kv - a.vn_kv);
        });

        const corePreset = computed(() => new Set(props.defaultVoltageFilter));
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
        const isNone = computed(() => selectedSet.value.size === 0);

        function applyPreset(name) {
            const next = name === 'core' ? [...props.defaultVoltageFilter]
                       : name === 'all'  ? [...props.voltageLevels]
                       : [];
            emit('update:selectedVoltages', next);
        }

        function toggleVoltage(v) {
            const next = selectedSet.value.has(v)
                ? props.selectedVoltages.filter(x => x !== v)
                : [...props.selectedVoltages, v];
            emit('update:selectedVoltages', next);
        }

        function toggleType(t) {
            const next = props.selectedTypes.includes(t)
                ? props.selectedTypes.filter(x => x !== t)
                : [...props.selectedTypes, t];
            emit('update:selectedTypes', next);
        }

        function pickSuggestion(bus) {
            search.value = '';
            showSuggestions.value = false;
            emit('select-bus', bus.id);
        }

        function blurLater() {
            setTimeout(() => { showSuggestions.value = false; }, 200);
        }

        return {
            search, showSuggestions, suggestions,
            isCore, isAll, isNone,
            applyPreset, toggleVoltage, toggleType, pickSuggestion, blurLater,
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

        <!-- Voltage levels -->
        <section class="section-card">
            <h3 class="section-title">Poziomy napięć</h3>
            <div class="chip-row">
                <button class="chip" :class="{ active: isCore }" @click="applyPreset('core')">RDZEŃ 400/220</button>
                <button class="chip" :class="{ active: isAll }"  @click="applyPreset('all')">ALL</button>
                <button class="chip" :class="{ active: isNone }" @click="applyPreset('none')">NONE</button>
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
                    <IconCable />
                    <span class="label">Linie</span>
                </label>
                <label class="check-row">
                    <input type="checkbox" :checked="selectedTypes.includes('trafo')" @change="toggleType('trafo')" />
                    <IconZap />
                    <span class="label">Transformatory</span>
                </label>
                <label class="check-row">
                    <input type="checkbox" :checked="selectedTypes.includes('bus')" @change="toggleType('bus')" />
                    <IconCircleDot />
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
    setup(props) {
        const rows = computed(() => {
            if (!props.selection) return [];
            const sel = props.selection;
            if (sel.kind === 'bus') {
                const bus = sel.payload;
                const items = [
                    { label: 'Un',  value: `${bus.vn_kv.toFixed(0)} kV` },
                ];
                if (props.hasResults && bus.vmPu != null) {
                    items.push({ label: 'Um',  value: `${bus.vmPu.toFixed(4)} p.u.`, status: voltageStatus(bus.vmPu) });
                    items.push({ label: 'Kąt', value: `${bus.vaDeg.toFixed(2)}°` });
                }
                if (bus.genMw > 0)  items.push({ label: 'P gen',  value: `${bus.genMw.toFixed(1)} MW`, status: 'good' });
                if (bus.loadMw > 0) items.push({ label: 'P load', value: `${bus.loadMw.toFixed(1)} MW` });
                return items;
            }
            if (sel.kind === 'line') {
                const ln = sel.payload;
                const items = [
                    { label: 'Un',     value: `${ln.voltage.toFixed(0)} kV` },
                    { label: 'Długość', value: `${ln.lengthKm.toFixed(1)} km` },
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
                    { label: 'Trafo',    value: `${tr.vnHvKv.toFixed(0)}/${tr.vnLvKv.toFixed(0)} kV` },
                    { label: 'Sn',       value: `${tr.snMva.toFixed(0)} MVA` },
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
        const kindLabel = computed(() => {
            const k = props.selection?.kind;
            return k === 'bus' ? 'Szyna'
                 : k === 'line' ? 'Linia'
                 : k === 'trafo' ? 'Transformator' : '';
        });

        return { rows, title, kindLabel };
    },
    template: `
    <div v-if="selection" class="selection-card">
        <div class="selection-header">
            <div>
                <div class="selection-kind">{{ kindLabel }}</div>
                <div class="selection-title">{{ title }}</div>
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
    },
    emits: ['stats-changed'],
    setup(props, { emit }) {
        const graphEl = ref(null);
        const traceMeta = ref([]);
        const allTraces = ref([]);
        const selection = ref(null);
        const defaultRange = ref(null);
        const focusHalf = ref({ x: 1, y: 1 });
        const ready = ref(false);

        const visibleCounts = computed(() => {
            const vSet = new Set(props.selectedVoltages);
            const tSet = new Set(props.selectedTypes);
            const total = { bus: props.network.buses.length, line: props.network.lines.length };
            const buses = tSet.has('bus')  ? props.network.buses.filter(b => vSet.has(b.vn_kv)).length : 0;
            const lines = tSet.has('line') ? props.network.lines.filter(l => vSet.has(l.voltage)).length : 0;
            return { buses, lines, totalBuses: total.bus, totalLines: total.line };
        });

        function initialLayout() {
            return {
                ...PLOT_LAYOUT_BASE,
                xaxis: { ...PLOT_LAYOUT_BASE.xaxis, range: props.network.bounds.x },
                yaxis: { ...PLOT_LAYOUT_BASE.yaxis, range: props.network.bounds.y },
            };
        }

        async function buildPlot() {
            const { traces, meta } = buildTraces(props.network);
            allTraces.value = traces;
            traceMeta.value = meta;

            const layout = initialLayout();
            defaultRange.value = { x: [...layout.xaxis.range], y: [...layout.yaxis.range] };
            const dx = defaultRange.value.x[1] - defaultRange.value.x[0];
            const dy = defaultRange.value.y[1] - defaultRange.value.y[0];
            focusHalf.value = { x: dx * FOCUS_ZOOM_RATIO, y: dy * FOCUS_ZOOM_RATIO };

            await Plotly.newPlot(graphEl.value, traces, layout, PLOT_CONFIG);
            graphEl.value.on('plotly_click', onPlotClick);
            applyVisibility();
            ready.value = true;
        }

        function applyVisibility() {
            if (!ready.value && allTraces.value.length === 0) return;
            const vSet = new Set(props.selectedVoltages);
            const tSet = new Set(props.selectedTypes);
            const update = traceMeta.value.map(m => {
                if (m.kind === 'selection') return undefined;
                return tSet.has(m.kind) && vSet.has(m.voltage);
            });
            const indices = update.map((_, i) => i).filter(i => update[i] !== undefined);
            const values = indices.map(i => update[i]);
            Plotly.restyle(graphEl.value, { visible: values }, indices);
        }

        function selectionTraceIndex() {
            return traceMeta.value.findIndex(m => m.kind === 'selection');
        }

        function clearHighlight() {
            const idx = selectionTraceIndex();
            if (idx < 0) return;
            Plotly.restyle(graphEl.value, { x: [[]], y: [[]] }, [idx]);
        }

        function highlightAt(x, y, baseSize) {
            const idx = selectionTraceIndex();
            if (idx < 0) return;
            Plotly.restyle(graphEl.value, {
                x: [[x]], y: [[y]],
                'marker.size': baseSize * HIGHLIGHT_SCALE,
            }, [idx]);
        }

        function onPlotClick(evt) {
            const point = evt?.points?.[0];
            if (!point) return;
            const meta = traceMeta.value[point.curveNumber];
            if (!meta) return;

            if (meta.kind === 'bus') {
                selectBus(meta.ids[point.pointIndex], false);
            } else if (meta.kind === 'line') {
                const id = meta.ids[point.pointIndex];
                const ln = props.network.lines.find(l => l.id === id);
                if (ln) { selection.value = { kind: 'line', payload: ln }; highlightAt(point.x, point.y, 14); }
            } else if (meta.kind === 'trafo') {
                const id = meta.ids[point.pointIndex];
                const tr = props.network.trafos.find(t => t.id === id);
                if (tr) { selection.value = { kind: 'trafo', payload: tr }; highlightAt(point.x, point.y, 14); }
            }
        }

        function findBusTraceIndex(voltage) {
            return traceMeta.value.findIndex(m => m.kind === 'bus' && m.voltage === voltage);
        }

        function selectBus(busId, focus) {
            const bus = props.network.buses.find(b => b.id === busId);
            if (!bus) return;
            selection.value = { kind: 'bus', payload: bus };

            const traceIdx = findBusTraceIndex(bus.vn_kv);
            const baseSize = traceIdx >= 0 ? allTraces.value[traceIdx].marker.size : 12;
            highlightAt(bus.x, bus.y, baseSize);

            if (focus) {
                Plotly.relayout(graphEl.value, {
                    'xaxis.range': [bus.x - focusHalf.value.x, bus.x + focusHalf.value.x],
                    'yaxis.range': [bus.y - focusHalf.value.y, bus.y + focusHalf.value.y],
                });
            }
        }

        function resetView() {
            if (!defaultRange.value) return;
            Plotly.relayout(graphEl.value, {
                'xaxis.range': defaultRange.value.x,
                'yaxis.range': defaultRange.value.y,
            });
            clearSelection();
        }

        function clearSelection() {
            selection.value = null;
            clearHighlight();
        }

        watch(() => [props.selectedVoltages, props.selectedTypes], () => {
            if (ready.value) applyVisibility();
        }, { deep: true });

        function onKey(e) {
            if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            if (e.key === 'Escape') clearSelection();
            if (e.key.toLowerCase() === 'r') resetView();
        }

        onMounted(async () => {
            await nextTick();
            await buildPlot();
            window.addEventListener('keydown', onKey);
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
    setup() {
        const network = ref(null);
        const error = ref(null);
        const selectedVoltages = ref([]);
        const selectedTypes = ref(['line', 'trafo', 'bus']);
        const graphPanelRef = ref(null);

        fetch('/api/network')
            .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
            .then(data => {
                network.value = data;
                selectedVoltages.value = [...data.defaultVoltageFilter];
                document.title = `${data.name} – kse_grid`;
            })
            .catch(e => { error.value = String(e); });

        const stats = computed(() => network.value?.stats || {});
        const statusLabel = computed(() => network.value?.hasResults ? 'Zbieżny' : 'Brak wyników');
        const statusClass = computed(() => network.value?.hasResults ? 'good' : 'warn');

        function onSelectBus(busId) { graphPanelRef.value?.selectBus(busId, true); }
        function onResetView() { graphPanelRef.value?.resetView(); }

        return {
            network, error, stats, statusLabel, statusClass,
            selectedVoltages, selectedTypes, graphPanelRef,
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
            <span class="status-pill" :class="statusClass">
                <span class="dot"></span>{{ statusLabel }}
            </span>
        </header>
        <div class="app-body">
            <Sidebar
                :stats="stats"
                :voltage-levels="network.voltageLevels"
                :default-voltage-filter="network.defaultVoltageFilter"
                :buses="network.buses"
                :has-results="network.hasResults"
                v-model:selected-voltages="selectedVoltages"
                v-model:selected-types="selectedTypes"
                @reset-view="onResetView"
                @select-bus="onSelectBus" />
            <GraphPanel
                ref="graphPanelRef"
                :network="network"
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
