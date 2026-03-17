import pandapower as pp
from pandapower.std_types import create_std_type

from kse_grid.topology import KSETopology


class GridBuilder:
    """Buduje sieć pandapower warstwa po warstwie na podstawie KSETopology."""

    def __init__(self, topology: KSETopology):
        self.topo = topology
        self.net = pp.create_empty_network(name="KSE Polska 400/220 kV")
        self._bus_index: dict[str, int] = {}  # nazwa stacji → indeks w net.bus

    # ------------------------------------------------------------------
    def _register_custom_std_types(self):
        """Rejestruje niestandardowe typy linii i transformatorów w sieci."""

        # Linia AFL-8 243 mm² @ 220 kV – parametry katalogowe
        create_std_type(self.net, {
            "r_ohm_per_km": 0.1188,
            "x_ohm_per_km": 0.272,
            "c_nf_per_km":  10.5,
            "max_i_ka":     0.645,
            "type":         "ol",
            "q_mm2":        243,
        }, name=KSETopology.LT220, element="line")

        # Autotransformator 275 MVA 400/220 kV – dane znamionowe PSE
        create_std_type(self.net, {
            "sn_mva":           275,
            "vn_hv_kv":         400,
            "vn_lv_kv":         220,
            "vk_percent":        8.5,   # obniżone z 12.5 → AT 400/220kV PSE typowo 8-10%
            "vkr_percent":       0.15,  # obniżone z 0.3 → niższe straty w uzwojeniu
            "pfe_kw":           120,
            "i0_percent":        0.06,
            "shift_degree":      0,
            "tap_side":         "hv",
            "tap_neutral":       0,
            "tap_min":          -10,
            "tap_max":           10,
            "tap_step_percent":  1.5,
        }, name=KSETopology.AT, element="trafo")

    # ------------------------------------------------------------------
    def _build_buses(self):
        for cfg in self.topo.BUSES_400KV + self.topo.BUSES_220KV:
            idx = pp.create_bus(
                self.net,
                vn_kv=cfg.vn_kv,
                name=cfg.name,
                geodata=(cfg.lat, cfg.lon),
            )
            self._bus_index[cfg.name] = idx

    # ------------------------------------------------------------------
    def _build_lines(self):
        for cfg in self.topo.LINES_400KV + self.topo.LINES_220KV:
            pp.create_line(
                self.net,
                from_bus=self._bus_index[cfg.from_bus],
                to_bus=self._bus_index[cfg.to_bus],
                length_km=cfg.length_km,
                std_type=cfg.std_type,
                name=cfg.name,
            )

    # ------------------------------------------------------------------
    def _build_transformers(self):
        for cfg in self.topo.TRAFOS:
            pp.create_transformer(
                self.net,
                hv_bus=self._bus_index[cfg.hv_bus],
                lv_bus=self._bus_index[cfg.lv_bus],
                std_type=cfg.std_type,
                name=cfg.name,
            )

    # ------------------------------------------------------------------
    def _build_generators(self):
        for cfg in self.topo.GENERATORS:
            kwargs = dict(
                bus=self._bus_index[cfg.bus],
                p_mw=cfg.p_mw,
                vm_pu=cfg.vm_pu,
                name=cfg.name,
                max_p_mw=cfg.max_p_mw,
                min_p_mw=cfg.min_p_mw,
            )
            if cfg.max_q_mvar is not None:
                kwargs["max_q_mvar"] = cfg.max_q_mvar
            if cfg.min_q_mvar is not None:
                kwargs["min_q_mvar"] = cfg.min_q_mvar
            pp.create_gen(self.net, **kwargs)

    # ------------------------------------------------------------------
    def _build_slack(self):
        pp.create_ext_grid(
            self.net,
            bus=self._bus_index[self.topo.SLACK_BUS],
            vm_pu=1.00,
            name="Slack Miłosna",
        )

    # ------------------------------------------------------------------
    def _build_loads(self):
        for cfg in self.topo.LOADS:
            pp.create_load(
                self.net,
                bus=self._bus_index[cfg.bus],
                p_mw=cfg.p_mw,
                q_mvar=cfg.q_mvar,
                name=f"Odbior: {cfg.name}",
            )

    # ------------------------------------------------------------------
    def _build_shunts(self):
        for cfg in self.topo.SHUNTS:
            pp.create_shunt(
                self.net,
                bus=self._bus_index[cfg.bus],
                q_mvar=cfg.q_mvar,
                p_mw=0.0,
                name=cfg.name,
            )

    # ------------------------------------------------------------------
    def build(self) -> pp.pandapowerNet:
        """Buduje i zwraca gotową sieć pandapower."""
        self._register_custom_std_types()
        self._build_buses()
        self._build_transformers()
        self._build_lines()
        self._build_generators()
        self._build_slack()
        self._build_loads()
        self._build_shunts()
        return self.net