"""Thresholds and domain constants for the power network."""

# Voltage (PN-EN 50160)
VOLTAGE_OK_MIN = 0.95
VOLTAGE_OK_MAX = 1.05
VOLTAGE_WARN_MIN = 0.90
VOLTAGE_WARN_MAX = 1.10

# Branch loading
LOAD_WARN_PCT = 100.0
LOAD_BAD_PCT = 150.0

# Transmission network (220 kV and above)
CORE_VOLTAGE_KV = 220.0
