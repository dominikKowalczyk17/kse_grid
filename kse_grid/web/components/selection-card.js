import { computed, reactive, ref, watch } from 'vue';
import { IconCheck, IconClose, IconEdit } from '/icons.js';
import { voltageStatus } from '/lib/formatters.js';

export const SelectionCard = {
    components: { IconCheck, IconClose, IconEdit },
    props: {
        selection: Object,
        switches: { type: Array, default: () => [] },
        hasResults: Boolean,
        topologyBusy: { type: Boolean, default: false },
        elementSchema: { type: Object, default: () => ({}) },
        elementParams: { type: Object, default: null },
        editError: { type: String, default: '' },
        editBusy: { type: Boolean, default: false },
    },
    emits: ['close', 'set-switch-state', 'set-switches-state', 'request-edit-params', 'submit-edit', 'cancel-edit'],
    setup (props, { emit }) {
        const editing = ref(false);
        const formState = reactive({ values: {} });
        const helpField = ref(null);

        const schemaForKind = computed(() => {
            const kind = props.selection?.kind;
            if (!kind) return [];
            return props.elementSchema?.[kind] || [];
        });

        function exitEdit () {
            editing.value = false;
            formState.values = {};
            helpField.value = null;
            emit('cancel-edit');
        }

        watch(() => [props.selection?.kind, props.selection?.payload?.id], () => {
            // Po zmianie zaznaczonego elementu zwijamy formularz, żeby nie pokazać
            // niespójnych wartości starego obiektu w polach edycji.
            if (editing.value) exitEdit();
        });

        watch(() => props.elementParams, (params) => {
            if (!editing.value || !params) return;
            const sel = props.selection;
            if (!sel || params.kind !== sel.kind || params.id !== sel.payload?.id) return;
            const next = {};
            for (const field of schemaForKind.value) {
                const value = params.params?.[field.field];
                next[field.field] = value == null ? '' : value;
            }
            formState.values = next;
        });

        function startEdit () {
            const sel = props.selection;
            if (!sel) return;
            editing.value = true;
            formState.values = {};
            emit('request-edit-params', { kind: sel.kind, id: sel.payload.id });
        }

        function submitEdit () {
            const sel = props.selection;
            if (!sel) return;
            const fields = {};
            for (const spec of schemaForKind.value) {
                const raw = formState.values[spec.field];
                if (spec.type === 'bool') {
                    fields[spec.field] = Boolean(raw);
                } else if (spec.type === 'int' || spec.type === 'float') {
                    if (raw === '' || raw == null) {
                        fields[spec.field] = null;
                    } else {
                        const num = Number(raw);
                        if (Number.isFinite(num)) fields[spec.field] = num;
                    }
                } else {
                    fields[spec.field] = raw ?? '';
                }
            }
            emit('submit-edit', {
                kind: sel.kind,
                id: sel.payload.id,
                fields,
                done: (ok) => {
                    if (ok) editing.value = false;
                },
            });
        }

        function openHelp (field) {
            helpField.value = field;
        }

        function closeHelp () {
            helpField.value = null;
        }

        const rows = computed(() => {
            if (!props.selection) return [];
            const selection = props.selection;
            if (selection.kind === 'bus') {
                const bus = selection.payload;
                const items = [];
                if (bus.type) items.push({ label: 'Typ', value: bus.type });
                items.push({ label: 'Un', value: `${bus.vn_kv.toFixed(0)} kV` });
                if (props.hasResults && bus.vmPu != null) {
                    items.push({ label: 'Um', value: `${bus.vmPu.toFixed(4)} p.u.`, status: voltageStatus(bus.vmPu) });
                    items.push({ label: 'Kąt', value: `${bus.vaDeg.toFixed(2)} °` });
                }
                if (bus.genMw > 0) items.push({ label: 'P gen', value: `${bus.genMw.toFixed(1)} MW`, status: 'good' });
                if (bus.genMvar != null) items.push({ label: 'Q gen', value: `${bus.genMvar.toFixed(1)} Mvar`, status: 'good' });
                if (bus.loadMw > 0) items.push({ label: 'P obc.', value: `${bus.loadMw.toFixed(1)} MW` });
                if (bus.loadMvar) items.push({ label: 'Q obc.', value: `${bus.loadMvar.toFixed(1)} Mvar` });
                return items;
            }
            if (selection.kind === 'line') {
                const line = selection.payload;
                const lengthLabel = line.lengthSource === 'geo'
                    ? `${line.lengthKm.toFixed(1)} km (geometria)`
                    : `${line.lengthKm.toFixed(1)} km (model)`;
                const items = [
                    { label: 'Un', value: `${line.voltage.toFixed(0)} kV` },
                    { label: 'Długość', value: lengthLabel },
                ];
                if (props.hasResults) {
                    items.push({ label: 'Obciążenie', value: `${(line.loading ?? 0).toFixed(1)}%` });
                    if (line.pFromMw != null) items.push({ label: 'P od strony początkowej', value: `${line.pFromMw.toFixed(1)} MW` });
                }
                return items;
            }
            if (selection.kind === 'trafo') {
                const trafo = selection.payload;
                const items = [
                    { label: 'Trafo', value: `${trafo.vnHvKv.toFixed(0)}/${trafo.vnLvKv.toFixed(0)} kV` },
                    { label: 'Sn', value: `${trafo.snMva.toFixed(0)} MVA` },
                ];
                if (props.hasResults) {
                    items.push({ label: 'Obciążenie', value: `${(trafo.loading ?? 0).toFixed(1)}%` });
                    if (trafo.pHvMw != null) items.push({ label: 'P po stronie HV', value: `${trafo.pHvMw.toFixed(1)} MW` });
                }
                const trafoSwitches = props.switches.filter(sw => sw.parentKind === 'trafo' && sw.elementId === trafo.id);
                for (const sw of trafoSwitches) {
                    items.push({
                        label: `Switch ${sw.sideLabel || sw.name}`,
                        value: sw.closed ? 'Zamknięty' : 'Otwarty',
                        status: sw.closed ? 'good' : 'bad',
                    });
                }
                return items;
            }
            if (selection.kind === 'switch') {
                const sw = selection.payload;
                return [
                    { label: 'Stan', value: sw.closed ? 'Zamknięty' : 'Otwarty', status: sw.closed ? 'good' : 'bad' },
                    { label: 'Powiązanie', value: sw.parentKind === 'trafo' ? 'Transformator' : sw.parentKind === 'line' ? 'Linia' : 'Łącznik szyn' },
                    { label: 'Element', value: `${sw.elementName} (#${sw.elementId})` },
                    { label: 'Bus', value: `${sw.busName} (#${sw.busId})` },
                    { label: 'Drugi koniec', value: sw.remoteBusName ? `${sw.remoteBusName} (#${sw.remoteBusId})` : '—' },
                    { label: 'Strona', value: sw.sideLabel || '—' },
                ];
            }
            return [];
        });

        const title = computed(() => props.selection?.payload?.name || '');
        const subtitle = computed(() => {
            const selection = props.selection;
            if (!selection) return '';
            const id = selection.payload?.id;
            if (id == null) return '';
            return selection.kind === 'bus' ? `Szyna #${id}`
                : selection.kind === 'line' ? `Linia #${id}`
                    : selection.kind === 'trafo' ? `Trafo #${id}`
                        : selection.kind === 'switch' ? `Łącznik #${id}` : '';
        });
        const kindLabel = computed(() => {
            const kind = props.selection?.kind;
            return kind === 'bus' ? 'Szyna'
                : kind === 'line' ? 'Linia'
                    : kind === 'trafo' ? 'Transformator'
                        : kind === 'switch' ? 'Łącznik' : '';
        });

        const switchActionLabel = computed(() => {
            const sw = props.selection?.kind === 'switch' ? props.selection.payload : null;
            if (!sw) return '';
            return sw.closed ? 'Otwórz switch' : 'Zamknij switch';
        });

        const relatedTrafoSwitches = computed(() => {
            const trafo = props.selection?.kind === 'trafo' ? props.selection.payload : null;
            if (!trafo) return [];
            return props.switches.filter(sw => sw.parentKind === 'trafo' && sw.elementId === trafo.id);
        });

        const trafoConnected = computed(() => relatedTrafoSwitches.value.some(sw => sw.closed));
        const trafoActionLabel = computed(() => {
            if (props.selection?.kind !== 'trafo' || !relatedTrafoSwitches.value.length) return '';
            return trafoConnected.value ? 'Odłącz trafo' : 'Załącz trafo';
        });

        const canEdit = computed(() => Boolean(props.selection) && schemaForKind.value.length > 0);
        const paramsLoaded = computed(() => {
            const params = props.elementParams;
            const sel = props.selection;
            if (!params || !sel) return false;
            return params.kind === sel.kind && params.id === sel.payload?.id;
        });

        return {
            rows,
            title,
            subtitle,
            kindLabel,
            switchActionLabel,
            relatedTrafoSwitches,
            trafoConnected,
            trafoActionLabel,
            editing,
            schemaForKind,
            formState,
            startEdit,
            submitEdit,
            exitEdit,
            canEdit,
            paramsLoaded,
            helpField,
            openHelp,
            closeHelp,
        };
    },
    template: `
    <div v-if="selection" class="selection-card">
        <div class="selection-header">
            <div>
                <div class="selection-kind">{{ kindLabel }}</div>
                <div class="selection-title">{{ title }}</div>
                <div v-if="subtitle" class="selection-subtitle">{{ subtitle }}</div>
            </div>
            <button class="card-icon-btn" type="button" @click="$emit('close')" aria-label="Zamknij">
                <IconClose />
            </button>
        </div>
        <div v-for="(row, i) in rows" :key="i" class="selection-row">
            <span class="lbl">{{ row.label }}</span>
            <span class="val" :class="row.status">{{ row.value }}</span>
        </div>

        <form v-if="editing" class="selection-edit" @submit.prevent="submitEdit">
            <div class="selection-edit-header">
                <span class="selection-edit-title">Parametry elementu</span>
                <span v-if="!paramsLoaded && !editError" class="selection-edit-hint">Wczytuję wartości…</span>
            </div>
            <div v-for="field in schemaForKind" :key="field.field" class="edit-row">
                <label class="edit-lbl" :for="'edit-' + field.field">
                    <span class="edit-lbl-text">
                        {{ field.label }}<span v-if="field.unit" class="edit-unit"> ({{ field.unit }})</span>
                    </span>
                    <button v-if="field.description"
                            type="button"
                            class="edit-help-btn"
                            :title="'Pomoc: ' + field.label"
                            :aria-label="'Pomoc: ' + field.label"
                            @click="openHelp(field)">?</button>
                </label>
                <input v-if="field.type === 'bool'"
                       :id="'edit-' + field.field"
                       type="checkbox"
                       class="edit-checkbox"
                       :disabled="!paramsLoaded || editBusy"
                       v-model="formState.values[field.field]" />
                <select v-else-if="field.type === 'enum'"
                        :id="'edit-' + field.field"
                        class="edit-input"
                        :disabled="!paramsLoaded || editBusy"
                        v-model="formState.values[field.field]">
                    <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt || '—' }}</option>
                </select>
                <input v-else
                       :id="'edit-' + field.field"
                       :type="field.type === 'str' ? 'text' : 'number'"
                       :step="field.type === 'int' ? '1' : 'any'"
                       class="edit-input"
                       :disabled="!paramsLoaded || editBusy"
                       v-model="formState.values[field.field]" />
            </div>
            <div v-if="editError" class="selection-edit-error">{{ editError }}</div>
            <div class="selection-edit-actions">
                <button type="button"
                        class="btn btn-ghost"
                        :disabled="editBusy"
                        @click="exitEdit">Anuluj</button>
                <button type="submit"
                        class="btn btn-primary"
                        :disabled="!paramsLoaded || editBusy || topologyBusy">
                    {{ editBusy || topologyBusy ? 'Zapisywanie…' : 'Zapisz' }}
                </button>
            </div>
        </form>

        <div v-if="!editing && selection.kind === 'switch'" class="selection-actions">
            <button
                class="btn btn-block"
                type="button"
                :disabled="topologyBusy"
                @click="$emit('set-switch-state', { switchId: selection.payload.id, closed: !selection.payload.closed })">
                {{ topologyBusy ? 'Przeliczam…' : switchActionLabel }}
            </button>
        </div>
        <div v-else-if="!editing && selection.kind === 'trafo' && relatedTrafoSwitches.length" class="selection-actions">
            <button
                class="btn btn-block"
                type="button"
                :disabled="topologyBusy"
                @click="$emit('set-switches-state', { switchIds: relatedTrafoSwitches.map(sw => sw.id), closed: !trafoConnected })">
                {{ topologyBusy ? 'Przeliczam…' : trafoActionLabel }}
            </button>
            <button
                v-for="sw in relatedTrafoSwitches"
                :key="sw.id"
                class="btn btn-block"
                type="button"
                :disabled="topologyBusy"
                @click="$emit('set-switch-state', { switchId: sw.id, closed: !sw.closed })">
                {{ topologyBusy ? 'Przeliczam…' : (sw.closed ? 'Otwórz ' : 'Zamknij ') + (sw.sideLabel || sw.name) }}
            </button>
        </div>

        <div v-if="!editing && canEdit" class="selection-edit-cta">
            <button type="button" class="btn btn-cta" @click="startEdit">
                <IconEdit />
                <span>Edytuj parametry</span>
            </button>
        </div>

        <teleport to="body">
            <div v-if="helpField" class="param-help-overlay" @click.self="closeHelp">
                <div class="param-help-modal" role="dialog" aria-modal="true" :aria-label="'Pomoc: ' + helpField.label">
                    <div class="param-help-header">
                        <div>
                            <div class="param-help-kind">Pomoc parametru</div>
                            <div class="param-help-title">
                                {{ helpField.label }}<span v-if="helpField.unit" class="edit-unit"> ({{ helpField.unit }})</span>
                            </div>
                            <div class="param-help-field">{{ helpField.field }}</div>
                        </div>
                        <button type="button" class="card-icon-btn" aria-label="Zamknij" @click="closeHelp">
                            <IconClose />
                        </button>
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
