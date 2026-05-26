import { computed, ref } from 'vue';
import { polishPlural } from '/lib/formatters.js';

const _STATUS_LABEL = { converged: 'zbieżna', unsupplied: 'brak zasilenia', not_converged: 'niezbieżna' };
const _STATUS_CLASS = { converged: 'good', unsupplied: 'muted', not_converged: 'bad' };

export const SwitchingPanel = {
    props: {
        topology: Object,
        busy: Boolean,
        requestError: String,
    },
    setup (props) {
        const topology = computed(() => props.topology || {});
        const pendingRecalc = computed(() => Boolean(topology.value.pendingRecalc));
        const pendingChangeCount = computed(() => Number(topology.value.pendingChangeCount || 0));
        const pendingChangeLabel = computed(() => polishPlural(pendingChangeCount.value, 'zmianę', 'zmiany', 'zmian'));
        const runMessageClass = computed(() => pendingRecalc.value
            ? 'helper helper-warn'
            : topology.value.lastRunSucceeded === false ? 'helper helper-bad' : 'helper');

        const islands = computed(() => Array.isArray(topology.value.islands) ? topology.value.islands : []);
        const showIslands = computed(() =>
            islands.value.length > 1 ||
            islands.value.some(i => i.pfStatus && i.pfStatus !== 'converged')
        );
        const islandsExpanded = ref(true);

        function islandStatusLabel(island) {
            if (!island.pfStatus) return pendingRecalc.value ? '—' : null;
            return _STATUS_LABEL[island.pfStatus] ?? island.pfStatus;
        }
        function islandStatusClass(island) {
            if (!island.pfStatus) return 'muted';
            return _STATUS_CLASS[island.pfStatus] ?? '';
        }

        return {
            topology, pendingRecalc, pendingChangeCount, pendingChangeLabel, runMessageClass,
            islands, showIslands, islandsExpanded,
            islandStatusLabel, islandStatusClass,
        };
    },
    template: `
    <section class="section-card">
        <h3 class="section-title">Łączenia / wyspy</h3>
        <div class="diag-stack">
            <div class="diag-row">
                <span class="diag-label">Wyspy</span>
                <span class="diag-value tabular">{{ topology.islandCount ?? 0 }}</span>
            </div>
            <div class="diag-row">
                <span class="diag-label">Wyspy zasilone</span>
                <span class="diag-value tabular" :class="(topology.unsuppliedIslandCount ?? 0) > 0 ? 'warn' : 'good'">
                    {{ topology.energizedIslandCount ?? 0 }}
                </span>
            </div>
            <div class="diag-row">
                <span class="diag-label">Wyspy niezasilone</span>
                <span class="diag-value tabular" :class="(topology.unsuppliedIslandCount ?? 0) > 0 ? 'bad' : 'good'">
                    {{ topology.unsuppliedIslandCount ?? 0 }}
                </span>
            </div>
            <div class="diag-row">
                <span class="diag-label">Szyny bez zasilania</span>
                <span class="diag-value tabular" :class="(topology.unsuppliedBusCount ?? 0) > 0 ? 'bad' : 'good'">
                    {{ topology.unsuppliedBusCount ?? 0 }}
                </span>
            </div>
            <div class="diag-row">
                <span class="diag-label">Odłączniki otwarte</span>
                <span class="diag-value tabular" :class="(topology.openSwitchCount ?? 0) > 0 ? 'warn' : ''">
                    {{ topology.openSwitchCount ?? 0 }} / {{ topology.switchCount ?? 0 }}
                </span>
            </div>
        </div>

        <template v-if="showIslands">
            <div class="section-subheader clickable" @click="islandsExpanded = !islandsExpanded">
                <span>Status wysp</span>
                <span class="expand-arrow">{{ islandsExpanded ? '▲' : '▼' }}</span>
            </div>
            <div v-if="islandsExpanded" class="island-list">
                <div v-for="island in islands" :key="island.id" class="island-row">
                    <span class="island-id">W{{ island.id }}</span>
                    <span class="island-buses tabular">{{ island.busCount }} sz.</span>
                    <span class="island-status" :class="islandStatusClass(island)">
                        {{ islandStatusLabel(island) }}
                    </span>
                    <span v-if="island.pfMessage" class="island-msg" :title="island.pfMessage">⚠</span>
                </div>
            </div>
        </template>

        <p class="helper">Odłączniki pokazują stan łączeniowy wysp. Klik marker na diagramie, potem użyj akcji Otwórz / Zamknij w karcie szczegółów.</p>
        <p v-if="pendingRecalc" class="helper helper-warn">
            Wprowadzono {{ pendingChangeCount }} {{ pendingChangeLabel }}.
            Wyniki rozpływu mocy są ukryte do czasu ponownego przeliczenia.
        </p>
        <p v-if="topology.lastRunMessage" :class="runMessageClass">{{ topology.lastRunMessage }}</p>
        <p v-if="requestError" class="helper helper-bad">{{ requestError }}</p>
    </section>
    `,
};
