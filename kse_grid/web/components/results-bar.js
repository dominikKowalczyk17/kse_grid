import { computed, ref } from 'vue';
import { formatMw, voltageColorVar } from '/lib/formatters.js';

export const ResultsBar = {
    props: {
        hasResults: Boolean,
        totals: Object,
        diagnostics: Object,
        buses: Array,
        lines: Array,
        trafos: Array,
    },
    emits: ['select-bus', 'select-element'],
    setup(props, { emit }) {
        const open = ref(false);

        const sortedBuses = computed(() => {
            if (!props.hasResults || !props.buses) return [];
            return [...props.buses]
                .filter(b => b.vmPu != null)
                .sort((a, b) => Math.abs(b.vmPu - 1) - Math.abs(a.vmPu - 1))
                .slice(0, 30);
        });

        const sortedBranches = computed(() => {
            if (!props.hasResults) return [];
            const lines = (props.lines || []).map(l => ({ ...l, kind: 'line' }));
            const trafos = (props.trafos || []).map(t => ({ ...t, kind: 'trafo' }));
            return [...lines, ...trafos]
                .sort((a, b) => b.loading - a.loading)
                .slice(0, 30);
        });

        function selectBus(busId) {
            open.value = false;
            emit('select-bus', busId);
        }

        function selectElement(kind, id) {
            open.value = false;
            emit('select-element', kind, id);
        }

        function loadingRowClass(pct) {
            if (pct >= 100) return 'report-row--bad';
            if (pct >= 80) return 'report-row--warn';
            return '';
        }

        return {
            open,
            sortedBuses,
            sortedBranches,
            selectBus,
            selectElement,
            loadingRowClass,
            formatMw,
            voltageColorVar,
        };
    },
    template: `
    <div class="results-bar">
        <button
            class="results-bar__strip"
            type="button"
            :disabled="!hasResults"
            @click="open = true"
        >
            <span v-if="!hasResults" class="results-bar__placeholder">
                Brak wyników — uruchom przeliczenie
            </span>
            <template v-else>
                <span class="results-bar__kpi">
                    <span class="rb-label">Straty</span>
                    <span class="rb-value">{{ formatMw(totals.lossesMw) }}<template v-if="totals.lossPct != null"> ({{ totals.lossPct.toFixed(1) }}%)</template></span>
                </span>
                <span class="rb-sep">|</span>
                <span class="results-bar__kpi">
                    <span class="rb-label">U min</span>
                    <span class="rb-value" :class="{ 'rb-warn': diagnostics.voltage.minPu < 0.95 }">{{ diagnostics.voltage.minPu.toFixed(3) }} {{ diagnostics.voltage.minBusName }}</span>
                </span>
                <span class="rb-sep">|</span>
                <span class="results-bar__kpi">
                    <span class="rb-label">U max</span>
                    <span class="rb-value" :class="{ 'rb-warn': diagnostics.voltage.maxPu > 1.05 }">{{ diagnostics.voltage.maxPu.toFixed(3) }} {{ diagnostics.voltage.maxBusName }}</span>
                </span>
                <span class="rb-sep">|</span>
                <span class="results-bar__kpi">
                    <span class="rb-label">L max</span>
                    <span class="rb-value" :class="{ 'rb-warn': diagnostics.loading.maxPct > 80 }">{{ diagnostics.loading.maxPct.toFixed(1) }}% {{ diagnostics.loading.maxName }}</span>
                </span>
                <span class="rb-sep rb-spacer"></span>
                <span class="rb-hint">▲ Otwórz raport</span>
            </template>
        </button>

        <Teleport to="body">
            <div v-if="open && hasResults" class="report-backdrop" @click.self="open = false">
                <div class="report-modal">
                    <div class="report-modal__header">
                        <h2 class="report-modal__title">Wyniki obliczeń</h2>
                        <button class="report-modal__close" type="button" @click="open = false" title="Zamknij">✕</button>
                    </div>
                    <div class="report-modal__body">

                        <div class="report-col">
                            <div class="report-col__title">Bilans mocy</div>
                            <div class="report-balance">
                                <div class="rb-row">
                                    <span class="rb-row__label">Obciążenie Σ</span>
                                    <span class="rb-row__val">{{ formatMw(totals.loadMw) }}</span>
                                </div>
                                <div class="rb-row">
                                    <span class="rb-row__label">Generacja Σ</span>
                                    <span class="rb-row__val">{{ formatMw(totals.generationMw) }}</span>
                                </div>
                                <div class="rb-row">
                                    <span class="rb-row__label">w tym slack</span>
                                    <span class="rb-row__val muted">{{ formatMw(totals.slackMw) }}</span>
                                </div>
                                <div class="rb-row rb-row--sep">
                                    <span class="rb-row__label">Straty ΔP</span>
                                    <span class="rb-row__val">{{ formatMw(totals.lossesMw) }}<template v-if="totals.lossPct != null"> ({{ totals.lossPct.toFixed(2) }}%)</template></span>
                                </div>
                            </div>
                        </div>

                        <div class="report-col">
                            <div class="report-col__title">Ranking napięć ({{ sortedBuses.length }} szyn)</div>
                            <div class="report-table">
                                <div class="report-thead">
                                    <span class="report-row__badge">kV</span>
                                    <span class="report-row__name">Szyna</span>
                                    <span class="report-row__val">U [p.u.]</span>
                                </div>
                                <div class="report-list">
                                    <button
                                        v-for="bus in sortedBuses"
                                        :key="bus.id"
                                        class="report-row"
                                        :class="{ 'report-row--viol': bus.vmPu < 0.95 || bus.vmPu > 1.05 }"
                                        type="button"
                                        @click="selectBus(bus.id)"
                                    >
                                        <span class="report-row__badge">{{ Math.round(bus.vn_kv) }}</span>
                                        <span class="report-row__name">{{ bus.name }}</span>
                                        <span class="report-row__val" :style="{ color: voltageColorVar(bus.vmPu) }">{{ bus.vmPu.toFixed(3) }}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="report-col">
                            <div class="report-col__title">Ranking obciążeń ({{ sortedBranches.length }} gałęzi)</div>
                            <div class="report-table">
                                <div class="report-thead">
                                    <span class="report-row__badge">Typ</span>
                                    <span class="report-row__name">Nazwa</span>
                                    <span class="report-row__val">Obciążenie</span>
                                </div>
                                <div class="report-list">
                                    <button
                                        v-for="branch in sortedBranches"
                                        :key="branch.kind + branch.id"
                                        class="report-row"
                                        :class="loadingRowClass(branch.loading)"
                                        type="button"
                                        @click="selectElement(branch.kind, branch.id)"
                                    >
                                        <span class="report-row__badge">{{ branch.kind === 'line' ? 'Linia' : 'Trafo' }}</span>
                                        <span class="report-row__name">{{ branch.name }}</span>
                                        <span class="report-row__val">{{ branch.loading.toFixed(1) }}%</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </Teleport>
    </div>
    `,
};
