# `create_app`


**Plik źródłowy:** `kse_grid\web_server.py`  
**Rodzaj:** funkcja  
**Linie w kodzie:** 21-35


## Co to jest


To jest funkcja pomocnicza lub główna o nazwie `create_app`. Po nazwie widać, że odpowiada za fragment logiki związany z: **create app**.

## Nagłówek funkcji


```python
def create_app(net: pp.pandapowerNet) -> FastAPI:
```

## Argumenty


| Argument | Typ w kodzie | Wartość domyślna |
|---|---|---|
| `net` | `pp.pandapowerNet` | `brak` |

## Co zwraca


Kod podpowiada, że funkcja zwraca: `FastAPI`.

## Co robi krok po kroku


1. Tworzy lub uzupełnia zmienne `payload` na podstawie wyniku funkcji `serialize_network`.
2. Tworzy lub uzupełnia zmienne `app` na podstawie wyniku funkcji `FastAPI`.
3. Wykonuje kolejny krok logiki funkcji.
4. Wykonuje kolejny krok logiki funkcji.
5. Wywołuje funkcję `app.mount`.
6. Na końcu zwraca wynik: `app`.

## Oryginalny opis zapisany w kodzie

Tworzy aplikację FastAPI dla danej sieci.
