# `KSEGrid.serve`

**Plik źródłowy:** `kse_grid\grid.py`  
**Rodzaj:** metoda klasy `KSEGrid`

## Co robi

Uruchamia dashboard WWW dla aktualnej sieci. To cienki wrapper nad `kse_grid.web_server.serve(...)`: sprawdza, czy `self.net` istnieje, wypisuje adres i przekazuje sterowanie do warstwy HTTP.

## Nagłówek metody

```python
def serve(
    self,
    host: str = "127.0.0.1",
    port: int = 8050,
    auto_open: bool = True,
) -> None:
```

## Argumenty

| Argument | Znaczenie |
|---|---|
| `host` | adres bind dla Uvicorn |
| `port` | port serwera |
| `auto_open` | czy po starcie otworzyć przeglądarkę |

## Co dzieje się w środku

1. sprawdza, czy `self.net` nie jest `None`,
2. importuje funkcję `serve` z `kse_grid.web_server`,
3. wypisuje URL dashboardu,
4. uruchamia serwer FastAPI/Uvicorn.

## Ważne

Ta metoda nie liczy load flow. Jeśli chcesz mieć w dashboardzie napięcia i obciążenia z `res_*`, wywołaj wcześniej `run_powerflow()`.
