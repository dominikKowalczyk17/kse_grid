"""Stałe wyglądu (kolory, rozmiary, progi) dla dashboardu Dash."""

from __future__ import annotations

from typing import Final

COLORS: Final[dict[str, str]] = {
    "bg":     "#0a0d12",
    "panel":  "#11161d",
    "panel2": "#161b22",
    "border": "#2a313c",
    "text":   "#e6edf3",
    "dim":    "#8b95a4",
    "accent": "#4ea1ff",
    "good":   "#3fb950",
    "warn":   "#d29922",
    "bad":    "#f85149",
}

STATUS_COLORS: Final[dict[str, str]] = {
    "good": COLORS["good"],
    "warn": COLORS["warn"],
    "bad":  COLORS["bad"],
}

LOADING_LEGEND: Final[list[tuple[str, str]]] = [
    ("#43A047", "0 – 40%"),
    ("#F9A825", "40 – 70%"),
    ("#FB8C00", "70 – 100%"),
    ("#D32F2F", "> 100%  (przeciążenie)"),
]

CORE_VOLTAGE_KV: Final[float] = 220.0
FOCUS_ZOOM_RATIO: Final[float] = 0.12
SELECTION_HIGHLIGHT_SCALE: Final[float] = 2.2

FONT_FAMILY: Final[str] = "'Inter', system-ui, sans-serif"
MONO_FONT_FAMILY: Final[str] = "JetBrains Mono, monospace"
