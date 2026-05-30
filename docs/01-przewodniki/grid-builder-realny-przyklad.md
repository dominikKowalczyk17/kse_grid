# Grid Builder — budowa realnej sieci krok po kroku

Krótki przewodnik budowy sieci przesyłowej *od zera* w Grid Builderze, na
przykładzie fragmentu KSE z trzema poziomami napięcia (400 / 220 / 110 kV).
Wszystkie parametry poniżej są zweryfikowane — rozpływ mocy zbiega się ze
zdrowymi napięciami.

## Co budujemy

Fragment sieci wokół węzła Rogowiec (rozdzielnia Elektrowni Bełchatów):

```
  Rogowiec 400 ──linia 400 kV── Trębaczew 400 ──AT 400/220── Trębaczew 220 ──T 220/110── Trębaczew 110
   (slack)                       (GEN, PV)                     (odbiór 180 MW)            (odbiór 90 MW)
```

- **4 szyny** na 3 poziomach napięcia (400 / 220 / 110 kV)
- **węzeł bilansujący** (ext_grid) na Rogowcu
- **generator PV** na szynie Trębaczew 400
- **1 linia** 400 kV + **2 transformatory** (kaskada 400/220/110)
- **2 odbiory** (na 220 i 110 kV)

## Przygotowanie

1. Strona startowa → **„Nowa sieć"** (wejście do Grid Buildera).
2. Nad formularzem przełącz format na **pandapower** — jednostki fizyczne
   (km, Ω/km, MVA) odpowiadają danym katalogowym i są czytelniejsze niż p.u.

> Buduj w kolejności zakładek: najpierw **szyny**, bo wszystkie pozostałe
> elementy wybierają szynę z listy rozwijanej. Bez szyn nie dodasz nic innego.

## Krok 1 — Szyny (zakładka „Szyny")

Dodaj cztery szyny (Un wybierasz z dropdownu):

| Nazwa           | Un [kV] | id |
|-----------------|---------|----|
| `Rogowiec 400`  | 400     | 0  |
| `Trębaczew 400` | 400     | 1  |
| `Trębaczew 220` | 220     | 2  |
| `Trębaczew 110` | 110     | 3  |

## Krok 2 — Węzeł bilansujący (zakładka „Ext. grid")

Slack reprezentuje silne źródło trzymające napięcie i bilansujące moc.

| Pole   | Wartość          |
|--------|------------------|
| Szyna  | `Rogowiec 400`   |
| vm_pu  | `1.02`           |
| Nazwa  | `Rogowiec slack` |

## Krok 3 — Linia 400 kV (zakładka „Linie")

| Pole            | Wartość                  | Uwaga                  |
|-----------------|--------------------------|------------------------|
| Szyna źródłowa  | `Rogowiec 400`           |                        |
| Szyna docelowa  | `Trębaczew 400`          |                        |
| Długość [km]    | `80`                     |                        |
| R' [Ω/km]       | `0.03`                   | typowe dla 400 kV      |
| X' [Ω/km]       | `0.31`                   | typowe dla 400 kV      |
| C' [nF/km]      | `11.5`                   | typowe dla 400 kV      |
| Imax [kA]       | `2.6`                    | obciążalność termiczna |

## Krok 4 — Transformatory (zakładka „Transformatory")

Autotransformator sprzęgający 400 i 220 kV:

| Pole       | Wartość        |
|------------|----------------|
| Szyna WN   | `Trębaczew 400`|
| Szyna nN   | `Trębaczew 220`|
| Sn [MVA]   | `330`          |
| Un HV [kV] | `400`          |
| Un LV [kV] | `220`          |
| uk [%]     | `12`           |
| ukr [%]    | `0.35`         |
| Pfe [kW]   | `120`          |
| i0 [%]     | `0.06`         |

Transformator 220/110 kV:

| Pole       | Wartość        |
|------------|----------------|
| Szyna WN   | `Trębaczew 220`|
| Szyna nN   | `Trębaczew 110`|
| Sn [MVA]   | `160`          |
| Un HV [kV] | `220`          |
| Un LV [kV] | `110`          |
| uk [%]     | `11`           |
| ukr [%]    | `0.4`          |
| Pfe [kW]   | `80`           |
| i0 [%]     | `0.05`         |

## Krok 5 — Generator (zakładka „Generatory")

Generator typu PV utrzymuje zadane napięcie na swojej szynie.

| Pole   | Wartość         |
|--------|-----------------|
| Szyna  | `Trębaczew 400` |
| P [MW] | `200`           |
| vm_pu  | `1.01`          |

## Krok 6 — Odbiory (zakładka „Odbiorniki")

| Nazwa        | Szyna           | P [MW] | Q [Mvar] |
|--------------|-----------------|--------|----------|
| `Odbiór 220` | `Trębaczew 220` | 180    | 60       |
| `Odbiór 110` | `Trębaczew 110` | 90     | 30       |

## Krok 7 — Obliczenia

Kliknij **„Oblicz i pokaż graf"**. Rozpływ się zbiegnie.

### Spodziewane wyniki (zweryfikowane)

| Szyna           | Napięcie    |
|-----------------|-------------|
| Rogowiec 400    | 1.02 p.u.   |
| Trębaczew 400   | 1.01 p.u.   |
| Trębaczew 220   | 0.965 p.u.  |
| Trębaczew 110   | 0.94 p.u.   |

Bilans mocy: slack ~72 MW + generator 200 MW = ~272 MW pokrywa 270 MW odbioru
plus ~1.5 MW strat.

## Dalsza edycja

Sieć budujesz przyrostowo — w każdej chwili możesz wrócić do dowolnej zakładki
i dołożyć element; nowe linie/trafa/odbiory automatycznie widzą istniejące
szyny w liście rozwijanej. W widoku grafu klik w element otwiera kartę z edycją
parametrów (zmiana zapisuje się na bieżąco), a tryb edycji pozwala przeciągać
szyny i przełączać łączniki.

> **Uwaga:** narzędzie nie wstawia węzła „w środek" istniejącej linii
> (łamanie linii w trybie edycji jest tylko wizualne — dodaje punkty trasy, nie
> tworzy nowego węzła elektrycznego). Żeby wstawić szynę między dwie już
> połączone, usuń łączącą je linię i dodaj nową szynę oraz dwa nowe odcinki.

## Wskazówki doboru parametrów

- **Nie przeciążaj pojedynczej linii** — np. 800 MW przez jedną linię 400 kV na
  150 km zaniża napięcie poniżej 0.9 p.u. (przeciążenie napięciowe). Realne
  korytarze są dwutorowe; podziel moc lub dodaj drugi tor.
- **Każda sieć musi mieć dokładnie jeden węzeł bilansujący** (ext_grid).
- Napięcia znamionowe szyn po obu stronach transformatora powinny zgadzać się
  z `Un HV` / `Un LV` trafa.
