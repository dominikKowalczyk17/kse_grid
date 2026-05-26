import { ref } from 'vue';
import { formatError } from '/lib/errors.js';

export function useErrorHandling() {
    const activeError = ref(null);

    function presentError(rawError, title, info = '') {
        const formatted = formatError(rawError, title);
        if (info) formatted.traceback = [info, formatted.traceback].filter(Boolean).join('\n\n');
        activeError.value = formatted;
        return formatted;
    }

    function dismissErrorModal() {
        activeError.value = null;
    }

    function handleRuntimeError(payload) {
        if (!payload) return null;
        const isWrapped = typeof payload === 'object' && payload !== null
            && ('error' in payload || 'title' in payload || 'info' in payload);
        return isWrapped
            ? presentError(payload.error, payload.title || 'Błąd aplikacji', payload.info || '')
            : presentError(payload, 'Błąd aplikacji');
    }

    return { activeError, presentError, dismissErrorModal, handleRuntimeError };
}
