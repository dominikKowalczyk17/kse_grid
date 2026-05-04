# Plan: powerflow dla wysp + fundament pod blackout i odbudowę

## Status na teraz
Ten dokument jest **wyłącznie planem do przedstawienia i omówienia**.  
Na tym etapie **nie wykonujemy implementacji w kodzie repozytorium**.

## Problem i kierunek
Obecnie aplikacja już umie rozcinać topologię switchami i liczyć metryki wysp (`islandCount`, `unsuppliedBusCount`), ale sam load flow jest liczony jednym wywołaniem `runpp()` dla całej sieci roboczej. To utrudnia scenariusze awaryjne: po rozłączeniu na wyspy chcemy liczyć każdą wyspę niezależnie (z informacją, które wyspy są zasilone, które są blackout), a później symulować sekwencję podnoszenia systemu.

Proponowane podejście: dodać warstwę **island-aware powerflow**, która:
1. buduje wyspy z aktualnej topologii (respect_switches),
2. klasyfikuje wyspy na zasilone / niezasilone,
3. liczy PF tylko dla wysp możliwych do zasilenia,
4. zwraca jawny status per-wyspa do API/UI.

## Co już jest w kodzie (stan obecny)
- `matpower.seed_operational_switches()` dodaje switche na końcach linii/trafo — topologię można dynamicznie rozcinać.
- `switching.SwitchingSession` po każdej zmianie switcha robi globalne `pp.runpp()` i publikuje payload.
- `serializer._compute_topology()` już liczy komponenty spójne (wyspy), bus-y niezasilone i metryki zbiorcze.
- Frontend (`switching-panel`) pokazuje liczbę wysp oraz niezasilone wyspy/busy, ale brak statusu obliczeń per wyspa i brak trybu „blackout restoration”.

## Plan implementacji

### 1) Silnik obliczeń wyspowych (backend)
- Pliki: `kse_grid/switching.py` (+ ewentualnie wydzielenie helpera np. `kse_grid/island_powerflow.py`).
- Dodać etap analizy wysp przed load flow:
  - wykrycie wysp na aktualnym `working_net`,
  - wykrycie źródeł odniesienia (ext_grid/slack gen) per wyspa,
  - klasyfikacja: `energized`, `unsupplied`, `partial` (jeśli PF nie zbiega).
- Uruchamiać load flow dla wysp, które mają warunki zasilenia; wyspy bez źródła oznaczać jako blackout bez traktowania tego jako błąd całej sesji.
- Ustalić spójne zasady agregacji wyniku sesji (np. „częściowy sukces”, gdy część wysp zbiega).

#### Snippet (szkielet backendu)
```python
# kse_grid/switching.py (koncepcja)
from pandapower.topology import create_nxgraph
import networkx as nx
import pandapower as pp

def run_island_powerflow(net, options):
    graph = create_nxgraph(net, respect_switches=True, include_out_of_service=False, multi=False)
    islands = [sorted(comp) for comp in nx.connected_components(graph)]
    island_results = []

    for bus_ids in islands:
        has_source = island_has_slack_or_extgrid(net, bus_ids)
        if not has_source:
            island_results.append({
                "status": "unsupplied",
                "bus_ids": bus_ids,
                "converged": False,
                "message": "Brak źródła odniesienia w wyspie.",
            })
            continue

        sub = build_subnet_for_island(net, bus_ids)  # helper: aktywuj elementy tylko z tej wyspy
        try:
            pp.runpp(sub, **options, calculate_voltage_angles=True, init="flat")
            merge_results_back(net, sub, bus_ids)     # helper: wpisz res_* dla tej wyspy
            island_results.append({"status": "converged", "bus_ids": bus_ids, "converged": True})
        except Exception as exc:
            mark_island_results_empty(net, bus_ids)   # helper: NaN / brak wyników tylko dla tej wyspy
            island_results.append({
                "status": "not_converged",
                "bus_ids": bus_ids,
                "converged": False,
                "message": str(exc),
            })

    return island_results
```

### 2) Model danych i API statusów wysp
- Pliki: `kse_grid/serializer.py`, `kse_grid/web_server.py`.
- Rozszerzyć payload `topology` o listę statusów wysp:
  - identyfikator wyspy,
  - liczba busów,
  - czy ma slack/source,
  - status PF (`converged`, `unsupplied`, `not_converged`),
  - ewentualny komunikat błędu.
- Zachować zgodność wsteczną obecnych pól (`islandCount`, `unsuppliedBusCount`, itd.).

#### Snippet (kontrakt payloadu)
```json
{
  "topology": {
    "islandCount": 3,
    "energizedIslandCount": 2,
    "unsuppliedIslandCount": 1,
    "islands": [
      {
        "id": 1,
        "busCount": 120,
        "hasSlack": true,
        "status": "converged",
        "converged": true,
        "message": null
      },
      {
        "id": 2,
        "busCount": 37,
        "hasSlack": false,
        "status": "unsupplied",
        "converged": false,
        "message": "Brak źródła odniesienia."
      }
    ]
  }
}
```

### 3) Prezentacja i obsługa w UI
- Pliki: `kse_grid/web/components/switching-panel.js` (+ ewentualnie `selection-card.js`).
- Pokazać per-wyspa status operacyjny i odróżnić:
  - wyspy niezasilone (blackout),
  - wyspy zasilone i zbieżne,
  - wyspy problematyczne (brak zbieżności).
- Dodać czytelne komunikaty sesji, które nie maskują sytuacji „część sieci działa, część blackout”.

#### Snippet (UI statusów wysp)
```js
// kse_grid/web/components/switching-panel.js (fragment koncepcji)
const islandBadgeClass = (island) => {
  if (island.status === 'converged') return 'good';
  if (island.status === 'unsupplied') return 'bad';
  return 'warn';
};
```

### 4) Fundament pod scenariusze blackoutu i odbudowy
- Pliki: backend session layer (`switching.py`) + API.
- Zdefiniować strukturę „scenariusza” (kolejne akcje łączeniowe + opcjonalne aktywowanie źródeł black-start).
- Dodać możliwość wykonania krok-po-kroku (replay) i zapisu stanu po każdym kroku.
- To umożliwi kolejną iterację: automatyczna strategia podnoszenia sieci.

#### Snippet (model scenariusza)
```json
{
  "scenarioId": "blackout-restore-001",
  "steps": [
    { "action": "open_switch", "switchId": 1452 },
    { "action": "enable_source", "kind": "gen", "elementId": 17, "mode": "blackstart" },
    { "action": "close_switch", "switchId": 1452 }
  ]
}
```

### 5) Testy i kryteria akceptacji
- Dodać testy backendowe dla:
  - rozcięcia na kilka wysp (min. jedna zasilona + jedna blackout),
  - braku globalnej awarii API, gdy tylko część wysp jest niezasilona,
  - poprawnej serializacji statusów wysp.
- Kryterium: rozłączenie sieci na wyspy nie powoduje utraty wyników dla zasilonych wysp i jest jawnie raportowane dla blackout wysp.

## Ryzyka / decyzje do potwierdzenia
- Definicja „liczy się dla wysp”: czy liczymy tylko wyspy mające źródło odniesienia, czy próbujemy automatycznie nadawać tymczasowy slack dla symulacji black-start?
- Zachowanie przy częściowej zbieżności: czy UI ma pokazywać stan jako „częściowo zbieżny” czy „błąd”?
- Zakres pierwszej iteracji: tylko backend+UI statusów, czy od razu także API scenariuszy blackoutu.

## Rekomendacja do prezentacji
Na start projektu (wersja „realistyczna operatorsko”):  
**wyspa bez aktywnego źródła = blackout / unsupplied (bez auto-slack)**.  
Tryb auto-slack warto dodać później jako opcjonalny „tryb badawczy”, żeby nie mieszać realizmu operacyjnego z eksperymentami.
