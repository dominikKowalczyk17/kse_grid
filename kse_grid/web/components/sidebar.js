import { computed, ref, watch } from 'vue';
import { IconSearch, IconRotate, IconCable, IconZap, IconCircleDot } from '/icons.js';
import { SwitchingPanel } from '/components/switching-panel.js';
import {
    formatMw,
    HISTOGRAM_BIN_WIDTH,
    HISTOGRAM_MAX,
    HISTOGRAM_MIN,
    voltageColorVar,
    voltageStatus,
} from '/lib/formatters.js';

export const Sidebar = {
    components: { IconSearch, IconRotate, IconCable, IconZap, IconCircleDot, SwitchingPanel },
    props: {
        stats: Object,
        totals: Object,
        diagnostics: Object,
        topology: Object,
        voltageLevels: Array,
        defaultVoltageFilter: Array,
        selectedVoltages: Array,
        selectedTypes: Array,
        buses: Array,
        lines: Array,
        trafos: Array,
        hasResults: Boolean,
        viewMode: String,
        geoAvailable: Boolean,
        atlasCategories: Array,
        minLineLoading: { type: Number, default: 0 },
        minBusPower: { type: Number, default: 0 },
        showSwitches: { type: Boolean, default: false },
        topologyBusy: { type: Boolean, default: false },
        topologyError: { type: String, default: '' },
    },
    emits: ['update:selectedVoltages', 'update:selectedTypes', 'update:viewMode', 'update:atlasCategories', 'update:minLineLoading', 'update:minBusPower', 'update:showSwitches', 'reset-view', 'reset-topology', 'select-bus', 'select-element'],
    setup (props, { emit }) {
        const search = ref('');
        const showSuggestions = ref(false);
        const hoveredBinIndex = ref(null);
        const activeHistogramBinIndex = ref(null);
        const activeHistogramBusCursor = ref(0);
        const activeBranchCursor = ref(0);

        const suggestions = computed(() => {
            const query = search.value.trim().toLowerCase();
            if (!query) return [];
            return props.buses
                .filter(bus =>
                    (bus.name.toLowerCase().includes(query) || String(bus.id).startsWith(query)) &&
                    ((props.viewMode !== 'geo' && props.viewMode !== 'atlas') || (bus.lat != null && bus.lon != null))
                )
                .sort((left, right) => right.vn_kv - left.vn_kv)
                .slice(0, 30);
        });

        const corePreset = computed(() => new Set(props.defaultVoltageFilter));
        const mediumPreset = computed(() => new Set(props.voltageLevels.filter(level => level <= 110)));
        const allPreset = computed(() => new Set(props.voltageLevels));
        const selectedSet = computed(() => new Set(props.selectedVoltages));
        const totals = computed(() => props.totals || {});
        const voltageDiag = computed(() => props.diagnostics?.voltage || {});
        const loadingDiag = computed(() => props.diagnostics?.loading || {});

        const isCore = computed(() =>
            selectedSet.value.size === corePreset.value.size &&
            [...selectedSet.value].every(level => corePreset.value.has(level))
        );
        const isAll = computed(() =>
            selectedSet.value.size === allPreset.value.size &&
            [...selectedSet.value].every(level => allPreset.value.has(level))
        );
        const isMediumVoltage = computed(() => props.selectedVoltages.some(level => mediumPreset.value.has(level)));
        const histogram = computed(() => {
            const binCount = Math.round((HISTOGRAM_MAX - HISTOGRAM_MIN) / HISTOGRAM_BIN_WIDTH);
            const bins = Array.from({ length: binCount }, (_, index) => {
                const lo = HISTOGRAM_MIN + index * HISTOGRAM_BIN_WIDTH;
                const hi = lo + HISTOGRAM_BIN_WIDTH;
                const mid = (lo + hi) / 2;
                return {
                    lo,
                    hi,
                    count: 0,
                    status: voltageStatus(mid) || 'good',
                    busIds: [],
                };
            });

            if (props.hasResults) {
                for (const bus of props.buses) {
                    if (!selectedSet.value.has(bus.vn_kv) || bus.vmPu == null) continue;
                    const vmPu = Math.max(HISTOGRAM_MIN, Math.min(HISTOGRAM_MAX - 1e-9, bus.vmPu));
                    const index = Math.min(binCount - 1, Math.floor((vmPu - HISTOGRAM_MIN) / HISTOGRAM_BIN_WIDTH));
                    bins[index].count += 1;
                    bins[index].busIds.push(bus.id);
                }
            }

            return {
                bins,
                max: bins.reduce((currentMax, bin) => Math.max(currentMax, bin.count), 0) || 1,
                total: bins.reduce((sum, bin) => sum + bin.count, 0),
                okBandLeft: ((0.95 - HISTOGRAM_MIN) / (HISTOGRAM_MAX - HISTOGRAM_MIN)) * 100,
                okBandWidth: ((1.05 - 0.95) / (HISTOGRAM_MAX - HISTOGRAM_MIN)) * 100,
                nominalLeft: ((1.0 - HISTOGRAM_MIN) / (HISTOGRAM_MAX - HISTOGRAM_MIN)) * 100,
            };
        });
        const hoveredBin = computed(() => hoveredBinIndex.value == null
            ? null
            : histogram.value.bins[hoveredBinIndex.value] ?? null);
        const activeHistogramBin = computed(() => activeHistogramBinIndex.value == null
            ? null
            : histogram.value.bins[activeHistogramBinIndex.value] ?? null);
        const activeHistogramBusIds = computed(() => activeHistogramBin.value?.busIds || []);
        const activeHistogramBusId = computed(() => {
            if (!activeHistogramBusIds.value.length) return null;
            const index = Math.min(activeHistogramBusCursor.value, activeHistogramBusIds.value.length - 1);
            return activeHistogramBusIds.value[index] ?? null;
        });
        const lossPctLabel = computed(() => totals.value.lossPct == null ? '—' : `${totals.value.lossPct.toFixed(2)} %`);
        const slackLabel = computed(() => totals.value.slackBusId == null ? '—' : `#${totals.value.slackBusId}`);
        const minBusSub = computed(() => voltageDiag.value.minBusId == null
            ? 'Brak danych'
            : `#${voltageDiag.value.minBusId} · ${voltageDiag.value.minBusKv?.toFixed(0) ?? '—'} kV`);
        const maxBusSub = computed(() => voltageDiag.value.maxBusId == null
            ? 'Brak danych'
            : `#${voltageDiag.value.maxBusId} · ${voltageDiag.value.maxBusKv?.toFixed(0) ?? '—'} kV`);
        const maxElementSub = computed(() => {
            if (loadingDiag.value.maxId == null) return 'Brak danych';
            return `${loadingDiag.value.maxKind === 'trafo' ? 'Trafo' : 'Linia'} #${loadingDiag.value.maxId}`;
        });
        const busById = computed(() => Object.fromEntries((props.buses || []).map(bus => [bus.id, bus])));
        const sortedBranches = computed(() => {
            if (!props.hasResults) return [];
            const selectedVoltages = new Set(props.selectedVoltages);
            const items = [];
            if (props.selectedTypes.includes('line')) {
                for (const line of props.lines || []) {
                    if (!selectedVoltages.has(line.voltage)) continue;
                    items.push({
                        kind: 'line',
                        id: line.id,
                        name: line.name,
                        label: `Linia #${line.id}`,
                        loading: Number(line.loading) || 0,
                        voltageLabel: `${line.voltage.toFixed(0)} kV`,
                        fromBus: line.fromBus,
                        toBus: line.toBus,
                    });
                }
            }
            if (props.selectedTypes.includes('trafo')) {
                for (const trafo of props.trafos || []) {
                    if (!selectedVoltages.has(trafo.vnHvKv) || !selectedVoltages.has(trafo.vnLvKv)) continue;
                    items.push({
                        kind: 'trafo',
                        id: trafo.id,
                        name: trafo.name,
                        label: `Trafo #${trafo.id}`,
                        loading: Number(trafo.loading) || 0,
                        voltageLabel: `${trafo.vnHvKv.toFixed(0)}/${trafo.vnLvKv.toFixed(0)} kV`,
                        fromBus: trafo.hvBus,
                        toBus: trafo.lvBus,
                    });
                }
            }
            return items.sort((left, right) => right.loading - left.loading || left.kind.localeCompare(right.kind) || left.id - right.id);
        });
        const activeBranch = computed(() => {
            if (!sortedBranches.value.length) return null;
            const index = Math.min(activeBranchCursor.value, sortedBranches.value.length - 1);
            return sortedBranches.value[index] ?? null;
        });

        function applyPreset (name) {
            const next = name === 'core' ? [...props.defaultVoltageFilter]
                : name === 'all' ? [...props.voltageLevels]
                    : name === 'medium' ? [...props.voltageLevels.filter(level => level <= 110)]
                        : [];
            emit('update:selectedVoltages', next);
        }

        function toggleVoltage (voltage) {
            const next = selectedSet.value.has(voltage)
                ? props.selectedVoltages.filter(value => value !== voltage)
                : [...props.selectedVoltages, voltage];
            emit('update:selectedVoltages', next);
        }

        function toggleType (type) {
            const next = props.selectedTypes.includes(type)
                ? props.selectedTypes.filter(value => value !== type)
                : [...props.selectedTypes, type];
            emit('update:selectedTypes', next);
        }

        function pickSuggestion (bus) {
            search.value = '';
            showSuggestions.value = false;
            emit('select-bus', bus.id);
        }

        function canFocusBus (busId) {
            if (busId == null) return false;
            const bus = props.buses.find(item => item.id === busId);
            if (!bus) return false;
            return (props.viewMode !== 'geo' && props.viewMode !== 'atlas') || (bus.lat != null && bus.lon != null);
        }

        function focusBus (busId) {
            if (!canFocusBus(busId)) return;
            emit('select-bus', busId);
        }

        function canFocusElement (element) {
            if (!element) return false;
            if (props.viewMode !== 'geo' && props.viewMode !== 'atlas') return true;
            const fromBus = busById.value[element.fromBus];
            const toBus = busById.value[element.toBus];
            return Boolean(fromBus && toBus && fromBus.lat != null && fromBus.lon != null && toBus.lat != null && toBus.lon != null);
        }

        function focusElement (element) {
            if (!canFocusElement(element)) return;
            emit('select-element', { kind: element.kind, id: element.id, focus: true });
        }

        function blurLater () {
            setTimeout(() => { showSuggestions.value = false; }, 200);
        }

        function setViewMode (mode) {
            if (mode === 'geo' && !props.geoAvailable) return;
            emit('update:viewMode', mode);
        }

        function toggleAtlasCategory (category) {
            const set = new Set(props.atlasCategories);
            if (set.has(category)) set.delete(category); else set.add(category);
            emit('update:atlasCategories', [...set]);
        }

        function histogramBarStyle (bin) {
            return { height: `${(bin.count / histogram.value.max) * 100}%` };
        }

        function focusHistogramBin (index) {
            const bin = histogram.value.bins[index];
            if (!bin?.busIds?.length) return;
            activeHistogramBinIndex.value = index;
            activeHistogramBusCursor.value = 0;
            focusBus(bin.busIds[0]);
        }

        function navigateHistogramBin (step) {
            if (!activeHistogramBusIds.value.length) return;
            const next = Math.min(
                activeHistogramBusIds.value.length - 1,
                Math.max(0, activeHistogramBusCursor.value + step),
            );
            activeHistogramBusCursor.value = next;
            focusBus(activeHistogramBusIds.value[next]);
        }

        function focusBranchAt (index) {
            if (!sortedBranches.value.length) return;
            const next = Math.min(sortedBranches.value.length - 1, Math.max(0, index));
            activeBranchCursor.value = next;
            focusElement(sortedBranches.value[next]);
        }

        function navigateBranches (step) {
            focusBranchAt(activeBranchCursor.value + step);
        }

        const maxBusPower = computed(() => {
            let max = 0;
            for (const bus of props.buses) {
                const p = Math.max(Math.abs(bus.loadMw ?? 0), Math.abs(bus.genMw ?? 0));
                if (p > max) max = p;
            }
            return Math.ceil(max);
        });

        function setMinLineLoading (value) {
            const num = Math.max(0, Number(value) || 0);
            emit('update:minLineLoading', num);
        }
        function setMinBusPower (value) {
            const num = Math.max(0, Number(value) || 0);
            emit('update:minBusPower', num);
        }

        watch(activeHistogramBusIds, ids => {
            if (!ids.length) {
                activeHistogramBinIndex.value = null;
                activeHistogramBusCursor.value = 0;
                return;
            }
            activeHistogramBusCursor.value = Math.min(activeHistogramBusCursor.value, ids.length - 1);
        });

        watch(sortedBranches, items => {
            if (!items.length) {
                activeBranchCursor.value = 0;
                return;
            }
            activeBranchCursor.value = Math.min(activeBranchCursor.value, items.length - 1);
        });

        return {
            search, showSuggestions, suggestions,
            isCore, isAll, isMediumVoltage,
            applyPreset, toggleVoltage, toggleType, pickSuggestion, blurLater, setViewMode,
            toggleAtlasCategory,
            HISTOGRAM_BIN_WIDTH,
            voltageColorVar, totals, voltageDiag, loadingDiag,
            histogram, hoveredBin, hoveredBinIndex, activeHistogramBinIndex, activeHistogramBin, activeHistogramBusIds, activeHistogramBusId, activeHistogramBusCursor, lossPctLabel, slackLabel,
            minBusSub, maxBusSub, maxElementSub,
            canFocusBus, focusBus, histogramBarStyle, focusHistogramBin, navigateHistogramBin,
            formatMw,
            maxBusPower, setMinLineLoading, setMinBusPower,
            sortedBranches, activeBranch, activeBranchCursor, canFocusElement, focusBranchAt, navigateBranches,
        };
    },
    template: `
    <aside class="sidebar">

        <SwitchingPanel
            :topology="topology"
            :busy="topologyBusy"
            :request-error="topologyError"
            @reset-topology="$emit('reset-topology')" />

        <section class="section-card">
            <h3 class="section-title">Bilans mocy</h3>
            <div class="metric-grid">
                <div class="metric">
                    <div class="metric-label">Σ P obc.</div>
                    <div class="metric-value tabular">{{ formatMw(totals.loadMw) }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Σ P gen</div>
                    <div class="metric-value tabular">{{ formatMw(totals.generationMw) }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">ΔP strat</div>
                    <div class="metric-value tabular">{{ formatMw(totals.lossesMw) }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Udział strat</div>
                    <div class="metric-value tabular">{{ lossPctLabel }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Węzeł slack</div>
                    <div class="metric-value tabular">{{ slackLabel }}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">Jedn. gen.</div>
                    <div class="metric-value tabular">{{ totals.genUnits ?? '—' }}</div>
                </div>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Profil napięciowy</h3>
            <div class="diag-stack">
                <button class="diag-row diag-row-button" type="button" :disabled="!canFocusBus(voltageDiag.minBusId)" @click="focusBus(voltageDiag.minBusId)">
                    <span class="diag-main">
                        <span class="diag-label">U min</span>
                        <span class="diag-sub">{{ minBusSub }}</span>
                    </span>
                    <span class="diag-values">
                        <span class="diag-value tabular" :class="voltageDiag.minPu != null ? (voltageDiag.minPu < 0.95 ? 'bad' : 'good') : ''">{{ voltageDiag.minPu != null ? voltageDiag.minPu.toFixed(3) + ' p.u.' : '—' }}</span>
                    </span>
                </button>
                <button class="diag-row diag-row-button" type="button" :disabled="!canFocusBus(voltageDiag.maxBusId)" @click="focusBus(voltageDiag.maxBusId)">
                    <span class="diag-main">
                        <span class="diag-label">U max</span>
                        <span class="diag-sub">{{ maxBusSub }}</span>
                    </span>
                    <span class="diag-values">
                        <span class="diag-value tabular" :class="voltageDiag.maxPu != null ? (voltageDiag.maxPu > 1.05 ? 'bad' : 'good') : ''">{{ voltageDiag.maxPu != null ? voltageDiag.maxPu.toFixed(3) + ' p.u.' : '—' }}</span>
                    </span>
                </button>
                <div class="diag-row">
                    <span class="diag-label">U &lt; 0.95 p.u.</span>
                    <span class="diag-value tabular" :class="{ bad: (voltageDiag.lowCount ?? 0) > 0 }">{{ voltageDiag.lowCount ?? 0 }}</span>
                </div>
                <div class="diag-row">
                    <span class="diag-label">U &gt; 1.05 p.u.</span>
                    <span class="diag-value tabular" :class="{ bad: (voltageDiag.highCount ?? 0) > 0 }">{{ voltageDiag.highCount ?? 0 }}</span>
                </div>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Obciążenie gałęzi</h3>
            <div class="diag-stack">
                <button class="diag-row diag-row-button"
                        type="button"
                        :disabled="!activeBranch || !canFocusElement(activeBranch)"
                        @click="focusBranchAt(activeBranchCursor)">
                    <span class="diag-main">
                        <span class="diag-label">Maks. obciążenie</span>
                        <span class="diag-sub">{{ activeBranch ? activeBranch.label + ' · ' + activeBranch.voltageLabel : maxElementSub }}</span>
                    </span>
                    <span class="diag-values">
                        <span class="diag-value tabular" :class="(activeBranch?.loading ?? loadingDiag.maxPct) >= 150 ? 'bad' : ((activeBranch?.loading ?? loadingDiag.maxPct) >= 100 ? 'warn' : 'good')">{{ activeBranch ? activeBranch.loading.toFixed(1) + ' %' : (loadingDiag.maxPct != null ? loadingDiag.maxPct.toFixed(1) + ' %' : '—') }}</span>
                    </span>
                </button>
                <div class="diag-row">
                    <span class="diag-label">Przeciążone ≥ 150%</span>
                    <span class="diag-value tabular" :class="{ bad: (loadingDiag.overloadedCount ?? 0) > 0 }">{{ loadingDiag.overloadedCount ?? 0 }}</span>
                </div>
                <div class="diag-row">
                    <span class="diag-label">Ciężko obciążone 100–150%</span>
                    <span class="diag-value tabular">{{ loadingDiag.heavyCount ?? 0 }}</span>
                </div>
                <div class="diag-row">
                    <span class="diag-label">Szyny z obciążeniem</span>
                    <span class="diag-value tabular">{{ loadingDiag.loadBusCount ?? 0 }}</span>
                </div>
                <div v-if="activeBranch" class="group-nav">
                    <button class="chip"
                            type="button"
                            :disabled="activeBranchCursor <= 0"
                            @click="navigateBranches(-1)">Poprzednia</button>
                    <button class="chip"
                            type="button"
                            :disabled="!canFocusElement(activeBranch)"
                            @click="focusBranchAt(activeBranchCursor)">
                        {{ activeBranchCursor + 1 }}/{{ sortedBranches.length }}
                    </button>
                    <button class="chip"
                            type="button"
                            :disabled="activeBranchCursor >= sortedBranches.length - 1"
                            @click="navigateBranches(1)">Następna</button>
                </div>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Szybkie podsumowanie</h3>
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

        <section class="section-card">
            <h3 class="section-title">Wyszukaj szynę</h3>
            <div class="search-wrap">
                <IconSearch />
                <input
                    v-model="search"
                    @focus="showSuggestions = true"
                    @blur="blurLater"
                    class="search-input"
                    placeholder="Nazwa lub ID szyny..."
                    type="text" />
            </div>
            <div v-if="showSuggestions && suggestions.length" class="suggestions">
                <button
                    v-for="b in suggestions"
                    :key="b.id"
                    class="suggestion-item"
                    @mousedown.prevent="pickSuggestion(b)">
                    <span>{{ b.name }}</span>
                    <span class="meta">#{{ b.id }} · {{ b.vn_kv.toFixed(0) }} kV</span>
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

        <section class="section-card">
            <h3 class="section-title">Filtry mocy / obciążenia</h3>
            <div class="filter-row">
                <label class="filter-label" for="flt-line-loading">
                    Min. obciążenie linii / trafo
                    <span class="diag-value tabular">{{ minLineLoading.toFixed(0) }}%</span>
                </label>
                <div class="filter-controls">
                    <input
                        id="flt-line-loading"
                        type="range"
                        min="0" max="200" step="1"
                        :value="minLineLoading"
                        @input="setMinLineLoading($event.target.value)" />
                    <input
                        type="number"
                        min="0" max="200" step="1"
                        class="filter-num"
                        :value="minLineLoading"
                        @input="setMinLineLoading($event.target.value)" />
                </div>
                <p class="helper" v-if="!hasResults">Brak wyników rozpływu — filtr ukryje wszystko przy wartości &gt; 0.</p>
            </div>
            <div class="filter-row">
                <label class="filter-label" for="flt-bus-power">
                    Min. moc na szynie (max{P obc., P gen.})
                    <span class="diag-value tabular">{{ formatMw(minBusPower) }}</span>
                </label>
                <div class="filter-controls">
                    <input
                        id="flt-bus-power"
                        type="range"
                        min="0" :max="maxBusPower" step="1"
                        :value="minBusPower"
                        @input="setMinBusPower($event.target.value)" />
                    <input
                        type="number"
                        min="0" :max="maxBusPower" step="1"
                        class="filter-num"
                        :value="minBusPower"
                        @input="setMinBusPower($event.target.value)" />
                </div>
                <p class="helper">Maks. w sieci: {{ formatMw(maxBusPower) }}. Linie z ukrytymi szynami też znikają.</p>
            </div>
            <div class="btn-search-row">
                <button class="btn btn-block" type="button" @click="setMinLineLoading(0); setMinBusPower(0);">
                    Wyczyść filtry
                </button>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Poziomy napięć</h3>
            <div class="chip-row">
                <button class="chip" :class="{ active: isCore }" @click="applyPreset('core')">Rdzeń 400/220</button>
                <button class="chip" :class="{ active: isMediumVoltage }" @click="applyPreset('medium')">110 kV</button>
                <button class="chip" :class="{ active: isAll }"  @click="applyPreset('all')">Wszystkie</button>
            </div>
            <div class="check-list">
                <label class="check-row" v-for="v in voltageLevels" :key="v">
                    <input type="checkbox" :checked="selectedVoltages.includes(v)" @change="toggleVoltage(v)" />
                    <span class="v-dot" :style="{ background: voltageColorVar(v) }"></span>
                    <span class="v-text">{{ v.toFixed(0) }} kV</span>
                </label>
            </div>
        </section>

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
                <label class="check-row">
                    <input type="checkbox" :checked="showSwitches" @change="$emit('update:showSwitches', $event.target.checked)" />
                    <span class="label">Switche</span>
                </label>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Rozkład U (p.u.)</h3>
            <div class="histogram-shell">
                <div class="histogram-chart">
                    <div class="histogram-band histogram-band-good" :style="{ left: histogram.okBandLeft + '%', width: histogram.okBandWidth + '%' }"></div>
                    <div class="histogram-line histogram-line-nominal" :style="{ left: histogram.nominalLeft + '%' }"></div>
                    <div class="histogram-bars">
                        <button
                            v-for="(bin, index) in histogram.bins"
                            :key="index"
                            class="histogram-bar-button"
                            :class="{ active: hoveredBinIndex === index || activeHistogramBinIndex === index, clickable: bin.busIds.length > 0 }"
                            type="button"
                            @mouseenter="hoveredBinIndex = index"
                            @mouseleave="hoveredBinIndex = null"
                            @click="focusHistogramBin(index)">
                            <span class="histogram-bar" :class="bin.status" :style="histogramBarStyle(bin)"></span>
                        </button>
                    </div>
                </div>
                <div class="histogram-axis">
                    <span>0.85</span>
                    <span>0.95</span>
                    <span>1.00</span>
                    <span>1.05</span>
                    <span>1.15</span>
                </div>
                <div class="histogram-readout">
                    <span v-if="hoveredBin">
                        <span class="diag-value tabular">{{ hoveredBin.lo.toFixed(2) }}–{{ hoveredBin.hi.toFixed(2) }} p.u.</span>
                        · {{ hoveredBin.count }} szyn
                        <span v-if="hoveredBin.busIds.length"> · kliknij, aby wejść w grupę</span>
                    </span>
                    <span v-else-if="activeHistogramBin">
                        <span class="diag-value tabular">{{ activeHistogramBin.lo.toFixed(2) }}–{{ activeHistogramBin.hi.toFixed(2) }} p.u.</span>
                        · {{ activeHistogramBusCursor + 1 }}/{{ activeHistogramBusIds.length }}
                        <span v-if="activeHistogramBusId != null"> · szyna #{{ activeHistogramBusId }}</span>
                    </span>
                    <span v-else-if="hasResults">
                        n = <span class="diag-value tabular">{{ histogram.total }}</span>
                        · koszyk {{ HISTOGRAM_BIN_WIDTH.toFixed(2) }} p.u.
                        · kliknij słupek, aby przechodzić po całej grupie
                    </span>
                    <span v-else>Brak wyników rozpływu mocy — rozkład U jest niedostępny.</span>
                </div>
                <div v-if="activeHistogramBin" class="group-nav">
                    <button class="chip"
                            type="button"
                            :disabled="activeHistogramBusCursor <= 0"
                            @click="navigateHistogramBin(-1)">Poprzednia</button>
                    <button class="chip"
                            type="button"
                            :disabled="activeHistogramBusId == null"
                            @click="focusBus(activeHistogramBusId)">
                        {{ activeHistogramBusCursor + 1 }}/{{ activeHistogramBusIds.length }}
                    </button>
                    <button class="chip"
                            type="button"
                            :disabled="activeHistogramBusCursor >= activeHistogramBusIds.length - 1"
                            @click="navigateHistogramBin(1)">Następna</button>
                </div>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Obciążenie linii</h3>
            <div class="legend-bar"></div>
            <div class="legend-scale">
                <span>0%</span><span>60%</span><span>100%</span><span>150%+</span>
            </div>
        </section>

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
