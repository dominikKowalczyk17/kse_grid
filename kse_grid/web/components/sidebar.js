import { computed, ref } from 'vue';
import { IconSearch, IconRotate, IconCable, IconZap, IconCircleDot } from '/icons.js';
import {
    formatMw,
    HISTOGRAM_BIN_WIDTH,
    HISTOGRAM_MAX,
    HISTOGRAM_MIN,
    voltageColorVar,
    voltageStatus,
} from '/lib/formatters.js';

export const Sidebar = {
    components: { IconSearch, IconRotate, IconCable, IconZap, IconCircleDot },
    props: {
        stats: Object,
        totals: Object,
        diagnostics: Object,
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
        const hoveredBinIndex = ref(null);

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
                    firstBusId: null,
                };
            });

            if (props.hasResults) {
                for (const bus of props.buses) {
                    if (!selectedSet.value.has(bus.vn_kv) || bus.vmPu == null) continue;
                    const vmPu = Math.max(HISTOGRAM_MIN, Math.min(HISTOGRAM_MAX - 1e-9, bus.vmPu));
                    const index = Math.min(binCount - 1, Math.floor((vmPu - HISTOGRAM_MIN) / HISTOGRAM_BIN_WIDTH));
                    bins[index].count += 1;
                    if (bins[index].firstBusId == null) bins[index].firstBusId = bus.id;
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

        function focusHistogramBin (bin) {
            if (!bin?.firstBusId) return;
            focusBus(bin.firstBusId);
        }

        return {
            search, showSuggestions, suggestions,
            isCore, isAll, isMediumVoltage,
            applyPreset, toggleVoltage, toggleType, pickSuggestion, blurLater, setViewMode,
            toggleAtlasCategory,
            HISTOGRAM_BIN_WIDTH,
            voltageColorVar, totals, voltageDiag, loadingDiag,
            histogram, hoveredBin, hoveredBinIndex, lossPctLabel, slackLabel,
            minBusSub, maxBusSub, maxElementSub,
            canFocusBus, focusBus, histogramBarStyle, focusHistogramBin,
            formatMw,
        };
    },
    template: `
    <aside class="sidebar">

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
                <div class="diag-row">
                    <span class="diag-main">
                        <span class="diag-label">Maks. obciążenie</span>
                        <span class="diag-sub">{{ maxElementSub }}</span>
                    </span>
                    <span class="diag-values">
                        <span class="diag-value tabular" :class="loadingDiag.maxPct >= 100 ? 'bad' : (loadingDiag.maxPct >= 80 ? 'warn' : 'good')">{{ loadingDiag.maxPct != null ? loadingDiag.maxPct.toFixed(1) + ' %' : '—' }}</span>
                    </span>
                </div>
                <div class="diag-row">
                    <span class="diag-label">Przeciążone ≥ 100%</span>
                    <span class="diag-value tabular" :class="{ bad: (loadingDiag.overloadedCount ?? 0) > 0 }">{{ loadingDiag.overloadedCount ?? 0 }}</span>
                </div>
                <div class="diag-row">
                    <span class="diag-label">Ciężko obciążone 80–100%</span>
                    <span class="diag-value tabular">{{ loadingDiag.heavyCount ?? 0 }}</span>
                </div>
                <div class="diag-row">
                    <span class="diag-label">Szyny z obciążeniem</span>
                    <span class="diag-value tabular">{{ loadingDiag.loadBusCount ?? 0 }}</span>
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
                            :class="{ active: hoveredBinIndex === index, clickable: bin.firstBusId != null }"
                            type="button"
                            @mouseenter="hoveredBinIndex = index"
                            @mouseleave="hoveredBinIndex = null"
                            @click="focusHistogramBin(bin)">
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
                        <span v-if="hoveredBin.firstBusId != null"> · kliknij, aby przejść do #{{ hoveredBin.firstBusId }}</span>
                    </span>
                    <span v-else-if="hasResults">
                        n = <span class="diag-value tabular">{{ histogram.total }}</span>
                        · koszyk {{ HISTOGRAM_BIN_WIDTH.toFixed(2) }} p.u.
                        · kliknij słupek, aby przejść do pierwszej szyny
                    </span>
                    <span v-else>Brak wyników rozpływu mocy — rozkład U jest niedostępny.</span>
                </div>
            </div>
        </section>

        <section class="section-card">
            <h3 class="section-title">Obciążenie linii</h3>
            <div class="legend-bar"></div>
            <div class="legend-scale">
                <span>0%</span><span>40%</span><span>80%</span><span>100%+</span>
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
