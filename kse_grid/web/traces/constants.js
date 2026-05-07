/**
 * Stałe domeny: koszyki napięć/obciążeń, identyfikatory meta i magiczne liczby
 * geometrii markerów. Trzymane w jednym miejscu, żeby ułatwić strojenie wyglądu.
 */

export const SELECTION_TRACE_KIND = 'selection';

export const BUS_BINS = [
    { label: '< 0.90 (krytycznie niskie)', test: v => v < 0.90,                color: '#6A1B9A' },
    { label: '0.90–0.95 (niskie)',          test: v => v >= 0.90 && v < 0.95,  color: '#1E88E5' },
    { label: '0.95–1.05 (OK)',              test: v => v >= 0.95 && v <= 1.05, color: '#43A047' },
    { label: '1.05–1.10 (wysokie)',         test: v => v > 1.05  && v <= 1.10, color: '#FB8C00' },
    { label: '> 1.10 (krytycznie wysokie)', test: v => v > 1.10,                color: '#D32F2F' },
];

export const BUS_DEFAULT_COLOR = '#9aa4b2';

export const LINE_BINS = [
    { label: '0-60%',     lower: 0,   upper: 60,       color: '#43A047' },
    { label: '60-100%',   lower: 60,  upper: 100,      color: '#F9A825' },
    { label: '100-150%',  lower: 100, upper: 150,      color: '#FB8C00' },
    { label: '>150%',     lower: 150, upper: Infinity, color: '#D32F2F' },
];

export const TRAFO_BINS = [
    { label: '0-60%',     lower: 0,   upper: 60,       color: '#90CAF9' },
    { label: '60-100%',   lower: 60,  upper: 100,      color: '#26A69A' },
    { label: '100-150%',  lower: 100, upper: 150,      color: '#FFB300' },
    { label: '>150%',     lower: 150, upper: Infinity, color: '#C62828' },
];

// Geometria – wspólny epsilon do detekcji „zerowej długości” odcinka.
export const GEOMETRY_EPSILON = 1e-9;

// Offset pomiędzy środkami dwóch cewek symbolu trafa (IEC 60417-5156).
// Dobrany tak, żeby przy domyślnym zoomie kółka wyraźnie się zachodziły.
export const TRAFO_SYMBOL_OFFSET_GEO = 0.0014;
export const TRAFO_SYMBOL_OFFSET_GRAPH = 0.0045;
// Maksymalna część długości odcinka, na którą może rozjechać się offset.
export const TRAFO_SYMBOL_MAX_LENGTH_FRACTION = 0.45;

// Separacja środków cewek w trybie shapes (jako frakcja promienia kółka).
export const TRAFO_SHAPE_SEPARATION_FACTOR = 0.6;
export const TRAFO_SHAPE_LINE_WIDTH = 1.6;

// Promień kółek symbolu trafa rysowanego jako layout.shapes.
export const TRAFO_RADIUS_DEFAULT = 0.07;
export const TRAFO_RADIUS_GRAPH_FACTOR = 0.00040;
export const TRAFO_RADIUS_GRAPH_MIN = 0.00200;

// Offset markera switcha od busa: marker ma siedzieć blisko busa,
// ale pozostać czytelny i klikalny.
export const SWITCH_OFFSET_LENGTH_FACTOR = 0.08;
export const SWITCH_MIN_OFFSET_GEO = 0.004;
export const SWITCH_MAX_OFFSET_GEO = 0.028;
export const SWITCH_MIN_OFFSET_GRAPH = 0.018;
export const SWITCH_MAX_OFFSET_GRAPH = 0.080;

// Markery hovera nakładane na linie (przezroczysta strefa kliknięcia).
export const LINE_HOVER_MARKER_MIN_SIZE = 8;
export const LINE_HOVER_MARKER_WIDTH_FACTOR = 2.5;
export const LINE_HOVER_MARKER_OPACITY = 0.25;

// Marker hovera nad symbolem trafa.
export const TRAFO_HOVER_MARKER_SHAPES_SIZE = 24;
export const TRAFO_HOVER_MARKER_GEO_SIZE = 12;
export const TRAFO_HOVER_MARKER_GEO_OPACITY = 0.9;
export const TRAFO_LINE_WIDTH = 2.2;

// Marker switcha.
export const SWITCH_MARKER_SIZE = 8;
export const SWITCH_MARKER_OPACITY = 0.95;
export const SWITCH_MARKER_STROKE_WIDTH = 1.5;

// Otoczka i obrys markerów busa.
export const BUS_MARKER_STROKE_WIDTH = 1.2;

// Markery „placeholder” podświetlenia selekcji rysowane na końcu listy traces.
export const SELECTION_OUTER_SIZE = 18;
export const SELECTION_INNER_SIZE = 12;
