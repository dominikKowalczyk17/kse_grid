# `create_app`

**Plik źródłowy:** `kse_grid\web_server.py`  
**Rodzaj:** funkcja

## Co robi

Buduje gotową aplikację `FastAPI` dla jednej, konkretnej sieci. Najpierw serializuje `pandapowerNet` do payloadu JSON, potem wystawia dwa główne endpointy i montuje frontend statyczny.

## Nagłówek funkcji

```python
def create_app(net: pp.pandapowerNet) -> FastAPI:
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `net` | sieć `pandapower`, która ma być pokazana w dashboardzie |

## Co zwraca

Obiekt `FastAPI` gotowy do uruchomienia przez Uvicorn.

## Jakie route'y tworzy

| Route | Rola |
|---|---|
| `GET /api/network` | zwraca gotowy payload JSON dla frontendu |
| `GET /` | zwraca `index.html` |
| mount `StaticFiles` pod `/` | serwuje JS, CSS, ikony i pliki pomocnicze z `kse_grid/web` |

## Ważna cecha

Payload jest liczony raz przy tworzeniu aplikacji:

```python
payload = serialize_network(net)
```

Czyli frontend dostaje statyczny zrzut aktualnego stanu sieci, a nie oblicza nic sam po stronie klienta.
