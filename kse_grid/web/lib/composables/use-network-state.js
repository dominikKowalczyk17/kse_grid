import { ref } from 'vue';
import { fetchNetwork, uploadNetwork } from '/lib/api.js';

export function useNetworkState({ presentError, onApply }) {
    const network = ref(null);
    const error = ref(null);
    const atLanding = ref(true);
    const uploadBusy = ref(false);
    const uploadError = ref('');
    const uploadProgress = ref(0);
    const uploadPhase = ref('upload');
    const uploadFileName = ref('');
    const uploadInputRef = ref(null);

    function applyNetwork(data, opts = {}) {
        const isFirstLoad = opts.firstLoad ?? !network.value;
        network.value = data;
        document.title = `${data.name} – kse_grid`;
        if (onApply) onApply(data, isFirstLoad);
    }

    function applyTopologyUpdate(update) {
        const net = network.value;
        if (!net || !update) return;

        if ('hasResults' in update) net.hasResults = update.hasResults;
        if (update.stats) net.stats = update.stats;
        if (update.totals) net.totals = update.totals;
        if (update.diagnostics) net.diagnostics = update.diagnostics;
        if (update.topology) net.topology = update.topology;

        _patchSwitches(net, update.switches);
        _patchBusResults(net, update.busResults);
        _patchLineResults(net, update.lineResults);
        _patchTrafoResults(net, update.trafoResults);

        if (update.changedElement) {
            _applyChangedElement(net, update.changedElement);
        }
    }

    async function loadNetwork() {
        try {
            applyNetwork(await fetchNetwork());
            error.value = null;
        } catch (fetchError) {
            error.value = presentError(fetchError, 'Błąd ładowania sieci').message;
        }
    }

    function triggerUpload() {
        uploadError.value = '';
        uploadInputRef.value?.click();
    }

    async function onUploadFile(event) {
        const input = event.target;
        const file = input?.files?.[0];
        if (!file) return;

        uploadBusy.value = true;
        uploadError.value = '';
        uploadProgress.value = 0;
        uploadPhase.value = 'upload';
        uploadFileName.value = file.name;
        error.value = null;

        try {
            const payload = await uploadNetwork(file, ({ phase, percent }) => {
                uploadPhase.value = phase;
                if (phase === 'upload' && typeof percent === 'number') {
                    uploadProgress.value = Math.min(100, Math.max(0, percent));
                } else if (phase === 'process') {
                    uploadProgress.value = 100;
                }
            });
            atLanding.value = false;
            applyNetwork(payload, { firstLoad: true });
        } catch (requestError) {
            uploadError.value = presentError(requestError, 'Błąd uploadu pliku').message;
        } finally {
            uploadBusy.value = false;
            uploadProgress.value = 0;
            uploadPhase.value = 'upload';
            uploadFileName.value = '';
            if (input) input.value = '';
        }
    }

    function leaveLanding() {
        atLanding.value = false;
    }

    return {
        network, error, atLanding,
        uploadBusy, uploadError, uploadProgress, uploadPhase, uploadFileName, uploadInputRef,
        applyNetwork, applyTopologyUpdate, loadNetwork, triggerUpload, onUploadFile, leaveLanding,
    };
}

function _patchSwitches(net, switches) {
    if (!Array.isArray(switches) || !Array.isArray(net.switches)) return;
    const byId = new Map(net.switches.map(sw => [sw.id, sw]));
    for (const patch of switches) {
        const sw = byId.get(patch.id);
        if (sw) sw.closed = patch.closed;
    }
}

function _patchBusResults(net, busResults) {
    if (!Array.isArray(busResults) || !Array.isArray(net.buses)) return;
    const byId = new Map(net.buses.map(b => [b.id, b]));
    for (const patch of busResults) {
        const bus = byId.get(patch.id);
        if (!bus) continue;
        bus.vmPu = patch.vmPu ?? null;
        bus.vaDeg = patch.vaDeg ?? null;
        if ('genMvar' in patch) bus.genMvar = patch.genMvar;
    }
}

function _patchLineResults(net, lineResults) {
    if (!Array.isArray(lineResults) || !Array.isArray(net.lines)) return;
    const byId = new Map(net.lines.map(l => [l.id, l]));
    for (const patch of lineResults) {
        const line = byId.get(patch.id);
        if (!line) continue;
        line.loading = patch.loading ?? 0;
        line.pFromMw = patch.pFromMw ?? null;
        line.qFromMvar = patch.qFromMvar ?? null;
        line.pToMw = patch.pToMw ?? null;
        line.qToMvar = patch.qToMvar ?? null;
    }
}

function _patchTrafoResults(net, trafoResults) {
    if (!Array.isArray(trafoResults) || !Array.isArray(net.trafos)) return;
    const byId = new Map(net.trafos.map(t => [t.id, t]));
    for (const patch of trafoResults) {
        const trafo = byId.get(patch.id);
        if (!trafo) continue;
        trafo.loading = patch.loading ?? 0;
        trafo.pHvMw = patch.pHvMw ?? null;
        trafo.qHvMvar = patch.qHvMvar ?? null;
        trafo.pLvMw = patch.pLvMw ?? null;
        trafo.qLvMvar = patch.qLvMvar ?? null;
    }
}

function _applyChangedElement(net, change) {
    const arrayKey = { bus: 'buses', line: 'lines', trafo: 'trafos', switch: 'switches', gen: 'gens' }[change.kind];
    if (!arrayKey || !Array.isArray(net[arrayKey])) return;
    const target = net[arrayKey].find(item => item.id === change.id);
    if (!target) return;
    for (const [key, value] of Object.entries(change.payload || {})) {
        target[key] = value;
    }
}
