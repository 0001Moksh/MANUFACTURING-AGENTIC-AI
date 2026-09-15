"""Production SQL tools for historical video-monitoring investigations."""

import os
import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool
from sqlalchemy import create_engine, text

_DATABASE_URL = os.getenv("CONSTRUCTION_DB_URL", "postgresql://postgres:postgres@localhost:5432/construction_ai")
try:
    _engine = create_engine(_DATABASE_URL, pool_pre_ping=True, pool_recycle=1800)
except Exception:
    _engine = None


@tool
def resolve_relative_date(value: str, reference_date: Optional[str] = None) -> Dict[str, str]:
    """Resolve common English/Hinglish date expressions to an inclusive ISO date range."""
    reference = datetime.strptime(reference_date, "%Y-%m-%d").date() if reference_date else datetime.now().date()
    normalized = re.sub(r"\s+", " ", (value or "").strip().lower())

    # Normalize common month abbreviations (e.g., 'sept' -> 'sep')
    normalized_clean = re.sub(r"\bsept\b", "sep", normalized)

    if normalized_clean in {"yesterday", "kal"}:
        target = reference - timedelta(days=1)
        return {"start_date": target.isoformat(), "end_date": target.isoformat()}
    if normalized_clean in {"today", "aaj"}:
        return {"start_date": reference.isoformat(), "end_date": reference.isoformat()}

    # Day of week matching (e.g. "saturday", "last saturday", "on saturday", "pichle saturday")
    weekdays = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
    for day_name, day_num in weekdays.items():
        if day_name in normalized_clean:
            days_ago = (reference.weekday() - day_num) % 7
            if days_ago == 0 and ("last" in normalized_clean or "pichle" in normalized_clean):
                days_ago = 7
            target = reference - timedelta(days=days_ago)
            return {"start_date": target.isoformat(), "end_date": target.isoformat()}

    match = re.search(r"(?:past|last)\s+(\d+)\s+days?", normalized_clean)
    if match:
        return {"start_date": (reference - timedelta(days=int(match.group(1)))).isoformat(), "end_date": reference.isoformat()}

    calendar_match = re.search(
        r"\b(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})\b",
        normalized_clean,
    )
    if calendar_match:
        for date_format in ("%d %B %Y", "%d %b %Y"):
            try:
                target = datetime.strptime(
                    f"{calendar_match.group(1)} {calendar_match.group(2)} {calendar_match.group(3)}",
                    date_format,
                ).date()
                return {"start_date": target.isoformat(), "end_date": target.isoformat()}
            except ValueError:
                continue
    try:
        target = datetime.strptime(normalized_clean, "%Y-%m-%d").date()
        return {"start_date": target.isoformat(), "end_date": target.isoformat()}
    except ValueError:
        return {"start_date": reference.isoformat(), "end_date": reference.isoformat()}


def _execute(query: str, params: Dict[str, Any]) -> List[Dict[str, Any]]:
    if _engine is None:
        return [{"error": "Video analytics database engine is unavailable."}]
    try:
        with _engine.connect() as connection:
            return [dict(row) for row in connection.execute(text(query), params).mappings().all()]
    except Exception as exc:
        return [{"error": f"Investigator query failed: {exc}"}]


@tool
def resolve_camera_id(camera_name: str) -> Dict[str, Any]:
    """Resolve a camera display name to its database ID before event queries."""
    matches = _execute("""
        SELECT id, name FROM cameras
        WHERE name ILIKE :camera_name ORDER BY id LIMIT 10
    """, {"camera_name": f"%{camera_name.strip()}%"})
    return {"camera_name": camera_name, "matches": matches}


@tool
def get_incidents_by_date(
    start_date: str,
    end_date: Optional[str] = None,
    camera_id: Optional[int] = None,
    camera_name: Optional[str] = None,
    zone_id: Optional[int] = None,
    alert_type: Optional[str] = None,
    severity: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fetch real alerts and incidents for an inclusive date range."""
    resolved_dates = resolve_relative_date.invoke({"value": start_date})
    resolved_start = resolved_dates["start_date"]
    end = end_date or resolved_dates["end_date"]
    
    search_camera_name = camera_name.strip() if camera_name else None
    if search_camera_name and camera_id is None:
        try:
            matches_res = resolve_camera_id.invoke({"camera_name": search_camera_name})
            matches = matches_res.get("matches", []) if isinstance(matches_res, dict) else []
            if isinstance(matches, list) and len(matches) > 0 and not isinstance(matches[0], dict) and "error" in matches[0]:
                matches = []
            if matches and isinstance(matches, list):
                exact = [m for m in matches if isinstance(m, dict) and m.get("name", "").lower() == search_camera_name.lower()]
                if exact:
                    camera_id = exact[0]["id"]
                elif len(matches) > 0 and isinstance(matches[0], dict) and "id" in matches[0]:
                    camera_id = matches[0]["id"]
        except Exception:
            pass

    query = """
        SELECT event_id, event_kind, event_time, camera_id, camera_name, zone_id,
               class_name, confidence, severity, snapshot_path, video_path,
               is_acknowledged, incident_status
        FROM (
            SELECT a.id AS event_id, 'alert' AS event_kind, a.created_at AS event_time,
                   a.camera_id, COALESCE(c.name, a.camera_name) AS camera_name,
                   a.zone_id, a.class_name, a.confidence,
                   CASE WHEN lower(a.class_name) ~ '(fire|smoke|intrusion|restricted|unauthorized|fall|unsafe)' THEN 'CRITICAL'
                        WHEN lower(a.class_name) ~ '(helmet|vest|ppe|warning|zone|harness|goggle|glove)' THEN 'WARNING'
                        ELSE 'NORMAL' END AS severity,
                   a.snapshot_path, NULL::text AS video_path, a.is_acknowledged,
                   NULL::text AS incident_status
            FROM alerts a LEFT JOIN cameras c ON c.id = a.camera_id
            WHERE a.created_at >= CAST(:start_date AS date)
              AND a.created_at < CAST(:end_date AS date) + INTERVAL '1 day'
            UNION ALL
            SELECT i.id, 'incident', i.started_at, i.camera_id,
                   COALESCE(c.name, i.camera_name), i.zone_id, i.class_name,
                   i.confidence, COALESCE(NULLIF(i.classification, ''), 'UNCLASSIFIED'),
                   i.snapshot_path, i.video_path, i.is_acknowledged,
                   CASE WHEN i.resolved_at IS NULL THEN 'OPEN' ELSE 'RESOLVED' END
            FROM incidents i LEFT JOIN cameras c ON c.id = i.camera_id
            WHERE i.started_at >= CAST(:start_date AS date)
              AND i.started_at < CAST(:end_date AS date) + INTERVAL '1 day'
        ) events
        WHERE (:camera_id IS NULL OR camera_id = :camera_id)
          AND (:camera_name_param IS NULL OR camera_name ILIKE :camera_name_param)
          AND (:zone_id IS NULL OR zone_id = :zone_id)
          AND (:alert_type IS NULL OR class_name ILIKE :alert_type)
          AND (:severity IS NULL OR severity ILIKE :severity)
        ORDER BY event_time DESC
    """
    cam_param = f"%{search_camera_name}%" if search_camera_name and camera_id is None else None
    return _execute(query, {
        "start_date": resolved_start,
        "end_date": end,
        "camera_id": camera_id,
        "camera_name_param": cam_param,
        "zone_id": zone_id,
        "alert_type": f"%{alert_type}%" if alert_type else None,
        "severity": severity,
    })
