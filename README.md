# KSE Grid – Polish Transmission Network Model

Uproszczony model polskiej sieci przesyłowej **400/220 kV** (KSE PSE S.A.) zbudowany w [pandapower](https://www.pandapower.org/). Topologia oparta na publicznie dostępnych danych PSE – rzeczywiste stacje, trasy linii i elektrownie systemowe.

## Struktura projektu

```
PowerFlow/
├── main.py                   # entry point
└── kse_grid/
    ├── __init__.py           # public API pakietu
    ├── models.py             # dataclasses (BusConfig, LineConfig, …)
    ├── topology.py           # KSETopology – surowe dane sieci
    ├── builder.py            # GridBuilder – buduje sieć pandapower
    ├── runner.py             # PowerFlowRunner – obliczenia + raporty
    └── grid.py               # KSEGrid – fasada (fluent interface)
```

## Model sieci

| Element | Liczba |
|---|---|
| Szyny 400 kV | 18 |
| Szyny 220 kV | 13 |
| Linie 400 kV | 40 (tory pojedyncze i podwójne) |
| Linie 220 kV | 18 |
| Autotransformatory 400/220 kV | 15 |
| Generatory | 10 (+ slack) |
| Obciążenia | 15 węzłów |
| Kompensatory Q | 32 (baterie kondensatorów + reaktory) |

### Główne elektrownie

| Elektrownia | Węzeł | Moc [MW] |
|---|---|---|
| Bełchatów | Rogowiec 400kV | 4 500 |
| Połaniec | Połaniec 400kV | 1 800 |
| Kozienice | Kozienice 400kV | Slack |
| Turów | Turów 400kV | 2 000 |
| Adamów / Pątnów | Pątnów 220kV | 1 200 |
| Blachownia | Blachownia 220kV | 800 |
| CCGT Stalowa Wola | Stalowa Wola 220kV | 450 |
| Żarnowiec PSP | Żarnowiec 400kV | ±500 |
| Żydowo PSP | Żydowo 220kV | ±150 |
| Import DE (Krajnik) | Krajnik 400kV | 800 |
| Import SwePol+DE (Plewiska) | Plewiska 400kV | 900 |

### Typy przewodów

- **400 kV:** `490-AL1/64-ST1A` (AFL-8 490 mm²), `max_i = 960 A`
- **220 kV:** `243-AL1/39-ST1A` (AFL-8 243 mm²), `max_i = 645 A`
- **AT 400/220 kV:** 450 MVA, `vk = 10%`, zdefiniowany jako custom std type

## Wymagania

```
python >= 3.11
pandapower >= 2.13
pandas
```

```bash
uv pip install pandapower pandas
```

## Uruchomienie

```bash
python main.py
```

Polecenie załaduje publiczny przypadek MATPOWER `case3120sp`, uruchomi rozpływ mocy i otworzy lokalny podgląd pod `http://127.0.0.1:8000/`. Serwer działa do `Ctrl+C`.

lub bezpośrednio z kodu:

```python
from pathlib import Path
import kse_grid

kse_grid.KSEGrid.from_matpower_case(Path("data/case3120sp.m")).run_powerflow().report()
```

Dostęp do surowej sieci pandapower:

```python
from pathlib import Path
import kse_grid

grid = kse_grid.KSEGrid.from_matpower_case(Path("data/case3120sp.m")).run_powerflow()
net = grid.net   # pp.pandapowerNet – pełne API pandapower
```

Interaktywny graf do przeglądarki:

```python
from pathlib import Path
import kse_grid

grid = kse_grid.KSEGrid.from_matpower_case(Path("data/case3120sp.m")).run_powerflow()
grid.plot_interactive("kse_grid_interactive.html")
```

Graf pozwala powiększać, przesuwać i sprawdzać szczegóły szyn, linii oraz transformatorów po najechaniu kursorem. Dla importu MATPOWER geodane nie są dostępne, więc układ jest generowany automatycznie jako schemat poglądowy.

Podgląd live w lokalnej przeglądarce:

```python
from pathlib import Path
import kse_grid

grid = kse_grid.KSEGrid.from_matpower_case(Path("data/case3120sp.m")).run_powerflow()
grid.serve_interactive()
```

To uruchamia prosty lokalny serwer HTTP. W widoku są dostępne filtry `Wszystko`, `Bez 110 kV`, `Tylko 400 kV` oraz `Tylko transformatory`. Kolor linii pokazuje obciążenie, a kolor szyn napięcie `Vm`.

Nałożenie sieci na rastrową mapę Polski:

```python
grid = kse_grid.KSEGrid().build().run_powerflow()
grid.serve_interactive(
    background_image="kse_grid/poland_map_natural_earth.png",
    background_bounds=(13.7, 24.6, 48.8, 55.1),  # lon_min, lon_max, lat_min, lat_max
)
```

`background_bounds` określa geograficzne granice obrazu. Jeśli pominiesz ten parametr, wykres dopasuje tło automatycznie do zakresu węzłów, co działa dobrze dla obrazów już przyciętych do obszaru sieci.

Dołączona mapa została wyrenderowana z public-domain Natural Earth.

## Modyfikacja topologii

Wszystkie dane sieci są w `kse_grid/topology.py` jako listy dataclass – bez logiki, łatwe do edycji.

```python
import kse_grid

# Dodaj nową linię (np. offshore Bałtyk)
topo = kse_grid.KSETopology()
topo.LINES_400KV.append(
    kse_grid.LineConfig(
        from_bus="Żarnowiec 400kV",
        to_bus="Dunowo 400kV",
        length_km=80,
        std_type=kse_grid.KSETopology.LT400,
        name="LNN Offshore Bałtyk 400kV"
    )
)

kse_grid.KSEGrid(topo).build().run_powerflow().report()
```

## Obliczenia

Load flow uruchamiany algorytmem **Iwamoto-NR** z inicjalizacją DC:

```python
grid.run_powerflow(
    algorithm="iwamoto_nr",   # stabilniejszy niż klasyczny NR
    max_iteration=100,
    tolerance_mva=1.0
)
```

Raport zawiera:
- bilans mocy (P generacja / import / obciążenie / straty)
- napięcia na szynach 400 kV z flagami ⚠️ poza ±5% Un
- top 10 najbardziej obciążonych linii 400 kV
- obciążenie autotransformatorów 400/220 kV
- lista naruszeń napięcia

## Uwagi

- Długości linii są przybliżone (odległość w linii prostej × 1.2)
- Obciążenia reprezentują pobór przez sieci 110 kV / dystrybucję (węzły zbiorcze)
- cos φ obciążeń ≈ 0.97 (po kompensacji po stronie DSO)
- Model nie uwzględnia sieci 110 kV ani połączeń HVDC (SwePol Link, LitPol Link)
- Slack bus: **Kozienice 400kV** (w modelu jako `ext_grid`)

## Licencja

MIT
