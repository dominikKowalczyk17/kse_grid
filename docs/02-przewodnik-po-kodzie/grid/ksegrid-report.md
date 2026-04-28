# `KSEGrid.report`

**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`

## Co robi

Drukuje skrócony raport tekstowy po load flow. Jeśli obliczenia się nie zbiegły, nie próbuje nic analizować - wypisuje tylko komunikat i zwraca obiekt bez zmian.

## Nagłówek metody

```python
def report(self) -> "KSEGrid":
```

## Co zwraca

Zwraca `self`, więc można pisać:

```python
KSEGrid.from_matpower_case("case.m").run_powerflow().report().serve()
```

## Co dzieje się w środku

1. jeśli `self._converged` jest `False`, wypisuje informację o braku wyników,
2. jeśli nie ma `self._runner`, rzuca błąd,
3. wywołuje `self._runner.summary()`,
4. pobiera tabelę naruszeń napięciowych przez `self._runner.voltage_violations()`,
5. jeśli naruszenia istnieją, pokazuje ich liczbę i podgląd pierwszych wierszy.

## Co raport zawiera

Raport tekstowy pokazuje między innymi:

- bilans mocy,
- największe odchylenia napięć,
- top obciążonych linii,
- transformatory o największym obciążeniu,
- listę busów poza pasmem ±5% Un.
