# Przewodnik po kodzie

To jest katalog z dokumentacją pisaną prostym językiem, ale z naciskiem na **przepływ danych**: co dana warstwa dostaje na wejściu, co produkuje na wyjściu i jak przekazuje wynik dalej.

Najważniejszy pipeline w projekcie wygląda tak:

```text
plik .m / .geojson
    -> matpower.load_matpower_case(...)
    -> grid.KSEGrid.from_matpower_case(...)
    -> runner.PowerFlowRunner.run()
    -> serializer.serialize_network(...)
    -> web_server.create_app(...)
    -> GET /api/network
    -> frontend Vue/Plotly
```

## Szybki deep dive: co wchodzi, co wychodzi

| Etap | Wejście | Wyjście | Po co istnieje |
|---|---|---|---|
| `matpower` | plik MATPOWER `.m`, opcjonalny sidecar GeoJSON | `pandapowerNet` | ładowanie modelu i normalizacja nazw / geometrii |
| `grid` | ścieżka do case'a | obiekt `KSEGrid` | prosta fasada dla użytkownika biblioteki |
| `runner` | `pandapowerNet` | wyniki load flow w `net.res_*` + raport tekstowy | obliczenia rozpływu mocy |
| `serializer` | `pandapowerNet` | `dict[str, Any]` gotowy do JSON-a | format dla API i frontendu |
| `web_server` | `pandapowerNet` | aplikacja FastAPI i endpoint `/api/network` | wystawienie danych w przeglądarce |

## Przykład end-to-end

Wejście:

```python
from kse_grid.grid import KSEGrid

grid = (
    KSEGrid
    .from_matpower_case("data/case2746wop_TAMU_Updated.m")
    .run_powerflow()
)
```

Stan po załadowaniu i policzeniu:

- `grid.net.bus` - tabela szyn
- `grid.net.line` - tabela linii
- `grid.net.trafo` - tabela transformatorów
- `grid.net.res_bus` - napięcia i kąty po load flow
- `grid.net.res_line` - obciążenia linii
- `grid.net.res_trafo` - obciążenia transformatorów

Wyjście dla API:

```python
from kse_grid.serializer import serialize_network

payload = serialize_network(grid.net)
print(payload["layoutModes"])       # ['graph', 'geo']
print(payload["defaultViewMode"])   # 'geo'
print(payload["stats"]["nBus"])     # 2746
```

## Jak czytać ten katalog

1. Zacznij od [`grid`](grid/README.md), jeśli chcesz zrozumieć publiczne API.
2. Przejdź do [`matpower`](matpower/README.md), jeśli interesuje Cię import `.m` i sidecarów.
3. Potem [`runner`](runner/README.md) i [`serializer`](serializer/README.md), bo tam powstają wyniki dla UI.
4. Na końcu przeczytaj [`web_server`](web_server/README.md), jeśli chcesz zobaczyć jak dane trafiają do przeglądarki.

## Układ katalogów

- [`__init__`](__init__/README.md) - publiczne API pakietu
- [`convert_kse_kmz`](convert_kse_kmz/README.md) - konwersja EPC + KMZ -> GeoJSON
- [`convert_tamu_geo`](convert_tamu_geo/README.md) - konwersja EPC -> GeoJSON
- [`grid`](grid/README.md) - fasada wysokiego poziomu
- [`matpower`](matpower/README.md) - import MATPOWER i geometrii
- [`runner`](runner/README.md) - load flow i raport tekstowy
- [`serializer`](serializer/README.md) - `pandapowerNet` -> JSON dla frontendu
- [`web_server`](web_server/README.md) - FastAPI i statyczny frontend
