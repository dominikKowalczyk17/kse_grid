# `matpower_formatter`

**Plik źródłowy:** `kse_grid/loading/matpower_formatter.py`
**Rodzaj:** moduł narzędziowy + CLI

## Co robi

Formatuje pliki MATPOWER (`.m`) tak, że bloki danych (`mpc.bus`, `mpc.gen`, `mpc.branch`, `mpc.gencost`, …) mają kolumny równo wyrównane do prawej. Nie zmienia żadnych wartości — przekształca wyłącznie białe znaki. Komentarze końcowe wierszy (np. `% nazwa szyny`) i komentarze nagłówkowe są zachowywane.

## API

```python
from kse_grid.loading.matpower_formatter import format_file, format_text

format_file(path)   # formatuje plik w miejscu, zwraca True jeśli treść się zmieniła
format_text(text)   # zwraca sformatowany tekst, bez I/O
```

## Użycie z CLI

```bash
# pojedynczy plik
python -m kse_grid.loading.matpower_formatter data/Zarnowiec.m

# wiele plików
python -m kse_grid.loading.matpower_formatter data/Solina.m data/Zarnowiec.m data/Zarnowiec_blackstart.m
```

## Użycie w PyCharm

Projekt zawiera dwa dzielone run-configi (`.idea/runConfigurations/`):

- **Format MATPOWER (current file)** — formatuje plik aktualnie otwarty w edytorze (parametr `$FilePath$`). Najszybsza droga: otwórz `.m`, kliknij Run.
- **Format MATPOWER (data/*.m)** — formatuje stałą listę plików własnych: `Solina.m`, `Zarnowiec.m`, `Zarnowiec_blackstart.m`. Dla większych presetów dopisz pliki w polu „Parameters" w „Edit Configurations".

Oba configi używają trybu `python -m` (MODULE_MODE), interpretera projektowego i katalogu roboczego `$PROJECT_DIR$`.

## Styl wyjściowy

- wcięcie wierszy danych: 4 spacje
- separator kolumn: 2 spacje
- wszystkie kolumny prawo-wyrównane do najszerszej wartości w bloku
- bez pustych linii na początku i końcu bloku
- komentarze pomiędzy wierszami danych są zachowywane (wcięte 4 spacjami)

## Bezpieczeństwo

Formatter tylko przesuwa białe znaki — nie parsuje wartości liczbowych ani struktury MATPOWER, więc nie wprowadza dryfu numerycznego. Po sformatowaniu warto raz przepuścić plik przez `import_matpower_case`, żeby się upewnić, że nadal się ładuje poprawnie.
