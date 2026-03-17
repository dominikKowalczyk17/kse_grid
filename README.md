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
| Linie 400 kV | 35 (tory pojedyncze i podwójne) |
| Linie 220 kV | 13 |
| Autotransformatory 400/220 kV | 14 |
| Generatory | 10 (+ slack) |
| Obciążenia | 15 węzłów |
| Kompensatory Q | 29 (baterie kondensatorów + reaktory) |

### Główne elektrownie

| Elektrownia | Węzeł | Moc [MW] |
|---|---|---|
| Bełchatów | Rogowiec 400kV | 3 800 |
| Połaniec + Kozienice | Połaniec 400kV | 4 600 |
| Turów | Turów 400kV | 2 000 |
| Adamów / Pątnów | Adamów 400kV | 1 200 |
| Blachownia | Blachownia 220kV | 800 |
| CCGT Stalowa Wola | Stalowa Wola 220kV | 450 |
| Żarnowiec PSP | Żarnowiec 400kV | ±716 |
| Żydowo PSP | Żydowo 220kV | ±150 |
| Import DE (Krajnik) | Krajnik 400kV | 800 |
| Import SwePol+DE (Plewiska) | Plewiska 400kV | 900 |

### Typy przewodów

- **400 kV:** `490-AL1/64-ST1A` (AFL-8 490 mm²), `max_i = 960 A`
- **220 kV:** `243-AL1/39-ST1A` (AFL-8 243 mm²), `max_i = 645 A`
- **AT 400/220 kV:** 275 MVA, `vk = 8.5%`, zdefiniowany jako custom std type

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

lub bezpośrednio z kodu:

```python
import kse_grid

kse_grid.KSEGrid().build().run_powerflow().report()
```

Dostęp do surowej sieci pandapower:

```python
grid = kse_grid.KSEGrid().build().run_powerflow()
net  = grid.net   # pp.pandapowerNet – pełne API pandapower
```

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
- Slack bus: **Kozienice 400kV**

## Licencja

MIT
