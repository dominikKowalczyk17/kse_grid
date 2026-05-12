import { computed, ref, watchEffect } from 'vue';
import { Sidebar } from '/components/sidebar.js';
import { GraphPanel } from '/components/graph-panel.js';
import { IconSun, IconMoon } from '/icons.js';
import {
    fetchElementParams,
    fetchElementSchema,
    fetchNetwork,
    resetTopology,
    setSwitchState,
    updateElement,
    uploadNetwork,
} from '/lib/api.js';

const THEME_STORAGE_KEY = 'kse_grid:theme';

export const App = {
    components: { Sidebar, GraphPanel, IconSun, IconMoon },
    setup () {
        const network = ref(null);
        const error = ref(null);
        const selectedVoltages = ref([]);
        const selectedTypes = ref(['line', 'trafo', 'bus']);
        const viewMode = ref('graph');
        const editMode = ref(false);
        const atlasCategories = ref(['osp', 'osd', 'jw']);
        const minLineLoading = ref(0);
        const minBusPower = ref(0);
        const showSwitches = ref(true);
        const topologyBusy = ref(false);
        const topologyError = ref('');
        const topologyRevision = ref(0);
        const graphPanelRef = ref(null);
        const uploadInputRef = ref(null);
        const uploadBusy = ref(false);
        const uploadError = ref('');
        const uploadProgress = ref(0);
        const uploadPhase = ref('upload');
        const uploadFileName = ref('');

        const elementSchema = ref({});
        const elementParams = ref(null);
        const editError = ref('');
        const editBusy = ref(false);

        const storedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY)) || 'dark';
        const theme = ref(storedTheme === 'light' ? 'light' : 'dark');

        watchEffect(() => {
            document.documentElement.dataset.theme = theme.value;
            try { localStorage.setItem(THEME_STORAGE_KEY, theme.value); } catch (_) {}
        });

        function toggleTheme () {
            theme.value = theme.value === 'dark' ? 'light' : 'dark';
        }

        function applyNetwork (data, opts = {}) {
            const isFirstLoad = opts.firstLoad ?? !network.value;
            network.value = data;
            document.title = `${data.name} – kse_grid`;

            if (isFirstLoad) {
                selectedVoltages.value = [...data.defaultVoltageFilter];
                viewMode.value = data.defaultViewMode || 'graph';
                return;
            }

            const nextVoltages = selectedVoltages.value.filter(level => data.voltageLevels.includes(level));
            selectedVoltages.value = nextVoltages.length ? nextVoltages : [...data.defaultVoltageFilter];
            if (viewMode.value === 'geo' && !data.geoAvailable) viewMode.value = data.defaultViewMode || 'graph';
        }

        function applyTopologyUpdate (update) {
            const net = network.value;
            if (!net || !update) return;

            if ('hasResults' in update) net.hasResults = update.hasResults;
            if (update.stats) net.stats = update.stats;
            if (update.totals) net.totals = update.totals;
            if (update.diagnostics) net.diagnostics = update.diagnostics;
            if (update.topology) net.topology = update.topology;

            if (Array.isArray(update.switches) && Array.isArray(net.switches)) {
                const byId = new Map(net.switches.map(sw => [sw.id, sw]));
                for (const patch of update.switches) {
                    const sw = byId.get(patch.id);
                    if (sw) sw.closed = patch.closed;
                }
            }

            if (Array.isArray(update.busResults) && Array.isArray(net.buses)) {
                const byId = new Map(net.buses.map(b => [b.id, b]));
                for (const patch of update.busResults) {
                    const bus = byId.get(patch.id);
                    if (!bus) continue;
                    bus.vmPu = patch.vmPu ?? null;
                    bus.vaDeg = patch.vaDeg ?? null;
                    if ('genMvar' in patch) bus.genMvar = patch.genMvar;
                }
            }

            if (Array.isArray(update.lineResults) && Array.isArray(net.lines)) {
                const byId = new Map(net.lines.map(l => [l.id, l]));
                for (const patch of update.lineResults) {
                    const line = byId.get(patch.id);
                    if (!line) continue;
                    line.loading = patch.loading ?? 0;
                    line.pFromMw = patch.pFromMw ?? null;
                    line.qFromMvar = patch.qFromMvar ?? null;
                    line.pToMw = patch.pToMw ?? null;
                    line.qToMvar = patch.qToMvar ?? null;
                }
            }

            if (Array.isArray(update.trafoResults) && Array.isArray(net.trafos)) {
                const byId = new Map(net.trafos.map(t => [t.id, t]));
                for (const patch of update.trafoResults) {
                    const trafo = byId.get(patch.id);
                    if (!trafo) continue;
                    trafo.loading = patch.loading ?? 0;
                    trafo.pHvMw = patch.pHvMw ?? null;
                    trafo.qHvMvar = patch.qHvMvar ?? null;
                    trafo.pLvMw = patch.pLvMw ?? null;
                    trafo.qLvMvar = patch.qLvMvar ?? null;
                }
            }

            if (update.changedElement) {
                applyChangedElement(net, update.changedElement);
            }

            topologyRevision.value += 1;
        }

        function applyChangedElement (net, change) {
            const arrayKey = change.kind === 'bus' ? 'buses'
                : change.kind === 'line' ? 'lines'
                    : change.kind === 'trafo' ? 'trafos'
                        : change.kind === 'switch' ? 'switches' : null;
            if (!arrayKey || !Array.isArray(net[arrayKey])) return;
            const target = net[arrayKey].find(item => item.id === change.id);
            if (!target) return;
            // Mutujemy element w miejscu, żeby aktywne `selection.payload` w GraphPanel
            // (który trzyma referencję do tego samego obiektu) od razu się odświeżyło.
            for (const [key, value] of Object.entries(change.payload || {})) {
                target[key] = value;
            }
        }

        async function loadNetwork () {
            try {
                applyNetwork(await fetchNetwork());
                error.value = null;
            } catch (fetchError) {
                error.value = String(fetchError);
            }
        }

        async function loadElementSchema () {
            try {
                elementSchema.value = await fetchElementSchema();
            } catch (_) {
                // Schemat nie jest krytyczny dla podstawowego widoku — przy braku
                // ukryjemy tylko przycisk edycji w karcie selekcji.
                elementSchema.value = {};
            }
        }

        async function onRequestEditParams ({ kind, id }) {
            editError.value = '';
            elementParams.value = null;
            try {
                elementParams.value = await fetchElementParams(kind, id);
            } catch (requestError) {
                editError.value = String(requestError);
            }
        }

        function onCancelEdit () {
            elementParams.value = null;
            editError.value = '';
        }

        async function onSubmitEdit ({ kind, id, fields, done }) {
            editBusy.value = true;
            editError.value = '';
            try {
                const payload = await updateElement(kind, id, fields);
                applyTopologyUpdate(payload);
                elementParams.value = null;
                if (typeof done === 'function') done(true);
            } catch (requestError) {
                editError.value = String(requestError);
                if (typeof done === 'function') done(false);
            } finally {
                editBusy.value = false;
            }
        }

        async function onSetSwitchState ({ switchId, closed }) {
            topologyBusy.value = true;
            topologyError.value = '';
            try {
                applyTopologyUpdate(await setSwitchState(switchId, closed));
            } catch (requestError) {
                topologyError.value = String(requestError);
            } finally {
                topologyBusy.value = false;
            }
        }

        async function onSetSwitchesState ({ switchIds, closed }) {
            topologyBusy.value = true;
            topologyError.value = '';
            try {
                let payload = null;
                for (const switchId of switchIds) {
                    payload = await setSwitchState(switchId, closed);
                }
                if (payload) applyTopologyUpdate(payload);
            } catch (requestError) {
                topologyError.value = String(requestError);
            } finally {
                topologyBusy.value = false;
            }
        }

        async function onResetTopology () {
            topologyBusy.value = true;
            topologyError.value = '';
            try {
                applyTopologyUpdate(await resetTopology());
            } catch (requestError) {
                topologyError.value = String(requestError);
            } finally {
                topologyBusy.value = false;
            }
        }

        function triggerUpload () {
            uploadError.value = '';
            uploadInputRef.value?.click();
        }

        async function onUploadFile (event) {
            const input = event.target;
            const file = input?.files?.[0];
            if (!file) return;
            uploadBusy.value = true;
            uploadError.value = '';
            uploadProgress.value = 0;
            uploadPhase.value = 'upload';
            uploadFileName.value = file.name;
            error.value = null;
            try {
                const payload = await uploadNetwork(file, ({ phase, percent }) => {
                    uploadPhase.value = phase;
                    if (phase === 'upload' && typeof percent === 'number') {
                        uploadProgress.value = Math.min(100, Math.max(0, percent));
                    } else if (phase === 'process') {
                        uploadProgress.value = 100;
                    }
                });
                // Wymuszamy reset filtrów / viewMode jak przy pierwszym ładowaniu,
                // ale BEZ zerowania network.value (to powodowało wyścig dwóch
                // równoczesnych buildPlot — z watcha network i topologyRevision —
                // przez co handlery bend/selection w pixi gubiły się).
                applyNetwork(payload, { firstLoad: true });
            } catch (requestError) {
                uploadError.value = String(requestError.message || requestError);
            } finally {
                uploadBusy.value = false;
                uploadProgress.value = 0;
                uploadPhase.value = 'upload';
                uploadFileName.value = '';
                if (input) input.value = '';
            }
        }

        loadNetwork();
        loadElementSchema();

        const stats = computed(() => network.value?.stats || {});

        function onSelectBus (busId) {
            graphPanelRef.value?.selectBus(busId, true);
        }

        function onSelectElement (selection) {
            graphPanelRef.value?.selectElement(selection);
        }

        function onResetView () {
            graphPanelRef.value?.resetView();
        }

        return {
            network,
            error,
            stats,
            selectedVoltages,
            selectedTypes,
            viewMode,
            editMode,
            atlasCategories,
            minLineLoading,
            minBusPower,
            showSwitches,
            topologyBusy,
            topologyError,
            topologyRevision,
            graphPanelRef,
            uploadInputRef,
            uploadBusy,
            uploadError,
            uploadProgress,
            uploadPhase,
            uploadFileName,
            elementSchema,
            elementParams,
            editError,
            editBusy,
            theme,
            toggleTheme,
            onSetSwitchState,
            onSetSwitchesState,
            onResetTopology,
            onSelectBus,
            onSelectElement,
            onResetView,
            onRequestEditParams,
            onSubmitEdit,
            onCancelEdit,
            triggerUpload,
            onUploadFile,
        };
    },
    template: `
    <div class="app-shell" v-if="network">
        <header class="app-header">
            <div class="brand">
                <span class="case-name brand-title">{{ network.name }}</span>
            </div>

            <div class="header-divider"></div>

            <div class="header-stats">
                <span class="header-stat"><span class="v tabular">{{ stats.nBus }}</span> szyn</span>
                <span class="header-stat"><span class="v tabular">{{ stats.nLine }}</span> linii</span>
                <span class="header-stat"><span class="v tabular">{{ stats.nTrafo }}</span> trafo</span>
            </div>

            <div class="header-spacer"></div>

            <button class="btn"
                    type="button"
                    :disabled="uploadBusy"
                    :title="uploadError || 'Załaduj plik MATPOWER (.m) z dysku'"
                    @click="triggerUpload">
                {{ uploadBusy ? 'Wgrywam…' : 'Wczytaj plik .m' }}
            </button>
            <input ref="uploadInputRef"
                   type="file"
                   accept=".m,text/plain"
                   style="display:none"
                   @change="onUploadFile" />

            <button class="btn"
                    type="button"
                    :class="{ 'btn-active': editMode }"
                    :title="editMode ? 'Tryb edycji włączony — drag busa, łamanie linii' : 'Włącz tryb edycji (drag busa, łamanie linii)'"
                    @click="editMode = !editMode">
                {{ editMode ? 'Edycja: WŁ' : 'Edycja: WYŁ' }}
            </button>

            <button class="btn"
                    type="button"
                    :disabled="topologyBusy"
                    @click="onResetTopology">
                {{ topologyBusy ? 'Przeliczam…' : 'Reset stanu sieci' }}
            </button>

            <button class="btn btn-icon theme-toggle"
                    type="button"
                    :aria-label="theme === 'dark' ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'"
                    :title="theme === 'dark' ? 'Jasny motyw' : 'Ciemny motyw'"
                    @click="toggleTheme">
                <IconSun v-if="theme === 'dark'" />
                <IconMoon v-else />
            </button>
        </header>
        <div class="app-body">
            <Sidebar
                :stats="stats"
                :totals="network.totals"
                :diagnostics="network.diagnostics"
                :topology="network.topology"
                :voltage-levels="network.voltageLevels"
                :default-voltage-filter="network.defaultVoltageFilter"
                :buses="network.buses"
                :lines="network.lines"
                :trafos="network.trafos"
                :has-results="network.hasResults"
                :view-mode="viewMode"
                :geo-available="network.geoAvailable"
                v-model:selected-voltages="selectedVoltages"
                v-model:selected-types="selectedTypes"
                v-model:view-mode="viewMode"
                v-model:atlas-categories="atlasCategories"
                v-model:min-line-loading="minLineLoading"
                v-model:min-bus-power="minBusPower"
                v-model:show-switches="showSwitches"
                :topology-busy="topologyBusy"
                :topology-error="topologyError"
                @reset-view="onResetView"
                @reset-topology="onResetTopology"
                @select-bus="onSelectBus"
                @select-element="onSelectElement" />
            <GraphPanel
                ref="graphPanelRef"
                :network="network"
                :view-mode="viewMode"
                :atlas-categories="atlasCategories"
                :selected-voltages="selectedVoltages"
                :selected-types="selectedTypes"
                :min-line-loading="minLineLoading"
                :min-bus-power="minBusPower"
                :show-switches="showSwitches"
                :topology-busy="topologyBusy"
                :topology-revision="topologyRevision"
                :theme="theme"
                :edit-mode="editMode"
                :element-schema="elementSchema"
                :element-params="elementParams"
                :edit-error="editError"
                :edit-busy="editBusy"
                @set-switch-state="onSetSwitchState"
                @set-switches-state="onSetSwitchesState"
                @request-edit-params="onRequestEditParams"
                @submit-edit="onSubmitEdit"
                @cancel-edit="onCancelEdit" />
        </div>
    </div>
    <div v-else-if="error" class="overlay">
        <span class="err">Błąd ładowania danych: {{ error }}</span>
    </div>
    <div v-else class="overlay">
        <div class="spinner"></div>
        <span>Ładowanie sieci...</span>
    </div>
    <transition name="upload-fade">
        <div v-if="uploadBusy" class="upload-backdrop" role="dialog" aria-modal="true" aria-label="Wgrywanie pliku">
            <div class="upload-modal">
                <div class="upload-title">
                    {{ uploadPhase === 'process' ? 'Przetwarzanie sieci…' : 'Wgrywanie pliku…' }}
                </div>
                <div v-if="uploadFileName" class="upload-filename" :title="uploadFileName">{{ uploadFileName }}</div>
                <div class="upload-progress" :class="{ indeterminate: uploadPhase === 'process' }">
                    <div class="upload-progress-bar" :style="{ width: (uploadPhase === 'process' ? 100 : uploadProgress) + '%' }"></div>
                </div>
                <div class="upload-status tabular">
                    <span v-if="uploadPhase === 'upload'">{{ uploadProgress.toFixed(0) }}%</span>
                    <span v-else>Uruchamiam rozpływ mocy…</span>
                </div>
            </div>
        </div>
    </transition>
    `,
};
