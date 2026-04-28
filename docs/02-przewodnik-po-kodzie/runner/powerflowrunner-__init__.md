# `PowerFlowRunner.__init__`

**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`

## Co robi

Inicjalizator jest bardzo prosty: zapisuje przekazaną sieć do `self.net`. Nie uruchamia żadnych obliczeń i nie tworzy dodatkowych struktur.

## Nagłówek metody

```python
def __init__(self, net: pp.pandapowerNet):
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `net` | gotowy model `pandapowerNet`, na którym mają być wykonywane obliczenia |

## Co zwraca

Nic jawnie nie zwraca. Przygotowuje obiekt runnera do dalszych wywołań `run()`, `summary()` i `voltage_violations()`.
