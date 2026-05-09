import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from 'react';
import type { NetworkPayload, SwitchState } from '@/types/network';
import { fetchNetwork, fetchNetworkCached, setSwitchState, resetTopology } from '@/api/api';
import { useSettings } from './SettingsContext';

interface NetworkContextValue {
  network: NetworkPayload | null;
  isLoading: boolean;
  isOffline: boolean;
  error: string | null;
  topologyBusy: boolean;
  topologyError: string | null;
  reload: () => Promise<void>;
  handleSetSwitch: (switchId: number, closed: boolean) => Promise<void>;
  handleResetTopology: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextValue>({
  network: null,
  isLoading: true,
  isOffline: false,
  error: null,
  topologyBusy: false,
  topologyError: null,
  reload: async () => {},
  handleSetSwitch: async () => {},
  handleResetTopology: async () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const { serverUrl, isLoading: settingsLoading } = useSettings();
  const [network, setNetwork] = useState<NetworkPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topologyBusy, setTopologyBusy] = useState(false);
  const [topologyError, setTopologyError] = useState<string | null>(null);
  const serverUrlRef = useRef(serverUrl);

  useEffect(() => {
    serverUrlRef.current = serverUrl;
  }, [serverUrl]);

  const applyTopologyUpdate = useCallback((update: Partial<NetworkPayload>) => {
    setNetwork((prev) => {
      if (!prev) return prev;
      const next = { ...prev };

      if ('hasResults' in update) next.hasResults = update.hasResults!;
      if (update.stats) next.stats = update.stats;
      if (update.totals) next.totals = update.totals;
      if (update.diagnostics) next.diagnostics = update.diagnostics;
      if (update.topology) next.topology = update.topology;

      if (Array.isArray(update.switches) && Array.isArray(next.switches)) {
        const byId = new Map(next.switches.map((sw: SwitchState) => [sw.id, sw]));
        for (const patch of update.switches) {
          const sw = byId.get(patch.id);
          if (sw) sw.closed = patch.closed;
        }
        next.switches = [...next.switches];
      }

      if (Array.isArray(update.busResults) && Array.isArray(next.buses)) {
        const byId = new Map(next.buses.map((b) => [b.id, b]));
        for (const patch of (update as any).busResults) {
          const bus = byId.get(patch.id);
          if (!bus) continue;
          bus.vmPu = patch.vmPu ?? null;
          bus.vaDeg = patch.vaDeg ?? null;
          if ('genMvar' in patch) bus.genMvar = patch.genMvar;
        }
        next.buses = [...next.buses];
      }

      if (Array.isArray((update as any).lineResults) && Array.isArray(next.lines)) {
        const byId = new Map(next.lines.map((l) => [l.id, l]));
        for (const patch of (update as any).lineResults) {
          const line = byId.get(patch.id);
          if (!line) continue;
          line.loading = patch.loading ?? 0;
          line.pFromMw = patch.pFromMw ?? null;
        }
        next.lines = [...next.lines];
      }

      if (Array.isArray((update as any).trafoResults) && Array.isArray(next.trafos)) {
        const byId = new Map(next.trafos.map((t) => [t.id, t]));
        for (const patch of (update as any).trafoResults) {
          const trafo = byId.get(patch.id);
          if (!trafo) continue;
          trafo.loading = patch.loading ?? 0;
          trafo.pHvMw = patch.pHvMw ?? null;
        }
        next.trafos = [...next.trafos];
      }

      return next;
    });
  }, []);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const data = await fetchNetwork();
      setNetwork(data);
    } catch (err) {
      const cached = await fetchNetworkCached();
      if (cached) {
        setNetwork(cached);
        setIsOffline(true);
      } else {
        setError(String(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoading) {
      reload();
    }
  }, [settingsLoading, reload, serverUrl]);

  const handleSetSwitch = useCallback(
    async (switchId: number, closed: boolean) => {
      setTopologyBusy(true);
      setTopologyError(null);
      try {
        const update = await setSwitchState(switchId, closed);
        applyTopologyUpdate(update);
      } catch (err) {
        setTopologyError(String(err));
      } finally {
        setTopologyBusy(false);
      }
    },
    [applyTopologyUpdate],
  );

  const handleResetTopology = useCallback(async () => {
    setTopologyBusy(true);
    setTopologyError(null);
    try {
      const update = await resetTopology();
      applyTopologyUpdate(update);
    } catch (err) {
      setTopologyError(String(err));
    } finally {
      setTopologyBusy(false);
    }
  }, [applyTopologyUpdate]);

  return (
    <NetworkContext.Provider
      value={{
        network,
        isLoading,
        isOffline,
        error,
        topologyBusy,
        topologyError,
        reload,
        handleSetSwitch,
        handleResetTopology,
      }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
