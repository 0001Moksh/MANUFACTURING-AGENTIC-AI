from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List

ACCESS_TYPES = [
    "read_only",
    "edit",
    "hitl_approval",
    "full_control",
]

PERMISSION_MODULE_CATALOG: List[Dict[str, Any]] = [
    {
        "module_key": "use_cases",
        "label": "Use Case Library",
        "resources": [
            {"resource_key": "daily_operations_reporting", "label": "Daily Operations Reporting"},
            {"resource_key": "executive_insights", "label": "Executive Insights"},
            {"resource_key": "predictive_maintenance", "label": "Predictive Maintenance"},
            {"resource_key": "ppe_behavior_monitoring", "label": "PPE & Behavior Monitoring"},
            {"resource_key": "incident_investigation", "label": "Incident Investigation"},
            {"resource_key": "permit_to_work", "label": "Permit to Work"},
            {"resource_key": "video_monitoring", "label": "Video Monitoring"},
        ],
    },
    {
        "module_key": "ai_agents",
        "label": "AI Agents",
        "resources": [
            {"resource_key": "maintenance_agent", "label": "Maintenance Agent"},
            {"resource_key": "reporting_agent", "label": "Reporting Agent"},
            {"resource_key": "safety_quality_agent", "label": "Safety & Quality Agent"},
            {"resource_key": "incident_investigation_agent", "label": "Incident & Investigation Agent"},
            {"resource_key": "permit_to_work_agent", "label": "Permit-to-Work Agent"},
            {"resource_key": "ppe_behavior_vision_agent", "label": "PPE & Behavior Vision Agent"},
            {"resource_key": "insights_summary_agent", "label": "Insights Summary Agent"},
        ],
    },
    {
        "module_key": "integrations",
        "label": "Integrations",
        "resources": [
            {"resource_key": "mes", "label": "MES"},
            {"resource_key": "video_analytics", "label": "Video Analytics"},
            {"resource_key": "erp", "label": "ERP"},
            {"resource_key": "email", "label": "Email"},
        ],
    },
]


def get_permission_catalog() -> List[Dict[str, Any]]:
    return deepcopy(PERMISSION_MODULE_CATALOG)


def _normalize_access_types(access_types: Any) -> List[str]:
    if isinstance(access_types, str):
        values = [access_types]
    elif isinstance(access_types, (list, tuple, set)):
        values = list(access_types)
    else:
        values = []

    normalized: List[str] = []
    for value in values:
        key = str(value).strip().lower()
        mapping = {
            "read": "read_only",
            "view": "read_only",
            "edit": "edit",
            "write": "edit",
            "read_only_edit": "read_only_edit",
            "approval": "hitl_approval",
            "hitl": "hitl_approval",
            "full": "full_control",
            "admin": "full_control",
            "full_control": "full_control",
            "hitl_approval": "hitl_approval",
            "read_only": "read_only",
        }
        resolved = mapping.get(key, key)
        if resolved in ACCESS_TYPES and resolved not in normalized:
            normalized.append(resolved)

    if not normalized:
        normalized = ["read_only"]
    return normalized


def normalize_permission_rule(permission: Any) -> Dict[str, Any]:
    if isinstance(permission, str):
        if ":" in permission:
            parts = permission.split(":")
            if len(parts) >= 3:
                access_types = parts[2:]
                if len(access_types) > 1 and {"read_only", "edit"}.issubset(set(access_types)):
                    access_types = ["read_only_edit"]
                return {
                    "module_key": parts[0].strip(),
                    "resource_key": parts[1].strip(),
                    "access_types": _normalize_access_types(access_types),
                    "permission_key": permission,
                }
        if "." in permission:
            module_key, resource_key = permission.split(".", 1)
            return {
                "module_key": module_key.strip(),
                "resource_key": resource_key.strip(),
                "access_types": ["read_only"],
                "permission_key": permission,
            }

        return {
            "module_key": "general",
            "resource_key": "*",
            "access_types": ["read_only"],
            "permission_key": permission,
        }

    if not isinstance(permission, dict):
        raise TypeError("Permission must be a string or a dictionary rule")

    module_key = str(permission.get("module_key") or permission.get("module") or "general").strip()
    resource_key = str(permission.get("resource_key") or permission.get("sub_module_id") or permission.get("resource") or "*").strip()
    access_types = _normalize_access_types(permission.get("access_types") or permission.get("access_type") or [])

    if not module_key or module_key == "*":
        module_key = "general"
    if not resource_key or resource_key == "*":
        resource_key = "*"

    permission_key = f"{module_key}:{resource_key}:{':'.join(access_types)}"
    return {
        "module_key": module_key,
        "resource_key": resource_key,
        "access_types": access_types,
        "permission_key": permission_key,
    }
