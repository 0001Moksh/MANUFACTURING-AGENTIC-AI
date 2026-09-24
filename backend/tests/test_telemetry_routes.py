import pytest

from app.routes import _get_telemetry_counts


class DummyTimeoutDB:
    async def execute(self, *_args, **_kwargs):
        raise TimeoutError("database timeout")


@pytest.mark.asyncio
async def test_get_telemetry_counts_handles_db_timeout():
    result = await _get_telemetry_counts(DummyTimeoutDB())

    assert result["active_work_orders"] == 0
    assert result["in_progress_work_orders"] == 0
    assert result["active_alerts"] == 0
    assert result["running_machines"] == 0
    assert result["total_machines"] == 0
