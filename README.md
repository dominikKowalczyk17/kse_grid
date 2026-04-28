# kse_grid – Interaktywny plotter sieci elektroenergetycznej

Narzędzie do wizualizacji i analizy rozpływu mocy z plików MATPOWER (`.m`), oparte o [pandapower](https://www.pandapower.org/), FastAPI i Plotly (frontend Vue 3 bez bundlera).

- Wczytuje dowolny plik `.m` (format MATPOWER)
- Liczy rozpływ mocy (algorytm Iwamoto-NR, start AC)
- Otwiera interaktywny dashboard w przeglądarce z filtrami napięć, wyszukiwaniem szyn i kartą szczegółów na wykresie
- Dodatkowo udostępnia `KSEGrid.report()` – tekstowy raport (bilans mocy, top przeciążenia, naruszenia napięcia ±5 % `Un`) drukowany w terminalu

![dashboard preview](docs/03-materialy-zrodlowe/kse-atlas/preview.png)

---

## Spis treści

1. [Szybki start na macOS](#szybki-start-na-macos)
2. [Instalacja](#instalacja)
3. [Uruchomienie](#uruchomienie)
4. [Użycie z poziomu kodu](#użycie-z-poziomu-kodu)
5. [Dashboard](#dashboard)
6. [Struktura projektu](#struktura-projektu)
7. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## Szybki start na macOS

```bash
# 1. Zainstaluj menedżer pakietów uv (jednorazowo)
curl -LsSf https://astral.sh/uv/install.sh | sh

# 2. Po zakończeniu instalacji ZRESTARTUJ Terminal (zamknij i otwórz ponownie),
#    żeby polecenie `uv` było widoczne. Sprawdź:
uv --version

# 3. Pobierz projekt z GitHuba
git clone https://github.com/dominikKowalczyk17/kse_grid.git
cd kse_grid

# 4. Uruchom aplikację (uv samo zainstaluje Python 3.13 i wszystkie zależności)
uv run python main.py
```

Po chwili w Terminalu pojawi się komunikat `Uvicorn running on http://127.0.0.1:8050` i automatycznie otworzy się Safari/Chrome z dashboardem. Aby zatrzymać serwer: `Ctrl + C` w Terminalu.

> metoda `KSEGrid.report()` drukuje bilans mocy, top przeciążenia i naruszenia napięcia bezpośrednio w terminalu.

> **Jeśli macOS poprosi o instalację narzędzi developerskich („command line developer tools")** przy `git clone` — kliknij **Install** i poczekaj kilka minut. Jeśli `curl` lub `git` nie działają w ogóle, uruchom `xcode-select --install`.

Dalsze szczegóły (Linux, Windows, instalacja bez `uv`, własne pliki `.m`) — w sekcjach poniżej.

---

## Instalacja

Wymagania:

- **Python 3.13** lub nowszy
- **git**
- Zalecany [uv](https://docs.astral.sh/uv/) – szybki menedżer pakietów. Można też użyć `pip` + `venv`.

### Linux / macOS

```bash
# 1. Zainstaluj uv (jednorazowo)
curl -LsSf https://astral.sh/uv/install.sh | sh
exec $SHELL

# 2. Sklonuj repo i zainstaluj zależności
git clone https://github.com/dominikKowalczyk17/kse_grid.git
cd kse_grid
uv sync

# 3. Aktywuj venv (opcjonalnie – uv run działa bez aktywacji)
source .venv/bin/activate
```

Bez `uv`:

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### Windows (PowerShell)

```powershell
# 1. Zainstaluj Python 3.13 ze https://www.python.org/downloads/windows/
#    Zaznacz „Add python.exe to PATH" w instalatorze.

# 2. Zainstaluj uv
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 3. Zrestartuj PowerShell, potem:
git clone https://github.com/dominikKowalczyk17/kse_grid.git
cd kse_grid
uv sync
.\.venv\Scripts\Activate.ps1
```

> Jeśli PowerShell odmówi aktywacji skryptu:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

Bez `uv`:

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

### Sprawdzenie instalacji

```bash
python -c "import pandapower, plotly, matpowercaseframes; print('OK')"
```

---

## Uruchomienie

```bash
# domyślny plik (data/case3120sp.m)
uv run python main.py

# własny plik .m
uv run python main.py ścieżka/do/case.m
```

Uruchomienie inicjuje load flow (Iwamoto-NR, start AC), generuje layout sieci (spring layout albo geometryczny WGS84 jeśli case go dostarcza) i startuje serwer FastAPI pod `http://127.0.0.1:8050/`. Przeglądarka otwiera się automatycznie. Stop: `Ctrl+C`.

---

## Użycie z poziomu kodu

```python
import kse_grid

# minimum: dashboard w przeglądarce
kse_grid.KSEGrid.from_matpower_case("data/case3120sp.m").run_powerflow().serve()

# z raportem tekstowym (bilans mocy, top 10 linii, naruszenia ±5% Un)
grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
grid.report()
grid.serve()

# bezpośredni dostęp do pandapower
print(grid.net.res_bus.head())
print(grid.net.res_line[grid.net.res_line.loading_percent > 100])

# parametry obliczeń
grid.run_powerflow(
    algorithm="nr",
    max_iteration=100,
    tolerance_mva=1.5,
)
```

---

## Dashboard

Po wejściu na `http://127.0.0.1:8050/`:

- **Lewy panel** – bilans mocy, profil napięciowy, diagnostyka obciążenia gałęzi, histogram rozkładu `U`, podsumowanie sieci, wyszukiwarka szyn, reset widoku, przełącznik trybu (Graf / OpenStreetMap / Atlas KSE), **filtry mocy i obciążenia**, filtry napięć i typów elementów oraz legendy.
- **Tryb Graf** (domyślny) – spring layout w dwuwymiarowej przestrzeni abstrakcyjnej.
- **Tryb OpenStreetMap** – sieć nałożona na szarą mapę (`carto-positron` / `carto-darkmatter`) z zaznaczonym konturem Polski. Aktywny tylko jeśli case ma geometrię WGS84.
- **Tryb Atlas KSE** – widok referencyjny: stacje + linie z atlasu KSE 2019 (OpenInfraMap / OSM), bez modelu pandapower. Pozwala wzrokowo zweryfikować, czy dataset TAMU pokrywa się z rzeczywistą topologią KSE. Kolory: przesył NN (PSE) – czerwony, dystrybucja 110 kV (OSD) – niebieski, linie blokowe / JW – szary kreskowany.
- **Motyw jasny / ciemny** – przełącznik 🌞 / 🌙 w prawym górnym rogu nagłówka. Ustawienie zapamiętywane w `localStorage`.
- **Filtry mocy i obciążenia** (sekcja w sidebarze):
  - **Min. obciążenie linii / trafo** – ukrywa gałęzie poniżej zadanego procenta. Szyny pozostawione bez żadnej widocznej linii też znikają.
  - **Min. moc na szynie** – pokazuje tylko szyny, gdzie `max(|P obc.|, |P gen.|)` przekracza próg (MW). Linie do ukrytych szyn również znikają.
- **Kolor linii i transformatorów** = obciążenie prądowe wg progu PSE 150 %:
  - 🟢 0–60 % → 🟡 60–100 % → 🟠 100–150 % → 🔴 > 150 % (przeciążenie).
- **Symbol transformatora** – zgodny z normą **IEC 60417-5156** (dwa przecinające się okręgi).
- **Kolor węzłów (szyn)** = napięcie `Um` w binach traffic-light:
  - 🟣 < 0.90 p.u. (krytycznie niskie)
  - 🔵 0.90 – 0.95 (niskie)
  - 🟢 0.95 – 1.05 (OK)
  - 🟠 1.05 – 1.10 (wysokie)
  - 🔴 > 1.10 p.u. (krytycznie wysokie)
- **Filtry napięć** – presety (`Rdzeń 400/220`, `110 kV`, `Wszystkie`) + checklisty per poziom. Domyślnie startujemy z rdzeniem 400/220 kV.
- **Checklisty elementów** – `Linie`, `Transformatory`, `Szyny`.
- **Interakcja:** klik = karta szczegółów, klik w tło = usunięcie zaznaczenia, wyszukiwarka = centrowanie, scroll = zoom, drag = pan. Skróty: `R` reset widoku, `Esc` wyczyść zaznaczenie.

### Tryb mapowy z paczek TAMU

Pliki `.m` od [TAMU Polish Grid](https://electricgrids.engr.tamu.edu/electric-grid-test-cases/polish-grid/) **nie zawierają geo** w samym MATPOWER. Współrzędne stacji 400/220 kV znajdują się w pliku PowerWorld `.EPC` z paczki TAMU. Konwertujemy je do pliku pomocniczego GeoJSON:

```bash
uv run python -m kse_grid.convert_tamu_geo "/path/case.EPC" --out data/case.geojson
```

#### Lepsza dokładność z atlasem KSE (KMZ)

Współrzędne TAMU z `.EPC` są przybliżone (centra stacji 400/220 kV). Jeśli masz atlas KSE w formacie KMZ (np. `KSE_2019.kmz` z OpenInfraMap / OSM), możesz dopasować nazwy stacji TAMU do polskich nazw z KMZ:

```bash
uv run python -m kse_grid.convert_kse_kmz \
  --epc "/path/case.EPC" \
  --kmz "/path/KSE_2019.kmz" \
  --out data/case.geojson
```

Wynikowy plik pomocniczy zawiera w `properties.source` znacznik `"kmz"` (dokładne coords z KMZ) lub `"epc"` (fallback z TAMU EPC). Dopasowanie korzysta z normalizacji nazw (usunięcie diakrytyków, kodów PowerWorld i fuzzy match `difflib`). Stroj `--cutoff` (domyślnie 0.86) reguluje agresywność dopasowania.

Plik pomocniczy musi mieć tę samą nazwę co `.m` (np. `case2746wop_TAMU_Updated.m` ↔ `case2746wop_TAMU_Updated.geojson`). Po konwersji:

```bash
uv run python main.py data/case2746wop_TAMU_Updated.m
```

#### Atlas KSE 2019 jako warstwa referencyjna

Pliki `kse_grid/web/kse_atlas_points.geojson` i `kse_grid/web/kse_atlas_lines.geojson` są wbudowane w aplikację i zasilają tryb **Atlas KSE** w sidebarze. Można je odświeżyć z `KSE_2019.kmz`:

```bash
uv run python -m kse_grid.convert_kse_atlas docs/03-materialy-zrodlowe/kse-atlas/KSE_2019.kmz
```

### Obsługiwane pliki pomocnicze GeoJSON

- `data/<stem>.geojson`
- `data/<stem>.json`
- `data/<stem>_wgs84.geojson`
- `data/<stem>_geo.geojson`

Format: `FeatureCollection` z punktami `Point` dla szyn. Dopasowanie po `properties.bus`, `bus_id`, `pp_index`, `id` albo po nazwie (`name`, `bus_name`, `station`).

---

## Struktura projektu

```
kse_grid/
├── main.py                        # punkt startowy – ładuje .m i uruchamia serwer
├── data/
│   ├── case3120sp.m               # przykładowy plik MATPOWER (3120 węzłów)
│   └── case2746wop_TAMU_Updated.* # case TAMU + sidecar .geojson
├── docs/
│   └── preview.png
└── kse_grid/
    ├── __init__.py                # publiczne API pakietu
    ├── grid.py                    # KSEGrid – główna klasa
    ├── matpower.py                # wczytywanie .m + sidecar GeoJSON
    ├── runner.py                  # obliczenia load flow + raport tekstowy
    ├── serializer.py              # net → JSON dla frontendu
    ├── web_server.py              # FastAPI + statyczne pliki frontendu
    ├── convert_tamu_geo.py        # konwerter PowerWorld .EPC → GeoJSON sidecar
    └── web/
        ├── index.html
        ├── main.js                # Vue 3 app (sidebar, wykres, interakcje)
        ├── traces.js              # builder śladów Plotly (graph + scattermapbox)
        ├── icons.js
        ├── style.css
        └── poland_border.geojson  # nakładka konturu Polski w trybie OSM
```

---

## Rozwiązywanie problemów

| Problem                                                           | Rozwiązanie                                                                                                                                                      |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ModuleNotFoundError: matpowercaseframes`                         | Środowisko nie aktywne lub `uv sync` nie wykonany. Aktywuj venv i powtórz.                                                                                       |
| Port 8050 zajęty                                                  | Uruchom `serve(port=...)` albo zwolnij port 8050.                                                                                                                |
| `pandapower` zgłasza ostrzeżenia o `BR_B` lub „fake transformers" | Normalne dla `case3120sp.m` – artefakt pliku MATPOWER, wynik PF jest poprawny.                                                                                   |
| Naruszenia napięcia i przeciążenia w `case3120sp`                 | To celowe – publiczny przypadek jest naciskiem stresowym, nie odwzorowaniem rzeczywistego stanu sieci.                                                           |
| Layout grafu trwa długo                                           | Spring layout dla 3120 węzłów to ~7 s, jednorazowo per uruchomienie. W trybie OSM nie ma kosztu layoutu, ale potrzebne są współrzędne WGS84.                     |
| Chip „OpenStreetMap" jest zablokowany                             | Case nie ma geometrii. Dla case'ów TAMU wygeneruj sidecar z `.EPC`: `uv run python -m kse_grid.convert_tamu_geo path/do/case.EPC --out data/case.geojson`.       |
| TAMU `.m` wywala `IndexError` na `gencost`                        | Loader automatycznie usuwa blok `mpc.gencost` jeśli pandapower nie potrafi go zaimportować (poly cost > 2nd order). To bezpieczny fallback – PF nadal się liczy. |
| TAMU `.m` wywala `No reference bus`                               | Loader automatycznie reaktywuje pierwszy `ext_grid` lub ustawia `slack=True` na pierwszym aktywnym generatorze.                                                  |
| Windows: PowerShell odmawia aktywacji venv                        | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, potem ponownie aktywuj.                                                                  |
| Brak `python3.13` w systemie                                      | Linux: `uv python install 3.13`. Windows: pobierz z [python.org](https://www.python.org/downloads/).                                                             |

---
