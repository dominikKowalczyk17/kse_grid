import { ref } from 'vue';
import { fetchElementParams, fetchElementSchema, updateElement } from '/lib/api.js';

export function useElementEdit({ applyTopologyUpdate, presentError }) {
    const elementSchema = ref({});
    const elementParams = ref(null);
    const editError = ref('');
    const editBusy = ref(false);

    async function loadElementSchema() {
        try {
            elementSchema.value = await fetchElementSchema();
        } catch (schemaError) {
            presentError(schemaError, 'Błąd pobierania schematu edycji');
            elementSchema.value = {};
        }
    }

    async function onRequestEditParams({ kind, id }) {
        editError.value = '';
        elementParams.value = null;
        try {
            elementParams.value = await fetchElementParams(kind, id);
        } catch (requestError) {
            editError.value = presentError(requestError, `Błąd pobierania parametrów ${kind} #${id}`).message;
        }
    }

    function onCancelEdit() {
        elementParams.value = null;
        editError.value = '';
    }

    async function onSubmitEdit({ kind, id, fields, done }) {
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

    return {
        elementSchema, elementParams, editError, editBusy,
        loadElementSchema, onRequestEditParams, onCancelEdit, onSubmitEdit,
    };
}
