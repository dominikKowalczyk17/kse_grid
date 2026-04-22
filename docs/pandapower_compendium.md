# Kompendium pandapower

> Wszystko co jest używane w aplikacji `kse_grid` — od podstaw, bez skrótu myślowego.

---

## Spis treści

1. [Czym jest pandapower?](#1-czym-jest-pandapower)
2. [pandapowerNet — centralny obiekt wszystkiego](#2-pandapowernet--centralny-obiekt-wszystkiego)
3. [Tabele wejściowe — topologia i parametry](#3-tabele-wejściowe--topologia-i-parametry)
   - [net.bus — szyny](#netbus--szyny-węzły-sieci)
   - [net.line — linie](#netline--linie-elektroenergetyczne)
   - [net.trafo — transformatory](#nettrafo--transformatory)
   - [net.gen — generatory](#netgen--generatory-węzły-pv)
   - [net.ext_grid — slack bus](#netext_grid--szyna-bilansująca-slack-bus)
   - [net.load — obciążenia](#netload--obciążenia)
4. [from_mpc() — konwerter MATPOWER → pandapower](#4-from_mpc--konwerter-matpower--pandapower)
5. [pp.runpp() — obliczenia load flow](#5-pprunpp--obliczenia-load-flow)
   - [Co to jest load flow?](#co-to-jest-load-flow)
   - [Parametry runpp()](#parametry-runpp)
6. [Tabele wynikowe — co aplikacja odczytuje](#6-tabele-wynikowe--co-aplikacja-odczytuje)
7. [LoadflowNotConverged — obsługa błędu](#7-loadflownotconverged--obsługa-błędu)
8. [Przepływ danych w aplikacji](#8-przepływ-danych-w-aplikacji)

---

## 1. Czym jest pandapower?

pandapower to biblioteka Python do analizy sieci elektroenergetycznych. Jej trzy zadania:

1. **Przechowywanie** danych sieci — szyny, linie, transformatory, generatory, obciążenia — w postaci tabel pandas DataFrame
2. **Obliczanie** stanu ustalonego sieci (load flow / power flow)
3. **Konwertowanie** formatów innych programów (MATPOWER, PSS/E) na własny model

W całej aplikacji importowana jest jako:

```python
import pandapower as pp
```

Skrót `pp` to alias — zamiast pisać `pandapower.runpp(...)` piszemy `pp.runpp(...)`.

---

## 2. `pandapowerNet` — centralny obiekt wszystkiego

Gdy ładujesz plik `.m`, dostajesz obiekt typu `pp.pandapowerNet`. To jest **cały model sieci** — jedna zmienna trzymająca wszystko.

Technicznie `pandapowerNet` zachowuje się jak słownik, gdzie każda wartość to tabela pandas DataFrame. Możesz na nim robić `net.bus`, `net.line` itd. — to są właśnie te tabele.

```python
net = from_mpc("case3120sp.m", f_hz=50)

net.bus       # tabela szyn
net.line      # tabela linii
net.trafo     # tabela transformatorów
net.gen       # tabela generatorów
net.load      # tabela obciążeń
net.ext_grid  # tabela szyny bilansującej
```

Po uruchomieniu `runpp()` dochodzą tabele wynikowe z prefiksem `res_`:

```python
net.res_bus      # wyniki dla szyn
net.res_line     # wyniki dla linii
net.res_trafo    # wyniki dla transformatorów
net.res_gen      # wyniki dla generatorów
net.res_ext_grid # wyniki dla slack busa
```

---

## 3. Tabele wejściowe — topologia i parametry

### `net.bus` — szyny (węzły sieci)

Szyna (*ang. bus*) to węzeł sieci — punkt gdzie coś jest podłączone: linia, transformator, generator lub odbiorca. W rzeczywistej sieci odpowiada to rozdzielni lub stacji elektroenergetycznej.

| Kolumna | Typ   | Opis |
|---------|-------|------|
| `name`  | str   | Nazwa stacji, np. `"Gdańsk Błonia"` |
| `vn_kv` | float | Napięcie znamionowe [kV], np. `400.0`, `220.0`, `110.0` |
| `geo`   | str   | Współrzędne GPS w formacie GeoJSON (opcjonalne) |

Kolumna `geo` jest sprawdzana w `plotting.py` — jeśli **wszystkie** szyny mają `geo`, sieć rysowana jest na prawdziwych współrzędnych geograficznych. Jeśli nie (tak jest dla `case3120sp.m`) — generowany jest układ poglądowy algorytmem sprężynowym (networkx `spring_layout`).

Po imporcie z pliku `.m` funkcja `_normalize_imported_net()` uzupełnia puste nazwy:

```python
net.bus.at[bus_idx, "name"] = f"Bus {bus_idx + 1}"
```

---

### `net.line` — linie elektroenergetyczne

Linia to połączenie elektryczne między dwiema szynami — może to być kabel ziemny lub napowietrzna linia wysokiego napięcia.

| Kolumna          | Typ   | Opis |
|------------------|-------|------|
| `name`           | str   | Nazwa linii |
| `from_bus`       | int   | Indeks szyny startowej (indeks do `net.bus`) |
| `to_bus`         | int   | Indeks szyny końcowej |
| `length_km`      | float | Długość linii [km] |
| `r_ohm_per_km`   | float | Rezystancja [Ω/km] — odpowiedzialna za straty cieplne |
| `x_ohm_per_km`   | float | Reaktancja [Ω/km] — odpowiedzialna za transport mocy biernej |
| `c_nf_per_km`    | float | Pojemność [nF/km] — generuje moc bierną pojemnościową |
| `max_i_ka`       | float | Maksymalny prąd [kA] — baza do obliczenia `loading_percent` |

W kodzie `plotting.py` napięcie znamionowe linii odczytywane jest z szyny startowej:

```python
net.bus.loc[net.line.from_bus, "vn_kv"]
```

---

### `net.trafo` — transformatory

Transformator łączy dwie szyny o **różnych** napięciach znamionowych. Strona wyższego napięcia to **HV** (*High Voltage*), niższego — **LV** (*Low Voltage*).

| Kolumna    | Typ   | Opis |
|------------|-------|------|
| `name`     | str   | Nazwa transformatora |
| `hv_bus`   | int   | Indeks szyny HV |
| `lv_bus`   | int   | Indeks szyny LV |
| `vn_hv_kv` | float | Napięcie znamionowe strony HV [kV], np. `400.0` |
| `vn_lv_kv` | float | Napięcie znamionowe strony LV [kV], np. `110.0` |
| `sn_mva`   | float | Moc znamionowa transformatora [MVA] |

W tooltipie na wykresie widać właśnie te pola:

```python
f"Trafo {row['vn_hv_kv']:.0f}/{row['vn_lv_kv']:.0f} kV"
f"Moc znamionowa: {row['sn_mva']:.0f} MVA"
```

---

### `net.gen` — generatory (węzły PV)

Generator to jednostka wytwórcza podłączona do szyny. W modelu load flow szyna z generatorem to tzw. **węzeł PV** — znana jest moc czynna P i napięcie V, a load flow wyznacza wymaganą moc bierną Q.

| Kolumna | Typ   | Opis |
|---------|-------|------|
| `bus`   | int   | Szyna do której podłączony |
| `p_mw`  | float | Moc czynna generatora [MW] |

W aplikacji suma generacji na szynie wyświetlana jest w tooltipie:

```python
gen_mw = net.gen.loc[net.gen.bus == bus_idx, "p_mw"].sum()
```

---

### `net.ext_grid` — szyna bilansująca (Slack bus)

To najważniejszy węzeł w modelu load flow — tzw. **szyna bilansu** lub **slack bus**. Każda sieć musi mieć dokładnie jeden slack bus.

**Dlaczego jest potrzebna?**

Układ równań load flow jest niedookreślony — nie wiadomo z góry ile mocy dostarczy każdy generator, bo straty w sieci zależą od napięć, a napięcia od przepływów mocy. Slack bus "oddaje" tyle mocy ile trzeba żeby bilans się zamknął — to jego napięcie jest referencją (1.0 p.u., kąt 0°).

W fizycznej sieci slack bus odpowiada systemowi elektroenergetycznemu z którym jesteśmy zsynchronizowani (sąsiedni kraj, duży blok energetyczny).

Import/eksport mocy ze slack busa odczytywany jest z wyników:

```python
p_ext = net.res_ext_grid["p_mw"].sum()
```

---

### `net.load` — obciążenia

Obciążenie to odbiór mocy — domy, fabryki, koleje.

| Kolumna | Typ   | Opis |
|---------|-------|------|
| `bus`   | int   | Szyna do której podłączone |
| `p_mw`  | float | Pobierana moc czynna [MW] |

Suma wszystkich `load.p_mw` to łączne zapotrzebowanie sieci. W `runner.py`:

```python
p_load = net.res_load["p_mw"].sum()
```

---

## 4. `from_mpc()` — konwerter MATPOWER → pandapower

```python
from pandapower.converter.matpower import from_mpc

net = from_mpc("case3120sp.m", f_hz=50)
```

**MATPOWER** to format pliku tekstowego (Matlab) który od lat 90. jest standardem akademickim w elektroenergetyce. Pliki `.m` zawierają dane sieci jako macierze Matlab:

```matlab
mpc.bus = [   % [bus_id, type, Pd, Qd, ..., baseKV, ...]
    1  3  0    0    ...  400;   % typ 3 = slack
    2  1  21.7 12.7 ...  110;   % typ 1 = zwykła szyna PQ
    3  2  0    0    ...  220;   % typ 2 = generator PV
    ...
]
```

`from_mpc` odczytuje te macierze i buduje `pandapowerNet`:

1. **`mpc.bus`** — typy szyn MATPOWER konwertowane są na pandapower:
   - typ `1` (PQ bus) → `net.bus` (zwykła szyna z obciążeniem)
   - typ `2` (PV bus) → `net.bus` + `net.gen` (szyna z generatorem)
   - typ `3` (Slack bus) → `net.bus` + `net.ext_grid`

2. **`mpc.branch`** — linie i transformatory (w MATPOWER to jedna tabela; jeśli stosunek napięć końców ≠ 1 → trafo, inaczej → linia)

3. **`mpc.gen`** → `net.gen`

Parametr `f_hz=50` to częstotliwość systemu. W Polsce i Europie **50 Hz**, w USA 60 Hz. Wpływa na przeliczenie reaktancji z jednostek MATPOWER na Ω/km.

---

## 5. `pp.runpp()` — obliczenia load flow

```python
pp.runpp(
    net,
    algorithm="iwamoto_nr",
    calculate_voltage_angles=True,
    max_iteration=100,
    init="flat",
    tolerance_mva=1.0,
)
```

To najważniejsza funkcja pandapowera. Rozwiązuje **problem load flow (przepływu mocy)** dla całej sieci.

---

### Co to jest load flow?

Wyobraź sobie sieć 3000 szyn i 4000 linii. Znane są:

- gdzie są generatory i ile produkują
- gdzie są odbiory i ile pobierają
- parametry każdej linii i transformatora (rezystancja, reaktancja)

Pytanie: **jakie napięcie panuje na każdej szynie i jakie prądy płyną przez każdą linię?**

To właśnie load flow. Matematycznie to układ **nieliniowych równań algebraicznych** — prawa Kirchhoffa dla całej sieci. Dla 3000 szyn to 6000 równań (dla każdej szyny bilans mocy czynnej P i biernej Q). Żaden komputer nie rozwiąże tego analitycznie, dlatego stosuje się metody **iteracyjne** — przybliżamy rozwiązanie krok po kroku aż błąd będzie wystarczająco mały.

---

### Parametry `runpp()`

#### `algorithm` — algorytm iteracyjny

| Wartość | Opis |
|---------|------|
| `"nr"` | **Newton-Raphson** — klasyczna metoda. Szybka, ale przy trudnych przypadkach może nie zbiegać. |
| `"iwamoto_nr"` | **Newton-Raphson z mnożnikiem Iwamoto** — przed każdym krokiem oblicza optymalny "mnożnik kroku" (0 < μ ≤ 1). Jeśli sieć jest łatwa → μ=1, działa identycznie jak NR. Jeśli trudna → μ<1, robi mniejszy krok i poprawia zbieżność. **Domyślny w tej aplikacji.** |
| `"bfsw"` | Backward/Forward Sweep — dla sieci promieniowych (dystrybucja). Nieużywany dla sieci pierścieniowych przesyłowych. |
| `"gs"` | Gauss-Seidel — historyczny algorytm, bardzo powolny, dziś rzadko stosowany. |

#### `calculate_voltage_angles=True`

Oblicza kąty napięcia (`va_degree` w `res_bus`), nie tylko amplitudy.

Kąt między dwiema szynami decyduje o kierunku i wielkości przepływu mocy czynnej. Transformatory z przesunięciem fazowym zmieniają kąt — bez tego parametru wyniki byłyby błędne.

Wynik trafia do tooltipa:

```python
f"Kąt: {net.res_bus.at[bus_idx, 'va_degree']:.2f}°"
```

#### `init` — punkt startowy iteracji

Od jakiego stanu zaczynamy przybliżać się do rozwiązania:

| Wartość | Opis |
|---------|------|
| `"flat"` | **Flat start AC** — wszystkie napięcia startują od `1.0 p.u.`, kąty od `0°`. Stan "idealnej sieci bez obciążenia". MATPOWER używa tego domyślnie — stąd ta wartość w aplikacji. |
| `"dc"` | Najpierw rozwiązuje uproszczony liniowy model DC, a wyniki kątów używa jako punkt startowy AC. Może szybciej zbiegać, ale wprowadza bias. |
| `"results"` | Używa poprzednich wyników z `res_bus`. Przydatne przy wielu obliczeniach z małymi zmianami. |

#### `max_iteration=100`

Limit iteracji. W każdej iteracji NR liczy nowe przybliżone wartości napięć. Jeśli po 100 iteracjach błąd jest nadal zbyt duży → rzuca wyjątek `LoadflowNotConverged`.

Dla typowych sieci zbieżność następuje po **3–10 iteracjach**. 100 to górna granica bezpieczeństwa.

#### `tolerance_mva=1.0`

Kryterium zbieżności. Iteracja zatrzymuje się gdy **maksymalny błąd residuum** (niespełnienie bilansu mocy w dowolnym węźle) jest mniejszy niż `1.0 MVA`.

Dla sieci o mocy kilku tysięcy MW tolerancja 1 MVA to ~0.01–0.1% błędu — wystarczająca dla analizy przesyłowej.

---

## 6. Tabele wynikowe — co aplikacja odczytuje

Po wywołaniu `pp.runpp()` pandapower wypełnia tabele `res_*`.

### `net.res_bus` — wyniki dla szyn

#### `vm_pu` — napięcie w jednostkach względnych

**p.u.** = *per unit* = jednostka względna. Napięcie podzielone przez napięcie nominalne:

```
Um [p.u.] = U_rzeczywiste / U_nominalne
```

**Przykład:** szyna 110 kV ma napięcie 113 kV → `vm_pu = 113/110 = 1.027 p.u.`

Dlaczego p.u. zamiast kV? Pozwala porównywać szyny różnych napięć na tej samej skali. Standard europejski dopuszcza odchylenia **±10%** (0.9–1.1 p.u.), operacyjnie często **±5%** (0.95–1.05 p.u.).

Jak używane w aplikacji:
- **Kolor szyn** na wykresie = `vm_pu` (skala Turbo, zakres 0.9–1.1)
- **Tooltip:** `Um: 1.0234 p.u.`
- **Ostrzeżenie** `⚠️` w raporcie: `< 0.95` lub `> 1.05`
- **Licznik naruszeń** na dashboardzie: `< 0.9` lub `> 1.1`

#### `va_degree` — kąt napięcia

Kąt fazowy napięcia w stopniach, względem slack busa (który ma kąt = 0°). Im większy kąt między dwiema szynami, tym większy przepływ mocy czynnej P między nimi.

---

### `net.res_line` — wyniki dla linii

#### `loading_percent` — obciążenie linii

```
loading_percent = (I_rzeczywiste / I_max) × 100%
```

Gdzie `I_max` = `max_i_ka` z `net.line`. Interpretacja i kolory na wykresie:

| Zakres | Kolor | Znaczenie |
|--------|-------|-----------|
| 0–40%  | 🟢 zielony | Luz, spora rezerwa |
| 40–70% | 🟡 żółty | Normalny stan pracy |
| 70–100% | 🟠 pomarańczowy | Duże obciążenie, uwaga |
| >100%  | 🔴 czerwony | **Przeciążenie** — zagrożenie termiczne |

#### `p_from_mw` — moc czynna

Moc wchodząca do linii od strony `from_bus` [MW]. Wyświetlana w tooltipie linii.

#### `pl_mw` — straty mocy

Straty mocy czynnej w linii:  `pl_mw = p_from_mw - p_to_mw` [MW]

Suma strat ze wszystkich linii i transformatorów = całkowite straty sieci:

```python
p_loss = net.res_line["pl_mw"].sum() + net.res_trafo["pl_mw"].sum()
```

---

### `net.res_trafo` — wyniki dla transformatorów

| Kolumna          | Opis |
|------------------|------|
| `p_hv_mw`        | Moc czynna po stronie HV [MW] |
| `pl_mw`          | Straty mocy w transformatorze [MW] |
| `loading_percent` | Obciążenie jako % mocy znamionowej `sn_mva` |

Kolor linii transformatora na wykresie = ten sam system kolorów co linie (0-40% niebieski, 40-70% morski, 70-100% żółty, >100% ciemnoczerwony).

---

### `net.res_gen` i `net.res_ext_grid` — bilans mocy

```python
p_gen = net.res_gen["p_mw"].sum()     # generacja z generatorów PV
p_ext = net.res_ext_grid["p_mw"].sum() # import/eksport ze slack busa
p_load = net.res_load["p_mw"].sum()   # całkowite obciążenie
p_loss = ...                           # straty

# Bilans: p_gen + p_ext ≈ p_load + p_loss
```

---

### Sprawdzanie czy wyniki istnieją

Przed odczytem wyników zawsze sprawdzamy czy `runpp()` był uruchomiony:

```python
has_results = not net.res_bus.empty
```

Jeśli `True` — tabele `res_*` mają dane.  
Jeśli `False` — `runpp()` nie był wywołany lub nie zbiegł — aplikacja rysuje sieć bez kolorowania napięć (szyny domyślnie `1.0 p.u.`) i bez danych o obciążeniach.

---

## 7. `LoadflowNotConverged` — obsługa błędu

```python
try:
    pp.runpp(net, ...)
    return True
except pp.auxiliary.LoadflowNotConverged:
    print("❌ Load flow nie zbiegł po 100 iteracjach!")
    return False
```

Wyjątek rzucany gdy algorytm iteracyjny nie osiągnie zbieżności w `max_iteration` krokach. Typowe przyczyny:

- Sieć jest poza granicą przepustowości (za duże obciążenie)
- Złe dane w pliku `.m` (nierealistyczne parametry)
- Izolowane fragmenty sieci bez połączenia ze slack busem
- Sieć słabo zbieżna (przydałby się lepszy algorytm lub punkt startowy)

Gdy wyjątek jest złapany, tabele `res_*` są puste — aplikacja działa dalej ale bez danych ilościowych.

---

## 8. Przepływ danych w aplikacji

```
plik .m
    │
    ▼
from_mpc(f_hz=50)
    │  Parsuje macierze MATPOWER
    │  Konwertuje typy szyn (1→PQ, 2→PV+gen, 3→slack)
    ▼
pandapowerNet (net)
    ├── net.bus      (szyny: name, vn_kv, geo)
    ├── net.line     (linie: from_bus, to_bus, length_km, max_i_ka)
    ├── net.trafo    (trafo: hv_bus, lv_bus, sn_mva)
    ├── net.gen      (generatory: bus, p_mw)
    ├── net.load     (obciążenia: bus, p_mw)
    └── net.ext_grid (slack bus)
    │
    ▼
pp.runpp(algorithm="iwamoto_nr", init="flat", ...)
    │  Rozwiązuje układ ~6000 równań nieliniowych
    │  Iteracyjnie (Newton-Raphson z mnożnikiem Iwamoto)
    ▼
pandapowerNet (net) — uzupełniony o wyniki
    ├── net.res_bus       (vm_pu, va_degree dla każdej szyny)
    ├── net.res_line      (loading_percent, p_from_mw, pl_mw)
    ├── net.res_trafo     (loading_percent, p_hv_mw, pl_mw)
    ├── net.res_gen       (p_mw, q_mvar)
    └── net.res_ext_grid  (p_mw — import/eksport)
    │
    ▼
plotting.py — buduje wykres Plotly
    ├── Kolor szyn         ← vm_pu  (skala Turbo 0.9–1.1)
    ├── Kolor linii        ← loading_percent (zielony→żółty→pomarańczowy→czerwony)
    ├── Tooltip szyny      ← vm_pu, va_degree, gen_mw, load_mw
    ├── Tooltip linii      ← loading_percent, p_from_mw, length_km
    ├── Tooltip trafo      ← loading_percent, p_hv_mw, sn_mva
    └── Panel boczny       ← suma linii/szyn/trafo, bilans mocy, naruszenia U
```

---

*Dokument wygenerowany na podstawie kodu źródłowego projektu `kse_grid`.*
