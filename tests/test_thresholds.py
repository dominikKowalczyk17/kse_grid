"""Sanity tests for kse_grid.thresholds."""

from __future__ import annotations

from kse_grid import thresholds


def test_voltage_ok_band_is_centered_on_nominal():
    # PN-EN 50160: ±5% acceptable.
    assert thresholds.VOLTAGE_OK_MIN < 1.0 < thresholds.VOLTAGE_OK_MAX
    assert abs((1.0 - thresholds.VOLTAGE_OK_MIN) - (thresholds.VOLTAGE_OK_MAX - 1.0)) < 1e-9


def test_warn_band_contains_ok_band():
    assert thresholds.VOLTAGE_WARN_MIN <= thresholds.VOLTAGE_OK_MIN
    assert thresholds.VOLTAGE_WARN_MAX >= thresholds.VOLTAGE_OK_MAX


def test_load_bad_exceeds_warn():
    assert thresholds.LOAD_BAD_PCT > thresholds.LOAD_WARN_PCT
    assert thresholds.LOAD_WARN_PCT == 100.0  # 100% is the canonical "rated" line.


def test_core_voltage_kv_is_transmission_level():
    assert thresholds.CORE_VOLTAGE_KV >= 110.0
