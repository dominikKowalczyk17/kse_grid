import { computed, nextTick, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue';
import { ErrorModal } from '/components/error-modal.js';
import { Sidebar } from '/components/sidebar.js';
import { GraphPanel } from '/components/graph-panel.js';
import { IconChevronLeft, IconChevronRight, IconSun, IconMoon } from '/icons.js';
import { formatError } from '/lib/errors.js';
import {
    fetchElementParams,
    fetchElementSchema,
    fetchNetwork,
    recalculatePowerflow,
    resetTopology,
    setSwitchState,
    updateElement,
    uploadNetwork,
} from '/lib/api.js';

const THEME_STORAGE_KEY = 'kse_grid:theme';
const SIDEBAR_STORAGE_KEY = 'kse_grid:sidebar-hidden';

function polishPlural(count, one, few, many) {
    if (count === 1) return one;
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
}

export const App = {
    components: { ErrorModal, Sidebar, GraphPanel, IconChevronLeft, IconChevronRight, IconSun, IconMoon },
    setup () {
        const network = ref(null);
        const error = ref(null);
        const activeError = ref(null);
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
        const powerflowBusy = ref(false);

        const elementSchema = ref({});
        const elementParams = ref(null);
        const editError = ref('');
        const editBusy = ref(false);

        const storedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY)) || 'dark';
        const storedSidebar = (typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_STORAGE_KEY)) || 'false';
        const theme = ref(storedTheme === 'light' ? 'light' : 'dark');
        const sidebarHidden = ref(storedSidebar === 'true');

        watchEffect(() => {
            document.documentElement.dataset.theme = theme.value;
            try { localStorage.setItem(THEME_STORAGE_KEY, theme.value); } catch (_) {}
        });

        watchEffect(() => {
            try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarHidden.value)); } catch (_) {}
        });

        function toggleTheme () {
            theme.value = theme.value === 'dark' ? 'light' : 'dark';
        }

        async function toggleSidebar () {
            sidebarHidden.value = !sidebarHidden.value;
            await nextTick();
            graphPanelRef.value?.handleLayoutChange?.();
        }

        function presentError (rawError, title, info = '') {
            const formatted = formatError(rawError, title);
            if (info) formatted.detail = [info, formatted.detail].filter(Boolean).join('\n\n');
            activeError.value = formatted;
            return formatted;
        }

        function dismissErrorModal () {
            activeError.value = null;
        }

        function handleRuntimeError (payload) {
            if (!payload) return;
            const isWrapped = typeof payload === 'object' && payload !== null && ('error' in payload || 'title' in payload || 'info' in payload);
            const formatted = isWrapped
                ? presentError(payload.error, payload.title || 'Błąd aplikacji', payload.info || '')
                : presentError(payload, 'Błąd aplikacji');
            if (!network.value) error.value = formatted.message;
        }

        function onWindowError (event) {
            const location = event?.filename
                ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
                : 'window.error';
            handleRuntimeError({
                title: 'Nieobsłużony błąd JavaScript',
                info: location,
                error: event?.error || new Error(event?.message || 'Nieznany błąd JavaScript'),
            });
        }

        function onUnhandledRejection (event) {
            event?.preventDefault?.();
            handleRuntimeError({
                title: 'Nieobsłużone odrzucenie Promise',
                info: 'window.unhandledrejection',
                error: event?.reason || new Error('Promise rejected without a handler'),
            });
        }

        function onRuntimeErrorEvent (event) {
            handleRuntimeError(event?.detail || null);
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
                error.value = presentError(fetchError, 'Błąd ładowania sieci').message;
            }
        }

        async function loadElementSchema () {
            try {
                elementSchema.value = await fetchElementSchema();
            } catch (schemaError) {
                presentError(schemaError, 'Błąd pobierania schematu edycji');
                elementSchema.value = {};
            }
        }

        async function onRequestEditParams ({ kind, id }) {
            editError.value = '';
            elementParams.value = null;
            try {
                elementParams.value = await fetchElementParams(kind, id);
            } catch (requestError) {
                editError.value = presentError(requestError, `Błąd pobierania parametrów ${kind} #${id}`).message;
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
                editError.value = presentError(requestError, `Błąd zapisu parametrów ${kind} #${id}`).message;
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
                topologyError.value = presentError(requestError, `Błąd aktualizacji odłącznika #${switchId}`).message;
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
                topologyError.value = presentError(requestError, 'Błąd aktualizacji stanu łączeniowego').message;
            } finally {
                topologyBusy.value = false;
            }
        }

        async function onResetTopology () {
            topologyBusy.value = true;
            topologyError.value = '';
            try {
                const payload = await resetTopology();
                applyNetwork(payload);
                elementParams.value = null;
                editError.value = '';
            } catch (requestError) {
                topologyError.value = presentError(requestError, 'Błąd resetu topologii').message;
            } finally {
                topologyBusy.value = false;
            }
        }

        async function onRecalculatePowerflow () {
            topologyBusy.value = true;
            powerflowBusy.value = true;
            topologyError.value = '';
            try {
                applyTopologyUpdate(await recalculatePowerflow());
            } catch (requestError) {
                topologyError.value = presentError(requestError, 'Błąd przeliczania rozpływu mocy').message;
            } finally {
                powerflowBusy.value = false;
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
                uploadError.value = presentError(requestError, 'Błąd uploadu pliku').message;
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

        onMounted(() => {
            window.addEventListener('error', onWindowError);
            window.addEventListener('unhandledrejection', onUnhandledRejection);
            window.addEventListener('kse-grid:error', onRuntimeErrorEvent);
        });

        onBeforeUnmount(() => {
            window.removeEventListener('error', onWindowError);
            window.removeEventListener('unhandledrejection', onUnhandledRejection);
            window.removeEventListener('kse-grid:error', onRuntimeErrorEvent);
        });

        const stats = computed(() => network.value?.stats || {});
        const pendingRecalc = computed(() => Boolean(network.value?.topology?.pendingRecalc));
        const pendingChangeCount = computed(() => Number(network.value?.topology?.pendingChangeCount || 0));
        const pendingHeaderLabel = computed(() => {
            const count = pendingChangeCount.value;
            return `${count} ${polishPlural(count, 'zmiana oczekuje', 'zmiany oczekują', 'zmian oczekuje')}`;
        });

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
            activeError,
            stats,
            pendingRecalc,
            pendingChangeCount,
            pendingHeaderLabel,
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
            powerflowBusy,
            elementSchema,
            elementParams,
            editError,
            editBusy,
            theme,
            sidebarHidden,
            toggleTheme,
            toggleSidebar,
            dismissErrorModal,
            handleRuntimeError,
            onSetSwitchState,
            onSetSwitchesState,
            onResetTopology,
            onRecalculatePowerflow,
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
                <span v-if="pendingRecalc" class="status-pill warn">
                    <span class="dot"></span>
                    {{ pendingHeaderLabel }}
                </span>
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
                    v-if="pendingRecalc"
                    type="button"
                    :disabled="topologyBusy"
                    @click="onRecalculatePowerflow">
                {{ topologyBusy ? 'Przeliczam…' : 'Przelicz rozpływ' }}
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
        <div class="app-body" :class="{ 'sidebar-hidden': sidebarHidden }">
            <div class="sidebar-shell">
                <Sidebar
                    class="sidebar-panel"
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
                @select-bus="onSelectBus"
                @select-element="onSelectElement" />
            </div>
            <button class="sidebar-toggle"
                    type="button"
                    :aria-label="sidebarHidden ? 'Rozwiń panel boczny' : 'Zwiń panel boczny'"
                    :title="sidebarHidden ? 'Pokaż panel boczny' : 'Ukryj panel boczny'"
                    @click="toggleSidebar">
                <IconChevronRight v-if="sidebarHidden" />
                <IconChevronLeft v-else />
            </button>
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
                @runtime-error="handleRuntimeError"
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
    <transition name="upload-fade">
        <div v-if="powerflowBusy" class="upload-backdrop" role="dialog" aria-modal="true" aria-label="Przeliczanie rozpływu mocy">
            <div class="upload-modal">
                <div class="upload-title">Przeliczanie rozpływu mocy…</div>
                <div class="upload-progress indeterminate">
                    <div class="upload-progress-bar" style="width:100%"></div>
                </div>
                <div class="upload-status tabular">Uruchamiam obliczenia…</div>
            </div>
        </div>
    </transition>
    <ErrorModal :error="activeError" @close="dismissErrorModal" />
    `,
};
