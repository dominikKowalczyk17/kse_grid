import { computed, ref, watchEffect } from 'vue';
import { Sidebar } from '/components/sidebar.js';
import { GraphPanel } from '/components/graph-panel.js';
import { IconSun, IconMoon } from '/icons.js';
import { fetchNetwork, resetTopology, setSwitchState } from '/lib/api.js';

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
        const graphPanelRef = ref(null);

        const storedTheme = (typeof localStorage !== 'undefined' && localStorage.getItem(THEME_STORAGE_KEY)) || 'dark';
        const theme = ref(storedTheme === 'light' ? 'light' : 'dark');

        watchEffect(() => {
            document.documentElement.dataset.theme = theme.value;
            try { localStorage.setItem(THEME_STORAGE_KEY, theme.value); } catch (_) {}
        });

        function toggleTheme () {
            theme.value = theme.value === 'dark' ? 'light' : 'dark';
        }

        function applyNetwork (data) {
            const isFirstLoad = !network.value;
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

        async function loadNetwork () {
            try {
                applyNetwork(await fetchNetwork());
                error.value = null;
            } catch (fetchError) {
                error.value = String(fetchError);
            }
        }

        async function onSetSwitchState ({ switchId, closed }) {
            topologyBusy.value = true;
            topologyError.value = '';
            try {
                applyNetwork(await setSwitchState(switchId, closed));
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
                let payload = network.value;
                for (const switchId of switchIds) {
                    payload = await setSwitchState(switchId, closed);
                }
                applyNetwork(payload);
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
                applyNetwork(await resetTopology());
            } catch (requestError) {
                topologyError.value = String(requestError);
            } finally {
                topologyBusy.value = false;
            }
        }

        loadNetwork();

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
            graphPanelRef,
            theme,
            toggleTheme,
            onSetSwitchState,
            onSetSwitchesState,
            onResetTopology,
            onSelectBus,
            onSelectElement,
            onResetView,
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
                :theme="theme"
                :edit-mode="editMode"
                @set-switch-state="onSetSwitchState"
                @set-switches-state="onSetSwitchesState" />
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
