import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import app
from licensing.generator import build_license_payload, generate_license_file


def test_license_payload_generation():
    payload = build_license_payload(
        customer_name="ABC Manufacturing",
        customer_id="CUST-100",
        product="MANUFACTURING_AGENTIC_AI",
        license_type="ANNUAL",
        expires_at="2027-08-29T00:00:00+00:00",
        installation_id="INSTALL-ABC",
        features=["MES", "SCADA", "ERP"],
        max_users=50,
        notes="Internal test",
    )
    assert payload["customer_name"] == "ABC Manufacturing"
    assert payload["product"] == "MANUFACTURING_AGENTIC_AI"
    assert len(payload["token_1"]) >= 24
    assert len(payload["features"]) == 3

    lic = generate_license_file(payload)
    assert lic.startswith(b"MAI-LIC-V1|")


def test_license_download_route():
    client = app.test_client()
    with client.session_transaction() as session:
        session["admin_logged_in"] = True

    response = client.post(
        "/licenses/new",
        data={
            "customer_name": "Test Customer",
            "customer_id": "CUST-200",
            "product": "MANUFACTURING_AGENTIC_AI",
            "license_type": "ANNUAL",
            "expiry_date": "2027-10-01T00:00",
            "installation_binding": "INSTALL-DL",
            "features": ["MES", "SCADA", "ERP"],
            "max_users": 12,
            "notes": "Download check",
        },
    )

    assert response.status_code == 200
    assert b"Download .lic file" in response.data
    assert b"/licenses/" in response.data

    license_id = response.data.decode("utf-8").split("/licenses/")[1].split("/download")[0]
    download = client.get(f"/licenses/{license_id}/download")
    assert download.status_code == 200
    assert download.headers["Content-Disposition"].startswith("attachment; filename=")
