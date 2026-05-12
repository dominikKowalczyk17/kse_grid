"""Schemat edytowalnych parametrów elementów sieci pandapower.

Moduł trzyma w jednym miejscu listę pól, które frontend może modyfikować w karcie
selekcji oraz logikę bezpiecznej koercji typów. Chodzi o to, żeby warstwa HTTP
nie musiała znać szczegółów modelu pandapower, a `SwitchingSession` miał jedno
proste API do mutacji elementów.
"""

from __future__ import annotations

import math
from typing import Any

import pandas as pd
import pandapower as pp


# ---------------------------------------------------------------------------
# Schemat
# ---------------------------------------------------------------------------

# Każdy wpis: (column, label, type, unit, options, description)
# - type ∈ {"str", "float", "int", "bool", "enum"}
# - options używane tylko dla "enum"
# - description: krótki opis po polsku do tooltipa / modala pomocy
_BUS_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta szyny — pomocna do identyfikacji w wynikach i na grafie. "
     "Nie wpływa na wyniki obliczeń."),
    ("vn_kv", "Un", "float", "kV", None,
     "Napięcie znamionowe szyny (kV). Wartość bazowa do przeliczeń per-unit. "
     "Zmiana wymaga spójności z napięciami znamionowymi przyłączonych elementów."),
    ("type", "Typ szyny", "enum", None, ["b", "n", "m"],
     "Rodzaj węzła w modelu pandapower:\n"
     "• b – bus szyny (busbar),\n"
     "• n – węzeł (node) bez fizycznej szyny,\n"
     "• m – węzeł pomocniczy (muff) np. dla łamania linii."),
    ("zone", "Strefa", "str", None, None,
     "Dowolna etykieta strefy/regionu. Używana przy raportowaniu i grupowaniu, "
     "nie wpływa na load flow."),
    ("max_vm_pu", "U max", "float", "p.u.", None,
     "Górny dopuszczalny poziom napięcia (p.u.). Wykorzystywany w analizach "
     "naruszeń napięciowych i w OPF."),
    ("min_vm_pu", "U min", "float", "p.u.", None,
     "Dolny dopuszczalny poziom napięcia (p.u.). Wykorzystywany w analizach "
     "naruszeń napięciowych i w OPF."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, szyna i wszystkie podłączone do niej elementy są pomijane "
     "w obliczeniach (jak fizyczne odłączenie)."),
]

_LINE_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta linii — nie wpływa na wyniki, ułatwia identyfikację."),
    ("length_km", "Długość", "float", "km", None,
     "Długość linii w kilometrach. Mnożona przez parametry jednostkowe "
     "(R', X', C', G') przy budowaniu macierzy admitancji."),
    ("r_ohm_per_km", "R'", "float", "Ω/km", None,
     "Rezystancja jednostkowa linii (Ω/km). Decyduje o stratach czynnych "
     "i spadkach napięcia w stanie ustalonym."),
    ("x_ohm_per_km", "X'", "float", "Ω/km", None,
     "Reaktancja jednostkowa linii (Ω/km). Główny parametr decydujący "
     "o przepływie mocy biernej i kątach napięć."),
    ("c_nf_per_km", "C'", "float", "nF/km", None,
     "Pojemność jednostkowa do ziemi (nF/km). Wpływa na generację mocy biernej "
     "przez linię (efekt Ferrantiego przy małym obciążeniu)."),
    ("g_us_per_km", "G'", "float", "µS/km", None,
     "Konduktancja jednostkowa upływu do ziemi (µS/km). Zwykle bliska 0 "
     "dla linii napowietrznych."),
    ("max_i_ka", "I max", "float", "kA", None,
     "Termiczny prąd dopuszczalny linii (kA). Z tego oraz Un wyliczane jest "
     "obciążenie procentowe linii."),
    ("df", "Współ. derate", "float", None, None,
     "Współczynnik obniżenia obciążalności (derating factor). Wartość 1.0 "
     "oznacza brak obniżenia. Stosowany np. dla linii w niekorzystnych warunkach."),
    ("parallel", "Liczba równoległych", "int", None, None,
     "Liczba równolegle pracujących torów linii o identycznych parametrach. "
     "Zwiększenie zmniejsza wypadkową impedancję i zwiększa obciążalność."),
    ("type", "Typ linii", "enum", None, ["", "cs", "ol"],
     "Rodzaj linii w modelu pandapower:\n"
     "• cs – kabel (cable),\n"
     "• ol – linia napowietrzna (overhead line),\n"
     "• puste – nieokreślony."),
    ("max_loading_percent", "Max obciążenie", "float", "%", None,
     "Górny dopuszczalny poziom obciążenia linii (%). Wykorzystywany "
     "do oznaczania przeciążeń i w OPF."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, linia jest pomijana w obliczeniach (odłączenie obu końców)."),
]

_TRAFO_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta transformatora — nie wpływa na wyniki."),
    ("sn_mva", "Sn", "float", "MVA", None,
     "Moc znamionowa transformatora (MVA). Bazowa wartość do wyliczania "
     "obciążenia procentowego oraz impedancji w jednostkach fizycznych."),
    ("vn_hv_kv", "Un HV", "float", "kV", None,
     "Napięcie znamionowe strony górnego napięcia (kV). Powinno odpowiadać "
     "napięciu szyny HV, do której trafo jest podłączone."),
    ("vn_lv_kv", "Un LV", "float", "kV", None,
     "Napięcie znamionowe strony dolnego napięcia (kV). Powinno odpowiadać "
     "napięciu szyny LV."),
    ("vk_percent", "uk", "float", "%", None,
     "Napięcie zwarcia transformatora (%). Definiuje całkowitą impedancję "
     "krótkotrwałą — kluczowe dla rozpływu mocy i prądów zwarciowych."),
    ("vkr_percent", "ukr", "float", "%", None,
     "Czynna część napięcia zwarcia (%). Z niej wyliczane są straty obciążeniowe "
     "(uzwojenia). Musi być ≤ uk."),
    ("pfe_kw", "ΔP Fe", "float", "kW", None,
     "Straty jałowe (w żelazie) w kW. Stałe straty niezależne od obciążenia."),
    ("i0_percent", "i0", "float", "%", None,
     "Prąd jałowy w procentach prądu znamionowego. Determinuje gałąź "
     "magnesowania w schemacie zastępczym."),
    ("shift_degree", "Przesunięcie fazowe", "float", "°", None,
     "Przesunięcie fazowe wnoszone przez grupę połączeń uzwojeń (np. Yd11 = 30°). "
     "Istotne dla analiz wielofazowych i zwarć asymetrycznych."),
    ("tap_side", "Strona zaczepu", "enum", None, ["", "hv", "lv"],
     "Strona transformatora, na której znajduje się przełącznik zaczepów: "
     "hv = górne napięcie, lv = dolne napięcie."),
    ("tap_neutral", "Zaczep neutralny", "int", None, None,
     "Pozycja zaczepu odpowiadająca przekładni znamionowej (zwykle 0)."),
    ("tap_min", "Zaczep min", "int", None, None,
     "Najniższa dopuszczalna pozycja zaczepu."),
    ("tap_max", "Zaczep max", "int", None, None,
     "Najwyższa dopuszczalna pozycja zaczepu."),
    ("tap_step_percent", "Krok zaczepu", "float", "%", None,
     "Zmiana przekładni napięciowej na jeden zaczep (%)."),
    ("tap_step_degree", "Krok kąta zaczepu", "float", "°", None,
     "Zmiana przesunięcia fazowego na jeden zaczep (°). Dotyczy transformatorów "
     "fazoprzesuwnikowych."),
    ("tap_pos", "Pozycja zaczepu", "int", None, None,
     "Aktualna pozycja zaczepu używana w obliczeniach."),
    ("parallel", "Liczba równoległych", "int", None, None,
     "Liczba równolegle pracujących identycznych transformatorów reprezentowanych "
     "przez ten obiekt."),
    ("df", "Współ. derate", "float", None, None,
     "Współczynnik obniżenia obciążalności (derating factor)."),
    ("max_loading_percent", "Max obciążenie", "float", "%", None,
     "Górny dopuszczalny poziom obciążenia transformatora (%)."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, transformator jest pomijany w obliczeniach."),
]

_SWITCH_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta łącznika — nie wpływa na wyniki."),
    ("type", "Typ", "enum", None, ["", "CB", "LBS", "LS", "DS"],
     "Rodzaj aparatu:\n"
     "• CB – wyłącznik (Circuit Breaker),\n"
     "• LBS – rozłącznik mocy (Load-Break Switch),\n"
     "• LS – odłącznik mocy (Load Switch),\n"
     "• DS – odłącznik (Disconnector)."),
    ("closed", "Zamknięty", "bool", None, None,
     "Stan łącznika: zamknięty (przewodzi) lub otwarty (przerwa). "
     "Zmiana wpływa bezpośrednio na topologię i wynik load flow."),
    ("z_ohm", "Impedancja", "float", "Ω", None,
     "Impedancja zastępcza łącznika w stanie zamkniętym (Ω). Zwykle 0 — "
     "ustawiana niezerowo dla modelowania impedancji styków."),
    ("in_ka", "I max", "float", "kA", None,
     "Znamionowy prąd ciągły aparatu (kA)."),
]


_TABLES = {
    "bus": ("bus", _BUS_FIELDS),
    "line": ("line", _LINE_FIELDS),
    "trafo": ("trafo", _TRAFO_FIELDS),
    "switch": ("switch", _SWITCH_FIELDS),
}


def field_schema() -> dict[str, list[dict[str, Any]]]:
    """Zwraca schemat edytowalnych pól w formacie nadającym się do JSON-a."""
    schema: dict[str, list[dict[str, Any]]] = {}
    for kind, (_table, fields) in _TABLES.items():
        schema[kind] = [
            {
                "field": name,
                "label": label,
                "type": ftype,
                "unit": unit,
                "options": options,
                "description": description,
            }
            for (name, label, ftype, unit, options, description) in fields
        ]
    return schema


# ---------------------------------------------------------------------------
# Odczyt / zapis
# ---------------------------------------------------------------------------

def _resolve(net: pp.pandapowerNet, kind: str, element_id: int) -> tuple[pd.DataFrame, list[tuple]]:
    if kind not in _TABLES:
        raise KeyError(f"Nieznany typ elementu: {kind!r}.")
    table_name, fields = _TABLES[kind]
    table = getattr(net, table_name)
    if element_id not in table.index:
        raise KeyError(f"Nie istnieje element {kind} #{element_id}.")
    return table, fields


def read_element_params(net: pp.pandapowerNet, kind: str, element_id: int) -> dict[str, Any]:
    """Zwraca bieżące wartości pól edytowalnych dla danego elementu."""
    table, fields = _resolve(net, kind, element_id)
    out: dict[str, Any] = {}
    for name, _label, ftype, _unit, _options, _description in fields:
        if name not in table.columns:
            out[name] = None
            continue
        raw = table.at[element_id, name]
        out[name] = _normalize_for_json(raw, ftype)
    return out


def apply_element_update(
    net: pp.pandapowerNet,
    kind: str,
    element_id: int,
    fields: dict[str, Any],
) -> None:
    """Mutuje wiersz elementu zgodnie z dostarczonymi polami.

    Rzuca `ValueError` przy nieznanym polu lub nieudanej koercji typu, dzięki
    czemu warstwa HTTP może bez analizy zwrócić 400.
    """
    table, schema_fields = _resolve(net, kind, element_id)
    schema_index = {
        name: (ftype, options)
        for (name, _label, ftype, _unit, options, _description) in schema_fields
    }

    for raw_name, raw_value in fields.items():
        if raw_name not in schema_index:
            raise ValueError(f"Pole {raw_name!r} nie jest edytowalne dla {kind}.")
        ftype, options = schema_index[raw_name]
        coerced = _coerce(raw_name, raw_value, ftype, options)
        if raw_name not in table.columns:
            table[raw_name] = None
        table.at[element_id, raw_name] = coerced


# ---------------------------------------------------------------------------
# Helpery typów
# ---------------------------------------------------------------------------

def _normalize_for_json(value: Any, ftype: str) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    if pd.isna(value):
        return None
    if ftype == "bool":
        return bool(value)
    if ftype == "int":
        try:
            return int(value)
        except (TypeError, ValueError):
            return None
    if ftype == "float":
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
    return str(value)


def _coerce(name: str, value: Any, ftype: str, options: list | None) -> Any:
    if value is None or (isinstance(value, str) and value == "" and ftype != "str"):
        # Pola opcjonalne – pozwalamy na "wyzerowanie" (NaN) wszędzie poza str.
        if ftype == "str":
            return ""
        return float("nan") if ftype in {"float", "int"} else None

    if ftype == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in {"true", "1", "yes", "tak"}
        return bool(value)

    if ftype == "int":
        try:
            return int(float(value))
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Pole {name!r} wymaga liczby całkowitej.") from exc

    if ftype == "float":
        try:
            result = float(value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Pole {name!r} wymaga liczby.") from exc
        if math.isnan(result) or math.isinf(result):
            raise ValueError(f"Pole {name!r} ma nieprawidłową wartość.")
        return result

    if ftype == "enum":
        text = str(value)
        if options is not None and text not in options:
            raise ValueError(f"Pole {name!r} przyjmuje tylko: {options}.")
        return text

    return str(value)
