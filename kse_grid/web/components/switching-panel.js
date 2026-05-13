import { computed } from 'vue';

function polishPlural(count, one, few, many) {
    if (count === 1) return one;
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
    return many;
}

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
        return { topology, pendingRecalc, pendingChangeCount, pendingChangeLabel, runMessageClass };
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
