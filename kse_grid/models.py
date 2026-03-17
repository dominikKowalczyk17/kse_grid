from dataclasses import dataclass, field


@dataclass
class BusConfig:
    name: str
    vn_kv: float
    lat: float
    lon: float


@dataclass
class LineConfig:
    from_bus: str
    to_bus: str
    length_km: float
    std_type: str
    name: str


@dataclass
class TrafoConfig:
    hv_bus: str
    lv_bus: str
    std_type: str
    name: str


@dataclass
class GenConfig:
    bus: str
    p_mw: float
    vm_pu: float
    name: str
    max_p_mw: float
    min_p_mw: float = 0.0
    max_q_mvar: float = None   # None = brak limitu (pandapower użyje nan)
    min_q_mvar: float = None


@dataclass
class LoadConfig:
    bus: str
    p_mw: float
    q_mvar: float
    name: str


@dataclass
class ShuntConfig:
    bus: str
    q_mvar: float
    name: str