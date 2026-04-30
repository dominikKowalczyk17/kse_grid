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
