import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NetworkPayload } from '@/types/network';

const CACHE_KEY = 'kse_grid:network_cache';
const SERVER_URL_KEY = 'kse_grid:server_url';
const DEFAULT_SERVER_URL = 'http://127.0.0.1:8050';

export async function getServerUrl(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(SERVER_URL_KEY);
    return stored ?? DEFAULT_SERVER_URL;
  } catch {
    return DEFAULT_SERVER_URL;
  }
}

export async function setServerUrl(url: string): Promise<void> {
  await AsyncStorage.setItem(SERVER_URL_KEY, url.replace(/\/$/, ''));
}

async function parseJson<T>(response: Response): Promise<T> {
  if (response.ok) return response.json() as Promise<T>;
  let detail = `HTTP ${response.status}`;
  try {
    const payload = (await response.json()) as { detail?: string };
    if (payload?.detail) detail = payload.detail;
  } catch {
    // fallback to status text
  }
  throw new Error(detail);
}

/** Pobiera pełny payload sieci z /api/network i zapisuje w cache. */
export async function fetchNetwork(): Promise<NetworkPayload> {
  const base = await getServerUrl();
  const response = await fetch(`${base}/api/network`, {
    headers: { Accept: 'application/json' },
  });
  const data = await parseJson<NetworkPayload>(response);
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // cache write failure is non-fatal
  }
  return data;
}

/** Zwraca dane z cache (do trybu offline), lub null jeśli brak. */
export async function fetchNetworkCached(): Promise<NetworkPayload | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as NetworkPayload;
  } catch {
    return null;
  }
}

/** Ustawia stan łącznika i zwraca slim update payload. */
export async function setSwitchState(
  switchId: number,
  closed: boolean,
): Promise<NetworkPayload> {
  const base = await getServerUrl();
  const response = await fetch(`${base}/api/switches/${switchId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ closed }),
  });
  return parseJson<NetworkPayload>(response);
}

/** Resetuje topologię do stanu bazowego. */
export async function resetTopology(): Promise<NetworkPayload> {
  const base = await getServerUrl();
  const response = await fetch(`${base}/api/topology/reset`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  return parseJson<NetworkPayload>(response);
}
