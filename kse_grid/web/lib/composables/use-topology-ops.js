import { ref } from 'vue';
import { recalculatePowerflow, resetTopology, setSwitchState } from '/lib/api.js';

export function useTopologyOps({ applyTopologyUpdate, applyNetwork, presentError }) {
    const topologyBusy = ref(false);
    const topologyError = ref('');
    const powerflowBusy = ref(false);

    async function onSetSwitchState({ switchId, closed }) {
        topologyBusy.value = true;
        topologyError.value = '';
        try {
            applyTopologyUpdate(await setSwitchState(switchId, closed));
        } catch (requestError) {
            topologyError.value = presentError(requestError, `Błąd aktualizacji odłącznika #${switchId}`).message;
        } finally {
            topologyBusy.value = false;
        }
    }

    async function onSetSwitchesState({ switchIds, closed }) {
        topologyBusy.value = true;
        topologyError.value = '';
        try {
            let payload = null;
            for (const switchId of switchIds) {
                payload = await setSwitchState(switchId, closed);
            }
            if (payload) applyTopologyUpdate(payload);
        } catch (requestError) {
            topologyError.value = presentError(requestError, 'Błąd aktualizacji stanu łączeniowego').message;
        } finally {
            topologyBusy.value = false;
        }
    }

    async function onResetTopology() {
        topologyBusy.value = true;
        topologyError.value = '';
        try {
            applyNetwork(await resetTopology());
        } catch (requestError) {
            topologyError.value = presentError(requestError, 'Błąd resetu topologii').message;
        } finally {
            topologyBusy.value = false;
        }
    }

    async function onRecalculatePowerflow() {
        topologyBusy.value = true;
        powerflowBusy.value = true;
        topologyError.value = '';
        try {
            applyTopologyUpdate(await recalculatePowerflow());
        } catch (requestError) {
            topologyError.value = presentError(requestError, 'Błąd przeliczania rozpływu mocy').message;
        } finally {
            powerflowBusy.value = false;
            topologyBusy.value = false;
        }
    }

    return {
        topologyBusy, topologyError, powerflowBusy,
        onSetSwitchState, onSetSwitchesState, onResetTopology, onRecalculatePowerflow,
    };
}
