# KSE Grid – Polish Transmission Network Model

Interaktywne narzędzie do analizy rozpływu mocy w polskiej sieci elektroenergetycznej, oparte o [pandapower](https://www.pandapower.org/) i Plotly. Zawiera:

- **Importer MATPOWER** dla publicznego przypadku `case3120sp` (3120 szyn, 3487 linii, 206 trafo – polski system w lecie 2008, szczyt poranny).
- **Ręcznie zbudowaną topologię KSE 400/220 kV** opartą na publicznych danych PSE (alternatywa do MATPOWER).
- **Dashboard w przeglądarce** z dark theme, filtrami napięć, kolorowaniem obciążenia linii i napięcia szyn.

![dashboard preview](docs/preview.png)

---

## Spis treści

1. [Instalacja od zera](#instalacja-od-zera)
   - [Linux / macOS](#linux--macos)
   - [Windows](#windows)
2. [Pierwsze uruchomienie](#pierwsze-uruchomienie)
3. [Użycie z poziomu kodu](#użycie-z-poziomu-kodu)
4. [Dashboard – co widać i jak filtrować](#dashboard)
5. [Modyfikacja topologii](#modyfikacja-topologii)
6. [Struktura projektu](#struktura-projektu)
7. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

---

## Instalacja od zera

Wymagania bazowe (te same dla Linux i Windows):

- **Python 3.13** lub nowszy
- **git**
- Zalecany [uv](https://docs.astral.sh/uv/) – szybki menedżer pakietów (~10× szybszy od pip). Można też użyć `pip` + `venv`.

### Linux / macOS

```bash
# 1. Zainstaluj uv (jednorazowo)
curl -LsSf https://astral.sh/uv/install.sh | sh
exec $SHELL          # przeładuj shell żeby PATH się zaktualizował

# 2. Sklonuj repo
git clone https://github.com/dominikKowalczyk17/kse_grid.git
cd kse_grid

# 3. Utwórz wirtualne środowisko z Pythonem 3.13 i zainstaluj zależności
uv sync

# 4. Aktywuj venv (opcjonalnie – uv run działa bez aktywacji)
source .venv/bin/activate
```

Bez `uv` (czysty `pip`):

```bash
python3.13 -m venv .venv
source .venv/bin/activate
pip install -e .
```

### Windows

**PowerShell** (zalecane):

```powershell
# 1. Zainstaluj Python 3.13 ze https://www.python.org/downloads/windows/
#    Zaznacz „Add python.exe to PATH" w instalatorze.

# 2. Zainstaluj uv
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 3. Zrestartuj PowerShell żeby PATH się odświeżył, potem:
git clone https://github.com/dominikKowalczyk17/kse_grid.git
cd kse_grid

# 4. Utwórz venv i zainstaluj zależności
uv sync

# 5. Aktywuj venv
.\.venv\Scripts\Activate.ps1
```

> Jeśli PowerShell odmówi aktywacji skryptu, jednorazowo wykonaj:
> `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

Alternatywa bez `uv` (czysty `pip`):

```powershell
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e .
```

### Sprawdzenie instalacji

```bash
python -c "import pandapower, plotly, matpowercaseframes; print('OK')"
```

Powinno wypisać `OK`.

---

## Pierwsze uruchomienie

Najprostsze użycie – wczytuje dołączony plik `data/case3120sp.m`, liczy rozpływ mocy i otwiera dashboard:

```bash
# z aktywnym venv:
python main.py

# albo bez aktywacji (z uv):
uv run python main.py
```

Co się stanie:

1. Załadowanie `data/case3120sp.m` (~1 s)
2. Newton-Raphson Iwamoto z inicjalizacją DC (~5 s, ~3120 węzłów)
3. Wydruk raportu w terminalu (bilans mocy, napięcia, top 10 obciążonych linii)
4. Wygenerowanie układu (spring layout, ~7 s przy 3120 węzłach)
5. Start lokalnego serwera HTTP pod `http://127.0.0.1:8000/` (jeśli port zajęty – kolejny wolny)
6. Automatyczne otwarcie domyślnej przeglądarki

Serwer działa do `Ctrl+C`.

---

## Użycie z poziomu kodu

### Wariant A – import z pliku MATPOWER

```python
from pathlib import Path
import kse_grid

grid = (
    kse_grid.KSEGrid
    .from_matpower_case(Path("data/case3120sp.m"))
    .run_powerflow()
)

grid.report()              # raport tekstowy w terminalu
grid.serve_interactive()   # dashboard live na localhost
```

### Wariant B – wbudowana topologia 400/220 kV PSE

```python
import kse_grid

grid = kse_grid.KSEGrid().build().run_powerflow()
grid.report()
grid.serve_interactive()
```

### Eksport do statycznego HTML

```python
grid.plot_interactive("kse_grid.html")   # zapis do pliku, do otworzenia bez serwera
```

### Dostęp do surowej sieci pandapower

```python
net = grid.net   # pp.pandapowerNet – pełne API pandapower
print(net.res_bus.head())
print(net.res_line[net.res_line.loading_percent > 100])
```

### Parametry obliczeń

```python
grid.run_powerflow(
    algorithm="iwamoto_nr",   # stabilniejszy od klasycznego NR
    init="dc",                 # ciepły start z rozpływu DC
    max_iteration=100,
    tolerance_mva=1.0,
)
```

### Nakład na rastrową mapę Polski (tylko topologia wbudowana – ma geodane)

```python
grid = kse_grid.KSEGrid().build().run_powerflow()
grid.serve_interactive(
    background_image="kse_grid/poland_map_natural_earth.png",
    background_bounds=(13.7, 24.6, 48.8, 55.1),  # lon_min, lon_max, lat_min, lat_max
)
```

> **Uwaga:** `case3120sp.m` nie zawiera geodanych (brak lat/lon w MATPOWER), więc dla tego importu tła mapy nie da się dokładnie nałożyć. Używany jest wtedy układ poglądowy (spring layout).

---

## Dashboard

Po wejściu na `http://127.0.0.1:8000/` zobaczysz:

- **Lewy panel:** liczba szyn, linii, transformatorów, generatorów; maksymalne obciążenie linii (zielone/żółte/czerwone), liczba naruszeń napięcia, lista poziomów napięć.
- **Główny viewport:** graf sieci. Kolor linii = obciążenie (zielony 0–40 % → czerwony >100 %). Kolor szyn = `Vm` w p.u.
- **Filtry nad wykresem:**
  - `Wszystko` – pełna sieć
  - `Bez 110 kV` – tylko 220 i 400 kV (część przesyłowa)
  - `Tylko 400 kV` – sieć NN
  - `Tylko transformatory` – wyizolowane trafa

Hover na element pokazuje szczegóły (kV, Vm, P, obciążenie). Scroll = zoom, drag = pan.

---

## Modyfikacja topologii

Wszystkie dane sieci ręcznej są w `kse_grid/topology.py` jako dataclass – bez logiki, łatwe do edycji.

```python
import kse_grid

topo = kse_grid.KSETopology()
topo.LINES_400KV.append(
    kse_grid.LineConfig(
        from_bus="Żarnowiec 400kV",
        to_bus="Dunowo 400kV",
        length_km=80,
        std_type=kse_grid.KSETopology.LT400,
        name="LNN Offshore Bałtyk 400kV",
    )
)

kse_grid.KSEGrid(topo).build().run_powerflow().report()
```

---

## Struktura projektu

```
PowerFlow/
├── main.py                     # entry point
├── data/
│   └── case3120sp.m            # publiczny przypadek MATPOWER (PL 2008)
├── docs/
│   └── preview.png             # zrzut dashboard (opcjonalnie)
└── kse_grid/
    ├── __init__.py             # publiczne API pakietu
    ├── models.py               # dataclasses (BusConfig, LineConfig, ...)
    ├── topology.py             # KSETopology – ręcznie zbudowane dane KSE
    ├── builder.py              # GridBuilder – buduje sieć pandapower z topologii
    ├── matpower.py             # loader plików .m (MATPOWER)
    ├── runner.py               # PowerFlowRunner – obliczenia + raporty
    ├── plotting.py             # dashboard HTML + Plotly
    └── grid.py                 # KSEGrid – fasada (fluent interface)
```

### Model wbudowany (alternatywa do MATPOWER)

| Element | Liczba |
|---|---|
| Szyny 400 kV | 18 |
| Szyny 220 kV | 13 |
| Linie 400 kV | 40 |
| Linie 220 kV | 18 |
| Autotransformatory 400/220 kV | 15 |
| Generatory | 10 (+ slack) |
| Obciążenia | 15 węzłów |
| Kompensatory Q | 32 |

Slack bus: **Kozienice 400 kV**. Główne elektrownie: Bełchatów (4500 MW), Połaniec (1800 MW), Turów (2000 MW), Pątnów (1200 MW), Kozienice (slack), Żarnowiec PSP (±500 MW), import z DE/SE.

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---|---|
| `ModuleNotFoundError: matpowercaseframes` | Środowisko nie aktywne lub `uv sync` nie wykonany. Aktywuj venv i powtórz. |
| Port 8000 zajęty | Skrypt automatycznie wybiera kolejny wolny port – sprawdź log w terminalu (`Port … zajęty, używam wolnego portu N`). |
| `pandapower` zgłasza ostrzeżenia o `BR_B` lub „fake transformers" | Normalne dla `case3120sp.m` – artefakt pliku MATPOWER, wynik PF jest poprawny. |
| Naruszenia napięcia (~1600) i przeciążenia (~140) w `case3120sp` | To celowe – publiczny przypadek jest naciskiem stresowym, nie odwzorowaniem rzeczywistego stanu sieci. |
| Spring layout trwa długo | ~7 s przy 3120 węzłach to norma; jednorazowo per uruchomienie. Zainstalowanie `python-igraph` mogłoby przyspieszyć (na razie nie używane). |
| Windows: PowerShell odmawia aktywacji venv | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, potem ponownie aktywuj. |
| Brak `python3.13` w systemie | Linux: `uv python install 3.13`. Windows: pobierz instalator z [python.org](https://www.python.org/downloads/). |

---

## Licencja

MIT
