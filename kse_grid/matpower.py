from __future__ import annotations

import json
import re
import tempfile
from numbers import Integral, Real
from pathlib import Path

import pandapower as pp
from pandapower.converter.matpower import from_mpc


def load_matpower_case(case_file: str | Path, f_hz: int = 50) -> pp.pandapowerNet:
    """Ładuje przypadek matpower (.m) do pandapower."""
    case_path = Path(case_file).expanduser().resolve()
    net = _import_matpower_case(case_path, f_hz=f_hz)
    net.name = case_path.stem
    setattr(net, "_case_path", str(case_path))
    _normalize_imported_net(net)
    _load_geo_sidecar(net, case_path)
    seed_operational_switches(net)
    return net


def _import_matpower_case(case_path: Path, f_hz: int) -> pp.pandapowerNet:
    try:
        return from_mpc(str(case_path), f_hz=f_hz)
    except IndexError as exc:
        if "too many indices for array" not in str(exc):
            raise
        return _import_without_gencost(case_path, f_hz=f_hz)


def _import_without_gencost(case_path: Path, f_hz: int) -> pp.pandapowerNet:
    text = case_path.read_text(encoding="utf-8", errors="ignore")
    stripped, replacements = re.subn(
        r"(?ms)^mpc\.gencost\s*=\s*\[.*?^];\s*",
        "",
        text,
    )
    if replacements == 0:
        raise RuntimeError(f"Nie udało się usunąć bloku gencost z {case_path.name}")

    with tempfile.NamedTemporaryFile("w", suffix=".m", delete=False, encoding="utf-8") as handle:
        handle.write(stripped)
        temp_path = Path(handle.name)

    try:
        return from_mpc(str(temp_path), f_hz=f_hz)
    finally:
        temp_path.unlink(missing_ok=True)


def _normalize_imported_net(net: pp.pandapowerNet):
    bus_names = net.bus["name"].fillna("").astype(str).str.strip()
    empty_bus_names = bus_names.eq("")
    for bus_idx in net.bus.index[empty_bus_names]:
        net.bus.at[bus_idx, "name"] = f"Bus {_to_int(bus_idx) + 1}"

    line_names = net.line["name"].fillna("").astype(str).str.strip()
    empty_line_names = line_names.eq("")
    for line_idx in net.line.index[empty_line_names]:
        row = net.line.loc[line_idx]
        from_name = net.bus.at[_to_int(row.from_bus), "name"]
        to_name = net.bus.at[_to_int(row.to_bus), "name"]
        net.line.at[line_idx, "name"] = f"Line {_to_int(line_idx) + 1}: {from_name} -> {to_name}"

    trafo_names = net.trafo["name"].fillna("").astype(str).str.strip()
    empty_trafo_names = trafo_names.eq("")
    for trafo_idx in net.trafo.index[empty_trafo_names]:
        row = net.trafo.loc[trafo_idx]
        hv_name = net.bus.at[_to_int(row.hv_bus), "name"]
        lv_name = net.bus.at[_to_int(row.lv_bus), "name"]
        net.trafo.at[trafo_idx, "name"] = f"Trafo {_to_int(trafo_idx) + 1}: {hv_name} -> {lv_name}"

    _ensure_reference_bus(net)


def _ensure_reference_bus(net: pp.pandapowerNet) -> None:
    active_ext_grid = (
        not net.ext_grid.empty and
        bool(net.ext_grid["in_service"].fillna(False).astype(bool).any())
    )
    active_slack_gen = (
        not net.gen.empty and
        "slack" in net.gen.columns and
        bool((net.gen["in_service"].fillna(False).astype(bool) & net.gen["slack"].fillna(False).astype(bool)).any())
    )
    if active_ext_grid or active_slack_gen:
        return

    if not net.ext_grid.empty:
        bus_in_service = net.bus["in_service"].fillna(False).astype(bool)
        candidates = [
            idx for idx, row in net.ext_grid.iterrows()
            if int(row.bus) in bus_in_service.index and bool(bus_in_service.at[int(row.bus)])
        ]
        if candidates:
            net.ext_grid.at[candidates[0], "in_service"] = True
            return

    if not net.gen.empty:
        bus_in_service = net.bus["in_service"].fillna(False).astype(bool)
        candidates = [
            idx for idx, row in net.gen.iterrows()
            if int(row.bus) in bus_in_service.index and bool(bus_in_service.at[int(row.bus)])
        ]
        if candidates:
            gen_idx = candidates[0]
            net.gen.at[gen_idx, "in_service"] = True
            net.gen.at[gen_idx, "slack"] = True
            if "slack_weight" in net.gen.columns:
                slack_weight = net.gen.at[gen_idx, "slack_weight"]
                if slack_weight is None or slack_weight != slack_weight:
                    net.gen.at[gen_idx, "slack_weight"] = 1.0


def _load_geo_sidecar(net: pp.pandapowerNet, case_path: Path) -> None:
    for sidecar_path in _candidate_geo_sidecars(case_path):
        if not sidecar_path.exists():
            continue
        _apply_geojson_sidecar(net, sidecar_path)
        setattr(net, "_geo_source", str(sidecar_path))
        break


def seed_operational_switches(net: pp.pandapowerNet) -> None:
    """
    Dodaje do sieci operacyjne switche pandapower na końcach linii i transformatorów.

    Matpower opisuje gałęzie głównie jako elementy typu branch z flagą aktywności
    (`branch status`). Po imporcie przez `from_mpc()` dostajemy więc poprawne tabele
    `net.line` / `net.trafo` oraz ich `in_service`, ale tabela `net.switch` zostaje
    pusta. To utrudnia późniejsze sterowanie topologią przez API, bo nie ma czego
    "otwierać" i "zamykać" bez bezpośredniego ruszania samych linii lub traf.

    Ten helper uzupełnia brakujący poziom topologiczny:
    - dla każdej linii tworzy po jednym switchu typu `l` na obu końcach,
    - dla każdego transformatora tworzy po jednym switchu typu `t` na obu końcach.

    Dzięki temu można później:
    - rozcinać sieć na wyspy przez `net.switch.closed = False`,
    - analizować komponenty spójne z `respect_switches = True`,
    - uruchamiać load flow dla różnych stanów łączeniowych bez usuwania elementów.

    Funkcja jest idempotentna: jeżeli jakiś switch już istnieje, nie doda duplikatu.
    Stan początkowy switcha odzwierciedla `in_service` danego elementu, ale helper
    celowo nie zmienia samego `in_service` — dostępność techniczna elementu i jego
    stan łączeniowy to w pandapower dwa różne poziomy modelu.

    Parameters
    ----------
    net:
        Sieć pandapower po imporcie MATPOWER, przygotowana do dalszej manipulacji
        topologią na poziomie switchy.
    """
    # Najpierw zbieramy wszystkie już istniejące switche. Dzięki temu helper można
    # wywołać wiele razy bez ryzyka, że każda próba doda kolejny zestaw duplikatów.
    existing_switches = {
        (_to_int(row.bus), _to_int(row.element), str(row.et))
        for _, row in net.switch.iterrows()
    }

    # Każdą aktywną linię chcemy móc rozłączyć od obu stron, więc seedujemy dwa
    # switche bus-line: jeden przy busie początkowym, drugi przy końcowym.
    for line_idx, row in net.line.iterrows():
        # Pandas daje nam indeks wiersza tabeli line; normalizujemy go do zwykłego
        # int, bo taki identyfikator będzie potem przekazywany do create_switch().
        line_id = _to_int(line_idx)

        # Początkowy stan switcha wyprowadzamy z in_service linii:
        # - linia aktywna -> switch startuje jako zamknięty,
        # - linia wyłączona -> switch startuje jako otwarty.
        # Dzięki temu świeżo zaimportowana sieć zachowuje ten sam stan pracy.
        closed = _initial_switch_state(row)

        # Nazwę bierzemy z modelu, a jeśli jej brakuje, budujemy prosty fallback.
        # Ten tekst trafia do net.switch.name i później ułatwia debugowanie.
        line_name = str(row.get("name") or f"Line {line_id + 1}")

        # Switch po stronie "from" oznacza możliwość otwarcia pola liniowego od
        # strony busa początkowego.
        _create_bus_element_switch(
            net=net,
            bus_id=_to_int(row.from_bus),
            element_id=line_id,
            et="l",
            closed=closed,
            name=f"{line_name} [from]",
            existing_switches=existing_switches,
        )

        # Analogiczny switch po stronie "to" daje niezależną kontrolę od drugiego
        # końca tej samej linii.
        _create_bus_element_switch(
            net=net,
            bus_id=_to_int(row.to_bus),
            element_id=line_id,
            et="l",
            closed=closed,
            name=f"{line_name} [to]",
            existing_switches=existing_switches,
        )

    # Dla transformatorów robimy dokładnie to samo, tylko używamy typu switcha `t`
    # i podpinamy go do strony HV oraz LV. To pozwala później otwierać pole trafo
    # tak samo, jak w operacjach sieciowych robi się to dla linii.
    for trafo_idx, row in net.trafo.iterrows():
        # Identyfikator transformatora z tabeli net.trafo.
        trafo_id = _to_int(trafo_idx)

        # Początkowy stan switchy trafo także dziedziczymy po in_service.
        closed = _initial_switch_state(row)

        # Czytelna nazwa pomaga rozpoznać, który switch odpowiada której stronie
        # transformatora.
        trafo_name = str(row.get("name") or f"Trafo {trafo_id + 1}")

        # strona wysokiego napięcia (HV).
        _create_bus_element_switch(
            net=net,
            bus_id=_to_int(row.hv_bus),
            element_id=trafo_id,
            et="t",
            closed=closed,
            name=f"{trafo_name} [hv]",
            existing_switches=existing_switches,
        )

        # strona niskiego napięcia (LV).
        _create_bus_element_switch(
            net=net,
            bus_id=_to_int(row.lv_bus),
            element_id=trafo_id,
            et="t",
            closed=closed,
            name=f"{trafo_name} [lv]",
            existing_switches=existing_switches,
        )


def _initial_switch_state(row: object) -> bool:
    """
    Wyznacza stan początkowy switcha na podstawie wiersza elementu z pandapower.

    Helper jest mały, ale pełni ważną funkcję tłumacza między dwoma poziomami modelu:
    `line/trafo.in_service` mówi, czy element jest technicznie aktywny po imporcie,
    a my z tej informacji budujemy startowy stan logiczny nowego switcha (`closed`).

    Parameters
    ----------
    row:
        Wiersz pandas reprezentujący element sieci, zwykle z `net.line` albo
        `net.trafo`.

    Returns
    -------
    bool
        `True`, jeśli switch powinien wystartować jako zamknięty, w przeciwnym razie
        `False`.
    """
    # Oczekujemy obiektu podobnego do pandas. Series, który ma metodę get().
    # Jeśli ktoś poda tu inny obiekt, wybieramy bezpieczne domyślne zachowanie:
    # traktujemy element jako aktywny i zostawiamy switch zamknięty.
    if not hasattr(row, "get"):
        return True

    # Czytamy flagę in_service. Gdy kolumny nie ma, też zakładamy stan aktywny,
    # bo tak zachowuje się większość importów do pandapower.
    raw = row.get("in_service", True)

    # Pandas zwykle zwraca bool, ale pomocniczo obsługujemy też stringi, żeby
    # helper był odporny na niestandardowe lub ręcznie modyfikowane dane.
    if isinstance(raw, str):
        return raw.strip().lower() not in {"false", "0", "no"}

    # Dla bool / numpy.bool_ / liczb wystarczy zwykłe rzutowanie na bool.
    return bool(raw)


def _create_bus_element_switch(
    net: pp.pandapowerNet,
    bus_id: int,
    element_id: int,
    et: str,
    closed: bool,
    name: str,
    existing_switches: set[tuple[int, int, str]],
) -> None:
    """
    Tworzy pojedynczy switch bus-element, jeśli taki switch jeszcze nie istnieje.

    To jest najniższy poziom "fabryki switchy". `seed_operational_switches()`
    decyduje *dla jakich* elementów tworzyć switche, a ten helper odpowiada już za
    sam bezpieczny zapis do `net.switch`.

    Unikalność switcha definiujemy jako trójkę:
    ` (bus_id, element_id, et)`, czyli:
    - przy którym busie jesteśmy,
    - do którego elementu się odnosimy,
    - jakiego typu jest połączenie (`l` albo `t`).

    Parameters
    ----------
    net:
        Sieć pandapower, do której ma zostać dopisany switch.
    bus_id:
        Indeks busa, po którego stronie switch ma być wstawiony.
    element_id:
        Indeks linii albo transformatora, do którego switch należy.
    et:
        Typ switcha pandapower: `l` dla linii albo `t` dla transformatora.
    closed:
        Początkowy stan łączeniowy switcha.
    name:
        Czytelna nazwa techniczna zapisywana w `net.switch.name`.
    existing_switches:
        Zbiór już istniejących kluczy switchy, używany do kontroli duplikatów.
    """
    # Budujemy klucz logiczny opisujący "ten konkretny switch przy tym końcu
    # tego konkretnego elementu".
    key = (bus_id, element_id, et)

    # Jeśli taki wpis już istnieje, nic nie robimy. Dzięki temu wywołanie helpera
    # jest bezpieczne nawet wtedy, gdy loader lub test odpali go drugi raz.
    if key in existing_switches:
        return

    # Tworzymy switch typu bus-element:
    # - bus wskazuje szynę po tej stronie,
    # - element wskazuje linię albo trafo,
    # - et określa, jak interpretować pole element.
    # `type="CB"` traktujemy tu jako rozsądny domyślny aparat łączeniowy
    # do operacji topologicznych.
    pp.create_switch(
        net,
        bus=bus_id,
        element=element_id,
        et=et,
        closed=closed,
        type="CB",
        name=name,
    )

    # Po pomyślnym utworzeniu switcha od razu dopisujemy jego klucz do cache'u,
    # żeby kolejne wywołania w tej samej sesji nie utworzyły dubla.
    existing_switches.add(key)


def _candidate_geo_sidecars(case_path: Path) -> list[Path]:
    stem = case_path.stem
    return [
        case_path.with_suffix(".geojson"),
        case_path.with_suffix(".json"),
        case_path.with_name(f"{stem}.wgs84.geojson"),
        case_path.with_name(f"{stem}_wgs84.geojson"),
        case_path.with_name(f"{stem}_geo.geojson"),
    ]


def _apply_geojson_sidecar(net: pp.pandapowerNet, sidecar_path: Path) -> None:
    payload = json.loads(sidecar_path.read_text(encoding="utf-8"))
    features = payload.get("features", [])
    if payload.get("type") != "FeatureCollection" or not isinstance(features, list):
        raise ValueError(f"{sidecar_path.name} musi być GeoJSON FeatureCollection")

    id_lookup = {int(idx): int(idx) for idx in net.bus.index}
    one_based_lookup = {int(idx) + 1: int(idx) for idx in net.bus.index}
    name_lookup = {
        str(net.bus.at[idx, "name"]).strip().casefold(): int(idx)
        for idx in net.bus.index
        if str(net.bus.at[idx, "name"]).strip()
    }

    matched = 0
    renamed = 0
    for feature in features:
        if not isinstance(feature, dict):
            continue
        geometry = feature.get("geometry") or {}
        if geometry.get("type") != "Point":
            continue

        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            continue

        bus_idx = _match_geo_feature_to_bus(feature, id_lookup, one_based_lookup, name_lookup)
        if bus_idx is None:
            continue

        lon = _to_float(coordinates[0])
        lat = _to_float(coordinates[1])
        net.bus.at[bus_idx, "geo"] = json.dumps(
            {"type": "Point", "coordinates": [lon, lat]},
            separators=(",", ":"),
        )

        properties = feature.get("properties") or {}
        station = _clean_station_name(properties.get("station"))
        if station:
            current = str(net.bus.at[bus_idx, "name"]).strip()
            if not current or _DEFAULT_BUS_NAME_RE.match(current):
                vn = _to_float(net.bus.at[bus_idx, "vn_kv"])
                net.bus.at[bus_idx, "name"] = f"{station} {vn:g} kV"
                renamed += 1

        matched += 1

    if matched == 0:
        raise ValueError(f"{sidecar_path.name} nie zawiera żadnych dopasowanych punktów szyn")

    if renamed:
        _refresh_composite_names(net)


_DEFAULT_BUS_NAME_RE = re.compile(r"^(?:Bus\s+)?\d+$", re.IGNORECASE)
_DEFAULT_LINE_NAME_RE = re.compile(r"^(?:Line|Linia)\s+\d+:\s")
_DEFAULT_TRAFO_NAME_RE = re.compile(r"^Trafo\s+\d+:\s")
_STATION_PREFIX_RE = re.compile(r"^\s*\d+\s+")
_STATION_NOISE_RE = re.compile(r"\s*&.*$")
_ASCII_FALLBACK = {"ł": "l", "Ł": "L", "ø": "o", "Ø": "O", "?": ""}


def _to_ascii(text: str) -> str:
    import unicodedata
    for src, dst in _ASCII_FALLBACK.items():
        text = text.replace(src, dst)
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text


def _clean_station_name(raw: object) -> str:
    if not isinstance(raw, str):
        return ""
    text = _STATION_PREFIX_RE.sub("", raw)
    text = _STATION_NOISE_RE.sub("", text)
    text = _to_ascii(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _refresh_composite_names(net: pp.pandapowerNet) -> None:
    for line_idx, row in net.line.iterrows():
        current = str(net.line.at[line_idx, "name"] or "").strip()
        if current and not _DEFAULT_LINE_NAME_RE.match(current):
            continue
        from_name = net.bus.at[_to_int(row.from_bus), "name"]
        to_name = net.bus.at[_to_int(row.to_bus), "name"]
        net.line.at[line_idx, "name"] = f"Line {_to_int(line_idx) + 1}: {from_name} -> {to_name}"

    for trafo_idx, row in net.trafo.iterrows():
        current = str(net.trafo.at[trafo_idx, "name"] or "").strip()
        if current and not _DEFAULT_TRAFO_NAME_RE.match(current):
            continue
        hv_name = net.bus.at[_to_int(row.hv_bus), "name"]
        lv_name = net.bus.at[_to_int(row.lv_bus), "name"]
        net.trafo.at[trafo_idx, "name"] = f"Trafo {_to_int(trafo_idx) + 1}: {hv_name} -> {lv_name}"


def _match_geo_feature_to_bus(
    feature: dict,
    id_lookup: dict[int, int],
    one_based_lookup: dict[int, int],
    name_lookup: dict[str, int],
) -> int | None:
    properties = feature.get("properties") or {}
    raw_candidates = [
        properties.get("bus"),
        properties.get("bus_id"),
        properties.get("bus_idx"),
        properties.get("pp_index"),
        properties.get("id"),
        feature.get("id"),
    ]
    for raw in raw_candidates:
        if raw is None:
            continue
        try:
            bus_id = int(raw)
        except (TypeError, ValueError):
            continue
        if bus_id in one_based_lookup:
            return one_based_lookup[bus_id]
        if bus_id in id_lookup:
            return id_lookup[bus_id]

    name_candidates = [
        properties.get("name"),
        properties.get("bus_name"),
        properties.get("station"),
    ]
    for raw in name_candidates:
        if raw is None:
            continue
        bus_idx = name_lookup.get(str(raw).strip().casefold())
        if bus_idx is not None:
            return bus_idx
    return None


def _to_int(value: object) -> int:
    if isinstance(value, Integral):
        return int(value)
    if isinstance(value, str):
        return int(value)
    raise TypeError(f"Expected integer-like value, got {type(value).__name__}")


def _to_float(value: object) -> float:
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, Real):
        return float(value)
    if isinstance(value, str):
        return float(value)
    raise TypeError(f"Expected float-like value, got {type(value).__name__}")
