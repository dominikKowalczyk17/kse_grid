import { computed, ref, watch } from 'vue';

export function useBranchRanking(props, { focusElement }) {
    const activeBranchCursor = ref(0);

    const sortedBranches = computed(() => {
        if (!props.hasResults) return [];
        const selectedVoltages = new Set(props.selectedVoltages);
        const items = [];

        if (props.selectedTypes.includes('line')) {
            for (const line of props.lines || []) {
                if (!selectedVoltages.has(line.voltage)) continue;
                items.push({
                    kind: 'line',
                    id: line.id,
                    name: line.name,
                    label: `Linia #${line.id}`,
                    loading: Number(line.loading) || 0,
                    voltageLabel: `${line.voltage.toFixed(0)} kV`,
                    fromBus: line.fromBus,
                    toBus: line.toBus,
                });
            }
        }
        if (props.selectedTypes.includes('trafo')) {
            for (const trafo of props.trafos || []) {
                if (!selectedVoltages.has(trafo.vnHvKv) || !selectedVoltages.has(trafo.vnLvKv)) continue;
                items.push({
                    kind: 'trafo',
                    id: trafo.id,
                    name: trafo.name,
                    label: `Trafo #${trafo.id}`,
                    loading: Number(trafo.loading) || 0,
                    voltageLabel: `${trafo.vnHvKv.toFixed(0)}/${trafo.vnLvKv.toFixed(0)} kV`,
                    fromBus: trafo.hvBus,
                    toBus: trafo.lvBus,
                });
            }
        }

        return items.sort((left, right) =>
            right.loading - left.loading
            || left.kind.localeCompare(right.kind)
            || left.id - right.id);
    });

    const activeBranch = computed(() => {
        if (!sortedBranches.value.length) return null;
        const index = Math.min(activeBranchCursor.value, sortedBranches.value.length - 1);
        return sortedBranches.value[index] ?? null;
    });

    function focusBranchAt(index) {
        if (!sortedBranches.value.length) return;
        const next = Math.min(sortedBranches.value.length - 1, Math.max(0, index));
        activeBranchCursor.value = next;
        focusElement(sortedBranches.value[next]);
    }

    function navigateBranches(step) {
        focusBranchAt(activeBranchCursor.value + step);
    }

    watch(sortedBranches, items => {
        if (!items.length) {
            activeBranchCursor.value = 0;
            return;
        }
        activeBranchCursor.value = Math.min(activeBranchCursor.value, items.length - 1);
    });

    return {
        sortedBranches,
        activeBranch,
        activeBranchCursor,
        focusBranchAt,
        navigateBranches,
    };
}
