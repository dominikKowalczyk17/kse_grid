# `_import_matpower_case`

**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Próbuje zaimportować plik `.m` przez `pandapower.converter.matpower.from_mpc(...)`. Jeśli parser wywali specyficzny `IndexError` związany z `gencost`, przełącza się na fallback `_import_without_gencost(...)`.

## Nagłówek funkcji

```python
def _import_matpower_case(case_path: Path, f_hz: int) -> pp.pandapowerNet:
```

## Co dzieje się w środku

1. woła `from_mpc(...)`,
2. jeśli import przejdzie, od razu zwraca wynik,
3. jeśli pojawi się `IndexError` z tekstem `too many indices for array`, traktuje to jako znany problem z `gencost`,
4. uruchamia import awaryjny bez bloku `gencost`,
5. inne wyjątki przepuszcza dalej bez maskowania.

## Po co istnieje

Niektóre case'y MATPOWER/TAMU mają blok `mpc.gencost`, którego `pandapower` nie umie poprawnie sparsować. Sama topologia i dane do power flow są jednak poprawne, więc fallback pozwala nadal użyć modelu do load flow.
