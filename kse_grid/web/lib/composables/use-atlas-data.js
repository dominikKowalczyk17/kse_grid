import { ref } from 'vue';
import { loadAtlas } from '/lib/atlas.js';

export function useAtlasData({ presentError }) {
    const atlasData = ref(null);

    async function ensureAtlasLoaded() {
        if (atlasData.value) return atlasData.value;
        try {
            atlasData.value = await loadAtlas();
        } catch (error) {
            if (presentError) presentError(error);
            atlasData.value = null;
        }
        return atlasData.value;
    }

    return { atlasData, ensureAtlasLoaded };
}
