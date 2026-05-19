import { computed, ref, watch } from 'vue';
import { voltageStatus } from '/lib/formatters.js';
import { HISTOGRAM_BIN_WIDTH, HISTOGRAM_MAX, HISTOGRAM_MIN } from '/lib/thresholds.js';

export function useVoltageHistogram(props, { focusBus }) {
    const hoveredBinIndex = ref(null);
    const activeHistogramBinIndex = ref(null);
    const activeHistogramBusCursor = ref(0);

    const histogram = computed(() => {
        const binCount = Math.round((HISTOGRAM_MAX - HISTOGRAM_MIN) / HISTOGRAM_BIN_WIDTH);
        const selectedSet = new Set(props.selectedVoltages);

        const bins = Array.from({ length: binCount }, (_, index) => {
            const lo = HISTOGRAM_MIN + index * HISTOGRAM_BIN_WIDTH;
            const hi = lo + HISTOGRAM_BIN_WIDTH;
            const mid = (lo + hi) / 2;
            return {
                lo, hi,
                count: 0,
                status: voltageStatus(mid) || 'good',
                busIds: [],
            };
        });

        if (props.hasResults) {
            for (const bus of props.buses) {
                if (!selectedSet.has(bus.vn_kv) || bus.vmPu == null) continue;
                const vmPu = Math.max(HISTOGRAM_MIN, Math.min(HISTOGRAM_MAX - 1e-9, bus.vmPu));
                const index = Math.min(binCount - 1, Math.floor((vmPu - HISTOGRAM_MIN) / HISTOGRAM_BIN_WIDTH));
                bins[index].count += 1;
                bins[index].busIds.push(bus.id);
            }
        }

        return {
            bins,
            max: bins.reduce((currentMax, bin) => Math.max(currentMax, bin.count), 0) || 1,
            total: bins.reduce((sum, bin) => sum + bin.count, 0),
            okBandLeft: ((0.95 - HISTOGRAM_MIN) / (HISTOGRAM_MAX - HISTOGRAM_MIN)) * 100,
            okBandWidth: ((1.05 - 0.95) / (HISTOGRAM_MAX - HISTOGRAM_MIN)) * 100,
            nominalLeft: ((1.0 - HISTOGRAM_MIN) / (HISTOGRAM_MAX - HISTOGRAM_MIN)) * 100,
        };
    });

    const hoveredBin = computed(() => hoveredBinIndex.value == null
        ? null
        : histogram.value.bins[hoveredBinIndex.value] ?? null);
    const activeHistogramBin = computed(() => activeHistogramBinIndex.value == null
        ? null
        : histogram.value.bins[activeHistogramBinIndex.value] ?? null);
    const activeHistogramBusIds = computed(() => activeHistogramBin.value?.busIds || []);
    const activeHistogramBusId = computed(() => {
        if (!activeHistogramBusIds.value.length) return null;
        const index = Math.min(activeHistogramBusCursor.value, activeHistogramBusIds.value.length - 1);
        return activeHistogramBusIds.value[index] ?? null;
    });

    function histogramBarStyle(bin) {
        return { height: `${(bin.count / histogram.value.max) * 100}%` };
    }

    function focusHistogramBin(index) {
        const bin = histogram.value.bins[index];
        if (!bin?.busIds?.length) return;
        activeHistogramBinIndex.value = index;
        activeHistogramBusCursor.value = 0;
        focusBus(bin.busIds[0]);
    }

    function navigateHistogramBin(step) {
        if (!activeHistogramBusIds.value.length) return;
        const next = Math.min(
            activeHistogramBusIds.value.length - 1,
            Math.max(0, activeHistogramBusCursor.value + step),
        );
        activeHistogramBusCursor.value = next;
        focusBus(activeHistogramBusIds.value[next]);
    }

    watch(activeHistogramBusIds, ids => {
        if (!ids.length) {
            activeHistogramBinIndex.value = null;
            activeHistogramBusCursor.value = 0;
            return;
        }
        activeHistogramBusCursor.value = Math.min(activeHistogramBusCursor.value, ids.length - 1);
    });

    return {
        histogram,
        hoveredBinIndex,
        hoveredBin,
        activeHistogramBinIndex,
        activeHistogramBin,
        activeHistogramBusIds,
        activeHistogramBusId,
        activeHistogramBusCursor,
        histogramBarStyle,
        focusHistogramBin,
        navigateHistogramBin,
        HISTOGRAM_BIN_WIDTH,
    };
}
