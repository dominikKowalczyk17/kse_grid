import { computed } from 'vue';
import { IconClose } from '/icons.js';
import { voltageStatus } from '/lib/formatters.js';

export const SelectionCard = {
    components: { IconClose },
    props: { selection: Object, hasResults: Boolean },
    emits: ['close'],
    setup (props) {
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
                return items;
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
                    : selection.kind === 'trafo' ? `Trafo #${id}` : '';
        });
        const kindLabel = computed(() => {
            const kind = props.selection?.kind;
            return kind === 'bus' ? 'Szyna'
                : kind === 'line' ? 'Linia'
                    : kind === 'trafo' ? 'Transformator' : '';
        });

        return { rows, title, subtitle, kindLabel };
    },
    template: `
    <div v-if="selection" class="selection-card">
        <div class="selection-header">
            <div>
                <div class="selection-kind">{{ kindLabel }}</div>
                <div class="selection-title">{{ title }}</div>
                <div v-if="subtitle" class="selection-subtitle">{{ subtitle }}</div>
            </div>
            <button class="card-close" @click="$emit('close')" aria-label="Zamknij">
                <IconClose />
            </button>
        </div>
        <div v-for="(row, i) in rows" :key="i" class="selection-row">
            <span class="lbl">{{ row.label }}</span>
            <span class="val" :class="row.status">{{ row.value }}</span>
        </div>
    </div>
    `,
};
