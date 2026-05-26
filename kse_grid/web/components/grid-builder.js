import { computed } from 'vue';

// Column definitions per element kind (display name → data key)
const COLUMNS = {
    bus:      [['ID', 'id'], ['Nazwa', 'name'], ['Un [kV]', 'vnKv']],
    line:     [['ID', 'id'], ['Nazwa', 'name'], ['Od', 'fromBus'], ['Do', 'toBus']],
    trafo:    [['ID', 'id'], ['Nazwa', 'name'], ['HV bus', 'hvBus'], ['LV bus', 'lvBus']],
    load:     [['ID', 'id'], ['Nazwa', 'name'], ['Szyna', 'bus'], ['P [MW]', 'pMw'], ['Q [Mvar]', 'qMvar']],
    gen:      [['ID', 'id'], ['Nazwa', 'name'], ['Szyna', 'bus'], ['P [MW]', 'pMw']],
    ext_grid: [['ID', 'id'], ['Nazwa', 'name'], ['Szyna', 'bus']],
};

function _colVal(row, key) {
    const v = row[key];
    return v === null || v === undefined ? '—' : v;
}

export const GridBuilder = {
    props: {
        network:      { type: Object,   required: true },
        TABS:         { type: Array,    required: true },
        activeTab:    { type: String,   required: true },
        formatMode:   { type: String,   required: true },
        activeSchema: { type: Array,    required: true },
        activeRows:   { type: Array,    required: true },
        formFields:   { type: Object,   required: true },
        formBusy:     { type: Boolean,  default: false },
        formError:    { type: String,   default: '' },
        newNetBusy:   { type: Boolean,  default: false },
    },
    emits: [
        'tab-change', 'format-change',
        'create-element', 'delete-element',
        'export-network', 'new-network',
        'update:formFields',
    ],
    setup(props, { emit }) {
        const columns = computed(() => COLUMNS[props.activeTab] || [['ID', 'id']]);

        function setField(name, value) {
            emit('update:formFields', { ...props.formFields, [name]: value });
        }

        function submitForm() {
            emit('create-element');
        }

        function deleteRow(elementId) {
            emit('delete-element', props.activeTab, elementId);
        }

        return { columns, setField, submitForm, deleteRow, _colVal };
    },
    template: `
<div class="grid-builder">
    <div class="gb-header">
        <h2 class="gb-title">Grid Builder</h2>
        <div class="gb-header-actions">
            <div class="gb-export-group">
                <button class="btn btn-sm" type="button" @click="$emit('export-network', 'json')" title="Pobierz jako pandapower JSON">
                    ↓ JSON
                </button>
                <button class="btn btn-sm" type="button" @click="$emit('export-network', 'matpower')" title="Pobierz jako plik MATPOWER .m">
                    ↓ .m
                </button>
            </div>
            <button class="btn btn-sm btn-danger" type="button"
                    :disabled="newNetBusy"
                    @click="$emit('new-network')"
                    title="Utwórz nową pustą sieć (usuwa bieżące elementy)">
                {{ newNetBusy ? 'Resetuję…' : 'Nowa sieć' }}
            </button>
        </div>
    </div>

    <div class="gb-tabs" role="tablist">
        <button
            v-for="tab in TABS"
            :key="tab.key"
            class="gb-tab"
            :class="{ active: activeTab === tab.key }"
            role="tab"
            :aria-selected="activeTab === tab.key"
            type="button"
            @click="$emit('tab-change', tab.key)">
            {{ tab.label }}
            <span class="gb-tab-count">
                {{ (network[tab.netKey] || []).length }}
            </span>
        </button>
    </div>

    <div class="gb-table-wrap">
        <table class="gb-table" v-if="activeRows.length > 0">
            <thead>
                <tr>
                    <th v-for="[label] in columns" :key="label">{{ label }}</th>
                    <th class="gb-col-action">Akcje</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="row in activeRows" :key="row.id">
                    <td v-for="[, key] in columns" :key="key" class="gb-cell">
                        {{ _colVal(row, key) }}
                    </td>
                    <td class="gb-col-action">
                        <button class="btn btn-xs btn-danger"
                                type="button"
                                @click="deleteRow(row.id)"
                                title="Usuń element">
                            Usuń
                        </button>
                    </td>
                </tr>
            </tbody>
        </table>
        <div v-else class="gb-empty-hint">
            Brak elementów w tej kategorii.
        </div>
    </div>

    <div class="gb-form-section">
        <div class="gb-form-header">
            <span class="gb-form-title">Dodaj element</span>
            <div class="gb-format-toggle" role="group" aria-label="Format pól">
                <button type="button"
                        class="chip"
                        :class="{ active: formatMode === 'matpower' }"
                        @click="$emit('format-change', 'matpower')">
                    MATPOWER
                </button>
                <button type="button"
                        class="chip"
                        :class="{ active: formatMode === 'pandapower' }"
                        @click="$emit('format-change', 'pandapower')">
                    pandapower
                </button>
            </div>
        </div>

        <form class="gb-form" @submit.prevent="submitForm" v-if="activeSchema.length > 0">
            <div class="gb-field-grid">
                <div
                    v-for="field in activeSchema"
                    :key="field.name"
                    class="gb-field">
                    <label :for="'gb-' + field.name" class="gb-label">
                        {{ field.name }}
                        <span v-if="field.unit" class="gb-unit">[{{ field.unit }}]</span>
                        <span v-if="field.required" class="gb-required" title="Wymagane">*</span>
                    </label>
                    <input
                        :id="'gb-' + field.name"
                        class="gb-input"
                        type="text"
                        :placeholder="field.description || ''"
                        :value="formFields[field.name] ?? ''"
                        @input="setField(field.name, $event.target.value)"
                    />
                </div>
            </div>
            <div v-if="formError" class="gb-form-error">{{ formError }}</div>
            <div class="gb-form-actions">
                <button class="btn" type="submit" :disabled="formBusy">
                    {{ formBusy ? 'Zapisuję…' : 'Dodaj' }}
                </button>
            </div>
        </form>
        <div v-else class="gb-empty-hint">
            Brak schematu pól dla tego elementu w wybranym formacie.
        </div>
    </div>
</div>
`,
};
