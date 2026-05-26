import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { ErrorModal } from '/components/error-modal.js';
import { ResultsBar } from '/components/results-bar.js';
import { Sidebar } from '/components/sidebar.js';
import { GraphPanel } from '/components/graph-panel.js';
import { GridBuilder } from '/components/grid-builder.js';
import { IconChevronLeft, IconChevronRight, IconSun, IconMoon } from '/icons.js';
import { useErrorHandling } from '/lib/composables/use-error-handling.js';
import { useNetworkState } from '/lib/composables/use-network-state.js';
import { useTopologyOps } from '/lib/composables/use-topology-ops.js';
import { useElementEdit } from '/lib/composables/use-element-edit.js';
import { useGridBuilder } from '/lib/composables/use-grid-builder.js';
import { useUiState } from '/lib/composables/use-ui-state.js';
import { polishPlural } from '/lib/formatters.js';

export const App = {
    components: { ErrorModal, ResultsBar, Sidebar, GraphPanel, GridBuilder, IconChevronLeft, IconChevronRight, IconSun, IconMoon },
    setup() {
        const errorHandling = useErrorHandling();
        const uiState = useUiState();
        const topologyRevision = ref(0);

        const networkState = useNetworkState({
            presentError: errorHandling.presentError,
            onApply(data, isFirstLoad) {
                if (isFirstLoad) {
                    uiState.selectedVoltages.value = [...data.defaultVoltageFilter];
                    uiState.viewMode.value = data.defaultViewMode || 'graph';
                    return;
                }
                const next = uiState.selectedVoltages.value.filter(level => data.voltageLevels.includes(level));
                uiState.selectedVoltages.value = next.length ? next : [...data.defaultVoltageFilter];
                if (uiState.viewMode.value === 'geo' && !data.geoAvailable) {
                    uiState.viewMode.value = data.defaultViewMode || 'graph';
                }
            },
        });

        function applyTopologyUpdate(update) {
            if (!update) return;
            networkState.applyTopologyUpdate(update);
            topologyRevision.value += 1;
        }

        const topologyOps = useTopologyOps({
            applyTopologyUpdate,
            applyNetwork: networkState.applyNetwork,
            presentError: errorHandling.presentError,
        });

        const elementEdit = useElementEdit({
            applyTopologyUpdate,
            presentError: errorHandling.presentError,
        });

        const gridBuilder = useGridBuilder({
            network: networkState.network,
            applyNetwork: networkState.applyNetwork,
            presentError: errorHandling.presentError,
        });

        async function onResetTopology() {
            await topologyOps.onResetTopology();
            elementEdit.onCancelEdit();
        }

        function handleRuntimeError(payload) {
            const formatted = errorHandling.handleRuntimeError(payload);
            if (formatted && !networkState.network.value) {
                networkState.error.value = formatted.message;
            }
        }

        function onWindowError(event) {
            const location = event?.filename
                ? `${event.filename}:${event.lineno || 0}:${event.colno || 0}`
                : 'window.error';
            handleRuntimeError({
                title: 'Nieobsłużony błąd JavaScript',
                info: location,
                error: event?.error || new Error(event?.message || 'Nieznany błąd JavaScript'),
            });
        }

        function onUnhandledRejection(event) {
            event?.preventDefault?.();
            handleRuntimeError({
                title: 'Nieobsłużone odrzucenie Promise',
                info: 'window.unhandledrejection',
                error: event?.reason || new Error('Promise rejected without a handler'),
            });
        }

        function onRuntimeErrorEvent(event) {
            handleRuntimeError(event?.detail || null);
        }

        const stats = computed(() => networkState.network.value?.stats || {});
        const pendingRecalc = computed(() => Boolean(networkState.network.value?.topology?.pendingRecalc));
        const pendingChangeCount = computed(() => Number(networkState.network.value?.topology?.pendingChangeCount || 0));
        const pendingHeaderLabel = computed(() => {
            const count = pendingChangeCount.value;
            return `${count} ${polishPlural(count, 'zmiana oczekuje', 'zmiany oczekują', 'zmian oczekuje')}`;
        });

        networkState.loadNetwork();
        elementEdit.loadElementSchema();
        gridBuilder.loadCreateSchema();

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

        return {
            network: networkState.network,
            error: networkState.error,
            activeError: errorHandling.activeError,
            uploadBusy: networkState.uploadBusy,
            uploadError: networkState.uploadError,
            uploadProgress: networkState.uploadProgress,
            uploadPhase: networkState.uploadPhase,
            uploadFileName: networkState.uploadFileName,
            uploadInputRef: networkState.uploadInputRef,
            triggerUpload: networkState.triggerUpload,
            onUploadFile: networkState.onUploadFile,
            topologyBusy: topologyOps.topologyBusy,
            topologyError: topologyOps.topologyError,
            powerflowBusy: topologyOps.powerflowBusy,
            topologyRevision,
            onSetSwitchState: topologyOps.onSetSwitchState,
            onSetSwitchesState: topologyOps.onSetSwitchesState,
            onResetTopology,
            onRecalculatePowerflow: topologyOps.onRecalculatePowerflow,
            elementSchema: elementEdit.elementSchema,
            elementParams: elementEdit.elementParams,
            editError: elementEdit.editError,
            editBusy: elementEdit.editBusy,
            onRequestEditParams: elementEdit.onRequestEditParams,
            onSubmitEdit: elementEdit.onSubmitEdit,
            onCancelEdit: elementEdit.onCancelEdit,
            theme: uiState.theme,
            sidebarHidden: uiState.sidebarHidden,
            selectedVoltages: uiState.selectedVoltages,
            selectedTypes: uiState.selectedTypes,
            viewMode: uiState.viewMode,
            editMode: uiState.editMode,
            atlasCategories: uiState.atlasCategories,
            minLineLoading: uiState.minLineLoading,
            minBusPower: uiState.minBusPower,
            showSwitches: uiState.showSwitches,
            graphPanelRef: uiState.graphPanelRef,
            toggleTheme: uiState.toggleTheme,
            toggleSidebar: uiState.toggleSidebar,
            onSelectBus: uiState.onSelectBus,
            onSelectElement: uiState.onSelectElement,
            onResetView: uiState.onResetView,
            stats,
            pendingRecalc,
            pendingChangeCount,
            pendingHeaderLabel,
            dismissErrorModal: errorHandling.dismissErrorModal,
            handleRuntimeError,
            gbTABS: gridBuilder.TABS,
            gbActiveTab: gridBuilder.activeTab,
            gbFormatMode: gridBuilder.formatMode,
            gbActiveSchema: gridBuilder.activeSchema,
            gbActiveRows: gridBuilder.activeRows,
            gbFormFields: gridBuilder.formFields,
            gbFormBusy: gridBuilder.formBusy,
            gbFormError: gridBuilder.formError,
            gbNewNetBusy: gridBuilder.newNetBusy,
            gbOnTabChange: gridBuilder.onTabChange,
            gbOnFormatChange: gridBuilder.onFormatChange,
            gbOnCreateElement: gridBuilder.onCreateElement,
            gbOnDeleteElement: gridBuilder.onDeleteElement,
            gbOnExportNetwork: gridBuilder.onExportNetwork,
            gbOnNewNetwork: gridBuilder.onNewNetwork,
            gbOnUpdateFormFields: (f) => { gridBuilder.formFields.value = f; },
        };
    },
    template: `
    <div class="app-shell" v-if="network">
        <header class="app-header">
            <div class="brand">
                <span class="case-name brand-title">{{ network.name }}</span>
            </div>

            <div class="header-divider"></div>

            <template v-if="!network.isEmpty">
                <div class="header-view-toggle" role="group" aria-label="Tryb widoku">
                    <button type="button"
                            class="chip"
                            :class="{ active: viewMode === 'graph' }"
                            @click="viewMode = 'graph'"
                            title="Widok grafowy (layout schematyczny)">Graf</button>
                    <button type="button"
                            class="chip"
                            :class="{ active: viewMode === 'geo' }"
                            :disabled="!network.geoAvailable"
                            @click="viewMode = 'geo'"
                            :title="network.geoAvailable ? 'Widok geograficzny (OpenStreetMap)' : 'Brak współrzędnych WGS84 w case\\'ie'">OSM</button>
                    <button type="button"
                            class="chip"
                            :class="{ active: viewMode === 'atlas' }"
                            @click="viewMode = 'atlas'"
                            title="Atlas KSE 2019 (referencyjny)">Atlas</button>
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
            </template>

            <div class="header-spacer"></div>

            <button class="btn"
                    type="button"
                    :disabled="uploadBusy"
                    :title="uploadError || 'Załaduj plik sieciowy (.m lub .json) z dysku'"
                    @click="triggerUpload">
                {{ uploadBusy ? 'Wgrywam…' : 'Wczytaj plik' }}
            </button>
            <input ref="uploadInputRef"
                   type="file"
                   accept=".m,.json"
                   style="display:none"
                   @change="onUploadFile" />

            <template v-if="!network.isEmpty">
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
            </template>

            <button class="btn"
                    type="button"
                    :disabled="gbNewNetBusy"
                    title="Utwórz nową pustą sieć"
                    @click="gbOnNewNetwork">
                {{ gbNewNetBusy ? 'Resetuję…' : 'Nowa sieć' }}
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

        <div v-if="network.isEmpty" class="grid-builder-page">
            <GridBuilder
                :network="network"
                :TABS="gbTABS"
                :active-tab="gbActiveTab"
                :format-mode="gbFormatMode"
                :active-schema="gbActiveSchema"
                :active-rows="gbActiveRows"
                :form-fields="gbFormFields"
                :form-busy="gbFormBusy"
                :form-error="gbFormError"
                :new-net-busy="gbNewNetBusy"
                @tab-change="gbOnTabChange"
                @format-change="gbOnFormatChange"
                @create-element="gbOnCreateElement"
                @delete-element="gbOnDeleteElement"
                @export-network="gbOnExportNetwork"
                @new-network="gbOnNewNetwork"
                @update:form-fields="gbOnUpdateFormFields"
            />
        </div>

        <div v-else class="app-body" :class="{ 'sidebar-hidden': sidebarHidden }">
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
            <ResultsBar
                :has-results="network.hasResults"
                :totals="network.totals"
                :diagnostics="network.diagnostics"
                :buses="network.buses"
                :lines="network.lines"
                :trafos="network.trafos"
                @select-bus="onSelectBus"
                @select-element="onSelectElement"
            />
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
