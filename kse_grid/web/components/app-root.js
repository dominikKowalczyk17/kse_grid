import { computed, ref, watchEffect } from 'vue';
import { Sidebar } from '/components/sidebar.js';
import { GraphPanel } from '/components/graph-panel.js';
import { IconSun, IconMoon } from '/icons.js';

const THEME_STORAGE_KEY = 'kse_grid:theme';

export const App = {
    components: { Sidebar, GraphPanel, IconSun, IconMoon },
    setup () {
        const network = ref(null);
        const error = ref(null);
        const selectedVoltages = ref([]);
        const selectedTypes = ref(['line', 'trafo', 'bus']);
        const viewMode = ref('graph');
        const atlasCategories = ref(['osp', 'osd', 'jw']);
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

        fetch('/api/network')
            .then(response => response.ok ? response.json() : Promise.reject(`HTTP ${response.status}`))
            .then(data => {
                network.value = data;
                selectedVoltages.value = [...data.defaultVoltageFilter];
                viewMode.value = data.defaultViewMode || 'graph';
                document.title = `${data.name} – kse_grid`;
            })
            .catch(fetchError => { error.value = String(fetchError); });

        const stats = computed(() => network.value?.stats || {});

        function onSelectBus (busId) {
            graphPanelRef.value?.selectBus(busId, true);
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
            atlasCategories,
            graphPanelRef,
            theme,
            toggleTheme,
            onSelectBus,
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
                :selected-types="selectedTypes"
                :theme="theme" />
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
