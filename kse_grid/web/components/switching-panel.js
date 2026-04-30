import { computed } from 'vue';

export const SwitchingPanel = {
    props: {
        topology: Object,
        busy: Boolean,
        requestError: String,
    },
    emits: ['reset-topology'],
    setup (props) {
        const topology = computed(() => props.topology || {});
        const runMessageClass = computed(() => topology.value.lastRunSucceeded === false ? 'helper helper-bad' : 'helper');
        return { topology, runMessageClass };
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
                <span class="diag-label">Switche otwarte</span>
                <span class="diag-value tabular" :class="(topology.openSwitchCount ?? 0) > 0 ? 'warn' : ''">
                    {{ topology.openSwitchCount ?? 0 }} / {{ topology.switchCount ?? 0 }}
                </span>
            </div>
        </div>

        <p class="helper">Switche pokazują stan łączeniowy wysp. Klik marker na diagramie, potem użyj akcji Otwórz / Zamknij w karcie szczegółów.</p>
        <p v-if="topology.lastRunMessage" :class="runMessageClass">{{ topology.lastRunMessage }}</p>
        <p v-if="requestError" class="helper helper-bad">{{ requestError }}</p>

        <div class="btn-search-row">
            <button class="btn btn-block" type="button" :disabled="busy" @click="$emit('reset-topology')">
                {{ busy ? 'Przeliczam…' : 'Reset topologii' }}
            </button>
        </div>
    </section>
    `,
};
