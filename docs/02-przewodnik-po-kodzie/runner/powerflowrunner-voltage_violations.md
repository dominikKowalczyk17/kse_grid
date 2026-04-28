# `PowerFlowRunner.voltage_violations`

**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`

## Co robi

Zwraca tabelę z szynami, których napięcie wyszło poza przedział `0.95-1.05 p.u.`. To jest surowy, programistyczny odpowiednik ostrzeżeń napięciowych pokazywanych potem w `KSEGrid.report()`.

## Nagłówek metody

```python
def voltage_violations(self) -> pd.DataFrame:
```

## Co zwraca

`pandas.DataFrame` z kolumnami:

- `vm_pu`,
- `name`,
- `vn_kv`.

Wiersze zawiera tylko dla busów spełniających:

```python
(vm_pu < 0.95) | (vm_pu > 1.05)
```

## Co dzieje się w środku

1. kopiuje `net.res_bus[["vm_pu"]]`,
2. dopina nazwę i poziom napięcia z `net.bus`,
3. filtruje tylko przypadki poza dopuszczalnym pasmem.
