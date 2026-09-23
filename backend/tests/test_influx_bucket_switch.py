import os

from app.influx_telemetry import get_active_influx_bucket, normalize_influx_bucket, set_active_influx_bucket


def test_normalize_influx_bucket_handles_supported_buckets():
    assert normalize_influx_bucket("ECE2") == "ECE2"
    assert normalize_influx_bucket("ece2") == "ECE2"
    assert normalize_influx_bucket("mps") == "mps"
    assert normalize_influx_bucket("MP3") == "mps"
    assert normalize_influx_bucket("mp3") == "mps"
    assert normalize_influx_bucket(None) == "ECE2"


def test_set_active_influx_bucket_updates_runtime_environment(monkeypatch):
    monkeypatch.delenv("INFLUXDB_BUCKET", raising=False)

    result = set_active_influx_bucket("mps")

    assert result["activeBucket"] == "mps"
    assert os.getenv("INFLUXDB_BUCKET") == "mps"
    assert get_active_influx_bucket() == "mps"
