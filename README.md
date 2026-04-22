# kse_grid – Interaktywny plotter sieci elektroenergetycznej

Narzędzie do wizualizacji i analizy rozpływu mocy z plików MATPOWER (`.m`), oparte o [pandapower](https://www.pandapower.org/), Dash i Plotly.

- Wczytuje dowolny plik `.m` (format MATPOWER)
- Liczy rozpływ mocy (algorytm Iwamoto-NR, start AC)
- Otwiera interaktywny dashboard w przeglądarce z filtrami napięć, wyszukiwaniem szyn i kartą szczegółów na wykresie

![dashboard preview](docs/preview.png)

---

## Spis treści

1. [Instalacja](#instalacja)
2. [Uruchomienie](#uruchomienie)
3. [Użycie z poziomu kodu](#użycie-z-poziomu-kodu)
4. [Dashboard](#dashboard)
5. [Struktura projektu](#struktura-projektu)
6. [Rozwiązywanie problemów](#rozwiązywanie-problemów)

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
python main.py

# własny plik .m
python main.py ścieżka/do/case.m

# bez aktywacji venv (z uv)
uv run python main.py
```

Co się dzieje po uruchomieniu:

1. Wczytanie pliku `.m`
2. Obliczenia load flow – Newton-Raphson Iwamoto, start AC (U=1 p.u., kąt=0°)
3. Wygenerowanie układu grafu (spring layout, jeśli plik nie zawiera geodanych)
4. Start dashboardu Dash pod `http://127.0.0.1:8050/` i otwarcie przeglądarki

Serwer działa do `Ctrl+C`.

---

## Użycie z poziomu kodu

### Podstawowe użycie

```python
from pathlib import Path
import kse_grid

kse_grid.KSEGrid.from_matpower_case("data/case3120sp.m").run_powerflow().serve_dash()
```

### Z raportem tekstowym

```python
import kse_grid

grid = kse_grid.KSEGrid.from_matpower_case("case.m").run_powerflow()
grid.report()            # bilans mocy, napięcia, top 10 linii – w terminalu
grid.serve_dash()        # dashboard Dash w przeglądarce
```

### Dostęp do danych pandapower

```python
net = grid.net
print(net.res_bus.head())                                    # wyniki napięć
print(net.res_line[net.res_line.loading_percent > 100])      # przeciążone linie
```

### Parametry obliczeń

```python
grid.run_powerflow(
    algorithm="iwamoto_nr",  # stabilniejszy od klasycznego NR przy słabych sieciach
    max_iteration=100,
    tolerance_mva=1.0,
)
```

---

## Dashboard

Po wejściu na `http://127.0.0.1:8050/`:

- **Lewy panel** – podsumowanie sieci, wyszukiwarka szyn, reset widoku, filtry napięć i typów elementów oraz legenda obciążenia linii.
- **Wykres** – graf sieci. Kolor linii = obciążenie (zielony 0–40% -> czerwony >100%). Kolor węzłów = `Um` w p.u.
- **Domyślny widok** – startowo pokazywany jest **rdzeń 400/220 kV**, żeby duże przypadki były czytelniejsze.
- **Presety filtrów napięć:**
  - `Rdzeń 400/220` – tylko sieć przesyłowa 400 i 220 kV
  - `Wszystkie` – pełna sieć
  - `Żadne` – szybkie wyłączenie wszystkich poziomów napięć
- **Checklisty** – pozwalają niezależnie włączać poziomy napięć oraz typy elementów (`Linie`, `Transformatory`, `Szyny`).
- **Interakcja:**
  - klik na węzeł lub element pokazuje kartę szczegółów w prawym górnym rogu wykresu,
  - klik w puste tło usuwa zaznaczenie,
  - wyszukiwarka szyn centruje widok na wybranym węźle,
  - scroll = zoom, drag = pan.

> Jeśli plik `.m` nie zawiera danych geograficznych (GPS), węzły są rozmieszczane automatycznie (spring layout).

---

## Struktura projektu

```
kse_grid/
├── main.py              # punkt startowy – ładuje .m i uruchamia dashboard Dash
├── data/
│   └── case3120sp.m     # przykładowy plik MATPOWER (3120 węzłów)
├── docs/
│   └── preview.png
└── kse_grid/
    ├── __init__.py      # publiczne API pakietu
    ├── grid.py          # KSEGrid – główna klasa (ładowanie, obliczenia, wizualizacja)
    ├── matpower.py      # wczytywanie plików .m
    ├── runner.py        # obliczenia load flow + raport tekstowy
    ├── plotting.py      # budowa figury Plotly i logika kolorowania elementów
    ├── dash_app.py      # layout dashboardu Dash i callbacki UI
    └── assets/
        ├── global.css   # style dashboardu
        └── graph_interactions.js  # dodatkowe interakcje po stronie przeglądarki
```

---

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
|---|---|
| `ModuleNotFoundError: matpowercaseframes` | Środowisko nie aktywne lub `uv sync` nie wykonany. Aktywuj venv i powtórz. |
| Port 8050 zajęty | Uruchom `serve_dash(port=...)` albo zwolnij port 8050. |
| `pandapower` zgłasza ostrzeżenia o `BR_B` lub „fake transformers" | Normalne dla `case3120sp.m` – artefakt pliku MATPOWER, wynik PF jest poprawny. |
| Naruszenia napięcia i przeciążenia w `case3120sp` | To celowe – publiczny przypadek jest naciskiem stresowym, nie odwzorowaniem rzeczywistego stanu sieci. |
| Spring layout trwa długo | ~7 s przy 3120 węzłach to norma; jednorazowo per uruchomienie. |
| Windows: PowerShell odmawia aktywacji venv | `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`, potem ponownie aktywuj. |
| Brak `python3.13` w systemie | Linux: `uv python install 3.13`. Windows: pobierz z [python.org](https://www.python.org/downloads/). |

---
