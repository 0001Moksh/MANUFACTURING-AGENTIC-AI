"""Database reads shared by host plugin routes; no application startup side effects."""
import asyncio
from datetime import datetime, timezone
from sqlalchemy import text
from .memory_telemetry import memory_sample

HOST_TABLES = {"telegraf_cpu", "telegraf_mem"}


async def latest_plugin_metric(db, table):
    if table not in HOST_TABLES:
        raise ValueError("Unsupported host telemetry table")
    async with asyncio.timeout(8):
        exists = (await db.execute(text("SELECT to_regclass(:table)"), {"table": f"public.{table}"})).scalar()
        if not exists:
            return None, "No telemetry table yet. Check the Telegraf service and PostgreSQL output."
        result = await db.execute(text(f'''SELECT "time", host FROM public.{table}
            WHERE "time" >= NOW() - INTERVAL '10 minutes'
            ORDER BY "time" DESC LIMIT 1'''))
        return result.mappings().first(), None


async def memory_payload(db, minutes=30, limit=1200):
    minutes = max(1, min(minutes, 1440))
    limit = max(1, min(limit, 5000))
    async with asyncio.timeout(8):
        exists = (await db.execute(text("SELECT to_regclass('public.telegraf_mem')"))).scalar()
        rows = []
        if exists:
            # JSON projection tolerates columns absent on Windows/macOS/Linux.
            result = await db.execute(text('''SELECT "time", host, to_jsonb(m) AS fields
                FROM public.telegraf_mem m
                WHERE "time" >= NOW() - make_interval(mins => :minutes)
                ORDER BY "time" DESC LIMIT :limit'''), {"minutes": minutes, "limit": limit})
            rows = list(result.mappings().all())
    samples = [memory_sample(row) for row in reversed(rows)]
    return {
        "plugin_id": "telegraf-memory-monitoring",
        "window_minutes": minutes,
        "sample_count": len(samples),
        "hosts": sorted({sample["host"] for sample in samples}),
        "samples": samples,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
