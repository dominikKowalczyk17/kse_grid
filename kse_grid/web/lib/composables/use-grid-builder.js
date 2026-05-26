import { computed, ref } from 'vue';
import {
    createElement,
    deleteElement,
    exportNetwork,
    fetchCreateSchema,
    fetchNetwork,
    newNetwork,
} from '/lib/api.js';

const TABS = [
    { key: 'bus',      label: 'Szyny',      netKey: 'buses' },
    { key: 'line',     label: 'Linie',      netKey: 'lines' },
    { key: 'trafo',    label: 'Transformatory', netKey: 'trafos' },
    { key: 'load',     label: 'Odbiorniki', netKey: 'loads' },
    { key: 'gen',      label: 'Generatory', netKey: 'gens' },
    { key: 'ext_grid', label: 'Ext. grid',  netKey: 'extGrids' },
];

export { TABS };

export function useGridBuilder({ network, applyNetwork, presentError }) {
    const activeTab = ref('bus');
    const formatMode = ref('matpower');
    const createSchema = ref({ pandapower: {}, matpower: {} });
    const formFields = ref({});
    const formBusy = ref(false);
    const formError = ref('');
    const deletingIds = ref(new Set());
    const newNetBusy = ref(false);

    async function loadCreateSchema() {
        try {
            createSchema.value = await fetchCreateSchema();
        } catch (err) {
            presentError(err, 'Błąd pobierania schematu tworzenia');
        }
    }

    const activeSchema = computed(() => {
        const tab = activeTab.value;
        const fmt = formatMode.value;
        let raw;
        if (fmt === 'matpower') {
            // matpower schema uses 'branch' for line/trafo
            const key = (tab === 'line' || tab === 'trafo') ? 'branch' : tab;
            raw = createSchema.value.matpower?.[key] || [];
        } else {
            raw = createSchema.value.pandapower?.[tab] || [];
        }
        // pandapower schema uses key "field"; matpower uses "name" — normalize to "name"
        return raw.map(f => f.name !== undefined ? f : { ...f, name: f.field });
    });

    const activeRows = computed(() => {
        const tab = TABS.find(t => t.key === activeTab.value);
        if (!tab || !network.value) return [];
        return network.value[tab.netKey] || [];
    });

    function resetForm() {
        formFields.value = {};
        formError.value = '';
    }

    async function onCreateElement() {
        formBusy.value = true;
        formError.value = '';
        try {
            await createElement(activeTab.value, formFields.value, formatMode.value);
            applyNetwork(await fetchNetwork());
            resetForm();
        } catch (err) {
            formError.value = presentError(err, `Błąd dodawania ${activeTab.value}`).message;
        } finally {
            formBusy.value = false;
        }
    }

    async function onDeleteElement(kind, elementId) {
        const key = `${kind}:${elementId}`;
        deletingIds.value = new Set([...deletingIds.value, key]);
        try {
            await deleteElement(kind, elementId);
            applyNetwork(await fetchNetwork());
        } catch (err) {
            presentError(err, `Błąd usuwania ${kind} #${elementId}`);
        } finally {
            const next = new Set(deletingIds.value);
            next.delete(key);
            deletingIds.value = next;
        }
    }

    function isDeleting(kind, elementId) {
        return deletingIds.value.has(`${kind}:${elementId}`);
    }

    function onExportNetwork(format) {
        exportNetwork(format);
    }

    async function onNewNetwork() {
        newNetBusy.value = true;
        try {
            applyNetwork(await newNetwork());
            resetForm();
        } catch (err) {
            presentError(err, 'Błąd tworzenia nowej sieci');
        } finally {
            newNetBusy.value = false;
        }
    }

    function onTabChange(key) {
        activeTab.value = key;
        resetForm();
    }

    function onFormatChange(fmt) {
        formatMode.value = fmt;
        resetForm();
    }

    return {
        TABS,
        activeTab,
        formatMode,
        createSchema,
        formFields,
        formBusy,
        formError,
        newNetBusy,
        activeSchema,
        activeRows,
        loadCreateSchema,
        onCreateElement,
        onDeleteElement,
        isDeleting,
        onExportNetwork,
        onNewNetwork,
        onTabChange,
        onFormatChange,
    };
}
