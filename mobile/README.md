# KSE Grid Mobile

Mobilna aplikacja (React Native / Expo) będąca rozszerzeniem narzędzia [kse_grid](../) do analizy sieci elektroenergetycznych. Umożliwia pełnowartościowe korzystanie z funkcjonalności kse_grid na urządzeniach mobilnych (Android i iOS).

## Funkcjonalności

| Ekran | Opis |
|---|---|
| **Sieć** (Przegląd) | Statystyki elementów sieci, bilans mocy, diagnostyka napięć i obciążeń, parametry rozpływu, reset topologii |
| **Szyny** | Lista wszystkich węzłów z filtrowaniem po poziomie napięcia (kV), statusie napięcia (OK / ostrzeżenie / przekroczenie) oraz wyszukiwarką |
| **Linie** | Lista linii i transformatorów posortowana wg obciążenia, z filtrowaniem po rodzaju elementu i stopniu obciążenia |
| **Łączniki** | Sterowanie łącznikami (otwieranie/zamykanie pojedynczego switcha) i reset topologii do stanu bazowego |
| **Ustawienia** | Konfiguracja adresu serwera, tryb offline (dane z pamięci podręcznej) |

## Wymagania

- Node.js ≥ 18
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Uruchomiony serwer `kse_grid` (FastAPI) — patrz [instrukcja uruchomienia](../README.md)

## Uruchomienie

### 1. Uruchom serwer kse_grid

W katalogu głównym repozytorium:

```bash
uv run python main.py
```

Serwer startuje domyślnie na `http://127.0.0.1:8050`.

### 2. Zainstaluj zależności aplikacji mobilnej

```bash
cd mobile
npm install
```

### 3. Uruchom aplikację

```bash
# Expo Go (szybki start)
npx expo start

# Lub konkretna platforma:
npx expo start --android
npx expo start --ios
```

### 4. Połącz aplikację z serwerem

W aplikacji przejdź do zakładki **Ustawienia** i wpisz adres IP/URL serwera:

- **Symulator iOS** / przeglądarka: `http://127.0.0.1:8050`
- **Emulator Android**: `http://10.0.2.2:8050`
- **Urządzenie fizyczne w sieci LAN**: `http://<IP-komputera>:8050`

> **Uwaga:** Jeśli łączysz fizyczne urządzenie z serwerem uruchomionym na komputerze, upewnij się, że oba są w tej samej sieci Wi-Fi, a firewall nie blokuje portu 8050.

## Architektura

```
mobile/
├── app/                        # Expo Router — strony aplikacji
│   ├── _layout.tsx             # Root layout (providery kontekstu)
│   └── (tabs)/
│       ├── _layout.tsx         # Tab navigator
│       ├── index.tsx           # Ekran: Przegląd sieci
│       ├── buses.tsx           # Ekran: Szyny
│       ├── lines.tsx           # Ekran: Linie i trafo
│       ├── switches.tsx        # Ekran: Łączniki
│       └── settings.tsx        # Ekran: Ustawienia
├── src/
│   ├── api/
│   │   └── api.ts              # Klient API — odpowiednik lib/api.js z web
│   ├── components/             # Komponenty wielokrotnego użytku
│   │   ├── BusItem.tsx
│   │   ├── DiagnosticRow.tsx
│   │   ├── Feedback.tsx        # LoadingOverlay, ErrorBanner, OfflineBanner
│   │   ├── LineItem.tsx
│   │   ├── StatsCard.tsx
│   │   ├── StatusDot.tsx
│   │   ├── SwitchItem.tsx
│   │   ├── TabBarIcon.tsx
│   │   └── VoltageFilterBar.tsx
│   ├── constants/
│   │   └── colors.ts           # Paleta kolorów (dopasowana do web)
│   ├── context/
│   │   ├── NetworkContext.tsx   # Stan sieci, operacje na topologii
│   │   └── SettingsContext.tsx  # Adres serwera, persystencja ustawień
│   ├── types/
│   │   └── network.ts          # Typy TypeScript zgodne z API backendu
│   └── utils/
│       └── formatters.ts       # Formatery (odpowiednik lib/formatters.js z web)
├── app.json                    # Konfiguracja Expo
├── babel.config.js             # Konfiguracja Babel (alias @/ → src/)
├── package.json
└── tsconfig.json
```

## Integracja z backendem

Aplikacja mobilna łączy się z istniejącym API serwera FastAPI (`kse_grid/web_server.py`):

| Endpoint | Metoda | Opis |
|---|---|---|
| `/api/network` | `GET` | Pełny payload sieci (szyny, linie, trafo, switche, wyniki) |
| `/api/switches/{id}` | `PATCH` | Zmiana stanu łącznika |
| `/api/topology/reset` | `POST` | Reset topologii do stanu bazowego |

Backend został zaktualizowany o obsługę nagłówków **CORS**, co umożliwia połączenie z urządzeń mobilnych w sieci lokalnej.

## Tryb offline

Aplikacja automatycznie zapisuje ostatnie pobrane dane sieci w pamięci podręcznej (`AsyncStorage`). W przypadku braku połączenia z serwerem wyświetlane są dane z cache z banerem informującym o trybie offline.
