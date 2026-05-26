# Wyjaśnienie Architektury Codebase'u – KSE Grid

## Spis treści

1. [Przegląd ogólny](#przegląd-ogólny)
2. [Architektura wysokiego poziomu](#architektura-wysokiego-poziomu)
3. [Przepływ danych: od wczytania do wizualizacji](#przepływ-danych-od-wczytania-do-wizualizacji)
4. [Moduły i ich odpowiedzialność](#moduły-i-ich-odpowiedzialność)
5. [Kluczowe komponenty](#kluczowe-komponenty)
6. [Model pracy sesji edycji](#model-pracy-sesji-edycji)
7. [API REST](#api-rest)
8. [Wyzwania architektoniczne i rozwiązania](#wyzwania-architektoniczne-i-rozwiązania)

---

## Przegląd ogólny

**KSE Grid** to interaktywna aplikacja do analizy i wizualizacji sieci elektroenergetycznych. Projekt łączy trzy główne warstwy:

1. **Backend Python** – ładowanie danych MATPOWER, obliczenia load flow w pandapower, manipulacja topologią
2. **API REST (FastAPI)** – serializacja stanu sieci do JSON-a, obsługa operacji topologicznych
3. **Frontend JavaScript/Vue 3** – renderowanie grafów (PixiJS), mapy (Plotly/OpenStreetMap), interfejs użytkownika

### Główne zależności

- **pandapower** – framework do modelowania i obliczeń sieci elektroenergetycznych
- **matpowercaseframes** – import plików MATPOWER (`.m`) z ich konwersją do pandas DataFrame
- **FastAPI + uvicorn** – serwer HTTP
- **Vue 3** – framework frontendu
- **PixiJS, Plotly** – renderowanie wizualizacji

### Techniczny stos

```
Warstwa:              Technologia
────────────────────────────────────────
Frontend              Vue 3 + PixiJS + Plotly
HTTP Server           FastAPI + Uvicorn
Serializacja          Pydantic + JSON
Backend obliczeń      pandapower (Pandas DataFrames)
Wczytywanie danych    matpowercaseframes + GeoJSON
```

---

## Architektura wysokiego poziomu

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           UŻYTKOWNIK                                     │
│                                                                          │
│                    Przeglądarka HTTP (Vue 3 + PixiJS)                   │
└─────────────────────┬──────────────────────────────────────────────────┘
                      │
                      │ JSON + WebSocket
                      ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                      WARSTWA API (FastAPI)                              │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ GET  /api/network             ← pobranie pełnego stanu sieci      │ │
│  │ PATCH /api/switches/{id}      ← przełączenie odłącznika          │ │
│  │ PATCH /api/elements/{kind}    ← edycja parametrów elementu        │ │
│  │ POST  /api/powerflow/recalculate ← przeliczenie LF               │ │
│  │ POST  /api/topology/reset     ← reset topologii                  │ │
│  │ POST  /api/network/upload     ← wgranie nowego case'a            │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────┬──────────────────────────────────────────────────────┬──────────┘
         │                                                       │
         │ Serializacja (JSON)                                   │ Deserializacja
         ↓                                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│              SESJA EDYCJI (SwitchingSession)                            │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ • base_net     – sieć po imporcie (punkt referencyjny)            │ │
│  │ • working_net  – kopia robocza (zmienia się po operacjach)        │ │
│  │ • layout grafu – pozycje węzłów (stale po imporcie)              │ │
│  │ • opcje LF     – ustawienia algorytmu (tracowane)                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└────────┬──────────────────────────────────────────────────────┬──────────┘
         │                                                       │
         │ Mutacja + Obliczenia                                 │ Legit stan
         ↓                                                       ↓
┌─────────────────────────────────────────────────────────────────────────┐
│             JĄDRO BIZNESOWE (pandapower)                                │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ • Ładowanie:   load_matpower_case()                               │ │
│  │                → import pliku .m                                  │ │
│  │                → normalizacja nazw / slack bus                    │ │
│  │                → załadowanie geo sidecar'ów                       │ │
│  │                → inicjalizacja stanów switchy                     │ │
│  │                                                                   │ │
│  │ • Obliczenia:  run_powerflow()                                    │ │
│  │                → pandapower.runpp() (Newton-Raphson)              │ │
│  │                → generowanie wyników res_bus, res_line, ...       │ │
│  │                                                                   │ │
│  │ • Manipulacja: apply_element_update(), _set_switch_state()       │ │
│  │                → zmiana parametrów elementów                      │ │
│  │                → przełączanie stanów switchy                      │ │
│  │                                                                   │ │
│  │ • Topologia:   compute_topology() – wyspy, brak zasilania        │ │
│  └────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Przepływ danych: od wczytania do wizualizacji

### 1. Uruchomienie aplikacji

```python
# main.py
kse_grid.KSEGrid.from_matpower_case("data/case.m")
    .run_powerflow()
    .serve()
```

### 2. Ładowanie pliku MATPOWER

```
load_matpower_case(case_file)
    ├─ import_matpower_case()        # matpowercaseframes → DataFrame
    ├─ normalize_network()           # nazwy, slack bus
    ├─ load_geo_sidecar()            # GeoJSON z geo_source
    └─ seed_operational_switches()   # inicjalizacja stanów switchy
    
    ↓ wynik: pp.pandapowerNet
```

Proces:
1. **matpowercaseframes** parsuje plik `.m` MATPOWER na DataFrames (bus, line, trafo, gen, load, ...)
2. **normalize_network()** uzupełnia brakujące pola (nazwy szyn, typ slack bus'a)
3. **load_geo_sidecar()** szuka pliku `case.geojson` lub wariantów, by dodać współrzędne WGS84
4. **seed_operational_switches()** ustawia stany początkowe przełączników (typowo zamknięte = connected)

### 3. Obliczenia load flow

```
run_powerflow(net, algorithm="nr", max_iteration=100, tolerance_mva=1e-6)
    ├─ pandapower.runpp()          # Newton-Raphson lub DC
    └─ generowanie tabel wynikowych (res_bus, res_line, res_trafo, ...)
    
    ↓ wynik: PowerflowResult(converged, message)
```

Po konwergencji sieć zawiera:
- `net.res_bus` – napięcie (vm_pu, va_degree), moc (p_mw, q_mvar)
- `net.res_line` – obciążenie (loading_percent), przepływy mocy
- `net.res_trafo` – obciążenie transformatorów, przepływy
- `net.res_gen` – generacja (p_mw, q_mvar)
- `net.res_load` – pobór mocy

### 4. Serializacja do JSON

```
serialize_network(net, graph_positions=None)
    ├─ compute_graph_positions()       # spring layout (Fruchterman-Reingold)
    ├─ _extract_geo_positions()        # WGS84 współrzędne (jeśli dostępne)
    ├─ _compute_stats()                # liczba elementów, napięcia, moc
    ├─ _compute_diagnostics()          # naruszenia napięcia + przeciążenia
    ├─ _serialize_buses()              # szyny z wynikami
    ├─ _serialize_lines()              # linie z obciążeniem
    ├─ _serialize_trafos()             # transformatory
    ├─ _serialize_switches()           # odłączniki
    ├─ _serialize_gens(), _serialize_loads(), ...
    └─ _compute_topology()             # wyspy, brak zasilania
    
    ↓ wynik: dict[str, Any] (JSON-compatible)
```

Wynik zawiera:
```json
{
  "name": "case_name",
  "hasResults": true,
  "stats": { "numBuses": 123, "numLines": 456, ... },
  "buses": [...],
  "lines": [...],
  "trafos": [...],
  "diagnostics": { "voltageViolations": [...], "overloaded": [...] },
  "bounds": { "minX": -10, "maxX": 100, ... },
  "geoView": { ... }
}
```

### 5. Wysłanie do frontendu

```
GET /api/network
    ├─ SwitchingSession.build_payload()
    ├─ serialize_network(working_net)
    └─ zwrot JSON do Vue
```

Frontend ładuje tę strukturę i renderuje ją w PixiJS (graf) / Plotly (mapa).

---

## Moduły i ich odpowiedzialność

### `kse_grid/`

| Moduł | Ścieżka | Odpowiedzialność |
|-------|--------|------------------|
| **grid.py** | `kse_grid/grid.py` | Fasada biblioteki – `KSEGrid` (from_matpower_case, run_powerflow, serve) |
| **web_server.py** | `kse_grid/web_server.py` | FastAPI app + REST API endpoints |

### `kse_grid/loading/`

Proces wczytywania danych MATPOWER i przygotowania sieci.

| Moduł | Odpowiedzialność |
|-------|------------------|
| **matpower.py** | Orkiestrator: `load_matpower_case()` – łączy import, normalizację, geo, switche |
| **matpower_importer.py** | Niski poziom: parsowanie `.m` + obsługa błędów (gencost) |
| **network_normalizer.py** | Uzupełnianie brakujących pól, ustawienie slack bus'a |
| **geojson_loader.py** | Załadowanie sidecar'ów GeoJSON – współrzędne WGS84 |

### `kse_grid/powerflow/`

Obliczenia load flow i raportowanie.

| Moduł | Odpowiedzialność |
|-------|------------------|
| **runner.py** | `PowerFlowRunner` – fasada (run, summary, voltage_violations) |
| **engine.py** | Niski poziom: `run_powerflow()` → pandapower.runpp() |
| **report.py** | Formatowanie wyników tekstowych dla terminala |

### `kse_grid/topology/`

Operacje na topologii sieci – przełączanie switchy, edycja parametrów.

| Moduł | Odpowiedzialność |
|-------|------------------|
| **switching.py** | `SwitchingSession` – zarządzanie sesją edycji, model base/working net |
| **element_editing.py** | `apply_element_update()`, `read_element_params()` – CRUD parametrów elementów |

### `kse_grid/serialization/`

Konwersja pandapower net → JSON dla frontendu.

| Moduł | Odpowiedzialność |
|-------|---|
| **serializer.py** | Orkiestrator: `serialize_network()`, `serialize_topology_update()` |
| **element_serializers.py** | Serializacja poszczególnych typów elementów (bus, line, trafo, ...) |
| **graph_layout.py** | Spring layout (Fruchterman-Reingold) dla pozycji węzłów |
| **geo_positions.py** | Konwersja WGS84 → viewport; obliczenia dla widoku mapy |
| **network_stats.py** | Statystyki sieci (liczba elementów, sumy mocy) |
| **diagnostics.py** | Analiza naruszeń (napięcie poza ±5%, obciążenie > 100%) |
| **topology_analysis.py** | Wyspy, szyny bez zasilania, analiza spójności |

### `kse_grid/converters/`

Konwertery zewnętrznych formatów – TAMU EPC, KMZ atlas.

| Moduł | Odpowiedzialność |
|-------|---|
| **tamu_geo.py** | TAMU EPC → GeoJSON |
| **kse_kmz.py** | Dopasowanie sieci do atlasu KSE (EPC + KMZ) |
| **kse_atlas.py** | KMZ atlasu KSE → warstwy referencyjne |

### `kse_grid/web/`

Frontend Vue 3.

| Struktura | Rola |
|-----------|------|
| `main.js` | Punkt startowy, inicjalizacja Vue |
| `components/` | Komponenty Vue (app-root, sidebar, graph-panel, detail-card, ...) |
| `lib/api.js` | Wrapper HTTP do API REST |
| `lib/composables/` | Vue composables (use-network-state, use-topology-ops, ...) |
| `renderers/pixi/` | Warstwa PixiJS do renderowania grafu |
| `traces/` | Konfiguracje warstw Plotly dla widoku mapy |
| `styles/` | CSS podzielony wg komponentów |

---

## Kluczowe komponenty

### 1. KSEGrid (kse_grid/grid.py)

Fasada główna biblioteki. Pozwala użytkownikowi na łatwy chain API:

```python
grid = kse_grid.KSEGrid.from_matpower_case("case.m") \
    .run_powerflow() \
    .serve()

# Dostęp do obiektu pandapower
net = grid.net
print(grid.net.res_bus.head())
```

**Główne metody:**
- `from_matpower_case(case_file, f_hz=50)` – ładowanie case'a
- `run_powerflow(algorithm, max_iteration, tolerance_mva)` – obliczenia
- `report()` – druk podsumowania w terminalu
- `serve(host, port, auto_open)` – uruchomienie serwera

### 2. SwitchingSession (kse_grid/topology/switching.py)

Zarządza sesją edycji sieci. Implementuje model:

```
base_net ────┐ (deepcopy)
             ├─ working_net (kopii robocza, mutowana przez API)
             └─ graph_positions (stałe pozycje na całą sesję)
```

**Model pracy:**
- Każda zmiana (switch, edycja elementu) jest wykonywana na kopii
- Jeśli coś pójdzie źle, oryginał `working_net` pozostaje niezmieniony
- Layout grafowy (`_graph_positions`) jest liczony raz dla base_net i reuse'owany
- Frontend zachowuje ręczne edycje pozycji szyn (drag, łamanie linii) poprzez incremental updates

**Główne metody:**
- `build_payload()` – pełny JSON sieci
- `build_update_payload()` – slim JSON zmian (tylko wyniki, bez layout)
- `set_switch_state(switch_id, closed)` – przełączenie odłącznika
- `update_element(kind, element_id, fields)` – edycja parametrów
- `recalculate()` – przeliczenie load flow
- `reset()` – reset do stanu bazowego

### 3. PowerFlowRunner (kse_grid/powerflow/runner.py)

Fasada do obliczeń load flow i raportowania.

```python
runner = PowerFlowRunner(net)
runner.run(algorithm="nr", max_iteration=100)
runner.summary()  # druk w terminalu
violations = runner.voltage_violations()  # DataFrame naruszeń napięcia
```

### 4. FastAPI app (kse_grid/web_server.py)

REST API z 6 glównymi endpointami:

```
GET    /api/network                 – pobranie pełnej sieci
PATCH  /api/switches/{id}           – zmiana stanu odłącznika
POST   /api/powerflow/recalculate   – przeliczenie load flow
POST   /api/topology/reset          – reset topologii
GET    /api/elements/{kind}/{id}    – pobranie parametrów elementu
PATCH  /api/elements/{kind}/{id}    – zmiana parametrów elementu
POST   /api/network/upload          – wgranie nowego pliku .m
GET    /api/elements/schema         – schemat edytowalnych pól
```

**Stan aplikacji:**
```python
state = {"session": SwitchingSession(net)}
state_lock = Lock()  # thread-safe
```

Każde żądanie operuje na `state["session"]`.

---

## Model pracy sesji edycji

### Problem:

Jeśli bezpośrednio mutuję `net` w miejscu, to po nieudanym `runpp()` sieć pozostaje w stanie pół-zmienionego. Frontend pokazuje stare dane. Błędy są trudne do debugowania.

### Rozwiązanie: base/working model

```python
class SwitchingSession:
    def __init__(self, net):
        self.base_net = deepcopy(net)      # punkt referencyjny
        self.working_net = deepcopy(net)   # kopia robocza
        self._graph_positions = compute_graph_positions(base_net)
    
    def _stage_change(self, mutator, pending_message, changed_element=None):
        # 1. Tworzymy kandydata (kopię working_net)
        candidate = deepcopy(self.working_net)
        
        # 2. Wykonujemy mutację na kopii
        mutator(candidate)
        _clear_results(candidate)
        
        # 3. Jeśli coś pójdzie źle → wyjątek, working_net nienaruszony
        # 4. Jeśli sukces → aktualizujemy working_net
        self.working_net = candidate
        self._pending_recalc = True
        
        return self.build_update_payload()
```

**Benefity:**
- Atomowość operacji – lub całkowita zmiana, lub żadna
- Łatwe debugowanie – każda kopia jest niezależna
- Możliwość undo – `reset()` to `working_net = deepcopy(base_net)`

### Zachowywanie layoutu grafu

Frontend może ręcznie edytować pozycje węzłów i łamać linie. Jeśli po każdej operacji przywrócilibyśmy pełny JSON z nowymi pozycjami, stralibyśmy te edycje.

**Rozwiązanie:**
```python
def serialize_network(...):
    # Pełny payload z pozycjami, geometriami, wszystkim
    return { "buses": [...], "lines": [...], "bounds": {...} }

def serialize_topology_update(...):
    # Slim payload – TYLKO wyniki, bez layout
    # Frontend: mutate w miejscu istniejące obiekty
    return {
        "hasResults": true,
        "stats": {...},
        "busResults": [...],  # tylko vm_pu, va_degree
        "lineResults": [...], # tylko loading, przepływy
        "switches": [...]
    }
```

Frontend po przełączeniu switcha:
1. Wysyła żądanie `PATCH /api/switches/{id}`
2. Otrzymuje slim update
3. Aktualizuje istniejące obiekty:
   ```javascript
   const update = response.data;
   for (const busResult of update.busResults) {
       const bus = this.network.buses.find(b => b.id === busResult.id);
       if (bus) {
           bus.vmPu = busResult.vmPu;
           bus.vaDeg = busResult.vaDeg;
           // pozycje x, y nie zostały zmienione!
       }
   }
   ```

---

## API REST

### 1. GET /api/network

Zwraca pełny stan sieci.

**Odpowiedź:**
```json
{
  "name": "case2746wop",
  "hasResults": true,
  "stats": {
    "numBuses": 2746,
    "numLines": 3514,
    "numTrafos": 520,
    "numSwitches": 1025,
    "minVoltage_kv": 0.48,
    "maxVoltage_kv": 765.0
  },
  "buses": [
    {
      "id": 0,
      "name": "Bus_0",
      "vnKv": 138.0,
      "vmPu": 1.05,
      "vaDeg": 0.0,
      "x": 12.5,
      "y": 34.8,
      "xGeo": null,
      "yGeo": null
    },
    ...
  ],
  "lines": [
    {
      "id": 0,
      "name": "Line_0",
      "fromBus": 0,
      "toBus": 1,
      "rOhm": 0.05,
      "xOhm": 0.15,
      "loading": 45.2,
      "pFromMw": 100.0,
      "qFromMvar": 20.0,
      "pToMw": -95.0,
      "qToMvar": -15.0
    },
    ...
  ],
  "diagnostics": {
    "voltageViolations": [
      { "busId": 5, "vmPu": 0.92, "message": "Napięcie poniżej 0.95 p.u." }
    ],
    "overloaded": [
      { "lineId": 10, "loading": 125.5, "message": "Linia: 125.5%" }
    ]
  },
  "topology": {
    "islands": [
      { "id": 0, "buses": [0, 1, 2, 3, ...] },
      { "id": 1, "buses": [100, 101, 102, ...] }
    ],
    "unelidBuses": [5, 6, 7]
  }
}
```

### 2. PATCH /api/switches/{switch_id}

Przełączenie stanu odłącznika i przeliczenie load flow.

**Żądanie:**
```json
{ "closed": true }
```

**Odpowiedź:**
```json
{
  "hasResults": true,
  "stats": {...},
  "busResults": [
    { "id": 0, "vmPu": 1.048, "vaDeg": -0.1 },
    ...
  ],
  "lineResults": [
    { "id": 0, "loading": 45.5, "pFromMw": 101.2, "qFromMvar": 20.5, ... },
    ...
  ],
  "topology": {
    "lastRunSucceeded": true,
    "lastRunMessage": null,
    "pendingRecalc": false
  }
}
```

### 3. POST /api/powerflow/recalculate

Ręczne przeliczenie load flow (po wykonaniu zmian, które nie było przeliczane).

**Odpowiedź:** jak wyżej (slim topology update).

### 4. POST /api/topology/reset

Reset do stanu bazowego.

**Odpowiedź:** pełny JSON sieci (jak GET /api/network).

### 5. GET /api/elements/schema

Schema pól edytowalnych dla każdego typu elementu.

**Odpowiedź:**
```json
{
  "bus": [
    {
      "name": "name",
      "type": "string",
      "value_type": "str",
      "description": "Nazwa szyny"
    },
    {
      "name": "vn_kv",
      "type": "number",
      "value_type": "float",
      "description": "Napięcie znamionowe [kV]"
    },
    ...
  ],
  "line": [
    {
      "name": "r_ohm_per_km",
      "type": "number",
      "value_type": "float",
      "description": "Rezystancja [Ω/km]"
    },
    ...
  ]
}
```

### 6. GET/PATCH /api/elements/{kind}/{element_id}

Pobranie / edycja parametrów konkretnego elementu.

**GET Odpowiedź:**
```json
{
  "kind": "bus",
  "id": 5,
  "params": {
    "name": "Bus_5",
    "vn_kv": 138.0,
    "type": "b",
    "zone": 1
  }
}
```

**PATCH Żądanie:**
```json
{
  "fields": {
    "name": "Bus_5_renamed",
    "vn_kv": 115.0
  }
}
```

**PATCH Odpowiedź:** slim topology update + `changedElement`.

### 7. POST /api/network/upload

Wgranie nowego pliku MATPOWER z poziomu UI.

**Żądanie:** multipart/form-data

```
POST /api/network/upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----

------
Content-Disposition: form-data; name="file"; filename="case2746wop.m"

[binarny zawartość pliku .m]
```

**Odpowiedź:** pełny JSON nowo wgranego case'a (jak GET /api/network).

---

## Wyzwania architektoniczne i rozwiązania

### Wyzwanie 1: Layout grafu vs ręczne edycje użytkownika

**Problem:**
- Spring layout (Fruchterman-Reingold) pozycji węzłów jest kosztowny (~0.5-2 sekundy dla 2746 węzłów)
- Jeśli liczymy layout po każdej operacji, tracimy ręczne edycje użytkownika (drag, łamanie linii)
- Frontend nie ma informacji o nowych pozycjach

**Rozwiązanie:**
- Layout liczymy **raz** przy imporcie, dla base_net
- Pozycje są przechowywane w `SwitchingSession._graph_positions`
- Po przełączeniu switcha/edycji: wysyłamy slim update (bez pozycji)
- Frontend mutuje dane **w miejscu** – zachowuje layout użytkownika

**Kod:**
```python
# backend
def __init__(self, net):
    self._graph_positions = compute_graph_positions(self.base_net)

def build_update_payload(self, changed_element=None):
    # Nie zawiera x, y, bounds – tylko wyniki LF
    return serialize_topology_update(self.working_net, changed_element=changed_element)

# frontend (Vue)
async function switchToggle(switchId, newState) {
    const response = await api.patch(`/api/switches/${switchId}`, { closed: newState });
    const update = response.data;
    
    // Mutuj w miejscu – pozycje niezmienione
    for (const busResult of update.busResults) {
        const bus = this.network.buses.find(b => b.id === busResult.id);
        Object.assign(bus, busResult);  // vm_pu, va_degree, ...
    }
}
```

### Wyzwanie 2: Transakcje atomowe – albo wszystko, albo nic

**Problem:**
- Operacja przełączania switcha + przeliczenie LF to dwie logicznie połączone operacje
- Jeśli `runpp()` nie zbiegnie, switch będzie przełączony, ale dane będą stare – frontend pokazuje sprzeczność
- Debugowanie jest trudne

**Rozwiązanie:**
- Każda operacja używa `deepcopy()` – tworzy niezależną kopię
- Mutacja na kopii – jeśli coś pójdzie źle, oryginał nienaruszony
- Dopiero po sukcesie → `self.working_net = candidate`

**Kod:**
```python
def _stage_change(self, mutator, pending_message, changed_element=None):
    # 1. Tworzymy kandydata (kopię)
    candidate = deepcopy(self.working_net)
    
    # 2. Mutujemy kopię
    mutator(candidate)
    _clear_results(candidate)
    
    # 3. Mutacja mogła rzucić wyjątek – candidate by odrzucony
    # 4. Jeśli ok – zastępujemy working_net
    self.working_net = candidate
    
    self._pending_recalc = True
    self._last_run_succeeded = None
    self._last_run_message = f"{pending_message} Zmiany oczekują na recalc."
    
    return self.build_update_payload(changed_element=changed_element)
```

### Wyzwanie 3: Wielowątkowe żądania HTTP

**Problem:**
- FastAPI może obsługiwać wiele żądań równocześnie (async)
- Jeśli frontend wyśle 2 operacje jednocześnie, mogą konkurować o dostęp do `state["session"]`
- Race condition: operacja B czyta `working_net` z operacji A, które nie zostały zakończone

**Rozwiązanie:**
- Lock (mutex) przy operacjach zmieniających stan

**Kod:**
```python
app = FastAPI()
state = {"session": SwitchingSession(net)}
state_lock = Lock()

@app.patch("/api/switches/{switch_id}")
def patch_switch(switch_id: int, update: SwitchStateUpdate):
    with state_lock:
        payload = state["session"].set_switch_state(switch_id, update.closed)
    return JSONResponse(payload)

@app.post("/api/network/upload")
async def upload_network(file: UploadFile = File(...)):
    # ... parse file ...
    new_net = load_matpower_case(temp_path)
    PowerFlowRunner(new_net).run()
    
    with state_lock:
        state["session"] = SwitchingSession(new_net)
        payload = state["session"].build_payload()
    
    return JSONResponse(payload)
```

### Wyzwanie 4: Utrzymanie stanu parametrów load flow

**Problem:**
- Użytkownik może wybrać inny algorytm (`"dc"` zamiast `"nr"`) lub parametry (`max_iteration=200`)
- Po przełączeniu switcha → przeliczenie LF powinno użyć tych samych parametrów
- Jeśli "zapomnimy" parametrów, frontend będzie zdezorientowany

**Rozwiązanie:**
- `SwitchingSession._powerflow_options` przechowuje opcje
- Po imporcie – zapisz opcje z `load_powerflow_options(net)`
- Przy każdym recalc – użyj zachowanych opcji

**Kod:**
```python
def __init__(self, net):
    self._powerflow_options = load_powerflow_options(net)

def _recalculate_in_place(self, net):
    opts = self._powerflow_options
    result = run_powerflow(
        net,
        algorithm=str(opts["algorithm"]),
        max_iteration=int(opts["max_iteration"]),
        tolerance_mva=float(opts["tolerance_mva"]),
    )

def build_update_payload(self, ...):
    payload = serialize_topology_update(...)
    self._inject_session_state(payload["topology"])
    # Wysłanie opcji LF do frontendu
    return payload
```

### Wyzwanie 5: Serializacja Pandas → JSON

**Problem:**
- pandas DataFrames zawierają `NaN`, `inf`, `None` – JSON nie obsługuje tych wartości
- Indeksy DataFrame mogą być nieciągłe (np. [0, 2, 5, 10]) – JSON wymaga listy

**Rozwiązanie:**
- Helper `to_int(idx)` – konwersja indeksu do int
- Helper `safe_float(val)` – konwersja NaN/inf → None

**Kod:**
```python
def safe_float(value) -> float | None:
    if pd.isna(value) or not np.isfinite(value):
        return None
    return float(value)

def to_int(value) -> int:
    return int(value)

# Użycie
for idx in net.bus.index:
    bus_id = to_int(idx)
    bus_obj = {
        "id": bus_id,
        "vmPu": safe_float(net.res_bus.at[idx, "vm_pu"]),  # → None jeśli NaN
        ...
    }
```

### Wyzwanie 6: Inicjalizacja stanów switchy z pliku MATPOWER

**Problem:**
- Plik MATPOWER zawiera informacje o switchach (status on/off)
- pandapower.runpp() może zmienić status (np. open circuit detection)
- Frontend musi wiedzieć, które switche są zamknięte na starcie

**Rozwiązanie:**
- `seed_operational_switches()` – przeanalizuj topologię i ustaw stany
- Typowo: switche są ustawiane na `closed=True` jeśli łączą dwie szyny

**Kod:**
```python
def seed_operational_switches(net):
    """
    Zainicjalizuj stany switchy na podstawie topologii.
    Domyślnie: switch = closed, chyba że gdzieś powiedziano inaczej.
    """
    for idx in net.switch.index:
        if net.switch.at[idx, "closed"] is None:
            net.switch.at[idx, "closed"] = True
```

---

## Podsumowanie

KSE Grid łączy trzy warstwy:

1. **Wczytywanie** – MATPOWER (.m) → pandapower Net + geo (GeoJSON)
2. **Obliczenia** – load flow (pandapower.runpp) + topologia
3. **Wizualizacja** – serializacja Net → JSON → Frontend (Vue + PixiJS + Plotly)

**Kluczowe elementy:**
- **SwitchingSession** – zarządza base/working model, atomowe operacje
- **Slim updates** – zachowanie layoutu użytkownika (ręczne edycje)
- **FastAPI + REST** – stateless interface do frontendu
- **Thread-safe** – Lock przy operacjach zmieniających stan
- **GeoJSON sidecar'y** – wsparcie dla współrzędnych WGS84
- **Modułowa architektura** – loading, powerflow, topology, serialization

Architektura jest skalowalna – można dodawać nowe rodzaje elementów (HVDC, wind farms, baterje), operacje na topologii (contingency analysis), wizualizacje (heatmapy, animacje) bez ingerencji w rdzeń.
