import { computed, ref, watch } from 'vue';
import { IconClose } from '/icons.js';

const COLUMNS = {
    bus:      [['ID', 'id'], ['Nazwa', 'name'], ['Un [kV]', 'vnKv']],
    line:     [['ID', 'id'], ['Nazwa', 'name'], ['Od', 'fromBus'], ['Do', 'toBus']],
    trafo:    [['ID', 'id'], ['Nazwa', 'name'], ['HV bus', 'hvBus'], ['LV bus', 'lvBus']],
    load:     [['ID', 'id'], ['Nazwa', 'name'], ['Szyna', 'bus'], ['P [MW]', 'pMw'], ['Q [Mvar]', 'qMvar']],
    gen:      [['ID', 'id'], ['Nazwa', 'name'], ['Szyna', 'bus'], ['P [MW]', 'pMw']],
    ext_grid: [['ID', 'id'], ['Nazwa', 'name'], ['Szyna', 'bus']],
};

const TAB_HINTS = {
    bus: {
        title: 'Szyna (Bus)',
        body: 'Podstawowy węzeł sieci — punkt połączenia elementów. Każda szyna ma napięcie znamionowe (Un), które wyznacza poziom napięcia danego fragmentu sieci. Od szyn należy zaczynać budowę każdej sieci.',
        note: 'Dodaj co najmniej 1 szynę przed dodaniem linii, transformatorów, odbiorników lub generatorów.',
        emptyHint: 'Zacznij tutaj — dodaj pierwszą szynę korzystając z formularza poniżej.',
    },
    line: {
        title: 'Linia',
        body: 'Odcinek linii elektrycznej łączący dwie szyny. Opisują ją parametry jednostkowe: rezystancja R (straty czynne), reaktancja X (przepływ mocy biernej) i pojemność C (efekt Ferrantiego) — mnożone przez długość.',
        note: 'Wymagane są co najmniej 2 szyny. Podaj ich ID w polach „Od" (from_bus) i „Do" (to_bus).',
        emptyHint: 'Brak linii. Dodaj co najmniej 2 szyny, a następnie połącz je linią.',
    },
    trafo: {
        title: 'Transformator',
        body: 'Transformator dwuuzwojeniowy łączący szynę WN (wyższe napięcie) z szyną nN (niższe napięcie). Umożliwia przesył mocy między różnymi poziomami napięcia i zapewnia izolację galwaniczną.',
        note: 'Podaj ID szyny WN i szyny nN. Napięcia znamionowe szyn powinny być zgodne z parametrami vn_hv_kv i vn_lv_kv transformatora.',
        emptyHint: 'Brak transformatorów. Dodaj szyny na różnych poziomach napięcia, a następnie połącz je transformatorem.',
    },
    load: {
        title: 'Odbiornik (Load)',
        body: 'Pobór mocy czynnej P [MW] i biernej Q [Mvar] przyłączony do szyny. Reprezentuje konsumentów: zakłady przemysłowe, sieci dystrybucyjne, linie odbiorcze. W load flow traktowany jako stałe PQ.',
        note: 'Podaj ID szyny, do której przyłączony jest odbiornik.',
        emptyHint: 'Brak odbiorników. Podaj ID szyny, do której chcesz przyłączyć odbiór.',
    },
    gen: {
        title: 'Generator (węzeł PV)',
        body: 'Źródło mocy czynnej z regulacją napięcia (węzeł PV). Utrzymuje zadane napięcie na szynie i dostarcza określoną moc czynną. Moc bierna jest wyznaczana automatycznie w trakcie load flow.',
        note: 'W sieci wymagany jest przynajmniej jeden węzeł bilansu (sieć zewnętrzna). Podaj ID szyny generatora.',
        emptyHint: 'Brak generatorów. Podaj ID szyny oraz zadaną moc czynną.',
    },
    ext_grid: {
        title: 'Sieć zewnętrzna (Slack)',
        body: 'Idealny węzeł bilansujący (slack) — utrzymuje zadane napięcie i kąt, przejmując nadwyżkę lub niedobór mocy. Jest to węzeł odniesienia dla obliczeń kątów fazowych i bilansu mocy.',
        note: 'Każda sieć musi mieć dokładnie jeden węzeł bilansu. Podaj ID szyny referencyjnej (zazwyczaj szyna z transformatorem sieciowym).',
        emptyHint: 'Brak węzła bilansu. Sieć wymaga co najmniej jednego węzła slack (ext_grid) do obliczenia rozpływu mocy.',
    },
};

const _BUS_FIELD_NAMES = new Set(['bus', 'from_bus', 'to_bus', 'hv_bus', 'lv_bus']);

function _colVal(row, key) {
    const v = row[key];
    return v === null || v === undefined ? '—' : v;
}

export const GridBuilder = {
    components: { IconClose },
    props: {
        network:        { type: Object,  required: true },
        TABS:           { type: Array,   required: true },
        activeTab:      { type: String,  required: true },
        formatMode:     { type: String,  required: true },
        activeSchema:   { type: Array,   required: true },
        activeRows:     { type: Array,   required: true },
        formFields:     { type: Object,  required: true },
        formBusy:       { type: Boolean, default: false },
        formError:      { type: String,  default: '' },
        formSuccessMsg: { type: String,  default: '' },
        hasBuses:       { type: Boolean, default: false },
        newNetBusy:     { type: Boolean, default: false },
    },
    emits: [
        'tab-change', 'format-change',
        'create-element', 'delete-element',
        'export-network', 'new-network',
        'show-graph',
        'update:formFields',
    ],
    setup(props, { emit }) {
        const columns = computed(() => COLUMNS[props.activeTab] || [['ID', 'id']]);
        const activeHint = computed(() => TAB_HINTS[props.activeTab] || null);
        const helpField = ref(null);
        const fieldErrors = ref({});

        const busOptions = computed(() => {
            const buses = props.network?.buses || [];
            return buses.map(b => ({ id: b.id, label: b.name ? `${b.id} — ${b.name}` : String(b.id) }));
        });

        function isBusField(field) {
            return _BUS_FIELD_NAMES.has(field.name);
        }

        function setField(name, value) {
            emit('update:formFields', { ...props.formFields, [name]: value });
            if (fieldErrors.value[name]) {
                const errs = { ...fieldErrors.value };
                delete errs[name];
                fieldErrors.value = errs;
            }
        }

        function validateField(field) {
            if (!field.required) return;
            const val = props.formFields[field.name];
            if (val === undefined || val === null || val === '') {
                fieldErrors.value = { ...fieldErrors.value, [field.name]: 'Pole wymagane' };
            }
        }

        function submitForm() {
            const schema = props.activeSchema;
            const errs = {};
            for (const field of schema) {
                if (field.required) {
                    const val = props.formFields[field.name];
                    if (val === undefined || val === null || val === '') {
                        errs[field.name] = 'Pole wymagane';
                    }
                }
            }
            fieldErrors.value = errs;
            if (Object.keys(errs).length > 0) return;
            emit('create-element');
        }

        function deleteRow(elementId) {
            emit('delete-element', props.activeTab, elementId);
        }

        function openHelp(field) {
            helpField.value = field;
        }

        function closeHelp() {
            helpField.value = null;
        }

        watch(() => props.activeTab, () => { fieldErrors.value = {}; });
        watch(() => props.formatMode, () => { fieldErrors.value = {}; });

        return {
            columns, activeHint, helpField, fieldErrors, busOptions,
            isBusField, setField, validateField, submitForm, deleteRow, openHelp, closeHelp, _colVal,
        };
    },
    template: `
<div class="grid-builder">
    <div class="gb-header">
        <h2 class="gb-title">Grid Builder</h2>
        <div class="gb-header-actions">
            <button class="btn btn-primary"
                    type="button"
                    :disabled="!hasBuses"
                    :title="hasBuses ? 'Przelicz rozpływ mocy i przejdź do widoku grafu' : 'Dodaj co najmniej jedną szynę przed przejściem do grafu'"
                    @click="$emit('show-graph')">
                Oblicz i pokaż graf
            </button>
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

    <div v-if="activeHint" class="gb-tab-hint">
        <div class="gb-tab-hint-header">
            <span class="gb-tab-hint-title">{{ activeHint.title }}</span>
        </div>
        <p class="gb-tab-hint-body">{{ activeHint.body }}</p>
        <p class="gb-tab-hint-note">
            <span class="gb-tab-hint-note-label">Uwaga:</span>
            {{ activeHint.note }}
        </p>
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
            <span class="gb-empty-icon">⊘</span>
            <span>{{ activeHint?.emptyHint || 'Brak elementów w tej kategorii.' }}</span>
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

        <transition name="gb-toast-fade">
            <div v-if="formSuccessMsg" class="gb-success-toast" role="status" aria-live="polite">
                ✓ {{ formSuccessMsg }}
            </div>
        </transition>

        <form class="gb-form" @submit.prevent="submitForm" v-if="activeSchema.length > 0">
            <div class="gb-field-grid">
                <div
                    v-for="field in activeSchema"
                    :key="field.name"
                    class="gb-field">
                    <label :for="'gb-' + field.name" class="gb-label">
                        <span class="gb-label-text">
                            {{ field.label || field.name }}
                            <span v-if="field.unit" class="gb-unit">[{{ field.unit }}]</span>
                            <span v-if="field.required" class="gb-required" title="Wymagane">*</span>
                        </span>
                        <button v-if="field.description"
                                type="button"
                                class="edit-help-btn"
                                :title="'Pomoc: ' + (field.label || field.name)"
                                :aria-label="'Pomoc: ' + (field.label || field.name)"
                                @click="openHelp(field)">?</button>
                    </label>
                    <select v-if="field.type === 'enum' && field.options && field.options.length"
                        :id="'gb-' + field.name"
                        class="gb-input"
                        :value="formFields[field.name] ?? ''"
                        @change="setField(field.name, typeof field.options[0] === 'number' ? Number($event.target.value) : $event.target.value)"
                        @keydown.enter.prevent="submitForm">
                        <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt === '' ? '—' : opt }}</option>
                    </select>
                    <select v-else-if="isBusField(field) && busOptions.length"
                        :id="'gb-' + field.name"
                        class="gb-input"
                        :class="{ 'gb-input-error': fieldErrors[field.name] }"
                        :value="formFields[field.name] ?? ''"
                        @change="setField(field.name, $event.target.value === '' ? '' : Number($event.target.value))"
                        @blur="validateField(field)"
                        @keydown.enter.prevent="submitForm">
                        <option value="">— wybierz szynę —</option>
                        <option v-for="opt in busOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                    </select>
                    <input v-else
                        :id="'gb-' + field.name"
                        class="gb-input"
                        :class="{ 'gb-input-error': fieldErrors[field.name] }"
                        type="text"
                        placeholder=""
                        :value="formFields[field.name] ?? ''"
                        @input="setField(field.name, $event.target.value)"
                        @blur="validateField(field)"
                    />
                    <span v-if="fieldErrors[field.name]" class="gb-field-error">{{ fieldErrors[field.name] }}</span>
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

    <teleport to="body">
        <div v-if="helpField" class="param-help-overlay" @click.self="closeHelp">
            <div class="param-help-modal" role="dialog" aria-modal="true" :aria-label="'Pomoc: ' + (helpField.label || helpField.name)">
                <div class="param-help-header">
                    <div>
                        <div class="param-help-kind">Pomoc parametru</div>
                        <div class="param-help-title">
                            {{ helpField.label || helpField.name }}<span v-if="helpField.unit" class="edit-unit"> ({{ helpField.unit }})</span>
                        </div>
                        <div class="param-help-field">{{ helpField.name }}</div>
                    </div>
                    <button type="button" class="card-icon-btn" aria-label="Zamknij" @click="closeHelp"><IconClose /></button>
                </div>
                <p class="param-help-body">{{ helpField.description }}</p>
                <div v-if="helpField.options && helpField.options.length" class="param-help-options">
                    <span class="param-help-options-label">Dopuszczalne wartości:</span>
                    <code v-for="opt in helpField.options" :key="opt" class="param-help-opt">{{ opt || '∅' }}</code>
                </div>
            </div>
        </div>
    </teleport>
</div>
`,
};
