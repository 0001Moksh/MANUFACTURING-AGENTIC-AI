import pytest

from app.report_urls import build_report_url, get_public_frontend_url, summarize_report_sources
from app.agents.report_generator_v3 import customize_and_split_query


def test_report_url_uses_configured_public_api():
    assert build_report_url("report_9bb023b1.pdf", "http://192.168.10.8:8001") == (
        "http://192.168.10.8:8001/reports/report_9bb023b1.pdf"
    )


def test_report_url_rejects_paths_and_non_pdf_files():
    with pytest.raises(ValueError, match="PDF filename"):
        build_report_url("../secret.pdf", "http://192.168.10.8:8001")
    with pytest.raises(ValueError, match="PDF filename"):
        build_report_url("report.csv", "http://192.168.10.8:8001")


def test_public_frontend_url_is_configurable(monkeypatch):
    monkeypatch.setenv("FRONTEND_URL", "https://mai.example.com/")

    assert get_public_frontend_url() == "https://mai.example.com"


def test_daily_operations_report_selects_mes_and_camera_configuration_sources():
    split = customize_and_split_query("Daily Operations Report")

    assert "mes" in split["selected_databases"]
    assert "video_analytics" in split["selected_databases"]
    requested = {item["database"]: item for item in split["customized_db_requests"]}
    assert {"machine", "utilization", "production"}.issubset(requested["mes"]["token_keywords"])
    assert {"camera", "configuration"}.issubset(requested["video_analytics"]["token_keywords"])


def test_notification_source_summary_uses_returned_database_rows():
    summary = summarize_report_sources([
        {"database": "mes", "table": "WorkOrder", "rows": 4},
        {"database": "video_analytics", "table": "cameras", "rows": 2},
        {"database": "mes", "table": "CapacityAnalysis", "rows": 3},
    ])

    assert "mes (7 rows across 2 tables)" in summary
    assert "video_analytics (2 rows across 1 tables)" in summary
