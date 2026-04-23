# `PowerFlowRunner.voltage_violations`


**Plik źródłowy:** `kse_grid\runner.py`  
**Rodzaj:** metoda klasy `PowerFlowRunner`  
**Linie w kodzie:** 111-116


## Co to jest


To jest metoda klasy `PowerFlowRunner`. Po nazwie widać, że odpowiada za fragment logiki związany z: **voltage violations**.

## Nagłówek metody


```python
    def voltage_violations(self) -> pd.DataFrame:
```

## Argumenty


Ta funkcja nie przyjmuje własnych argumentów roboczych.

## Co zwraca


Kod podpowiada, że metoda zwraca: `pd.DataFrame`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `res` na podstawie wyniku funkcji `self.net.res_bus[["vm_pu"]].copy`.
2. Przygotowuje zmienne pomocnicze: `res["name"]`.
3. Przygotowuje zmienne pomocnicze: `res["vn_kv"]`.
4. Na końcu zwraca wynik: `res[(res.vm_pu < 0.95) | (res.vm_pu > 1.05)]`.

## Oryginalny opis zapisany w kodzie

Zwraca DataFrame z szynami poza pasmem ±5% Un.
