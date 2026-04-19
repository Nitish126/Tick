# Formula: MWU = Distance * (1 + Thermal Factor + Idle Ratio)
def calculate_mwu(distance_km: float, thermal_factor: float, idle_ratio: float) -> float:
    """
    Calculates Mechanical Wear Units (MWU)
    - distance_km: Distance driven in the timeframe.
    - thermal_factor: derived from engine/ambient temperatures (0.0 to 1.0).
    - idle_ratio: percentage of time idling vs driving (0.0 to 1.0).
    """
    return distance_km * (1 + thermal_factor + idle_ratio)
