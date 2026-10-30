"""Normalize platform-dependent Telegraf memory fields without inventing values."""
import math

MEMORY_FIELDS = ("total", "used", "available", "free", "cached", "buffered", "used_percent", "available_percent")


def memory_sample(row):
    values = row.get("fields") or {}
    sample = {
        "time": row["time"].isoformat() if hasattr(row["time"], "isoformat") else str(row["time"]),
        "host": row.get("host") or "Unknown host",
    }
    for field in MEMORY_FIELDS:
        try:
            value = float(values[field])
            sample[field] = value if math.isfinite(value) and value >= 0 else None
        except (KeyError, TypeError, ValueError):
            sample[field] = None
    total = sample["total"]
    for field, source in (("used_percent", "used"), ("available_percent", "available")):
        if sample[field] is None and total and sample[source] is not None:
            sample[field] = 100 * sample[source] / total
        if sample[field] is not None and sample[field] > 100:
            sample[field] = None
    return sample
