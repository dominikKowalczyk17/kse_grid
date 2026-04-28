# `KSEGrid.__init__`

**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`

## Co robi

Inicjalizuje pusty obiekt-fasadę. Na tym etapie sieć nie jest jeszcze załadowana i nie ma wyników obliczeń.

Ustawia trzy pola stanu:

- `self.net = None` - jeszcze brak `pandapowerNet`,
- `self._runner = None` - jeszcze brak helpera od load flow,
- `self._converged = False` - brak potwierdzonej zbieżności obliczeń.

## Nagłówek metody

```python
def __init__(self):
```

## Argumenty

Metoda nie przyjmuje własnych argumentów roboczych poza `self`.

## Co zwraca

Nic jawnie nie zwraca. Jej rolą jest przygotowanie początkowego stanu obiektu.

## Po co istnieje

Dzięki temu kolejne kroki pipeline'u mają jasny stan:

1. po `__init__` obiekt jest pusty,
2. po `from_matpower_case(...)` pojawia się `self.net`,
3. po `run_powerflow(...)` pojawiają się wyniki i `self._runner`.
