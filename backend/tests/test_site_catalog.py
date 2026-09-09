from app.db import Site


def test_site_model_tracks_site_identity_and_status():
    site = Site(
        code="ALPHA-01",
        name="Alpha Refinery",
        location="Abu Dhabi, UAE",
        region="UAE",
        status="Live",
        is_active=True,
    )

    assert site.code == "ALPHA-01"
    assert site.name == "Alpha Refinery"
    assert site.location == "Abu Dhabi, UAE"
    assert site.region == "UAE"
    assert site.status == "Live"
    assert site.is_active is True
