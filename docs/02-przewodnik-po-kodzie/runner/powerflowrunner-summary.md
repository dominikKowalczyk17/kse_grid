# `PowerFlowRunner.summary`

**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`

## Co robi

Drukuje czytelny raport tekstowy do terminala na podstawie tabel wynikowych `pandapower`. To jest warstwa prezentacji - nie zmienia modelu i niczego nie serializuje do JSON-a.

## Nagłówek metody

```python
def summary(self):
```

## Co pokazuje

Metoda wypisuje kilka bloków:

1. nazwę modelu,
2. bilans mocy: generacja, slack/import, obciążenie, straty,
3. top 10 busów o największym odchyleniu napięcia,
4. top 10 najbardziej obciążonych linii,
5. top 10 najbardziej obciążonych transformatorów,
6. krótkie podsumowanie przeciążeń.

## Skąd bierze dane

Czyta bezpośrednio z:

- `net.res_bus`,
- `net.res_line`,
- `net.res_trafo`,
- `net.res_gen`,
- `net.res_ext_grid`,
- `net.res_load`.

## Ważne

Ta metoda zakłada, że wcześniej wykonano `run()`. Bez wyników `res_*` raport nie będzie miał sensu.
