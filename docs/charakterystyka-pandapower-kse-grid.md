# Charakterystyka środowiska pandapower i projektu kse_grid

## 1. Wprowadzenie do pandapower

pandapower to otwartoźródłowe narzędzie oparte na języku Python, służące do modelowania, analizy i optymalizacji systemów elektroenergetycznych. Projekt został opracowany przez Uniwersytet w Kassel oraz Fraunhofer IEE. Biblioteka łączy wygodę pracy z tabelami `pandas` z algorytmami obliczeniowymi wykorzystywanymi w analizie sieci elektroenergetycznych, w tym z funkcjami wywodzącymi się z PYPOWER.

pandapower udostępnia między innymi obliczenia rozpływu mocy, optymalny rozpływ mocy, estymację stanu, analizy zwarciowe zgodne z IEC 60909 oraz funkcje topologiczne. Model sieci jest reprezentowany jako obiekt `pandapowerNet`, który składa się z tabel typu `DataFrame`. Dzięki temu dane elementów sieci, parametry techniczne i wyniki obliczeń są przechowywane w czytelnej strukturze tabelarycznej.

Bibliotekę można instalować z użyciem `pip`, na przykład poleceniem `pip install pandapower[all]`. W pracy naukowo-inżynierskiej często używa się także dystrybucji Anaconda lub środowisk wirtualnych, ponieważ pandapower korzysta z wielu pakietów numerycznych. Poprawność instalacji można sprawdzić przez import biblioteki w Pythonie albo uruchomienie testów projektu.

## 2. Struktura danych, import MATPOWER i kse_grid

W pandapower sieć jest opisywana jako zbiór elementów elektroenergetycznych, takich jak szyny, linie, transformatory, generatory, odbiory i łączniki. Jest to podejście odmienne od klasycznego modelu macierzowego MATPOWER, w którym dane sieci są zapisane głównie w macierzach `bus`, `branch`, `gen` i `gencost`.

pandapower udostępnia konwertery pozwalające importować przypadki sieciowe MATPOWER z plików `.m`. Konwersja przekształca model macierzowy do modelu elementowego pandapower. W projekcie `kse_grid` proces ten jest udostępniony przez funkcję `KSEGrid.from_matpower_case()`, która tworzy obiekt aplikacji na podstawie wskazanego pliku MATPOWER.

Wewnątrz projektu import jest realizowany przez funkcję `load_matpower_case()`. Funkcja ta ładuje przypadek MATPOWER, nadaje sieci nazwę, normalizuje dane, dołącza pomocnicze dane geograficzne z plików GeoJSON oraz tworzy warstwę przełączników operacyjnych dla linii i transformatorów.

Projekt zawiera także mechanizmy obsługi problemów typowych dla publicznych przypadków MATPOWER. Przykładem jest defensywna obsługa błędów związanych z blokiem `gencost` oraz korekta klasyfikacji gałęzi sieci jako transformatorów, gdy łączą one szyny o różnych poziomach napięcia.

## 3. Dedykowany interfejs i instalacja kse_grid

`kse_grid` to interaktywne narzędzie do analizy, edycji i wizualizacji sieci elektroenergetycznych. Projekt łączy obliczenia wykonywane z użyciem pandapower z lokalnym interfejsem webowym opartym na FastAPI, Vue 3, PixiJS i Plotly.

Projekt można uruchomić na dwa sposoby.

### Metoda 1: gotowe pliki wykonywalne

Repozytorium zawiera konfigurację budowania plików wykonywalnych przy użyciu PyInstaller. Workflow GitHub Actions buduje artefakty dla systemów Linux i Windows. W przypadku taga wersji w formacie `v*` workflow może opublikować w GitHub Releases pliki `PowerFlow-linux` oraz `PowerFlow.exe`.

Ta metoda jest przeznaczona dla użytkowników, którzy nie chcą ręcznie konfigurować środowiska Python. Po pobraniu odpowiedniego pliku wykonywalnego użytkownik uruchamia aplikację lokalnie. Program startuje backend, uruchamia lokalny serwer i otwiera interfejs w domyślnej przeglądarce internetowej. Dostępność tej metody zależy od tego, czy dla danej wersji opublikowano Release z gotowymi plikami.

### Metoda 2: instalacja ze źródeł

Druga metoda jest przeznaczona dla użytkowników, którzy chcą uruchomić projekt bezpośrednio z kodu źródłowego albo rozwijać go programistycznie.

1. Należy upewnić się, że w systemie zainstalowany jest Python w wersji 3.13 lub nowszej.
2. Następnie należy pobrać kod źródłowy z repozytorium GitHub.
3. Po wejściu do katalogu projektu należy zainstalować zależności poleceniem `uv sync`.
4. Aplikację można uruchomić poleceniem `uv run python main.py`.
5. Alternatywnie, bez użycia `uv`, można utworzyć środowisko wirtualne i zainstalować projekt poleceniem `pip install -e .`.

Pominięcie instalacji zależności może skutkować błędami importu, na przykład `ModuleNotFoundError` dla bibliotek wymaganych do konwersji plików MATPOWER. W systemie Windows, jeżeli PowerShell blokuje aktywację środowiska wirtualnego, może być konieczna zmiana polityki wykonywania skryptów poleceniem `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## 4. Uruchamianie symulacji i wizualizacja wyników

Aplikacja może zostać uruchomiona bez pliku wejściowego albo z podaniem konkretnego przypadku MATPOWER. Uruchomienie `python main.py` tworzy pustą sieć gotową do edycji w interfejsie. Jeżeli użytkownik chce załadować konkretny plik MATPOWER, powinien podać jego ścieżkę jako argument, na przykład `python main.py data/case2383wp.m`.

Po uruchomieniu aplikacji startuje lokalny serwer dostępny pod adresem `http://127.0.0.1:8050/`, a interfejs zostaje otwarty w domyślnej przeglądarce internetowej. W przypadku załadowania niepustej sieci aplikacja inicjalizuje sesję obliczeniową i umożliwia wykonanie lub ponowne wykonanie obliczeń rozpływu mocy.

Wizualizacja wyników w `kse_grid` oferuje trzy tryby widoku:

- topologię grafu, przedstawiającą techniczny układ połączeń elementów sieci,
- widok mapowy OpenStreetMap, wykorzystujący współrzędne geograficzne WGS84,
- warstwę odniesienia KSE Atlas, przeznaczoną do porównania z referencyjną warstwą polskiego systemu elektroenergetycznego.

Użytkownik może analizować wyniki przez kodowanie kolorami obciążenia linii i napięć szyn, a także przez wizualizację kierunków przepływu mocy czynnej. Interfejs pozwala filtrować elementy według poziomu napięcia, typu elementu, mocy czynnej i biernej oraz procentowego obciążenia. Dostępne są również karty szczegółów elementów, edycja parametrów sieci, przełączanie stanów łączników, ponowne przeliczanie rozpływu mocy oraz wczytywanie nowego pliku `.m` bez restartowania procesu serwera.

Dodatkowo metoda `KSEGrid.report()` umożliwia wygenerowanie tekstowego podsumowania wyników bezpośrednio w terminalu. Jest to przydatne przy pracy bez interfejsu graficznego lub przy szybkim sprawdzaniu poprawności obliczeń.
