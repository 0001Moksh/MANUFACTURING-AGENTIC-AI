from app.permission_engine import get_permission_catalog, normalize_permission_rule


def test_permission_catalog_contains_dynamic_modules():
    catalog = get_permission_catalog()
    assert any(item["module_key"] == "use_cases" for item in catalog)
    assert any(item["module_key"] == "guardrails" for item in catalog)
    assert all("resources" in item for item in catalog)


def test_normalize_permission_rule_handles_dynamic_rule_values():
    rule = {
        "module_key": "use_cases",
        "resource_key": "daily_reporting",
        "access_types": ["read_only", "hitl_approval"],
    }

    normalized = normalize_permission_rule(rule)
    assert normalized["module_key"] == "use_cases"
    assert normalized["resource_key"] == "daily_reporting"
    assert normalized["access_types"] == ["read_only", "hitl_approval"]
    assert normalized["permission_key"].startswith("use_cases:daily_reporting")
