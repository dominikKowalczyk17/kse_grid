# `web_server.py`

To jest cienka warstwa HTTP. Nie liczy load flow i nie buduje payloadu ręcznie - bierze gotowy `pandapowerNet`, serializuje go i wystawia pod prostym API.

## Co wchodzi, co wychodzi

| Funkcja | Wejście | Wyjście |
|---|---|---|
| `create_app(net)` | `pandapowerNet` | obiekt `FastAPI` z gotowymi route'ami |
| `serve(net, host, port, auto_open)` | `pandapowerNet` | działający serwer Uvicorn |

## Jakie route'y powstają

| Route | Co zwraca |
|---|---|
| `GET /api/network` | cały payload JSON dla frontendu |
| `GET /` | `index.html` aplikacji Vue |
| pliki statyczne pod `/...` | `main.js`, `style.css`, ikony, GeoJSON-y itp. |

## Realny przykład z repo

```python
from kse_grid.matpower import load_matpower_case
from kse_grid.web_server import create_app

net = load_matpower_case("data/case3120sp.m")
app = create_app(net)
```

Efekt:

```python
app.title
# 'case3120sp – KSE Grid'

[(route.path, sorted(route.methods)) for route in app.routes if route.path in ["/", "/api/network"]]
# [('/api/network', ['GET']), ('/', ['GET'])]
```

## Pliki w tym katalogu

- [`create_app`](create_app.md)
- [`serve`](serve.md)
