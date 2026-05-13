async function parseJson(response) {
    if (response.ok) return response.json();

    let detail = `HTTP ${response.status}`;
    try {
        const payload = await response.json();
        if (payload?.detail) detail = payload.detail;
    } catch (_) {
        // Fallback zostaje na prostym HTTP status, jeśli backend nie zwróci JSON-a.
    }
    throw new Error(detail);
}

export async function fetchNetwork() {
    return parseJson(await fetch('/api/network'));
}

export async function setSwitchState(switchId, closed) {
    return parseJson(await fetch(`/api/switches/${switchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closed }),
    }));
}

export async function resetTopology() {
    return parseJson(await fetch('/api/topology/reset', { method: 'POST' }));
}

export async function recalculatePowerflow() {
    return parseJson(await fetch('/api/powerflow/recalculate', { method: 'POST' }));
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

        xhr.addEventListener('error', () => reject(new Error('Błąd sieci podczas wysyłania pliku')));
        xhr.addEventListener('abort', () => reject(new Error('Wysyłanie pliku przerwane')));
        xhr.addEventListener('load', () => {
            const text = xhr.responseText || '';
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(text ? JSON.parse(text) : {}); }
                catch (_) { reject(new Error('Niepoprawna odpowiedź serwera (nie-JSON)')); }
                return;
            }
            let detail = `HTTP ${xhr.status}`;
            try {
                const payload = JSON.parse(text);
                if (payload?.detail) detail = payload.detail;
            } catch (_) { /* fallback */ }
            reject(new Error(detail));
        });

        xhr.send(form);
    });
}

export async function fetchElementSchema() {
    return parseJson(await fetch('/api/elements/schema'));
}

export async function fetchElementParams(kind, elementId) {
    return parseJson(await fetch(`/api/elements/${kind}/${elementId}`));
}

export async function updateElement(kind, elementId, fields) {
    return parseJson(await fetch(`/api/elements/${kind}/${elementId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
    }));
}
