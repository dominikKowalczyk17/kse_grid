import { computed, reactive, ref, watch } from 'vue';
import { IconCheck, IconChevronLeft, IconClose, IconEdit } from '/icons.js';
import { voltageStatus } from '/lib/formatters.js';

export const SelectionCard = {
    components: { IconCheck, IconChevronLeft, IconClose, IconEdit },
    props: {
        selection: Object,
        switches: { type: Array, default: () => [] },
        gens: { type: Array, default: () => [] },
        loads: { type: Array, default: () => [] },
        sgens: { type: Array, default: () => [] },
        extGrids: { type: Array, default: () => [] },
        shunts: { type: Array, default: () => [] },
        hasResults: Boolean,
        topologyBusy: { type: Boolean, default: false },
        elementSchema: { type: Object, default: () => ({}) },
        elementParams: { type: Object, default: null },
        editError: { type: String, default: '' },
        editBusy: { type: Boolean, default: false },
        canGoBack: { type: Boolean, default: false },
    },
    emits: ['close', 'go-back', 'set-switch-state', 'set-switches-state', 'select-gen', 'select-bus-element', 'request-edit-params', 'submit-edit', 'cancel-edit'],
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

        const busGens = computed(() => {
            if (props.selection?.kind !== 'bus') return [];
            const busId = props.selection.payload?.id;
            if (busId == null) return [];
            return (props.gens || []).filter(g => g.busId === busId);
        });

        function _filterByBus(arr) {
            if (props.selection?.kind !== 'bus') return [];
            const busId = props.selection.payload?.id;
            if (busId == null) return [];
            return (arr || []).filter(x => x.busId === busId);
        }
        const busLoads = computed(() => _filterByBus(props.loads));
        const busSgens = computed(() => _filterByBus(props.sgens));
        const busExtGrids = computed(() => _filterByBus(props.extGrids));
        const busShunts = computed(() => _filterByBus(props.shunts));

        const rows = computed(() => {
            if (!props.selection) return [];
            const selection = props.selection;
            if (selection.kind === 'gen') {
                const gen = selection.payload;
                const items = [];
                if (gen.busId != null) items.push({ label: 'Szyna', value: `#${gen.busId}` });
                items.push({ label: 'Status', value: gen.inService ? 'W ruchu' : 'Wyłączony', status: gen.inService ? 'good' : 'bad' });
                if (gen.pMw != null) items.push({ label: 'P zadana', value: `${gen.pMw.toFixed(1)} MW` });
                if (gen.vmPu != null) items.push({ label: 'U zadane', value: `${gen.vmPu.toFixed(3)} p.u.` });
                if (gen.maxPMw != null) items.push({ label: 'P max', value: `${gen.maxPMw.toFixed(0)} MW` });
                if (gen.minPMw != null) items.push({ label: 'P min', value: `${gen.minPMw.toFixed(0)} MW` });
                if (gen.maxQMvar != null) items.push({ label: 'Q max', value: `${gen.maxQMvar.toFixed(0)} Mvar` });
                if (gen.minQMvar != null) items.push({ label: 'Q min', value: `${gen.minQMvar.toFixed(0)} Mvar` });
                if (gen.resPMw != null) items.push({ label: 'P (wynik)', value: `${gen.resPMw.toFixed(1)} MW`, status: 'good' });
                if (gen.resQMvar != null) items.push({ label: 'Q (wynik)', value: `${gen.resQMvar.toFixed(1)} Mvar`, status: 'good' });
                return items;
            }
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
                        label: `Odłącznik ${sw.sideLabel || sw.name}`,
                        value: sw.closed ? 'Zamknięty' : 'Otwarty',
                        status: sw.closed ? 'good' : 'bad',
                    });
                }
                return items;
            }
            if (selection.kind === 'load') {
                const ld = selection.payload;
                const items = [];
                if (ld.busId != null) items.push({ label: 'Szyna', value: `#${ld.busId}` });
                items.push({ label: 'Status', value: ld.inService ? 'W ruchu' : 'Wyłączony', status: ld.inService ? 'good' : 'bad' });
                if (ld.pMw != null) items.push({ label: 'P obc.', value: `${ld.pMw.toFixed(2)} MW` });
                if (ld.qMvar != null) items.push({ label: 'Q obc.', value: `${ld.qMvar.toFixed(2)} Mvar` });
                return items;
            }
            if (selection.kind === 'sgen') {
                const sg = selection.payload;
                const items = [];
                if (sg.busId != null) items.push({ label: 'Szyna', value: `#${sg.busId}` });
                items.push({ label: 'Status', value: sg.inService ? 'W ruchu' : 'Wyłączony', status: sg.inService ? 'good' : 'bad' });
                if (sg.pMw != null) items.push({ label: 'P', value: `${sg.pMw.toFixed(2)} MW` });
                if (sg.qMvar != null) items.push({ label: 'Q', value: `${sg.qMvar.toFixed(2)} Mvar` });
                return items;
            }
            if (selection.kind === 'ext_grid') {
                const eg = selection.payload;
                const items = [];
                if (eg.busId != null) items.push({ label: 'Szyna', value: `#${eg.busId}` });
                items.push({ label: 'Status', value: eg.inService ? 'W ruchu' : 'Wyłączony', status: eg.inService ? 'good' : 'bad' });
                if (eg.vmPu != null) items.push({ label: 'U zadane', value: `${eg.vmPu.toFixed(4)} p.u.` });
                if (eg.vaDeg != null) items.push({ label: 'Kąt zadany', value: `${eg.vaDeg.toFixed(2)} °` });
                return items;
            }
            if (selection.kind === 'shunt') {
                const sh = selection.payload;
                const items = [];
                if (sh.busId != null) items.push({ label: 'Szyna', value: `#${sh.busId}` });
                items.push({ label: 'Status', value: sh.inService ? 'W ruchu' : 'Wyłączony', status: sh.inService ? 'good' : 'bad' });
                if (sh.pMw != null) items.push({ label: 'P (Gs)', value: `${sh.pMw.toFixed(2)} MW` });
                if (sh.qMvar != null) items.push({ label: 'Q (Bs)', value: `${sh.qMvar.toFixed(2)} Mvar` });
                if (sh.step != null) items.push({ label: 'Stopień', value: String(sh.step) });
                return items;
            }
            if (selection.kind === 'switch') {
                const sw = selection.payload;
                return [
                    { label: 'Stan', value: sw.closed ? 'Zamknięty' : 'Otwarty', status: sw.closed ? 'good' : 'bad' },
                    { label: 'Powiązanie', value: sw.parentKind === 'trafo' ? 'Transformator' : sw.parentKind === 'line' ? 'Linia' : 'Odłącznik szynowy' },
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
            const kindToLabel = {
                bus: 'Szyna', line: 'Linia', trafo: 'Trafo', switch: 'Odłącznik',
                gen: 'Generator', load: 'Obciążenie', sgen: 'SGen',
                ext_grid: 'Slack', shunt: 'Bocznik',
            };
            const label = kindToLabel[selection.kind];
            return label ? `${label} #${id}` : '';
        });
        const kindLabel = computed(() => {
            const kindToLabel = {
                bus: 'Szyna', line: 'Linia', trafo: 'Transformator', switch: 'Odłącznik',
                gen: 'Generator', load: 'Obciążenie', sgen: 'Generator statyczny',
                ext_grid: 'Zasilanie zewnętrzne', shunt: 'Bocznik (Gs/Bs)',
            };
            return kindToLabel[props.selection?.kind] || '';
        });

        const switchActionLabel = computed(() => {
            const sw = props.selection?.kind === 'switch' ? props.selection.payload : null;
            if (!sw) return '';
            return sw.closed ? 'Otwórz odłącznik' : 'Zamknij odłącznik';
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
            busGens,
            busLoads,
            busSgens,
            busExtGrids,
            busShunts,
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
            <button v-if="canGoBack" class="card-icon-btn selection-back-btn" type="button" @click="$emit('go-back')" aria-label="Powrót do szyny">
                <IconChevronLeft />
            </button>
            <div class="selection-header-text">
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

        <template v-if="!editing && selection.kind === 'bus' && busGens.length">
            <div class="selection-section-label">Generatory</div>
            <div v-for="gen in busGens" :key="gen.id" class="selection-gen-row">
                <span class="gen-name">{{ gen.name }}</span>
                <span class="gen-status" :class="gen.inService ? 'good' : 'bad'">
                    {{ gen.inService ? 'W ruchu' : 'Wyłączony' }}
                </span>
                <button type="button" class="btn btn-sm gen-edit-btn" @click="$emit('select-gen', gen.id)">
                    Edytuj
                </button>
            </div>
        </template>

        <template v-if="!editing && selection.kind === 'bus' && busLoads.length">
            <div class="selection-section-label">Obciążenia</div>
            <div v-for="ld in busLoads" :key="ld.id" class="selection-gen-row">
                <span class="gen-name">{{ ld.name }} — {{ (ld.pMw ?? 0).toFixed(1) }} MW</span>
                <button type="button" class="btn btn-sm gen-edit-btn" @click="$emit('select-bus-element', { kind: 'load', id: ld.id })">
                    Edytuj
                </button>
            </div>
        </template>

        <template v-if="!editing && selection.kind === 'bus' && busSgens.length">
            <div class="selection-section-label">Generatory statyczne (SGen)</div>
            <div v-for="sg in busSgens" :key="sg.id" class="selection-gen-row">
                <span class="gen-name">{{ sg.name }} — {{ (sg.pMw ?? 0).toFixed(1) }} MW</span>
                <button type="button" class="btn btn-sm gen-edit-btn" @click="$emit('select-bus-element', { kind: 'sgen', id: sg.id })">
                    Edytuj
                </button>
            </div>
        </template>

        <template v-if="!editing && selection.kind === 'bus' && busExtGrids.length">
            <div class="selection-section-label">Zasilanie zewnętrzne (slack)</div>
            <div v-for="eg in busExtGrids" :key="eg.id" class="selection-gen-row">
                <span class="gen-name">{{ eg.name }} — {{ (eg.vmPu ?? 1).toFixed(3) }} p.u.</span>
                <button type="button" class="btn btn-sm gen-edit-btn" @click="$emit('select-bus-element', { kind: 'ext_grid', id: eg.id })">
                    Edytuj
                </button>
            </div>
        </template>

        <template v-if="!editing && selection.kind === 'bus' && busShunts.length">
            <div class="selection-section-label">Boczniki (Gs/Bs)</div>
            <div v-for="sh in busShunts" :key="sh.id" class="selection-gen-row">
                <span class="gen-name">{{ sh.name }} — Q={{ (sh.qMvar ?? 0).toFixed(1) }} Mvar</span>
                <button type="button" class="btn btn-sm gen-edit-btn" @click="$emit('select-bus-element', { kind: 'shunt', id: sh.id })">
                    Edytuj
                </button>
            </div>
        </template>

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
                {{ topologyBusy ? 'Aktualizuję…' : switchActionLabel }}
            </button>
        </div>
        <div v-else-if="!editing && selection.kind === 'trafo' && relatedTrafoSwitches.length" class="selection-actions">
            <button
                class="btn btn-block"
                type="button"
                :disabled="topologyBusy"
                @click="$emit('set-switches-state', { switchIds: relatedTrafoSwitches.map(sw => sw.id), closed: !trafoConnected })">
                {{ topologyBusy ? 'Aktualizuję…' : trafoActionLabel }}
            </button>
            <button
                v-for="sw in relatedTrafoSwitches"
                :key="sw.id"
                class="btn btn-block"
                type="button"
                :disabled="topologyBusy"
                @click="$emit('set-switch-state', { switchId: sw.id, closed: !sw.closed })">
                {{ topologyBusy ? 'Aktualizuję…' : (sw.closed ? 'Otwórz ' : 'Zamknij ') + (sw.sideLabel || sw.name) }}
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
