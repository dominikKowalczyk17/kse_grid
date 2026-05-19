"""Konwersja typów — helpery używane w wielu modułach."""

from __future__ import annotations

import math
from numbers import Integral, Real
from typing import Any


def to_int(value: object) -> int:
    if isinstance(value, Integral):
        return int(value)
    if isinstance(value, str):
        return int(value)
    raise TypeError(f"Expected integer-like value, got {type(value).__name__}")


def to_float(value: object) -> float:
    result = safe_float(value)
    if result is None:
        raise TypeError(f"Expected float-like value, got {value!r}")
    return result


def safe_float(value: Any) -> float | None:
    if isinstance(value, bool):
        f = float(value)
    elif isinstance(value, Real):
        f = float(value)
    elif isinstance(value, str):
        try:
            f = float(value)
        except ValueError:
            return None
    else:
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return f
