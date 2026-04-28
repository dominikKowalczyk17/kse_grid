# `serve`

**Plik źródłowy:** `kse_grid\web_server.py`  
**Rodzaj:** funkcja

## Co robi

Uruchamia serwer HTTP z dashboardem. To wygodny wrapper, który bierze `pandapowerNet`, buduje aplikację `FastAPI`, opcjonalnie otwiera przeglądarkę i startuje `uvicorn`.

## Nagłówek funkcji

```python
def serve(
    net: pp.pandapowerNet,
    host: str = "127.0.0.1",
    port: int = 8050,
    auto_open: bool = True,
) -> None:
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `net` | sieć do pokazania |
| `host` | adres bind serwera |
| `port` | port serwera |
| `auto_open` | czy po starcie wywołać `webbrowser.open(...)` |

## Co dzieje się w środku

1. tworzy aplikację przez `create_app(net)`,
2. jeśli `auto_open=True`, uruchamia `Timer`, który po chwili otwiera URL w przeglądarce,
3. startuje `uvicorn.run(...)`.

## Po co `Timer`

Przeglądarka jest otwierana z krótkim opóźnieniem, żeby serwer zdążył wystartować zanim system spróbuje wejść na adres.
