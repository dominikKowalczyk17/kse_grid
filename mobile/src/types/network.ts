/** Wyniki rozpływu dla szyny (bus). */
export interface BusResult {
  id: number;
  name: string;
  vn_kv: number;
  /** Napięcie w jednostkach względnych [p.u.] lub null gdy brak wyników. */
  vmPu: number | null;
  vaDeg: number | null;
  lat: number | null;
  lon: number | null;
  genMvar?: number | null;
  inService: boolean;
}

/** Wyniki rozpływu dla linii. */
export interface LineResult {
  id: number;
  name: string;
  fromBus: number;
  toBus: number;
  /** Stopień obciążenia [%]. */
  loading: number;
  pFromMw: number | null;
  inService: boolean;
  stdType: string | null;
  lengthKm: number | null;
}

/** Wyniki rozpływu dla transformatora. */
export interface TrafoResult {
  id: number;
  name: string;
  hvBus: number;
  lvBus: number;
  /** Stopień obciążenia [%]. */
  loading: number;
  pHvMw: number | null;
  inService: boolean;
  stdType: string | null;
}

/** Stan pojedynczego łącznika. */
export interface SwitchState {
  id: number;
  name: string;
  closed: boolean;
  bus: number;
  element: number;
  etType: string;
}

/** Statystyki diagnostyczne dla napięć. */
export interface VoltageDiagnostics {
  ok: number;
  warn: number;
  bad: number;
  disconnected: number;
}

/** Statystyki diagnostyczne dla obciążeń. */
export interface LoadingDiagnostics {
  ok: number;
  warn: number;
  bad: number;
}

/** Diagnostyka całej sieci. */
export interface NetworkDiagnostics {
  voltage: VoltageDiagnostics;
  loading: LoadingDiagnostics;
}

/** Podstawowe statystyki sieci. */
export interface NetworkStats {
  nBus: number;
  nLine: number;
  nTrafo: number;
  nGen: number;
  nLoad: number;
  nSwitch: number;
}

/** Sumy mocy w sieci. */
export interface NetworkTotals {
  genMw: number | null;
  loadMw: number | null;
  lossMw: number | null;
}

/** Topologia (stan sesji przełączeniowej). */
export interface TopologyState {
  lastRunSucceeded: boolean;
  lastRunMessage: string | null;
  powerflowOptions: {
    algorithm: string;
    max_iteration: number;
    tolerance_mva: number;
  };
}

/** Pełny payload sieci z API /api/network. */
export interface NetworkPayload {
  name: string;
  hasResults: boolean;
  voltageLevels: number[];
  defaultVoltageFilter: number[];
  defaultViewMode: string;
  geoAvailable: boolean;
  stats: NetworkStats;
  totals: NetworkTotals;
  diagnostics: NetworkDiagnostics;
  topology: TopologyState;
  buses: BusResult[];
  lines: LineResult[];
  trafos: TrafoResult[];
  switches: SwitchState[];
}

/** Status napięcia węzła. */
export type VoltageStatus = 'good' | 'warn' | 'bad' | '';
