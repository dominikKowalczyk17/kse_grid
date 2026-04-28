# `_import_without_gencost`

**Plik źródłowy:** `kse_grid\matpower.py`  
**Rodzaj:** funkcja pomocnicza

## Co robi

Importuje case MATPOWER po usunięciu całego bloku `mpc.gencost`. To awaryjna ścieżka używana tylko wtedy, gdy standardowy importer `pandapower` wywala się na danych kosztowych generatorów.

## Nagłówek funkcji

```python
def _import_without_gencost(case_path: Path, f_hz: int) -> pp.pandapowerNet:
```

## Co dzieje się w środku

1. czyta cały plik `.m` jako tekst,
2. regexem wycina blok:

```matlab
mpc.gencost = [
...
];
```

3. jeśli nic nie wyciął, rzuca błąd,
4. zapisuje tymczasową wersję pliku bez `gencost`,
5. importuje ją przez `from_mpc(...)`,
6. na końcu usuwa plik tymczasowy.

## Ważne

Usunięcie `gencost` jest bezpieczne dla zwykłego power flow, bo koszty generatorów są potrzebne do OPF, a nie do samego rozpływu mocy.
