import { AppError } from '/lib/errors.js';

function parseTextPayload(text) {
    if (!text) return {};
    try {
        return { json: JSON.parse(text), text };
    } catch (_) {
        return { json: null, text };
    }
}

async function parseJson(response, requestMeta = {}) {
    const text = await response.text();
    const { json } = parseTextPayload(text);

    if (response.ok) return json ?? {};

    const detail = json?.detail || text || `HTTP ${response.status}`;
    throw new AppError(detail, {
        name: 'HttpError',
        title: requestMeta.title || 'Błąd żądania HTTP',
        status: response.status,
        method: requestMeta.method || null,
        url: requestMeta.url || response.url,
        detail,
        body: text,
    });
}

async function requestJson(url, options = {}, meta = {}) {
    try {
        const response = await fetch(url, options);
        return await parseJson(response, {
            url,
            method: options.method || 'GET',
            title: meta.title,
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError(error?.message || String(error), {
            name: 'NetworkError',
            title: meta.title || 'Błąd sieci',
            method: options.method || 'GET',
            url,
            detail: error?.stack || String(error),
            cause: error,
        });
    }
}

export async function fetchNetwork() {
    return requestJson('/api/network', {}, { title: 'Błąd ładowania sieci' });
}

export async function setSwitchState(switchId, closed) {
    return requestJson(`/api/switches/${switchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed }),
    }, { title: `Błąd aktualizacji odłącznika #${switchId}` });
}

export async function resetTopology() {
    return requestJson('/api/topology/reset', { method: 'POST' }, { title: 'Błąd resetu topologii' });
}

export async function recalculatePowerflow() {
    return requestJson('/api/powerflow/recalculate', { method: 'POST' }, { title: 'Błąd przeliczania rozpływu mocy' });
}

export function uploadNetwork(file, onProgress) {
    return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('file', file, file.name);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/network/upload');
        xhr.responseType = 'text';

        xhr.upload.addEventListener('progress', (event) => {
            if (typeof onProgress !== 'function') return;
            if (event.lengthComputable) {
                onProgress({ phase: 'upload', loaded: event.loaded, total: event.total, percent: (event.loaded / event.total) * 100 });
            } else {
                onProgress({ phase: 'upload', loaded: event.loaded, total: 0, percent: null });
            }
        });
        xhr.upload.addEventListener('load', () => {
            if (typeof onProgress === 'function') onProgress({ phase: 'process', percent: null });
        });

        xhr.addEventListener('error', () => reject(new AppError('Błąd sieci podczas wysyłania pliku', {
            name: 'NetworkError',
            title: 'Błąd uploadu pliku',
            method: 'POST',
            url: '/api/network/upload',
        })));
        xhr.addEventListener('abort', () => reject(new AppError('Wysyłanie pliku przerwane', {
            name: 'AbortError',
            title: 'Upload pliku przerwany',
            method: 'POST',
            url: '/api/network/upload',
        })));
        xhr.addEventListener('load', () => {
            const text = xhr.responseText || '';
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(text ? JSON.parse(text) : {}); }
                catch (_) {
                    reject(new AppError('Niepoprawna odpowiedź serwera (nie-JSON)', {
                        name: 'InvalidResponseError',
                        title: 'Błąd uploadu pliku',
                        status: xhr.status,
                        method: 'POST',
                        url: '/api/network/upload',
                        body: text,
                    }));
                }
                return;
            }
            const { json } = parseTextPayload(text);
            const detail = json?.detail || text || `HTTP ${xhr.status}`;
            reject(new AppError(detail, {
                name: 'HttpError',
                title: 'Błąd uploadu pliku',
                status: xhr.status,
                method: 'POST',
                url: '/api/network/upload',
                detail,
                body: text,
            }));
        });

        xhr.send(form);
    });
}

export async function fetchElementSchema() {
    return requestJson('/api/elements/schema', {}, { title: 'Błąd pobierania schematu edycji' });
}

export async function fetchElementParams(kind, elementId) {
    return requestJson(`/api/elements/${kind}/${elementId}`, {}, {
        title: `Błąd pobierania parametrów ${kind} #${elementId}`,
    });
}

export async function updateElement(kind, elementId, fields) {
    return requestJson(`/api/elements/${kind}/${elementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    }, {
        title: `Błąd zapisu parametrów ${kind} #${elementId}`,
    });
}
