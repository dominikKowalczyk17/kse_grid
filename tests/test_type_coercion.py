"""Unit tests for kse_grid.type_coercion."""

from __future__ import annotations

import math

import numpy as np
import pytest

from kse_grid.type_coercion import safe_float, to_float, to_int


class TestToInt:
    def test_passes_int_through(self):
        assert to_int(42) == 42

    def test_converts_numeric_string(self):
        assert to_int("17") == 17

    def test_converts_numpy_int(self):
        assert to_int(np.int64(99)) == 99
        assert isinstance(to_int(np.int64(99)), int)

    def test_rejects_float(self):
        with pytest.raises(TypeError):
            to_int(3.14)

    def test_rejects_none(self):
        with pytest.raises(TypeError):
            to_int(None)


class TestSafeFloat:
    def test_int(self):
        assert safe_float(3) == 3.0

    def test_float(self):
        assert safe_float(2.5) == 2.5

    def test_bool_true_becomes_one(self):
        # Critical: bool is a numeric subclass in Python.
        # Without explicit handling it would raise.
        assert safe_float(True) == 1.0

    def test_bool_false_becomes_zero(self):
        assert safe_float(False) == 0.0

    def test_numeric_string(self):
        assert safe_float("12.75") == 12.75

    def test_invalid_string_returns_none(self):
        assert safe_float("not a number") is None

    def test_none_returns_none(self):
        assert safe_float(None) is None

    def test_dict_returns_none(self):
        assert safe_float({}) is None

    def test_nan_returns_none(self):
        assert safe_float(float("nan")) is None

    def test_infinity_returns_none(self):
        assert safe_float(math.inf) is None
        assert safe_float(-math.inf) is None


class TestToFloat:
    def test_returns_float(self):
        assert to_float(5) == 5.0

    def test_raises_on_invalid(self):
        with pytest.raises(TypeError):
            to_float("garbage")

    def test_raises_on_nan(self):
        with pytest.raises(TypeError):
            to_float(float("nan"))
