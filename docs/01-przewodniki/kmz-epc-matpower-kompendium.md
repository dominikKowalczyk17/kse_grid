# KMZ, EPC, MATPOWER i nazwy busów - proste kompendium

Ten plik zbiera w prostych słowach najważniejsze odpowiedzi o tym:

1. jak w tym projekcie bus dostaje nazwę,
2. po co jest plik [`EPC`](#epc),
3. dlaczego sam plik `KMZ` nie wystarcza do nadania nazw busom,
4. co da się zrobić z samym `KMZ`,
5. czego jeszcze potrzeba do zbudowania modelu sieci w `pandapower`.

## 1. Jak po konwersji przypisywane są nazwy busów

Samo uruchomienie `convert_kse_kmz.py` **nie zmienia nazw w pliku `.m`**.  
Ten skrypt tworzy tylko plik pomocniczy `GeoJSON`, czyli plik z punktami na mapie i dodatkowymi informacjami.

Prawdziwe przypisywanie nazw dzieje się później, kiedy projekt ładuje case przez `load_matpower_case(...)`.

Proces wygląda tak:

1. plik `.m` jest ładowany do `pandapower`,
2. jeśli jakiś bus nie ma nazwy, dostaje nazwę tymczasową typu `Bus 1`, `Bus 2`, itd.,
3. potem kod szuka obok case'a pliku `GeoJSON`,
4. jeśli taki plik znajdzie, próbuje dopasować każdy punkt z `GeoJSON` do konkretnego busa,
5. jeśli punkt ma nazwę stacji, a obecna nazwa busa jest pusta albo tymczasowa, to bus dostaje nową nazwę.

Finalna nazwa jest składana mniej więcej tak:

```text
<nazwa stacji> <poziom napięcia> kV
```

Przykłady:

- `Belchatow 400 kV`
- `Kozienice 220 kV`

## 2. Skąd skrypt wie, że dany bus to konkretna stacja

Najważniejsza rzecz: **sam plik `.m` zwykle tego nie mówi**.

Skrypt nie zgaduje z samego `case2383wp.m`, że:

- `bus 1 = Bełchatów`,
- `bus 2 = Kozienice`,
- itd.

Do tego potrzeba **pliku [`EPC`](#epc)**.

To właśnie [`EPC`](#epc) daje dodatkowe informacje, których często nie ma w `MATPOWER`.

Z pliku [`EPC`](#epc) skrypt bierze między innymi:

- numer busa,
- numer stacji,
- nazwę stacji przypisaną do busa.

Potem bierze tę nazwę stacji z [`EPC`](#epc) i porównuje ją z nazwami punktów z `KSE_2019.kmz`.

Czyli w praktyce działa to tak:

```text
bus z EPC
-> nazwa stacji z EPC
-> dopasowanie do nazwy w KMZ
-> współrzędne i nazwa do pliku GeoJSON
```

Czyli informacja "to jest Bełchatów" pochodzi z [`EPC`](#epc), a nie z samego `KMZ`.

## 3. Czy da się nadać realne nazwy busom bez pliku EPC

W obecnym podejściu: **nie**.

Jeśli dostępny jest tylko:

- `case2383wp.m`

i nie ma pasującego do niego pliku [`EPC`](#epc), to kod nie ma skąd wziąć mapowania:

```text
Bus 1 -> konkretna stacja
```

Plik `KMZ` ma tylko:

- nazwy stacji,
- położenie stacji na mapie.

Nie ma w nim informacji:

- który punkt odpowiada `bus 1`,
- który punkt odpowiada `bus 2`,
- itd.

Dlatego bez [`EPC`](#epc) nie da się automatycznie nadać prawdziwych nazw busom tą metodą.

### Co mogłoby zastąpić EPC

Zamiast [`EPC`](#epc) można by użyć innego źródła, jeśli zawiera takie mapowanie, na przykład:

- gotowego `GeoJSON` już dopasowanego do busów,
- osobnego pliku z mapowaniem `bus -> stacja`,
- innego modelu tej samej sieci, który ma już poprawne nazwy.

## 4. Czy z samego KSE_2019.kmz da się zbudować sieć

Tak, ale tylko do pewnego stopnia.

Z samego `KSE_2019.kmz` można zwykle odtworzyć:

- gdzie są stacje,
- jak mniej więcej biegną linie,
- jak wygląda ogólna topologia, czyli kto z kim jest połączony.

To wystarcza, żeby zrobić:

- mapę sieci,
- prosty graf połączeń,
- analizę połączeń,
- przybliżone długości linii.

Ale to jeszcze nie jest pełny model do sensownych obliczeń rozpływu mocy.

## 5. Czy sam KMZ wystarczy do obliczeń w pandapower

Do prostego rysunku lub grafu: **tak**.  
Do porządnych obliczeń elektroenergetycznych: **nie**.

W `pandapower` potrzeba więcej danych niż tylko położenia stacji i linii.

## 6. Co jeszcze jest potrzebne do modelu w pandapower

Jeśli celem są sensowne obliczenia, zwykle potrzeba jeszcze:

- poziomów napięć na stacjach,
- parametrów linii,
- transformatorów i ich parametrów,
- informacji o źródłach wytwarzania,
- informacji o obciążeniach,
- założonego układu pracy sieci.

### Co już można mieć lub oszacować

Jeśli interesuje nas tylko sieć przesyłowa `400/220 kV`, to część rzeczy da się wyznaczyć albo sensownie założyć:

- napięcia są znane,
- typy linii często są znane,
- z typów linii i długości można policzyć parametry linii,
- moce zwarciowe bywają znane lub możliwe do zebrania,
- przebieg sieci da się odczytać z map.

To znaczy, że można zbudować **uproszczony model**.

## 7. Czego najczęściej brakuje najbardziej

Nawet jeśli znasz linie i napięcia, to zwykle nadal brakuje:

- dokładnych danych o transformatorach,
- aktualnych ustawień transformatorów,
- dokładnych danych o generacji w węzłach,
- dokładnych danych o obciążeniach w węzłach,
- dokładnego układu połączeń wewnątrz stacji,
- informacji, które elementy są aktualnie włączone, a które wyłączone.

To właśnie te dane zwykle najbardziej ograniczają dokładność modelu.

## 8. Czy da się zrobić model edukacyjny

**Tak.**

Jeśli celem nie jest idealne odwzorowanie realnej pracy KSE, tylko model edukacyjny, to można przyjąć rozsądne założenia.

Przykładowo można:

- odtworzyć stacje i linie z `KMZ`,
- policzyć przybliżone parametry linii,
- dodać transformatory z typowymi parametrami,
- przypisać generację do znanych elektrowni,
- rozdzielić obciążenie w prosty sposób,
- wybrać jeden lub kilka mocnych węzłów jako punkt odniesienia dla obliczeń.

Taki model nie będzie modelem operatorskim, ale może być bardzo dobry do nauki.

## 9. Czy publicznie da się znaleźć generację, obciążenia i slack

### Generacja

Część danych publicznych istnieje, ale zwykle nie w formie:

```text
ten bus ma dokładnie tyle MW i tyle MVAr
```

Publicznie częściej znajdziesz:

- sumaryczną generację,
- generację według technologii,
- czasem dane dla elektrowni lub bloków.

To pomaga, ale nie daje od razu gotowego modelu bus po busie.

### Obciążenia

Podobnie jest z obciążeniem.

Publicznie da się znaleźć:

- zapotrzebowanie krajowe,
- czasem dane obszarowe,

ale zwykle nie pełny rozkład obciążenia na wszystkie stacje `400/220 kV`.

### Slack

Tutaj ważna rzecz:

**slack nie jest czymś, co odczytujesz z mapy.**

To jest element modelu obliczeniowego.  
Po prostu wybiera się węzeł albo kilka węzłów, które będą pełniły taką rolę w obliczeniach.

## 10. Jakie układy pracy można założyć do celów edukacyjnych

Do modelu edukacyjnego można założyć kilka prostych wariantów pracy sieci, na przykład:

- normalny stan pracy,
- wariant letni,
- wariant zimowy,
- wariant szczytowy,
- wariant dolinny,
- wariant importowy,
- wariant eksportowy,
- wariant awaryjny z wyłączeniem jednej linii lub transformatora.

Nie będzie to dokładnie to, co robi operator w danej chwili, ale do nauki jest to w pełni sensowne.

## 11. Co z nastawami transformatorów

Pełne aktualne nastawy transformatorów zwykle nie są publicznie dostępne.

W modelu edukacyjnym można przyjąć prostsze podejście:

1. zacząć od ustawienia neutralnego,
2. sprawdzić napięcia po obliczeniach,
3. ewentualnie skorygować ustawienia tak, żeby napięcia wyglądały rozsądnie.

To nie daje pełnej zgodności z rzeczywistą pracą sieci, ale pozwala zbudować działający model.

## 12. Najkrótszy wniosek

### Jeśli celem są tylko realne nazwy busów

Potrzeba czegoś, co mówi:

```text
który bus odpowiada której stacji
```

W tym projekcie taką rolę pełni [`EPC`](#epc).

### Jeśli celem jest zbudowanie modelu sieci z samego KMZ

Można zbudować:

- mapę,
- topologię,
- szkielet modelu.

Ale nie pełny, wiarygodny model obliczeniowy bez dodatkowych danych.

### Jeśli celem jest zbudowanie modelu edukacyjnego KSE 400/220 kV

To jest wykonalne, jeśli dołoży się:

- parametry linii,
- dane o transformatorach,
- uproszczoną generację,
- uproszczone obciążenia,
- przyjęty układ pracy.

---

## Słownik prostych pojęć

### Bus

W modelu sieci to punkt, do którego są podłączone linie, transformatory, źródła albo odbiory.  
Najprościej: **węzeł sieci**.

### MATPOWER case

Plik z opisem sieci elektroenergetycznej, zwykle z rozszerzeniem `.m`.

### EPC

<a id="epc"></a>

Plik z programu PowerWorld.  
W tym projekcie jest cenny dlatego, że może zawierać nazwy stacji i powiązanie busów ze stacjami.

### KMZ

Plik mapowy, w praktyce spakowany KML.  
Może zawierać punkty stacji i przebieg linii.

### GeoJSON

Prosty format pliku z obiektami na mapie, np. punktami i liniami.

### Topologia

Informacja o tym, **co jest z czym połączone**.

### Slack

Specjalny węzeł w modelu obliczeniowym, który "domyka bilans" mocy.  
W praktyce: punkt odniesienia potrzebny do obliczeń.

### Rozpływ mocy

Obliczenie pokazujące, jak płynie moc w sieci oraz jakie są napięcia i obciążenia elementów.

### Model edukacyjny

Model uproszczony, dobry do nauki i eksperymentów, ale niekoniecznie idealnie zgodny z rzeczywistą pracą systemu.
