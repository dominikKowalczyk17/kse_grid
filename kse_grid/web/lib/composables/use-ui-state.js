import { nextTick, ref, watchEffect } from 'vue';

const THEME_STORAGE_KEY = 'kse_grid:theme';
const SIDEBAR_STORAGE_KEY = 'kse_grid:sidebar-hidden';

export function useUiState() {
    const selectedVoltages = ref([]);
    const selectedTypes = ref(['line', 'trafo', 'bus']);
    const viewMode = ref('graph');
    const editMode = ref(false);
    const atlasCategories = ref(['osp', 'osd', 'jw']);
    const minLineLoading = ref(0);
    const minBusPower = ref(0);
    const showSwitches = ref(true);
    const graphPanelRef = ref(null);

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

    function toggleTheme() {
        theme.value = theme.value === 'dark' ? 'light' : 'dark';
    }

    async function toggleSidebar() {
        sidebarHidden.value = !sidebarHidden.value;
        await nextTick();
        graphPanelRef.value?.handleLayoutChange?.();
    }

    function onSelectBus(busId) {
        graphPanelRef.value?.selectBus(busId, true);
    }

    function onSelectElement(selection) {
        graphPanelRef.value?.selectElement(selection);
    }

    function onResetView() {
        graphPanelRef.value?.resetView();
    }

    return {
        selectedVoltages, selectedTypes, viewMode, editMode,
        atlasCategories, minLineLoading, minBusPower, showSwitches,
        graphPanelRef, theme, sidebarHidden,
        toggleTheme, toggleSidebar, onSelectBus, onSelectElement, onResetView,
    };
}
