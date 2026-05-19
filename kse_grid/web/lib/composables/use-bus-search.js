import { computed, ref } from 'vue';
import { isMapMode } from '/lib/view-mode.js';

export function useBusSearch(props, { onPickBus }) {
    const search = ref('');
    const showSuggestions = ref(false);

    const suggestions = computed(() => {
        const query = search.value.trim().toLowerCase();
        if (!query) return [];
        const isMap = isMapMode(props.viewMode);
        return props.buses
            .filter(bus =>
                (bus.name.toLowerCase().includes(query) || String(bus.id).startsWith(query))
                && (!isMap || (bus.lat != null && bus.lon != null))
            )
            .sort((left, right) => right.vn_kv - left.vn_kv)
            .slice(0, 30);
    });

    function pickSuggestion(bus) {
        search.value = '';
        showSuggestions.value = false;
        onPickBus(bus.id);
    }

    function blurLater() {
        setTimeout(() => { showSuggestions.value = false; }, 200);
    }

    return { search, showSuggestions, suggestions, pickSuggestion, blurLater };
}
