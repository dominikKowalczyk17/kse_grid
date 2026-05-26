"""Schemat edytowalnych parametrów elementów sieci pandapower.

Moduł trzyma w jednym miejscu listę pól, które frontend może modyfikować w karcie
selekcji oraz logikę bezpiecznej koercji typów. Chodzi o to, żeby warstwa HTTP
nie musiała znać szczegółów modelu pandapower, a `SwitchingSession` miał jedno
proste API do mutacji elementów.
"""

from __future__ import annotations

import math
from typing import Any

import pandapower as pp
import pandas as pd

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
    ("c_nf_per_km", "C' (źródło B')", "float", "nF/km", None,
     "Pojemność jednostkowa do ziemi (nF/km). To pole jest źródłem susceptancji "
     "linii w macierzy admitancji — pandapower nie trzyma B' osobno, lecz wylicza "
     "B' = 2π·f·C'·10⁻³ [µS/km] (przy 50 Hz: B' ≈ 0.3142·C').\n"
     "Z MATPOWER: kolumna `b` (per-unit, total) jest konwertowana na C' przez "
     "importer. Wpływa na generację mocy biernej linii (efekt Ferrantiego "
     "przy małym obciążeniu)."),
    ("g_us_per_km", "G' (upływność)", "float", "µS/km", None,
     "Konduktancja jednostkowa upływu do ziemi (µS/km). Z MATPOWER nie jest "
     "wczytywana (matpower nie ma kolumny G dla branchu) — zwykle bliska 0 "
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


_GEN_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta generatora — pomocna do identyfikacji."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, generator jest pomijany w obliczeniach (wyłączony z ruchu). "
     "Wyłączenie zmienia szyne z PV na PQ i kasuje regulację napięcia."),
    ("p_mw", "P zadana", "float", "MW", None,
     "Nastawiona moc czynna generatora (MW). W load flow PV generator utrzymuje "
     "to nastawienie do granic Pmax/Pmin."),
    ("vm_pu", "U zadane", "float", "p.u.", None,
     "Nastawiony poziom napięcia (p.u.) na szynie, którą generator reguluje. "
     "Aktywne tylko gdy generator jest PV (in_service=True)."),
    ("max_p_mw", "P max", "float", "MW", None,
     "Maksymalna moc czynna generatora (MW). Ogranicza output w OPF."),
    ("min_p_mw", "P min", "float", "MW", None,
     "Minimalna moc czynna generatora (MW). Ogranicza output w OPF."),
    ("max_q_mvar", "Q max", "float", "Mvar", None,
     "Maksymalna moc bierna (Mvar). Po osiągnięciu limitu generator przełącza się "
     "z regulacji napięcia na regulację Q."),
    ("min_q_mvar", "Q min", "float", "Mvar", None,
     "Minimalna moc bierna (Mvar). Ogranicza Q od dołu."),
]


_LOAD_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta obciążenia — pomocna do identyfikacji."),
    ("p_mw", "P obc.", "float", "MW", None,
     "Pobierana moc czynna (MW). MATPOWER `Pd` w wierszu szyny mapuje się tutaj."),
    ("q_mvar", "Q obc.", "float", "Mvar", None,
     "Pobierana moc bierna (Mvar). MATPOWER `Qd`."),
    ("const_z_percent", "Udział stałej Z", "float", "%", None,
     "Procent obciążenia modelowany jako stała impedancja (ZIP). Suma Z+I+P powinna = 100."),
    ("const_i_percent", "Udział stałego I", "float", "%", None,
     "Procent obciążenia modelowany jako stały prąd (ZIP)."),
    ("sn_mva", "Sn", "float", "MVA", None,
     "Moc znamionowa obciążenia (MVA) — używana do skalowania ZIP."),
    ("scaling", "Współ. skalowania", "float", None, None,
     "Mnożnik P i Q stosowany w obliczeniach (np. profil dobowy)."),
    ("type", "Typ", "enum", None, ["", "wye", "delta"],
     "Schemat połączenia: wye (gwiazda) lub delta (trójkąt)."),
    ("controllable", "Sterowalne (OPF)", "bool", None, None,
     "Czy OPF może modyfikować P/Q (load shedding / DSM)."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, obciążenie nie jest uwzględniane w obliczeniach."),
]

_SGEN_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta generatora statycznego (PV/wiatr/farma)."),
    ("p_mw", "P", "float", "MW", None,
     "Wstrzykiwana moc czynna (MW). Konwencja: dodatnie = generacja."),
    ("q_mvar", "Q", "float", "Mvar", None,
     "Wstrzykiwana moc bierna (Mvar)."),
    ("sn_mva", "Sn", "float", "MVA", None,
     "Moc znamionowa (MVA)."),
    ("scaling", "Współ. skalowania", "float", None, None,
     "Mnożnik P i Q stosowany w obliczeniach."),
    ("type", "Typ", "str", None, None,
     "Dowolna etykieta typu (np. 'PV', 'WT'). Nie wpływa na load flow."),
    ("current_source", "Źródło prądowe", "bool", None, None,
     "Gdy True, model traktuje jak źródło prądowe (istotne dla zwarć)."),
    ("max_p_mw", "P max", "float", "MW", None,
     "Maksymalna moc czynna (OPF)."),
    ("min_p_mw", "P min", "float", "MW", None,
     "Minimalna moc czynna (OPF)."),
    ("max_q_mvar", "Q max", "float", "Mvar", None,
     "Maksymalna moc bierna (OPF)."),
    ("min_q_mvar", "Q min", "float", "Mvar", None,
     "Minimalna moc bierna (OPF)."),
    ("controllable", "Sterowalne (OPF)", "bool", None, None,
     "Czy OPF może zmieniać P/Q."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, pomijany w obliczeniach."),
]

_EXT_GRID_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta zasilania zewnętrznego (slack)."),
    ("vm_pu", "U zadane", "float", "p.u.", None,
     "Nastawione napięcie szyny slack (p.u.). MATPOWER `Vg` dla wiersza slack."),
    ("va_degree", "Kąt zadany", "float", "°", None,
     "Kąt napięcia szyny slack (°). Zwykle 0 jako węzeł referencyjny."),
    ("slack_weight", "Waga slack", "float", None, None,
     "Udział w pokryciu strat — istotne tylko gdy jest wiele slacków."),
    ("max_p_mw", "P max", "float", "MW", None,
     "Maksymalna moc czynna oddawana do sieci (OPF)."),
    ("min_p_mw", "P min", "float", "MW", None,
     "Minimalna moc czynna (OPF, może być ujemna = pobór)."),
    ("max_q_mvar", "Q max", "float", "Mvar", None,
     "Maksymalna moc bierna (OPF)."),
    ("min_q_mvar", "Q min", "float", "Mvar", None,
     "Minimalna moc bierna (OPF)."),
    ("controllable", "Sterowalne (OPF)", "bool", None, None,
     "Czy OPF może modyfikować P/Q slacka."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, slack nie jest aktywny — system traci punkt referencyjny."),
]

_SHUNT_FIELDS: list[tuple] = [
    ("name", "Nazwa", "str", None, None,
     "Etykieta elementu boczngo (bateria kondensatorów / dławik)."),
    ("p_mw", "P (Gs)", "float", "MW", None,
     "Czynne straty bocznika przy napięciu znamionowym. MATPOWER `Gs`."),
    ("q_mvar", "Q (Bs)", "float", "Mvar", None,
     "Generacja Q przy U=1 p.u. Dodatnie = kondensator, ujemne = dławik. MATPOWER `Bs`."),
    ("vn_kv", "Un", "float", "kV", None,
     "Napięcie znamionowe bocznika (kV) — baza do przeliczenia admitancji."),
    ("step", "Bieżący stopień", "int", None, None,
     "Aktualnie załączony stopień regulacji."),
    ("max_step", "Liczba stopni", "int", None, None,
     "Maksymalna liczba stopni regulacji."),
    ("in_service", "W eksploatacji", "bool", None, None,
     "Gdy wyłączone, bocznik nie wnosi admitancji do macierzy."),
]


# ---------------------------------------------------------------------------
# Schemat tworzenia elementów
# ---------------------------------------------------------------------------

# Struktura: {kind: {required: [(name, type)], optional: [(name, type, options)], defaults: {name: value}}}
_CREATION_SCHEMA: dict[str, dict[str, Any]] = {
    "bus": {
        "required": [("vn_kv", "float")],
        "optional": [
            ("name", "str", None),
            ("type", "enum", ["b", "n", "m"]),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "type": "b", "in_service": True},
    },
    "load": {
        "required": [("bus", "int"), ("p_mw", "float")],
        "optional": [
            ("name", "str", None),
            ("q_mvar", "float", None),
            ("scaling", "float", None),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "q_mvar": 0.0, "scaling": 1.0, "in_service": True},
    },
    "sgen": {
        "required": [("bus", "int"), ("p_mw", "float")],
        "optional": [
            ("name", "str", None),
            ("q_mvar", "float", None),
            ("scaling", "float", None),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "q_mvar": 0.0, "scaling": 1.0, "in_service": True},
    },
    "ext_grid": {
        "required": [("bus", "int")],
        "optional": [
            ("name", "str", None),
            ("vm_pu", "float", None),
            ("va_degree", "float", None),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "vm_pu": 1.0, "va_degree": 0.0, "in_service": True},
    },
    "shunt": {
        "required": [("bus", "int"), ("q_mvar", "float"), ("vn_kv", "float")],
        "optional": [
            ("name", "str", None),
            ("p_mw", "float", None),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "p_mw": 0.0, "in_service": True},
    },
    "line": {
        "required": [
            ("from_bus", "int"), ("to_bus", "int"), ("length_km", "float"),
            ("r_ohm_per_km", "float"), ("x_ohm_per_km", "float"),
            ("c_nf_per_km", "float"), ("max_i_ka", "float"),
        ],
        "optional": [
            ("name", "str", None),
            ("g_us_per_km", "float", None),
            ("parallel", "int", None),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "g_us_per_km": 0.0, "parallel": 1, "in_service": True},
    },
    "trafo": {
        "required": [
            ("hv_bus", "int"), ("lv_bus", "int"), ("sn_mva", "float"),
            ("vn_hv_kv", "float"), ("vn_lv_kv", "float"),
            ("vk_percent", "float"), ("vkr_percent", "float"),
            ("pfe_kw", "float"), ("i0_percent", "float"),
        ],
        "optional": [
            ("name", "str", None),
            ("tap_neutral", "int", None),
            ("tap_min", "int", None),
            ("tap_max", "int", None),
            ("tap_step_percent", "float", None),
            ("tap_pos", "int", None),
            ("parallel", "int", None),
            ("in_service", "bool", None),
        ],
        "defaults": {
            "name": "", "tap_neutral": 0, "tap_min": -2, "tap_max": 2,
            "tap_step_percent": 1.25, "tap_pos": 0, "parallel": 1, "in_service": True,
        },
    },
    "gen": {
        "required": [("bus", "int"), ("p_mw", "float")],
        "optional": [
            ("name", "str", None),
            ("vm_pu", "float", None),
            ("max_q_mvar", "float", None),
            ("min_q_mvar", "float", None),
            ("max_p_mw", "float", None),
            ("min_p_mw", "float", None),
            ("in_service", "bool", None),
        ],
        "defaults": {"name": "", "vm_pu": 1.0, "in_service": True},
    },
}

_CREATORS: dict[str, Any] = {
    "bus": pp.create_bus,
    "load": pp.create_load,
    "sgen": pp.create_sgen,
    "ext_grid": pp.create_ext_grid,
    "shunt": pp.create_shunt,
    "line": pp.create_line_from_parameters,
    "trafo": pp.create_transformer_from_parameters,
    "gen": pp.create_gen,
}

_AUTO_NAME_PREFIX: dict[str, str] = {
    "bus": "Bus",
    "load": "Load",
    "sgen": "SGen",
    "ext_grid": "Grid",
    "shunt": "Shunt",
    "line": "Line",
    "trafo": "Trafo",
    "gen": "Gen",
}


_TABLES = {
    "bus": ("bus", _BUS_FIELDS),
    "line": ("line", _LINE_FIELDS),
    "trafo": ("trafo", _TRAFO_FIELDS),
    "switch": ("switch", _SWITCH_FIELDS),
    "gen": ("gen", _GEN_FIELDS),
    "load": ("load", _LOAD_FIELDS),
    "sgen": ("sgen", _SGEN_FIELDS),
    "ext_grid": ("ext_grid", _EXT_GRID_FIELDS),
    "shunt": ("shunt", _SHUNT_FIELDS),
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


# ---------------------------------------------------------------------------
# Tworzenie elementów
# ---------------------------------------------------------------------------

def validate_creation_fields(kind: str, fields: dict[str, Any]) -> None:
    """Rzuca ValueError jeśli brakuje wymaganych pól dla danego rodzaju elementu."""
    if kind not in _CREATION_SCHEMA:
        raise ValueError(f"Tworzenie elementu {kind!r} nie jest obsługiwane.")
    schema = _CREATION_SCHEMA[kind]
    missing = [name for name, _ in schema["required"] if name not in fields or fields[name] is None]
    if missing:
        raise ValueError(f"Brakujące wymagane pola: {', '.join(missing)}.")


def create_element_in_net(net: pp.pandapowerNet, kind: str, fields: dict[str, Any]) -> int:
    """Tworzy element w sieci i zwraca jego index.

    Rzuca ValueError przy brakujących polach, nieznanych wartościach lub złej referencji szyny.
    """
    validate_creation_fields(kind, fields)
    schema = _CREATION_SCHEMA[kind]

    req_names = {name for name, _ in schema["required"]}
    kwargs: dict[str, Any] = dict(schema["defaults"])

    for name, ftype in schema["required"]:
        kwargs[name] = _coerce(name, fields[name], ftype, None)

    opt_index = {name: (ftype, options) for name, ftype, options in schema["optional"]}
    for name, value in fields.items():
        if name in opt_index and name not in req_names:
            ftype, options = opt_index[name]
            kwargs[name] = _coerce(name, value, ftype, options)

    if "bus" in kwargs and not net.bus.empty and int(kwargs["bus"]) not in net.bus.index:
        raise ValueError(f"Szyna o id={kwargs['bus']} nie istnieje.")

    for bus_field in ("from_bus", "to_bus", "hv_bus", "lv_bus"):
        if bus_field in kwargs and not net.bus.empty and int(kwargs[bus_field]) not in net.bus.index:
            raise ValueError(f"Szyna o id={kwargs[bus_field]} ({bus_field}) nie istnieje.")

    if kind == "line" and "from_bus" in kwargs and "to_bus" in kwargs:
        if int(kwargs["from_bus"]) == int(kwargs["to_bus"]):
            raise ValueError("Linia nie może łączyć szyny z samą sobą (from_bus == to_bus).")

    if kind == "trafo" and "hv_bus" in kwargs and "lv_bus" in kwargs:
        if int(kwargs["hv_bus"]) == int(kwargs["lv_bus"]):
            raise ValueError("Transformator nie może łączyć szyny z samą sobą (hv_bus == lv_bus).")

    if kind == "gen" and "bus" in kwargs:
        bus_id = int(kwargs["bus"])
        if not net.ext_grid.empty and bus_id in net.ext_grid["bus"].values:
            raise ValueError(
                f"Szyna #{bus_id} jest już węzłem slack (ext_grid) — "
                "dodanie generatora PV spowodowałoby konflikt węzłów referencyjnych."
            )

    try:
        idx = int(_CREATORS[kind](net, **kwargs))
    except (ValueError, KeyError) as exc:
        raise ValueError(f"Błąd pandapower przy tworzeniu {kind}: {exc}") from exc
    except Exception as exc:
        raise ValueError(f"Nieoczekiwany błąd przy tworzeniu {kind}: {exc}") from exc

    table = getattr(net, kind)
    if "name" in table.columns and not str(table.at[idx, "name"]).strip():
        prefix = _AUTO_NAME_PREFIX.get(kind, kind.capitalize())
        table.at[idx, "name"] = f"{prefix} {idx + 1}"

    return idx
