"""
================================================================================
 Manufacturing & Video-Analytics Intelligent Report Generator  (v3)
================================================================================

v3 adds a THIRD data source: InfluxDB (real-time IoT / machine telemetry),
alongside the existing MES (MSSQL) + video_analytics (Postgres) pair.

KEY DESIGN GOAL FOR INFLUXDB (token-efficiency + accuracy, no fake data):
    - Raw InfluxDB rows are NEVER sent to the LLM. Ever.
    - The time range needed is extracted from the user's query with regex
      (extract_flux_time_range) - the LLM is not asked to pick a time range,
      which keeps this deterministic and avoids an extra LLM round trip.
    - Data is always pulled downsampled (Flux aggregateWindow) so we never
      pull raw high-frequency points into the process.
    - Only compact per-field statistics (min/max/avg/last/trend/count) are
      given to the LLM as context - not samples, not rows.
    - Charts are built DIRECTLY from the (already small, downsampled)
      DataFrame returned by InfluxDB - the LLM never sees or produces the
      chart data, it only picks whether a chart is worth showing.

Everything else (MES / video_analytics behaviour) is unchanged from v2.

Entry point (same as before):

    process_query_and_generate_pdf(user_query, pdf_path=None) -> str

================================================================================
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from difflib import get_close_matches
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# --------------------------------------------------------------------------
# Third-party libs
# --------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
except ImportError:
    raise ImportError("pip install python-dotenv")

try:
    import pyodbc
except ImportError:
    raise ImportError("pip install pyodbc")

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    raise ImportError("pip install psycopg2-binary")

try:
    from influxdb_client import InfluxDBClient
except ImportError:
    raise ImportError("pip install influxdb-client")

try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        PageBreak, HRFlowable, Image, NextPageTemplate,
        PageTemplate, Frame, BaseDocTemplate, KeepTogether,
    )
    from reportlab.platypus.tableofcontents import TableOfContents
    from reportlab.pdfgen import canvas as pdf_canvas
except ImportError:
    raise ImportError("pip install reportlab")

try:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
except ImportError:
    raise ImportError("pip install matplotlib numpy")

try:
    from litellm import completion, completion_cost
except ImportError:
    raise ImportError("pip install litellm")

load_dotenv()
os.environ["GEMINI_API_KEY"] = os.getenv("GEMINI_API_KEY", "")
os.environ["GROQ_API_KEY"] = os.getenv("GROQ_API_KEY", "")

# --------------------------------------------------------------------------
# Logging
# --------------------------------------------------------------------------
log = logging.getLogger("report_agent")

# --------------------------------------------------------------------------
# Visual theme (shared by charts + PDF)
# --------------------------------------------------------------------------
THEME = {
    "primary": "#1a5276",
    "primary_light": "#2874a6",
    "accent": "#e67e22",
    "success": "#1e8449",
    "warning": "#b9770e",
    "danger": "#c0392b",
    "bg_light": "#eaf2f8",
    "bg_alt_row": "#f4f8fb",
    "grey": "#5d6d7e",
    "text": "#333333",
    "grid": "#e5e8e8",
    "palette": ["#1a5276", "#2874a6", "#5499c7", "#7fb3d5",
                "#e67e22", "#d68910", "#1e8449", "#27ae60",
                "#c0392b", "#a04000"],
}

# --------------------------------------------------------------------------
# Resolve base path for schema files relative to project root
# --------------------------------------------------------------------------
_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))

def _resolve_schema_path(env_key: str, default_relative: str) -> str:
    """Resolve a schema path from env var or fall back to project-root-relative default."""
    val = os.getenv(env_key)
    if val:
        return val
    return os.path.join(_PROJECT_ROOT, default_relative)


# --------------------------------------------------------------------------
# 1. Database registry (config-driven, extensible)
#    db_type is one of: "mssql" | "postgres" | "influxdb"
# --------------------------------------------------------------------------
@dataclass
class DatabaseConfig:
    name: str
    db_type: str
    schema_path: str
    connection: Dict[str, str] = field(default_factory=dict)


def _default_registry() -> Dict[str, DatabaseConfig]:
    registry: Dict[str, DatabaseConfig] = {
        "video_analytics": DatabaseConfig(
            name="video_analytics",
            db_type="postgres",
            schema_path=_resolve_schema_path(
                "VIDEO_ANALYTICS_SCHEMA_PATH",
                os.path.join("docs", "video_analytics_db_info", "construction_ai_schema.json"),
            ),
            connection={
                "url": os.getenv("CONSTRUCTION_DB_URL", ""),
                "host": os.getenv("PG_HOST", "localhost"),
                "port": os.getenv("PG_PORT", "5432"),
                "dbname": os.getenv("PG_DB", "construction_ai"),
                "user": os.getenv("PG_USER", "postgres"),
                "password": os.getenv("PG_PASSWORD", "0987654321"),
            },
        ),
        "mes": DatabaseConfig(
            name="mes",
            db_type="mssql",
            schema_path=_resolve_schema_path(
                "MES_SCHEMA_PATH",
                os.path.join("docs", "mes_db_info", "schema.json"),
            ),
            connection={
                "driver": os.getenv("DB_DRIVER", "ODBC Driver 18 for SQL Server"),
                "server": os.getenv("DB_SERVER", "localhost,1433"),
                "database": os.getenv("DB_NAME", "mes_new"),
                "trusted": os.getenv("DB_TRUSTED_CONNECTION", "yes"),
                "encrypt": os.getenv("DB_ENCRYPT", "no"),
                "trust_cert": os.getenv("DB_TRUST_SERVER_CERTIFICATE", "yes"),
            },
        ),
        # ---------------- NEW: InfluxDB (IoT / machine telemetry) ----------------
        "influxdb": DatabaseConfig(
            name="influxdb",
            db_type="influxdb",
            schema_path=_resolve_schema_path(
                "INFLUX_SCHEMA_PATH",
                os.path.join("docs", "iot_info", "influx_schema.json"),
            ),
            connection={
                "url": os.getenv("INFLUXDB_URL", f"http://{os.getenv('IIIOT_IP', '192.168.10.130')}:{os.getenv('IIIOT_PORT', '8086')}"),
                "token": os.getenv("INFLUXDB_TOKEN", ""),
                "org": os.getenv("INFLUXDB_ORG", "IIIOT-INFOTECH"),
                # bucket name: allow explicit override, else fall back to IIIOT_NAME
                "bucket": os.getenv("INFLUXDB_BUCKET", os.getenv("IIIOT_NAME", "iiiot-infotech")),
                "machine_name": os.getenv("INFLUX_MACHINE_NAME", "Live InfluxDB Equipment"),
                "machine_code": os.getenv("INFLUX_MACHINE_CODE", "INFLUX-01"),
            },
        ),
    }

    extra_path = os.getenv("EXTRA_DB_CONFIG_FILE")
    if extra_path and os.path.exists(extra_path):
        try:
            with open(extra_path, "r", encoding="utf-8") as f:
                extra = json.load(f)
            for name, cfg in extra.items():
                registry[name] = DatabaseConfig(
                    name=name,
                    db_type=cfg.get("db_type", "postgres"),
                    schema_path=cfg.get("schema_path", ""),
                    connection=cfg.get("connection", {}),
                )
            log.info("Loaded %d extra database(s) from %s", len(extra), extra_path)
        except Exception as e:
            log.warning("Failed to load EXTRA_DB_CONFIG_FILE (%s): %s", extra_path, e)

    return registry


DB_REGISTRY: Dict[str, DatabaseConfig] = _default_registry()


def validate_environment() -> List[str]:
    problems = []
    for name, cfg in DB_REGISTRY.items():
        if not cfg.schema_path or not os.path.exists(cfg.schema_path):
            problems.append(f"[{name}] schema file not found: {cfg.schema_path}")
    if not os.getenv("GEMINI_API_KEY") and not os.getenv("GROQ_API_KEY"):
        problems.append("No GEMINI_API_KEY or GROQ_API_KEY set - LLM summaries will fall back to raw data.")
    influx_cfg = DB_REGISTRY.get("influxdb")
    if influx_cfg and not influx_cfg.connection.get("token"):
        problems.append("[influxdb] no INFLUXDB_TOKEN set.")
    return problems


# --------------------------------------------------------------------------
# 2. Stop words + domain vocabulary  (extensible via DOMAIN_VOCAB_FILE)
# --------------------------------------------------------------------------
STOP_WORDS = {
    "a", "an", "the", "and", "or", "of", "in", "on", "for", "to", "from", "with",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "can", "could", "should", "may", "might",
    "i", "me", "my", "we", "you", "your", "he", "she", "it", "they", "them",
    "this", "that", "these", "those", "what", "which", "who", "whom", "whose",
    "all", "any", "some", "no", "not", "only", "just", "also", "very", "too",
    "want", "need", "show", "give", "get", "list", "data", "information", "details",
    "application", "system", "report", "me", "please",
}

DOMAIN_VOCABULARY: Dict[str, Dict[str, List[str]]] = {
    "video_analytics": {
        "camera": ["cameras", "camera_status_logs", "basler_devices", "basler_model_assignments", "hse_camera_rules"],
        "cameras": ["cameras", "camera_status_logs", "basler_devices"],
        "config": ["cameras", "hse_camera_rules", "basler_model_assignments", "detection_assignments"],
        "configuration": ["cameras", "hse_camera_rules", "basler_model_assignments", "detection_assignments"],
        "rule": ["hse_camera_rules", "hse_rule_definitions", "hse_rule_events"],
        "hse": ["hse_camera_rules", "hse_rule_definitions", "hse_rule_events"],
        "alert": ["alerts", "anomaly_flags", "hse_rule_events", "incidents"],
        "violation": ["alerts", "anomaly_flags", "hse_rule_events", "incidents"],
        "safety": ["alerts", "anomaly_flags", "hse_rule_events", "incidents"],
        "anomaly": ["anomaly_flags"],
        "incident": ["incidents"],
        "zone": ["zones", "zone_risk_scores"],
        "worker": ["attendances", "employees", "employee_movements"],
        "employee": ["employees", "attendances", "employee_movements"],
        "attendance": ["attendances"],
        "model": ["ai_models", "ai_model_classes", "basler_model_assignments"],
        "basler": ["basler_devices", "basler_model_assignments"],
    },
    "mes": {
        "machine": ["Machine", "MachineMaster", "MachineFGMapping", "MachineMaterialMapping", "CapacityAnalysis"],
        "machines": ["Machine", "MachineMaster"],
        "utilization": ["CapacityAnalysis", "MachineMaster"],
        "util": ["CapacityAnalysis", "MachineMaster"],
        "capacity": ["CapacityAnalysis", "MachineMaster", "ContainerCapacity"],
        "workorder": ["WorkOrder", "WorkOrderStep", "WorkOrderBOM", "WorkOrderLog", "WorkOrderResource"],
        "work_order": ["WorkOrder", "WorkOrderStep", "WorkOrderBOM", "WorkOrderLog"],
        "wo": ["WorkOrder", "WorkOrderStep"],
        "production": ["WorkOrder", "ProductionPlanning", "FinishedGood", "SemiFinishedGood"],
        "shift": ["ShiftMaster", "ShiftCalendar", "OperatorMaster"],
        "operator": ["OperatorMaster", "WorkOrderResource"],
        "inventory": ["Inventory", "InventoryByLot", "FinishedGood", "SemiFinishedGood"],
        "material": ["Materials", "RawMaterial", "BOMLine", "BOMMaster"],
        "bom": ["BOMMaster", "BOMLine"],
        "mps": ["MPSHeader", "MpsMaster"],
        "mrp": ["MRP_Run", "MRP_Demand", "MRP_Result"],
        "planning": ["MPSHeader", "MpsMaster", "ProductionPlanning", "WeeklyPlanning"],
        "maintenance": ["MaintenanceWindow"],
        "schedule": ["GanttSchedule", "WorkOrder"],
        "downtime": ["MaintenanceWindow", "CapacityAnalysis"],
    },
    # influxdb vocabulary is built dynamically from the schema file itself
    # (see build_influx_vocabulary below) and merged in here at load time.
    "influxdb": {
        "iot": [],
        "telemetry": [],
        "sensor": [],
        "machine": [],
        # NOTE: raw influx field names are abbreviated (BN_V, R_Current, ...),
        # so plain-english words like "voltage" never appear as a token in
        # any field name and the auto-derived vocabulary (build_influx_vocabulary)
        # can't discover them on its own. Seed them explicitly here.
        "electrical": ["electrical_params"],
        "voltage": ["electrical_params"],
        "volt": ["electrical_params"],
        "volts": ["electrical_params"],
        "amperage": ["electrical_params"],
        "amps": ["electrical_params"],
        "current": ["electrical_params"],
        "temperature": ["electrical_params"],
        "vibration": ["electrical_params"],
        "cycle": [],
        "production": [],
        "reject": [],
        "runstatus": [],
        "run_status": [],
        "oee": [],
    },
}


def _load_extra_vocabulary() -> None:
    vocab_path = os.getenv("DOMAIN_VOCAB_FILE")
    if not vocab_path or not os.path.exists(vocab_path):
        return
    try:
        with open(vocab_path, "r", encoding="utf-8") as f:
            extra = json.load(f)
        for db_name, kw_map in extra.items():
            DOMAIN_VOCABULARY.setdefault(db_name, {})
            for kw, tables in kw_map.items():
                DOMAIN_VOCABULARY[db_name].setdefault(kw, [])
                for t in tables:
                    if t not in DOMAIN_VOCABULARY[db_name][kw]:
                        DOMAIN_VOCABULARY[db_name][kw].append(t)
        log.info("Merged extra domain vocabulary from %s", vocab_path)
    except Exception as e:
        log.warning("Failed to load DOMAIN_VOCAB_FILE (%s): %s", vocab_path, e)


_load_extra_vocabulary()

# --------------------------------------------------------------------------
# 3. Schema cleaning (SQL side)  +  InfluxDB schema parsing (NEW)
# --------------------------------------------------------------------------
NOISE_COLUMNS = {
    "nn", "pk", "id", "date", "on", "at", "_at", "created", "updated",
    "qty", "quantity", "count", "bags", "bag",
}

NUMERIC_TYPE_HINTS = {
    "int", "integer", "bigint", "smallint", "tinyint", "float", "double",
    "decimal", "numeric", "money", "real", "number", "bit",
}
NON_NUMERIC_TYPE_HINTS = {
    "string", "varchar", "nvarchar", "char", "nchar", "text", "ntext",
    "datetime", "date", "time", "timestamp", "bool", "boolean", "uniqueidentifier",
    "guid",
}


def clean_column_name(raw: str) -> List[str]:
    name = raw.strip().split(":")[0].strip()
    if "/" in name:
        parts = re.split(r"[/]", name)
        cleaned = []
        for p in parts:
            p = re.sub(r"[^a-zA-Z0-9_]", "", p)
            if (p and len(p) > 2 and not p.isdigit()
                    and p.lower() not in NOISE_COLUMNS and not p.startswith("_")):
                cleaned.append(p)
        return cleaned
    name = re.sub(r"[^a-zA-Z0-9_]", "", name)
    if (name and len(name) > 2 and not name.isdigit()
            and name.lower() not in NOISE_COLUMNS
            and not name.startswith("_") and not re.match(r"^\d", name)):
        return [name]
    return []


def parse_and_clean_schema(file_path: str) -> Dict[str, List[str]]:
    table_map: Dict[str, List[str]] = {}
    if not file_path or not os.path.exists(file_path):
        log.warning("Schema file not found: %s", file_path)
        return table_map
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    for table_name, schema_str in data.items():
        clean_cols: List[str] = []
        if isinstance(schema_str, str):
            for col_def in schema_str.split(","):
                clean_cols.extend(clean_column_name(col_def))
        elif isinstance(schema_str, list):
            clean_cols = [str(c) for c in schema_str if c]
        table_map[table_name] = list(dict.fromkeys(
            c for c in clean_cols
            if c and len(c) > 2 and not c.startswith("_")
            and c.lower() not in NOISE_COLUMNS and not re.match(r"^\d", c)
        ))
    return table_map


def parse_column_types(file_path: str) -> Dict[str, Dict[str, str]]:
    types_map: Dict[str, Dict[str, str]] = {}
    if not file_path or not os.path.exists(file_path):
        return types_map
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return types_map
    for table_name, schema_str in data.items():
        col_types: Dict[str, str] = {}
        if isinstance(schema_str, str):
            for col_def in schema_str.split(","):
                part = col_def.strip()
                if ":" not in part:
                    continue
                name, _, typ = part.partition(":")
                name = re.sub(r"[^a-zA-Z0-9_]", "", name.strip())
                typ = typ.strip().split()[0].lower() if typ.strip() else ""
                typ = re.sub(r"[^a-z]", "", typ)
                if name and typ:
                    col_types[name] = typ
        types_map[table_name] = col_types
    return types_map


# ---------------------- NEW: InfluxDB schema parsing -----------------------
@dataclass
class InfluxMeasurementSchema:
    measurement: str      # actual influx _measurement value, e.g. "BM-01"
    group: str            # top-level schema key it came from, e.g. "mps"
    fields: Dict[str, str]           # field_name -> influx type ("float" etc)
    tags: Dict[str, List[str]]       # tag_key -> known tag values (may be [])


def parse_influx_schema(file_path: str) -> Dict[str, InfluxMeasurementSchema]:
    """
    Normalizes the two schema shapes seen in influx_schema.json:

      1) Group with an explicit sub-measurement object:
           { "ECE2": { "electrical_params": {"tags": {...}, "fields": {...}} } }
         -> one InfluxMeasurementSchema per sub-key ("electrical_params").

      2) Group with a shared_schema applied to many named measurements:
           { "mps": { "shared_schema": {"tags":{}, "fields":{...}},
                      "measurements": ["BM-01", "BM-02", ...] } }
         -> one InfluxMeasurementSchema per entry in "measurements", all
            sharing the same tags/fields.

    Returns: {measurement_name: InfluxMeasurementSchema}
    """
    out: Dict[str, InfluxMeasurementSchema] = {}
    if not file_path or not os.path.exists(file_path):
        log.warning("InfluxDB schema file not found: %s", file_path)
        return out

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    for group_name, group_body in data.items():
        if not isinstance(group_body, dict):
            continue

        if "shared_schema" in group_body and "measurements" in group_body:
            shared = group_body.get("shared_schema", {})
            fields = dict(shared.get("fields", {}))
            tags = dict(shared.get("tags", {}))
            for m in group_body.get("measurements", []):
                out[m] = InfluxMeasurementSchema(
                    measurement=m, group=group_name, fields=fields, tags=tags,
                )
        else:
            # Each sub-key is its own measurement definition
            for sub_key, sub_body in group_body.items():
                if not isinstance(sub_body, dict):
                    continue
                fields = dict(sub_body.get("fields", {}))
                tags = dict(sub_body.get("tags", {}))
                out[sub_key] = InfluxMeasurementSchema(
                    measurement=sub_key, group=group_name, fields=fields, tags=tags,
                )
    log.info("Parsed InfluxDB schema: %d measurement(s)", len(out))
    return out


def build_influx_vocabulary(schema: Dict[str, InfluxMeasurementSchema]) -> Dict[str, List[str]]:
    """Auto-derives keyword -> [measurement names] mappings straight from the
    schema, so new machines/measurements/fields are searchable without
    hand-editing DOMAIN_VOCABULARY."""
    vocab: Dict[str, Set[str]] = defaultdict(set)
    for m_name, m_schema in schema.items():
        keys = set()
        keys.add(m_name.lower())
        keys.add(m_schema.group.lower())
        for f in m_schema.fields.keys():
            # split CamelCase / snake_case field names into tokens
            tokens = re.findall(r"[A-Za-z]+", f)
            for t in tokens:
                if len(t) > 2:
                    keys.add(t.lower())
            keys.add(f.lower())
        for k in keys:
            vocab[k].add(m_name)
    return {k: sorted(v) for k, v in vocab.items()}


_SCHEMA_CACHE: Dict[str, Dict[str, List[str]]] = {}
_TYPES_CACHE: Dict[str, Dict[str, Dict[str, str]]] = {}
_INFLUX_SCHEMA_CACHE: Dict[str, Dict[str, InfluxMeasurementSchema]] = {}


def build_clean_registry(registry: Dict[str, DatabaseConfig]) -> Dict[str, Dict[str, List[str]]]:
    """Builds the {db: {table: [columns]}} map for SQL dbs, and
    {db: {measurement: [fields]}} for influx (so downstream helpers like
    get_relevant_columns / score_table can treat fields just like columns)."""
    out: Dict[str, Dict[str, List[str]]] = {}
    for db_name, cfg in registry.items():
        if cfg.db_type == "influxdb":
            mtime = os.path.getmtime(cfg.schema_path) if os.path.exists(cfg.schema_path) else 0
            cache_key = f"{cfg.schema_path}:{mtime}"
            if cache_key not in _INFLUX_SCHEMA_CACHE:
                _INFLUX_SCHEMA_CACHE[cache_key] = parse_influx_schema(cfg.schema_path)
            influx_schema = _INFLUX_SCHEMA_CACHE[cache_key]
            out[db_name] = {m: list(s.fields.keys()) for m, s in influx_schema.items()}
            # merge auto-derived vocabulary
            auto_vocab = build_influx_vocabulary(influx_schema)
            DOMAIN_VOCABULARY.setdefault("influxdb", {})
            for kw, measurements in auto_vocab.items():
                DOMAIN_VOCABULARY["influxdb"].setdefault(kw, [])
                for m in measurements:
                    if m not in DOMAIN_VOCABULARY["influxdb"][kw]:
                        DOMAIN_VOCABULARY["influxdb"][kw].append(m)
            continue

        mtime = os.path.getmtime(cfg.schema_path) if os.path.exists(cfg.schema_path) else 0
        cache_key = f"{cfg.schema_path}:{mtime}"
        if cache_key in _SCHEMA_CACHE:
            out[db_name] = _SCHEMA_CACHE[cache_key]
        else:
            parsed = parse_and_clean_schema(cfg.schema_path)
            _SCHEMA_CACHE[cache_key] = parsed
            out[db_name] = parsed
            log.info("Loaded %s: %d tables", db_name, len(parsed))
        if cache_key not in _TYPES_CACHE:
            _TYPES_CACHE[cache_key] = parse_column_types(cfg.schema_path)
    return out


def build_type_registry(registry: Dict[str, DatabaseConfig]) -> Dict[str, Dict[str, Dict[str, str]]]:
    out: Dict[str, Dict[str, Dict[str, str]]] = {}
    for db_name, cfg in registry.items():
        if cfg.db_type == "influxdb":
            mtime = os.path.getmtime(cfg.schema_path) if os.path.exists(cfg.schema_path) else 0
            cache_key = f"{cfg.schema_path}:{mtime}"
            influx_schema = _INFLUX_SCHEMA_CACHE.get(cache_key, {})
            out[db_name] = {m: s.fields for m, s in influx_schema.items()}
            continue
        mtime = os.path.getmtime(cfg.schema_path) if os.path.exists(cfg.schema_path) else 0
        cache_key = f"{cfg.schema_path}:{mtime}"
        if cache_key not in _TYPES_CACHE:
            _TYPES_CACHE[cache_key] = parse_column_types(cfg.schema_path)
        out[db_name] = _TYPES_CACHE[cache_key]
    return out


def get_influx_schema(db_name: str = "influxdb") -> Dict[str, InfluxMeasurementSchema]:
    cfg = DB_REGISTRY[db_name]
    mtime = os.path.getmtime(cfg.schema_path) if os.path.exists(cfg.schema_path) else 0
    cache_key = f"{cfg.schema_path}:{mtime}"
    return _INFLUX_SCHEMA_CACHE.get(cache_key, {})


CLEAN_REGISTRY = build_clean_registry(DB_REGISTRY)
TYPE_REGISTRY = build_type_registry(DB_REGISTRY)

# --------------------------------------------------------------------------
# 4. Query understanding: tokens, fuzzy matching, aggregation intent
# --------------------------------------------------------------------------
AGGREGATION_VERBS = {
    "average": "AVG", "avg": "AVG", "mean": "AVG",
    "total": "SUM", "sum": "SUM",
    "count": "COUNT", "number": "COUNT",
    "maximum": "MAX", "max": "MAX", "highest": "MAX",
    "minimum": "MIN", "min": "MIN", "lowest": "MIN",
}
ANALYTIC_HINTS = {"trend", "compare", "comparison", "breakdown", "by", "per", "across", "over time"}


def extract_tokens(query: str) -> Set[str]:
    tokens = set(re.findall(r"[a-zA-Z0-9_]+", query.lower()))
    return {t for t in tokens if t not in STOP_WORDS and len(t) > 1}


def find_matched_keywords(tokens: Set[str], vocab: Dict[str, List[str]]) -> Set[str]:
    matched: Set[str] = set()
    vocab_keys = list(vocab.keys())
    for t in tokens:
        if t in vocab:
            matched.add(t)
            continue
        substr_hit = False
        for key in vocab_keys:
            if (t in key or key in t) and min(len(t), len(key)) >= 4:
                matched.add(key)
                substr_hit = True
        if substr_hit:
            continue
        if len(t) >= 5:
            close = get_close_matches(t, vocab_keys, n=1, cutoff=0.82)
            if close:
                matched.add(close[0])
    return matched


def detect_aggregation(query: str) -> Optional[str]:
    q = query.lower()
    for word, fn in AGGREGATION_VERBS.items():
        if re.search(rf"\b{re.escape(word)}\b", q):
            return fn
    if any(h in q for h in ANALYTIC_HINTS):
        return "AVG"
    return None


def score_table(table_name: str, matched_keywords: Set[str], vocab: Dict[str, List[str]]) -> int:
    score = 0
    table_l = table_name.lower()
    for kw in matched_keywords:
        if kw in vocab and table_name in vocab[kw]:
            score += 10
        if kw in table_l:
            score += 6
    return score


def get_relevant_columns(cols: List[str], tokens: Set[str], matched: Set[str]) -> List[str]:
    scored = []
    for col in cols:
        col_l = col.lower()
        s = 0
        if col_l in tokens:
            s += 12
        for m in matched:
            if m in col_l or col_l in m:
                s += 5
        if any(x in col_l for x in ["id", "name", "code", "status", "qty", "quantity",
                                     "util", "capacity", "is_active", "active"]):
            s += 2
        scored.append((s, col))
    scored.sort(key=lambda x: (-x[0], x[1]))
    relevant = [c for s, c in scored if s >= 2]
    if len(relevant) < 3:
        relevant = cols[:8]
    return relevant[:8]


def _find_numeric_column(cols: List[str], col_types: Optional[Dict[str, str]] = None) -> Optional[str]:
    col_types = col_types or {}
    name_hits = [c for c in cols if any(
        h in c.lower() for h in ["util", "capacity", "qty", "quantity", "amount",
                                  "percent", "score", "count", "value", "total"])]

    def is_safe_numeric(c: str) -> bool:
        typ = col_types.get(c, "").lower()
        if not typ:
            return True
        if typ in NUMERIC_TYPE_HINTS:
            return True
        if typ in NON_NUMERIC_TYPE_HINTS:
            return False
        return True

    def is_identifier(c: str) -> bool:
        cl = c.lower()
        return cl == "id" or cl.endswith("id") or cl.endswith("_id")

    typed_numeric = [c for c in cols if col_types.get(c, "").lower() in NUMERIC_TYPE_HINTS]
    for c in name_hits:
        if c in typed_numeric:
            return c
    for c in name_hits:
        if is_safe_numeric(c):
            return c
    measure_candidates = [c for c in typed_numeric if not is_identifier(c)]
    if measure_candidates:
        return measure_candidates[0]
    return None


def _find_categorical_column(cols: List[str], col_types: Optional[Dict[str, str]] = None) -> Optional[str]:
    col_types = col_types or {}
    name_hits = [c for c in cols if any(
        h in c.lower() for h in ["status", "type", "name", "code", "shift", "zone", "machine", "camera"])]
    for c in name_hits:
        typ = col_types.get(c, "").lower()
        if not typ or typ in NON_NUMERIC_TYPE_HINTS or typ not in NUMERIC_TYPE_HINTS:
            return c
    return name_hits[0] if name_hits else None


def customize_and_split_query(user_query: str) -> Dict[str, Any]:
    tokens = extract_tokens(user_query)
    agg_fn = detect_aggregation(user_query)
    result: Dict[str, Any] = {
        "raw_user_query": user_query,
        "aggregation": agg_fn,
        "selected_databases": [],
        "customized_db_requests": [],
    }
    for db_name, tables in CLEAN_REGISTRY.items():
        cfg = DB_REGISTRY[db_name]
        vocab = DOMAIN_VOCABULARY.get(db_name, {})
        matched = find_matched_keywords(tokens, vocab)
        if not matched:
            continue
        candidates = []
        for table_name in tables:
            sc = score_table(table_name, matched, vocab)
            if sc >= 6:
                candidates.append((sc, table_name))
        for kw in matched:
            for t in vocab.get(kw, []):
                real = next((r for r in tables if r.lower() == t.lower()), None)
                if real and not any(real == c[1] for c in candidates):
                    candidates.append((10, real))
        if not candidates:
            continue
        candidates.sort(key=lambda x: -x[0])
        # influx measurements can be numerous (per-machine); keep a few more
        top_n = 12 if cfg.db_type == "influxdb" else 10
        top_tables = [t for _, t in candidates[:top_n]]
        mappings = []
        db_types = TYPE_REGISTRY.get(db_name, {})
        for table_name in top_tables:
            cols = tables[table_name]
            col_types = db_types.get(table_name, {})
            if cfg.db_type == "influxdb":
                primary = get_relevant_columns(cols, tokens, matched)
                if not primary:
                    primary = cols[:5]
                primary = primary[:5]
                numeric_col = primary[0] if primary else None
                categorical_col = None
            else:
                primary = get_relevant_columns(cols, tokens, matched)
                numeric_col = _find_numeric_column(cols, col_types)
                categorical_col = _find_categorical_column(cols, col_types)
            mappings.append({
                "responsible_table": table_name,
                "primary_columns": primary,
                "all_table_columns": cols,
                "numeric_column": numeric_col,
                "categorical_column": categorical_col,
            })
        keywords_str = ", ".join(sorted(matched))
        if db_name == "video_analytics":
            intent = f"Retrieve camera / rules / alerts related to: {keywords_str}"
        elif db_name == "influxdb":
            intent = f"Retrieve live machine telemetry related to: {keywords_str}"
        else:
            intent = f"Retrieve machine / production / work-order data related to: {keywords_str}"
        result["selected_databases"].append(db_name)
        result["customized_db_requests"].append({
            "database": db_name,
            "customized_sub_query": intent,
            "token_keywords": sorted(list(matched)),
            "target_mappings": mappings,
        })
    return result

# --------------------------------------------------------------------------
# 5. Date detection + time filters (SQL)  +  Flux time range (NEW, influx)
# --------------------------------------------------------------------------
REAL_DATE_HINTS = [
    "created_at", "updated_at", "checked_at", "triggered_at", "timestamp",
    "createdon", "updatedon", "created_date", "updated_date",
    "startdate", "enddate", "plannedstart", "actualstart", "date",
    "changedat", "lastupdated",
]
BAD_DATE_COLUMNS = {
    "updatedby", "createdby", "status", "type", "name", "code", "location",
    "rtsp_template", "utilizationpercent", "utilization",
}


def detect_date_column(columns: List[str]) -> Optional[str]:
    cols_lower = {c.lower(): c for c in columns}
    for p in REAL_DATE_HINTS:
        if p in cols_lower:
            return cols_lower[p]
    for c in columns:
        cl = c.lower()
        if cl in BAD_DATE_COLUMNS:
            continue
        if any(h in cl for h in ["_at", "_on", "date", "time", "timestamp"]) and len(cl) > 4:
            return c
    return None


def extract_time_filter(user_query: str) -> Optional[str]:
    q = user_query.lower()
    today = datetime.now().date()

    m = re.search(r"last (\d+) days?", q)
    if m:
        start = today - timedelta(days=int(m.group(1)))
        return f"{{date_col}} >= '{start}'"

    if "last week" in q or "past week" in q:
        start = today - timedelta(days=7)
        return f"{{date_col}} >= '{start}'"
    if "this week" in q:
        start = today - timedelta(days=today.weekday())
        return f"{{date_col}} >= '{start}'"
    if "today" in q:
        return f"{{date_col}} >= '{today}'"
    if "yesterday" in q:
        y = today - timedelta(days=1)
        return f"{{date_col}} >= '{y}' AND {{date_col}} < '{today}'"
    if "last month" in q or "past month" in q:
        start = today - timedelta(days=30)
        return f"{{date_col}} >= '{start}'"
    if "this month" in q:
        start = today.replace(day=1)
        return f"{{date_col}} >= '{start}'"
    if "last quarter" in q or "past quarter" in q:
        start = today - timedelta(days=90)
        return f"{{date_col}} >= '{start}'"
    return None


# ---------------------- NEW: Flux time-range extraction ---------------------
def _to_rfc3339(dt: datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def _compute_every(span_seconds: float, target_points: int = 250) -> str:
    """Picks an aggregateWindow bucket so a query over any span returns
    roughly `target_points` rows (keeps InfluxDB payloads small)."""
    every_seconds = max(int(span_seconds / target_points), 10)
    if every_seconds < 60:
        return f"{every_seconds}s"
    if every_seconds < 3600:
        return f"{max(1, every_seconds // 60)}m"
    if every_seconds < 86400:
        return f"{max(1, every_seconds // 3600)}h"
    return f"{max(1, every_seconds // 86400)}d"


def extract_flux_time_range(user_query: str) -> Tuple[str, str, str, bool]:
    q = user_query.lower()
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=24)
    stop = now
    is_explicit = True

    m = re.search(r"last (\d+) (hour|day|week)s?", q)
    if m:
        n, unit = int(m.group(1)), m.group(2)
        delta = {"hour": timedelta(hours=n), "day": timedelta(days=n), "week": timedelta(weeks=n)}[unit]
        start = now - delta
    elif "last week" in q or "past week" in q:
        start = now - timedelta(days=7)
    elif "this week" in q:
        start = now - timedelta(days=now.weekday())
    elif "today" in q:
        start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    elif "yesterday" in q:
        day_start = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=1)
        start, stop = day_start, day_start + timedelta(days=1)
    elif "last month" in q or "past month" in q:
        start = now - timedelta(days=30)
    elif "this month" in q:
        start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    elif "last quarter" in q or "past quarter" in q:
        start = now - timedelta(days=90)
    elif "last hour" in q or "past hour" in q:
        start = now - timedelta(hours=1)
    else:
        is_explicit = False

    span_seconds = max((stop - start).total_seconds(), 60)
    every = _compute_every(span_seconds)
    return _to_rfc3339(start), _to_rfc3339(stop), every, is_explicit


INFLUX_WIDEN_WINDOWS_HOURS = [24, 24 * 7, 24 * 30, 24 * 90, 24 * 365]


# --------------------------------------------------------------------------
# 6. SQL generation (SQL dbs)  +  Flux generation (NEW, influx)
# --------------------------------------------------------------------------
def _apply_time_filter(sql_where: List[str], time_filter: Optional[str], date_col: Optional[str]) -> None:
    if time_filter and date_col:
        sql_where.append(time_filter.replace("{date_col}", f'"{date_col}"'))


def _generate_flat_sql(
    table_name: str, primary_columns: List[str], all_columns: List[str],
    time_filter: Optional[str], limit: int,
) -> str:
    date_col = detect_date_column(all_columns)
    where_clauses: List[str] = []
    _apply_time_filter(where_clauses, time_filter, date_col)
    where_sql = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""

    cols = primary_columns if primary_columns else all_columns[:8]
    if not cols:
        cols = ["*"]
    for possible_id in ["id", "Id", "ID", f"{table_name}Id"]:
        if possible_id in all_columns and possible_id not in cols:
            cols.insert(0, possible_id)
            break
    col_list = ", ".join(f'"{c}"' for c in cols)
    sql = f'SELECT {col_list}\nFROM "{table_name}"{where_sql}'
    if date_col:
        sql += f'\nORDER BY "{date_col}" DESC'
    sql += f"\nLIMIT {limit};"
    return sql


def generate_sql_for_table(
    table_name: str,
    primary_columns: List[str],
    all_columns: List[str],
    time_filter: Optional[str] = None,
    limit: int = 50,
    aggregation: Optional[str] = None,
    numeric_column: Optional[str] = None,
    categorical_column: Optional[str] = None,
) -> Tuple[str, bool, Optional[str]]:
    flat_sql = _generate_flat_sql(table_name, primary_columns, all_columns, time_filter, limit)

    if aggregation and numeric_column and categorical_column:
        date_col = detect_date_column(all_columns)
        where_clauses: List[str] = []
        _apply_time_filter(where_clauses, time_filter, date_col)
        where_sql = f"\nWHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        sql = (
            f'SELECT "{categorical_column}", '
            f'{aggregation}("{numeric_column}") AS "{aggregation.lower()}_{numeric_column}", '
            f'COUNT(*) AS "record_count"\n'
            f'FROM "{table_name}"'
            f'{where_sql}\n'
            f'GROUP BY "{categorical_column}"\n'
            f'ORDER BY 2 DESC\n'
            f'LIMIT {min(limit, 25)};'
        )
        return sql, True, flat_sql

    return flat_sql, False, None


def generate_flux_for_measurement(
    bucket: str,
    measurement: str,
    fields: List[str],
    start: str,
    stop: str,
    every: str,
    agg_fn: str = "mean",
    limit: int = 300,
) -> str:
    field_filter = " or ".join(f'r._field == "{f}"' for f in fields) if fields else "true"
    flux_agg = {"AVG": "mean", "SUM": "sum", "COUNT": "count", "MAX": "max", "MIN": "min"}.get(
        (agg_fn or "").upper(), "mean"
    )
    flux = (
        f'from(bucket: "{bucket}")\n'
        f'  |> range(start: {start}, stop: {stop})\n'
        f'  |> filter(fn: (r) => r._measurement == "{measurement}")\n'
        f'  |> filter(fn: (r) => {field_filter})\n'
        f'  |> aggregateWindow(every: {every}, fn: {flux_agg}, createEmpty: false)\n'
        f'  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")\n'
        f'  |> sort(columns: ["_time"])\n'
        f'  |> limit(n: {limit})'
    )
    return flux


def generate_sql_queries(pipeline_output: Dict[str, Any], limit_per_table: int = 50) -> Dict[str, Any]:
    time_filter = extract_time_filter(pipeline_output.get("raw_user_query", ""))
    aggregation = pipeline_output.get("aggregation")
    flux_start, flux_stop, flux_every, flux_explicit = extract_flux_time_range(pipeline_output.get("raw_user_query", ""))

    sql_result: Dict[str, Any] = {
        "raw_user_query": pipeline_output.get("raw_user_query"),
        "time_filter_applied": time_filter,
        "flux_time_range": {"start": flux_start, "stop": flux_stop, "every": flux_every, "explicit": flux_explicit},
        "aggregation_applied": aggregation,
        "databases": [],
    }
    for req in pipeline_output.get("customized_db_requests", []):
        cfg = DB_REGISTRY[req["database"]]
        db_entry = {
            "database": req["database"],
            "intent": req["customized_sub_query"],
            "keywords": req["token_keywords"],
            "queries": [],
        }

        if cfg.db_type == "influxdb":
            bucket = cfg.connection.get("bucket", "")
            for mapping in req["target_mappings"]:
                measurement = mapping["responsible_table"]
                fields = mapping["primary_columns"] or mapping["all_table_columns"][:5]
                flux = generate_flux_for_measurement(
                    bucket=bucket, measurement=measurement, fields=fields,
                    start=flux_start, stop=flux_stop, every=flux_every,
                    agg_fn="AVG", limit=300,
                )
                db_entry["queries"].append({
                    "table": measurement,
                    "sql": flux,
                    "fallback_sql": None,
                    "is_aggregate": bool(aggregation),
                    "columns_used": fields,
                    "date_column_used": "_time",
                    "explanation": f"Downsampled telemetry ({flux_every} buckets, mean) from {measurement}",
                    "source_type": "influxdb",
                    "influx_bucket": bucket,
                    "influx_measurement": measurement,
                    "influx_fields": fields,
                    "influx_agg": "AVG",
                    "influx_time_explicit": flux_explicit,
                    "influx_window_hours": 24,
                })
        else:
            for mapping in req["target_mappings"]:
                table = mapping["responsible_table"]
                primary = mapping["primary_columns"]
                all_cols = mapping["all_table_columns"]
                sql, is_agg, fallback_sql = generate_sql_for_table(
                    table, primary, all_cols, time_filter, limit=limit_per_table,
                    aggregation=aggregation,
                    numeric_column=mapping.get("numeric_column"),
                    categorical_column=mapping.get("categorical_column"),
                )
                db_entry["queries"].append({
                    "table": table,
                    "sql": sql,
                    "fallback_sql": fallback_sql,
                    "is_aggregate": is_agg,
                    "columns_used": primary if primary else all_cols[:8],
                    "date_column_used": detect_date_column(all_cols),
                    "explanation": (
                        f"Aggregate ({aggregation}) view of {table}" if is_agg
                        else f"Fetch relevant columns from {table}"
                    ),
                    "source_type": cfg.db_type,
                })
        sql_result["databases"].append(db_entry)
    return sql_result


# --------------------------------------------------------------------------
# 7. Validator
# --------------------------------------------------------------------------
def validate_sql(sql: str, columns_used: List[str], date_col: Optional[str], is_aggregate: bool,
                  source_type: str = "sql") -> List[str]:
    if source_type == "influxdb":
        issues = []
        if "range(" not in sql:
            issues.append("Flux query missing a range() clause")
        return issues
    issues = []
    if not is_aggregate and date_col and "ORDER BY" not in sql:
        issues.append(f"Has date column '{date_col}' but no ORDER BY")
    if not is_aggregate and len(columns_used) < 2:
        issues.append("Too few columns selected")
    if "SELECT *" in sql:
        issues.append("Using SELECT *")
    for bad in ["_at", "4NN", "2NN", "DateOn"]:
        if f'"{bad}"' in sql or f".{bad}" in sql:
            issues.append(f"Noise column still present: {bad}")
    return issues


def analyze_pipeline_result(sql_result: Dict[str, Any]) -> Dict[str, Any]:
    report = {
        "query": sql_result["raw_user_query"],
        "databases_selected": [d["database"] for d in sql_result["databases"]],
        "total_queries": 0,
        "issues_found": [],
        "status": "OK",
    }
    for db in sql_result["databases"]:
        for q in db["queries"]:
            report["total_queries"] += 1
            issues = validate_sql(q["sql"], q["columns_used"], q.get("date_column_used"),
                                   q.get("is_aggregate", False), q.get("source_type", "sql"))
            for iss in issues:
                report["issues_found"].append(f"[{db['database']}.{q['table']}] {iss}")
    if report["issues_found"]:
        report["status"] = "ISSUES_DETECTED"
    return report

# --------------------------------------------------------------------------
# 8. Database connections & execution
# --------------------------------------------------------------------------
def get_connection(cfg: DatabaseConfig):
    if cfg.db_type == "mssql":
        c = cfg.connection
        driver = c.get("driver", "ODBC Driver 18 for SQL Server")
        server = c.get("server", "localhost,1433")
        database = c.get("database", "")
        trusted = str(c.get("trusted", "yes")).lower() == "yes"
        encrypt = c.get("encrypt", "no")
        trust_cert = c.get("trust_cert", "yes")
        conn_str = (
            f"DRIVER={{{driver}}};SERVER={server};DATABASE={database};"
            f"Trusted_Connection={'yes' if trusted else 'no'};"
            f"Encrypt={encrypt};TrustServerCertificate={trust_cert};"
        )
        return pyodbc.connect(conn_str, timeout=15)

    if cfg.db_type == "postgres":
        c = cfg.connection
        url = c.get("url")
        if url and url.startswith("postgresql"):
            url = url.replace("postgresql+psycopg2://", "postgresql://")
            return psycopg2.connect(url)
        return psycopg2.connect(
            host=c.get("host", "localhost"),
            port=c.get("port", "5432"),
            dbname=c.get("dbname", "postgres"),
            user=c.get("user", "postgres"),
            password=c.get("password", ""),
        )

    raise ValueError(f"Unsupported db_type for get_connection(): {cfg.db_type}")


def execute_sql(db_name: str, sql: str) -> Tuple[List[str], List[Tuple], Optional[str]]:
    cfg = DB_REGISTRY.get(db_name)
    if cfg is None:
        return [], [], f"Unknown database: {db_name}"

    run_sql = sql
    if cfg.db_type == "mssql":
        run_sql = re.sub(r'"([^"]+)"', r'[\1]', run_sql)
        m = re.search(r"LIMIT\s+(\d+)", run_sql, re.IGNORECASE)
        if m:
            limit = m.group(1)
            run_sql = re.sub(r"LIMIT\s+\d+\s*;?", "", run_sql, flags=re.IGNORECASE)
            run_sql = re.sub(r"(SELECT\s+)", rf"\1TOP {limit} ", run_sql, count=1, flags=re.IGNORECASE)

    try:
        conn = get_connection(cfg)
        try:
            if cfg.db_type == "mssql":
                cursor = conn.cursor()
                cursor.execute(run_sql)
                columns = [col[0] for col in cursor.description] if cursor.description else []
                rows = [tuple(r) for r in cursor.fetchall()]
                cursor.close()
            else:
                cursor = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
                cursor.execute(run_sql)
                columns = [desc[0] for desc in cursor.description] if cursor.description else []
                rows = [tuple(r) for r in cursor.fetchall()]
                cursor.close()
            return columns, rows, None
        finally:
            conn.close()
    except Exception as e:
        log.error("Query failed on %s: %s\nSQL was:\n%s", db_name, e, run_sql)
        return [], [], str(e)


# ---------------------- NEW: InfluxDB execution -----------------------------
def execute_flux(db_name: str, flux_query: str) -> Tuple[List[str], List[Tuple], Optional[str]]:
    cfg = DB_REGISTRY.get(db_name)
    if cfg is None:
        return [], [], f"Unknown database: {db_name}"
    c = cfg.connection
    try:
        client = InfluxDBClient(url=c.get("url"), token=c.get("token"), org=c.get("org"), timeout=20_000)
        try:
            query_api = client.query_api()
            df = query_api.query_data_frame(flux_query)
            if isinstance(df, list):
                import pandas as pd
                df = pd.concat(df, ignore_index=True) if df else None
            if df is None or df.empty:
                return [], [], None
            drop_cols = [c2 for c2 in ["result", "table", "_start", "_stop", "_measurement"] if c2 in df.columns]
            df = df.drop(columns=drop_cols, errors="ignore")
            columns = list(df.columns)
            rows = [tuple(r) for r in df.itertuples(index=False, name=None)]
            return columns, rows, None
        finally:
            client.close()
    except Exception as e:
        log.error("Influx query failed on %s: %s\nFlux was:\n%s", db_name, e, flux_query)
        return [], [], str(e)


def execute_flux_with_widening(db_name: str, q: Dict[str, Any]) -> Dict[str, Any]:
    cols, rows, err = execute_flux(db_name, q["sql"])
    windows_tried = [{"hours": q.get("influx_window_hours", 24), "row_count": len(rows), "error": err}]
    final_sql = q["sql"]

    can_widen = (
        err is None and len(rows) == 0
        and not q.get("influx_time_explicit", True)
        and q.get("influx_measurement") and q.get("influx_bucket")
    )
    if can_widen:
        now = datetime.now(timezone.utc)
        already_tried_hours = q.get("influx_window_hours", 24)
        for hrs in INFLUX_WIDEN_WINDOWS_HOURS:
            if hrs <= already_tried_hours:
                continue
            start = now - timedelta(hours=hrs)
            stop = now
            span_seconds = hrs * 3600
            every = _compute_every(span_seconds)
            widened_flux = generate_flux_for_measurement(
                bucket=q["influx_bucket"], measurement=q["influx_measurement"],
                fields=q.get("influx_fields") or [], start=_to_rfc3339(start), stop=_to_rfc3339(stop),
                every=every, agg_fn=q.get("influx_agg", "AVG"), limit=300,
            )
            cols2, rows2, err2 = execute_flux(db_name, widened_flux)
            windows_tried.append({"hours": hrs, "row_count": len(rows2), "error": err2})
            if err2 is None and len(rows2) > 0:
                cols, rows, err = cols2, rows2, err2
                final_sql = widened_flux
                log.info("Influx %s: widened window to last %dh to find data.", q["table"], hrs)
                break
            if err2 is not None:
                break

    return {
        "table": q["table"],
        "sql": final_sql,
        "is_aggregate": q.get("is_aggregate", False),
        "aggregation_fallback": False,
        "original_aggregate_error": None,
        "columns": cols,
        "rows": rows,
        "row_count": len(rows),
        "error": err,
        "explanation": q["explanation"],
        "source_type": "influxdb",
        "time_windows_tried": windows_tried,
    }


def _execute_with_aggregate_fallback(db_name: str, q: Dict[str, Any]) -> Dict[str, Any]:
    if q.get("source_type") == "influxdb":
        return execute_flux_with_widening(db_name, q)

    cols, rows, err = execute_sql(db_name, q["sql"])
    used_fallback = False
    original_error = None

    if err and q.get("is_aggregate") and q.get("fallback_sql"):
        log.warning("Aggregate query on %s.%s failed (%s) - retrying as a flat row query.",
                    db_name, q["table"], err)
        original_error = err
        cols, rows, err2 = execute_sql(db_name, q["fallback_sql"])
        if err2 is None:
            used_fallback = True
            err = None
        else:
            err = err2

    return {
        "table": q["table"],
        "sql": q["fallback_sql"] if used_fallback else q["sql"],
        "is_aggregate": False if used_fallback else q.get("is_aggregate", False),
        "aggregation_fallback": used_fallback,
        "original_aggregate_error": original_error,
        "columns": cols,
        "rows": rows,
        "row_count": len(rows),
        "error": err,
        "explanation": q["explanation"],
        "source_type": q.get("source_type", "sql"),
    }


def run_all_queries(sql_result: Dict[str, Any], max_workers: int = 8) -> Dict[str, Any]:
    execution_result: Dict[str, Any] = {
        "raw_user_query": sql_result["raw_user_query"],
        "time_filter_applied": sql_result.get("time_filter_applied"),
        "flux_time_range": sql_result.get("flux_time_range"),
        "aggregation_applied": sql_result.get("aggregation_applied"),
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "databases": [],
    }

    jobs = []
    for db_entry in sql_result.get("databases", []):
        for q in db_entry["queries"]:
            jobs.append((db_entry["database"], q))

    results_by_id: Dict[int, Dict[str, Any]] = {}
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        future_map = {
            pool.submit(_execute_with_aggregate_fallback, db_name, q): (id(q), db_name, q)
            for db_name, q in jobs
        }
        for fut in as_completed(future_map):
            job_id, db_name, q = future_map[fut]
            results_by_id[job_id] = fut.result()

    for db_entry in sql_result.get("databases", []):
        new_db = {
            "database": db_entry["database"],
            "intent": db_entry["intent"],
            "keywords": db_entry["keywords"],
            "queries": [results_by_id[id(q)] for q in db_entry["queries"]],
        }
        execution_result["databases"].append(new_db)

    return execution_result

# --------------------------------------------------------------------------
# 9. Rich metadata + data-quality scoring (SQL)  +  compact influx stats (NEW)
# --------------------------------------------------------------------------
def _detect_type(values: list) -> str:
    non_null = [v for v in values if v is not None]
    if not non_null:
        return "unknown"
    sample = non_null[0]
    if isinstance(sample, bool):
        return "boolean"
    if isinstance(sample, int) and not isinstance(sample, bool):
        return "integer"
    if isinstance(sample, float):
        return "numeric"
    try:
        float(sample)
        return "numeric"
    except (TypeError, ValueError):
        pass
    return "string"


def _build_rich_metadata(table_name: str, columns: List[str], rows: List[Tuple], max_sample: int = 5) -> Dict[str, Any]:
    if not rows or not columns:
        return {
            "table_name": table_name, "total_records": 0, "total_columns": len(columns),
            "columns": columns, "column_details": {},
            "data_quality": {"potential_outliers": [], "zero_values": {}, "completeness_pct": 0, "score": "N/A"},
        }

    total_records = len(rows)
    col_details: Dict[str, Any] = {}
    zero_values: Dict[str, int] = {}
    potential_outliers: List[Dict[str, Any]] = []
    total_cells = total_records * len(columns)
    null_cells = 0

    for col_idx, col_name in enumerate(columns):
        col_values = [row[col_idx] for row in rows]
        non_null = [v for v in col_values if v is not None]
        null_count = total_records - len(non_null)
        null_cells += null_count
        unique_count = len(set(str(v) for v in non_null))
        dtype = _detect_type(col_values)

        detail: Dict[str, Any] = {
            "data_type": dtype, "null_count": null_count, "unique_count": unique_count,
            "sample_values": [],
        }
        samples, seen = [], set()
        for v in non_null:
            s = str(v)
            if s not in seen:
                samples.append(v)
                seen.add(s)
            if len(samples) >= max_sample:
                break
        detail["sample_values"] = samples

        if dtype in ("numeric", "integer"):
            nums = []
            for v in non_null:
                try:
                    nums.append(float(v))
                except (TypeError, ValueError):
                    continue
            if nums:
                detail["min"] = round(min(nums), 2)
                detail["max"] = round(max(nums), 2)
                detail["avg"] = round(sum(nums) / len(nums), 2)
                zero_cnt = sum(1 for n in nums if n == 0)
                if zero_cnt:
                    zero_values[col_name] = zero_cnt
                if len(nums) > 5:
                    avg = detail["avg"]
                    for n in nums:
                        if avg > 0 and n > avg * 10:
                            potential_outliers.append({
                                "column": col_name, "value": n,
                                "issue": f"Unusually high value (>{avg * 10:.1f})",
                            })
                            break
        col_details[col_name] = detail

    completeness_pct = round(100 * (1 - null_cells / total_cells), 1) if total_cells else 0
    if completeness_pct >= 95 and len(potential_outliers) == 0:
        score = "Good"
    elif completeness_pct >= 80:
        score = "Fair"
    else:
        score = "Needs review"

    return {
        "table_name": table_name, "total_records": total_records, "total_columns": len(columns),
        "columns": columns, "column_details": col_details,
        "data_quality": {
            "potential_outliers": potential_outliers,
            "zero_values": zero_values,
            "completeness_pct": completeness_pct,
            "score": score,
        },
    }


def _build_influx_metadata(measurement: str, columns: List[str], rows: List[Tuple]) -> Dict[str, Any]:
    if not rows or not columns:
        return {"measurement": measurement, "record_count": 0, "fields": {}}

    time_idx = columns.index("_time") if "_time" in columns else None
    field_stats: Dict[str, Any] = {}

    for col_idx, col_name in enumerate(columns):
        if col_name in ("_time",):
            continue
        values = [row[col_idx] for row in rows]
        nums = []
        for v in values:
            try:
                if v is not None:
                    nums.append(float(v))
            except (TypeError, ValueError):
                continue
        if not nums:
            continue
        first_v, last_v = nums[0], nums[-1]
        trend = "flat"
        if last_v > first_v * 1.05:
            trend = "rising"
        elif last_v < first_v * 0.95:
            trend = "falling"
        field_stats[col_name] = {
            "min": round(min(nums), 3),
            "max": round(max(nums), 3),
            "avg": round(sum(nums) / len(nums), 3),
            "last": round(last_v, 3),
            "trend": trend,
        }

    time_range = None
    if time_idx is not None and rows:
        time_range = {"start": str(rows[0][time_idx]), "end": str(rows[-1][time_idx])}

    return {
        "measurement": measurement,
        "record_count": len(rows),
        "time_range": time_range,
        "fields": field_stats,
    }


# --------------------------------------------------------------------------
# 10. LLM context preparation (token-optimized)
# --------------------------------------------------------------------------
def prepare_llm_context(execution_result: Dict[str, Any], metadata_threshold: int = 5) -> str:
    parts = [f"USER QUERY: {execution_result['raw_user_query']}",
             f"Generated at: {execution_result['generated_at']}"]
    if execution_result.get("time_filter_applied"):
        parts.append(f"Time filter: {execution_result['time_filter_applied']}")
    if execution_result.get("flux_time_range"):
        ftr = execution_result["flux_time_range"]
        parts.append(f"Telemetry time range: {ftr['start']} to {ftr['stop']} (bucket: {ftr['every']})")
    if execution_result.get("aggregation_applied"):
        parts.append(f"Aggregation requested: {execution_result['aggregation_applied']}")
    parts.append("")

    for db in execution_result["databases"]:
        parts.append(f"=== DATABASE: {db['database'].upper()} ===")
        parts.append(f"Intent: {db['intent']}")
        parts.append(f"Keywords: {', '.join(db['keywords'])}")
        parts.append("")
        for q in db["queries"]:
            if q.get("error"):
                parts.append(f"--- Table: {q['table']} (QUERY FAILED: {q['error']}) ---\n")
                continue
            if q["row_count"] == 0:
                if q.get("source_type") == "influxdb" and q.get("time_windows_tried"):
                    tried = ", ".join(f"last {w['hours']}h -> {w['row_count']} rows" for w in q["time_windows_tried"])
                    parts.append(f"--- Telemetry: {q['table']} (NO DATA in any tried window: {tried}) ---\n")
                continue

            if q.get("source_type") == "influxdb":
                meta = _build_influx_metadata(q["table"], q["columns"], q["rows"])
                parts.append(f"--- Telemetry: {q['table']} ({q['row_count']} downsampled points) ---")
                parts.append(json.dumps(meta, default=str))
                parts.append("")
                continue

            note = ""
            if q.get("is_aggregate"):
                note = ", aggregated"
            elif q.get("aggregation_fallback"):
                note = ", aggregation not possible on this table - showing raw rows instead"
            parts.append(f"--- Table: {q['table']} ({q['row_count']} rows{note}) ---")
            if q["row_count"] > metadata_threshold:
                meta = _build_rich_metadata(q["table"], q["columns"], q["rows"])
                parts.append(json.dumps(meta, indent=2, default=str))
            else:
                parts.append(f"Columns: {q['columns']}")
                for i, row in enumerate(q["rows"][:15]):
                    parts.append(f"  Row {i+1}: {row}")
                if q["row_count"] > 15:
                    parts.append(f"  ... ({q['row_count']-15} more rows)")
            parts.append("")
    return "\n".join(parts)


# --------------------------------------------------------------------------
# 11. LLM layer: fallback chain + retry/backoff + token/cost tracking
# --------------------------------------------------------------------------
LLM_SYSTEM_PROMPT = """You are an expert manufacturing & IoT-telemetry data analyst.
You receive a user query and the actual data retrieved from the databases
(SQL tables shown as row/metadata samples, and InfluxDB telemetry shown ONLY
as compact per-field statistics: min/max/avg/last/trend - you will never see
raw telemetry rows, so base telemetry commentary strictly on those stats).

Your job is to produce a clean JSON array of report sections.

STRICT RULES:
1. Output ONLY valid JSON - no markdown, no explanation, no extra text.
2. Each section must have exactly these keys:
   - "title": short meaningful title (string)
   - "summary": 3-8 sentence plain-text summary of the data in this section (string)
   - "chart": true or false
   - "chart_config": null OR an object with:
        {
          "chart_type": "bar" | "hbar" | "line" | "pie" | "donut" | "scatter",
          "x_axis": "column name",
          "y_axis": "column name",
          "label": "human readable label",
          "title": "chart title",
          "aggregation": "sum" | "avg" | "count" | null
        }
   - "table_name": the source table/measurement this section is primarily about (string, best guess)
3. Use chart=true only when a visualization truly adds value. Do NOT request
   a chart when the underlying table/measurement has only one row or one
   category to plot (e.g. a single punch_type, a single status value) -
   a one-bar chart is useless; just describe the number in the summary instead.
4. Supported chart_type values are ONLY: "bar", "hbar", "line", "pie", "donut", "scatter".
5. For InfluxDB telemetry sections you MUST use chart_type "line" with
   x_axis="_time" - never bar/pie/hbar/scatter for telemetry, since it is a
   time series. If a telemetry measurement has no data, do not request a chart for it.
6. Group related tables/measurements into logical sections when it makes sense.
7. Never invent data. Base everything strictly on the provided data/stats.
8. If a table's query failed, or a telemetry measurement returned "NO DATA
   in any tried window", explain that plainly (mention it looks like a data
   collection / configuration gap worth checking, not just "no data").
9. Write summaries with real analytical substance, not generic filler:
   name the specific numbers, say what they imply operationally (e.g. is
   this good/bad/typical), and where relevant note what evidence is missing.
"""

LLM_MODELS = [m.strip() for m in os.getenv(
    "LLM_FALLBACK_MODELS",
    "gemini/gemini-3.5-flash,gemini/gemini-3.6-flash,groq/openai/gpt-oss-120b,groq/openai/gpt-oss-20b"
).split(",") if m.strip()]

MAX_RETRIES_PER_MODEL = int(os.getenv("LLM_MAX_RETRIES", "2"))
RETRY_BACKOFF_SECONDS = float(os.getenv("LLM_RETRY_BACKOFF", "1.5"))


def _clean_json_content(content: str) -> str:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    return content


def _normalize_sections(parsed: Any) -> List[Dict[str, Any]]:
    if isinstance(parsed, list):
        sections = parsed
    elif isinstance(parsed, dict) and "sections" in parsed:
        sections = parsed["sections"]
    elif isinstance(parsed, dict):
        sections = [parsed]
    else:
        raise ValueError("Unexpected JSON structure from LLM")
    for s in sections:
        if "title" not in s or "summary" not in s:
            raise ValueError("Missing required keys in section")
        s.setdefault("chart", False)
        s.setdefault("table_name", None)
        if s.get("chart") and not s.get("chart_config"):
            s["chart"] = False
            s["chart_config"] = None
    return sections


def _empty_usage(model: Optional[str] = None, fallback_used: bool = False) -> Dict[str, Any]:
    return {
        "model": model, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
        "cost_usd": None, "fallback_used": fallback_used,
    }


def _safe_completion_cost(response: Any) -> Optional[float]:
    try:
        cost = completion_cost(completion_response=response)
        return float(cost) if cost is not None else None
    except Exception as e:
        log.debug("completion_cost() unavailable for this model: %s", e)
        return None


def call_llm_with_fallback(
    user_query: str,
    data_context: str,
    execution_result: Optional[Dict[str, Any]] = None,
) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    messages = [
        {"role": "system", "content": LLM_SYSTEM_PROMPT},
        {"role": "user", "content": f"USER QUERY:\n{user_query}\n\nDATA CONTEXT:\n{data_context}"},
    ]

    last_error = None
    for model in LLM_MODELS:
        for attempt in range(1, MAX_RETRIES_PER_MODEL + 1):
            try:
                log.info("Trying LLM model %s (attempt %d/%d)", model, attempt, MAX_RETRIES_PER_MODEL)
                response = completion(model=model, messages=messages, temperature=0.2, max_tokens=4096)
                content = _clean_json_content(response.choices[0].message.content)
                sections = _normalize_sections(json.loads(content))

                usage = getattr(response, "usage", None)
                prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
                completion_tokens = getattr(usage, "completion_tokens", 0) or 0
                total_tokens = getattr(usage, "total_tokens", None) or (prompt_tokens + completion_tokens)
                usage_info = {
                    "model": model,
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "total_tokens": total_tokens,
                    "cost_usd": _safe_completion_cost(response),
                    "fallback_used": False,
                }

                log.info("LLM success with %s - %d sections (%d prompt / %d completion tokens, cost=%s)",
                          model, len(sections), prompt_tokens, completion_tokens,
                          f"${usage_info['cost_usd']:.4f}" if usage_info["cost_usd"] is not None else "N/A")
                return sections, usage_info
            except Exception as e:
                last_error = e
                log.warning("%s attempt %d failed: %s", model, attempt, e)
                if attempt < MAX_RETRIES_PER_MODEL:
                    time.sleep(RETRY_BACKOFF_SECONDS * attempt)

    log.error("All LLM models failed (last error: %s). Falling back to data-driven sections.", last_error)
    sections = build_fallback_sections_from_data(user_query, execution_result)
    return sections, _empty_usage(model=None, fallback_used=True)


def build_fallback_sections_from_data(user_query: str, execution_result: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []
    if not execution_result:
        return [{
            "title": "Data Summary", "table_name": None,
            "summary": "AI summarisation was unavailable for this run. See the data tables and appendix below for the raw results.",
            "chart": False, "chart_config": None,
        }]

    for db in execution_result.get("databases", []):
        for q in db["queries"]:
            if q.get("error") or q["row_count"] == 0:
                continue

            if q.get("source_type") == "influxdb":
                meta = _build_influx_metadata(q["table"], q["columns"], q["rows"])
                field_bits = [f"{f} (avg {s['avg']}, {s['trend']})" for f, s in list(meta["fields"].items())[:4]]
                summary = (
                    f"{meta['record_count']} downsampled telemetry point(s) from {q['table']}. "
                    + (f"Fields: {', '.join(field_bits)}. " if field_bits else "")
                    + "AI narrative summarisation was unavailable for this run; figures above are computed directly from InfluxDB."
                )
                numeric_fields = [f for f in q["columns"] if f != "_time"]
                chart_cfg = None
                use_chart = False
                if numeric_fields:
                    use_chart = True
                    chart_cfg = {
                        "chart_type": "line", "x_axis": "_time", "multi_field": True,
                        "title": f"{q['table']}: signals over time",
                    }
                sections.append({
                    "title": f"{q['table']} telemetry",
                    "table_name": q["table"],
                    "summary": summary,
                    "chart": use_chart,
                    "chart_config": chart_cfg,
                })
                continue

            meta = _build_rich_metadata(q["table"], q["columns"], q["rows"])
            dq = meta["data_quality"]
            summary = (
                f"{meta['total_records']} record(s) retrieved from {q['table']} "
                f"across {meta['total_columns']} columns. Data completeness is "
                f"{dq['completeness_pct']}% ({dq['score']}). "
            )
            if dq["potential_outliers"]:
                summary += f"{len(dq['potential_outliers'])} potential outlier(s) flagged. "
            summary += "AI narrative summarisation was unavailable for this run; figures above are computed directly from the data."

            chart_cfg = None
            use_chart = False
            if q.get("is_aggregate") and len(q["columns"]) >= 2:
                use_chart = True
                chart_cfg = {
                    "chart_type": "bar", "x_axis": q["columns"][0], "y_axis": q["columns"][1],
                    "label": q["columns"][1], "title": f"{q['table']}: {q['columns'][1]} by {q['columns'][0]}",
                    "aggregation": None,
                }
            sections.append({
                "title": f"{q['table']} overview",
                "table_name": q["table"],
                "summary": summary,
                "chart": use_chart,
                "chart_config": chart_cfg,
            })

    if not sections:
        sections.append({
            "title": "No Data Found", "table_name": None,
            "summary": "No matching data was returned for this query. Try rephrasing it or widening the time filter.",
            "chart": False, "chart_config": None,
        })
    return sections

# --------------------------------------------------------------------------
# 12. Chart drawing  (bar / hbar / line / pie / donut / scatter, themed)
# --------------------------------------------------------------------------
plt.rcParams.update({
    "axes.edgecolor": "#cfd8dc",
    "axes.grid": True,
    "grid.color": "#e5e8e8",
    "grid.linewidth": 0.6,
    "font.size": 9,
})


def _truncate_label(v: Any, max_len: int = 16) -> str:
    s = str(v)
    return s if len(s) <= max_len else s[: max_len - 1] + "…"


def _is_number(v: Any) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def draw_chart_from_config(
    chart_config: Dict[str, Any], columns: List[str], rows: List[Tuple]
) -> Optional[io.BytesIO]:
    if not chart_config or not rows or not columns:
        return None

    chart_type = (chart_config.get("chart_type") or "").lower()
    x_axis = chart_config.get("x_axis")
    y_axis = chart_config.get("y_axis")
    title = chart_config.get("title") or chart_config.get("label") or "Chart"
    aggregation = (chart_config.get("aggregation") or "sum").lower()
    col_idx = {c: i for i, c in enumerate(columns)}

    palette = THEME.get("palette", ["#1D5375", "#E67E22", "#2ECC71", "#9B59B6", "#3498DB"])
    primary_color = THEME.get("primary", "#1D5375")
    primary_light = THEME.get("primary_light", "#3498DB")
    text_color = THEME.get("text", "#333333")
    grid_color = THEME.get("grid", "#E0E0E0")

    def get_col(name):
        return [row[col_idx[name]] for row in rows] if name in col_idx else None

    def apply_clean_spines(ax, show_x_grid=False, show_y_grid=True):
        ax.set_axisbelow(True)
        for spine in ["top", "right", "left", "bottom"]:
            ax.spines[spine].set_color("#E0E0E0")
            ax.spines[spine].set_linewidth(0.8)
        ax.xaxis.grid(show_x_grid, linestyle="-", alpha=0.3, color=grid_color, zorder=0)
        ax.yaxis.grid(show_y_grid, linestyle="-", alpha=0.3, color=grid_color, zorder=0)

    try:
        if chart_type in ("pie", "donut"):
            cat_col = x_axis or (columns[0] if columns else None)
            if not cat_col:
                return None
            cats = get_col(cat_col)
            if not cats:
                return None
            counts = Counter(str(c) for c in cats if c is not None)
            if len(counts) < 2 or len(counts) > 12:
                return None
            sorted_counts = dict(sorted(counts.items(), key=lambda item: item[1], reverse=True))
            raw_labels = list(sorted_counts.keys())
            labels = [_truncate_label(k) for k in raw_labels]
            sizes = list(sorted_counts.values())
            fig, ax = plt.subplots(figsize=(5.5, 3.2), dpi=150, subplot_kw=dict(aspect="equal"))
            is_donut = chart_type == "donut"
            wedge_kw = {"edgecolor": "white", "linewidth": 1.2}
            if is_donut:
                wedge_kw["width"] = 0.4

            def custom_autopct(pct):
                return f"{pct:.1f}%" if pct >= 3.0 else ""

            wedges, texts, autotexts = ax.pie(
                sizes, autopct=custom_autopct, pctdistance=0.72 if is_donut else 0.62,
                startangle=140, colors=palette[: len(labels)], wedgeprops=wedge_kw,
            )
            for autotext in autotexts:
                autotext.set_color("white")
                autotext.set_fontsize(7.5)
                autotext.set_weight("bold")
            ax.legend(wedges, labels, title=cat_col.title(), loc="center left",
                      bbox_to_anchor=(0.95, 0.5), frameon=False, fontsize=8,
                      title_fontsize=8.5, labelspacing=0.3)
            ax.set_title(title, fontsize=11, color=primary_color, weight="bold", pad=10)
            buf = io.BytesIO()
            fig.tight_layout()
            fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
            buf.seek(0)
            plt.close(fig)
            return buf

        if chart_type == "scatter":
            if not x_axis or not y_axis:
                return None
            xs, ys = get_col(x_axis), get_col(y_axis)
            if not xs or not ys:
                return None
            pairs = [(float(x), float(y)) for x, y in zip(xs, ys)
                     if x is not None and y is not None and _is_number(x) and _is_number(y)]
            if len(pairs) < 2:
                return None
            xv, yv = zip(*pairs)
            fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
            ax.scatter(xv, yv, color=primary_light, alpha=0.8, edgecolors="white", linewidth=1, s=60, zorder=3)
            apply_clean_spines(ax, show_x_grid=True, show_y_grid=True)
            ax.set_title(title, fontsize=12, color=primary_color, weight="bold", pad=15)
            ax.set_xlabel(x_axis.title(), fontsize=10, color=text_color, labelpad=8)
            ax.set_ylabel(y_axis.title(), fontsize=10, color=text_color, labelpad=8)
            buf = io.BytesIO()
            fig.tight_layout()
            fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
            buf.seek(0)
            plt.close(fig)
            return buf

        if chart_type in ("bar", "hbar", "line"):
            is_multi_field = chart_type == "line" and x_axis == "_time" and chart_config.get("multi_field")
            if not x_axis or (not y_axis and not is_multi_field):
                return None
            xs = get_col(x_axis)
            ys = get_col(y_axis) if y_axis else None
            if not xs or (not is_multi_field and not ys):
                return None

            if chart_type == "line" and x_axis == "_time":
                if chart_config.get("multi_field"):
                    exclude = {"_time"}
                    tag_like = {
                        c for c in columns
                        if not _is_number(
                            next((row[col_idx[c]] for row in rows if row[col_idx[c]] is not None), None)
                        )
                    }
                    field_names = [c for c in columns if c not in exclude and c not in tag_like]
                    field_names = field_names[:5]
                    if not field_names:
                        return None

                    time_vals = get_col("_time")
                    n = len(time_vals)

                    def _to_ist_label(t) -> str:
                        try:
                            if isinstance(t, datetime):
                                dt = t
                            else:
                                s = str(t).replace("Z", "+00:00")
                                dt = datetime.fromisoformat(s)
                            if dt.tzinfo is None:
                                dt = dt.replace(tzinfo=timezone.utc)
                            ist = dt.astimezone(timezone(timedelta(hours=5, minutes=30)))
                            return ist.strftime("%d-%b %H:%M")
                        except Exception:
                            return _truncate_label(str(t), 16)

                    ist_labels = [_to_ist_label(t) for t in time_vals]

                    fig, ax = plt.subplots(figsize=(9.5, 4.8), dpi=150)

                    plotted_any = False
                    for i, fname in enumerate(field_names):
                        yv_raw = get_col(fname)
                        pairs = [
                            (idx, float(y))
                            for idx, y in enumerate(yv_raw)
                            if y is not None and _is_number(y)
                        ]
                        if len(pairs) < 2:
                            continue

                        xs_idx = [p[0] for p in pairs]
                        ys_val = [p[1] for p in pairs]
                        max_abs = max(abs(v) for v in ys_val) or 1.0
                        ys_norm = [100.0 * v / max_abs for v in ys_val]

                        color = palette[i % len(palette)]
                        ax.plot(
                            xs_idx, ys_norm,
                            linewidth=2.2,
                            color=color,
                            label=f"{fname}  (max {max_abs:.1f})",
                            zorder=4,
                            solid_capstyle="round",
                        )
                        ax.fill_between(xs_idx, ys_norm, alpha=0.08, color=color, zorder=3)
                        plotted_any = True

                    if not plotted_any:
                        plt.close(fig)
                        return None

                    step = max(1, n // 8)
                    ax.set_xticks(range(0, n, step))
                    ax.set_xticklabels(
                        [ist_labels[i] for i in range(0, n, step)],
                        rotation=25, ha="right", fontsize=8,
                    )

                    ax.set_ylabel("% of each signal's own max", fontsize=9.5, color=text_color, labelpad=8)
                    ax.set_ylim(-5, 110)
                    apply_clean_spines(ax, show_x_grid=True, show_y_grid=True)

                    leg = ax.legend(
                        loc="upper right",
                        fontsize=8,
                        frameon=True,
                        fancybox=True,
                        framealpha=0.92,
                        edgecolor="#dddddd",
                        ncol=1,
                    )
                    leg.get_frame().set_linewidth(0.6)

                    ax.set_title(title, fontsize=12, color=primary_color, weight="bold", pad=12)
                    ax.axhline(0, color="#cccccc", linewidth=0.8, zorder=2)

                    buf = io.BytesIO()
                    fig.tight_layout()
                    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
                    buf.seek(0)
                    plt.close(fig)
                    return buf

                pairs = [(x, float(y)) for x, y in zip(xs, ys) if y is not None and _is_number(y)]
                if len(pairs) < 2:
                    return None
                xv = [str(p[0]) for p in pairs]
                yv = [p[1] for p in pairs]
                step = max(1, len(xv) // 8)
                fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
                ax.plot(range(len(xv)), yv, linewidth=2.2, color=primary_light, zorder=4)
                ax.fill_between(range(len(xv)), yv, alpha=0.12, color=primary_light, zorder=3)
                ax.set_xticks(range(0, len(xv), step))
                ax.set_xticklabels([_truncate_label(xv[i], 16) for i in range(0, len(xv), step)],
                                    rotation=30, ha="right", fontsize=7.5)
                ax.set_ylabel(y_axis.title(), fontsize=10, color=text_color, labelpad=8)
                apply_clean_spines(ax, show_x_grid=True, show_y_grid=True)
                ax.set_title(title, fontsize=12, color=primary_color, weight="bold", pad=15)
                buf = io.BytesIO()
                fig.tight_layout()
                fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
                buf.seek(0)
                plt.close(fig)
                return buf

            agg: Dict[str, List[float]] = defaultdict(list)
            for x, y in zip(xs, ys):
                if x is not None and y is not None and _is_number(y):
                    agg[str(x)].append(float(y))
            if len(agg) < 2:
                return None

            items = list(agg.items())
            if aggregation == "avg":
                values = [sum(v) / len(v) for _, v in items]
            elif aggregation == "count":
                values = [len(v) for _, v in items]
            else:
                values = [sum(v) for _, v in items]
            labels = [_truncate_label(k) for k, _ in items]

            order = sorted(range(len(values)), key=lambda i: -values[i])[:15]
            labels = [labels[i] for i in order]
            values = [values[i] for i in order]

            if chart_type == "hbar":
                labels, values = labels[::-1], values[::-1]
                fig, ax = plt.subplots(figsize=(8, max(3.5, 0.45 * len(labels) + 1)), dpi=150)
                bars = ax.barh(labels, values, color=primary_color, height=0.65, zorder=3)
                ax.bar_label(bars, fmt="%.1f", padding=6, fontsize=8.5, color="#555555")
                max_v = max(values) if values else 1
                ax.set_xlim(0, max_v * 1.12)
                ax.set_xlabel(y_axis.title(), fontsize=10, color=text_color, labelpad=8)
                apply_clean_spines(ax, show_x_grid=True, show_y_grid=False)
            elif chart_type == "bar":
                fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
                bars = ax.bar(labels, values, color=primary_color, width=0.6, zorder=3)
                ax.bar_label(bars, fmt="%.1f", padding=4, fontsize=8.5, color="#555555")
                max_v = max(values) if values else 1
                ax.set_ylim(0, max_v * 1.12)
                ax.set_ylabel(y_axis.title(), fontsize=10, color=text_color, labelpad=8)
                plt.setp(ax.get_xticklabels(), rotation=30, ha="right", fontsize=8.5)
                apply_clean_spines(ax, show_x_grid=False, show_y_grid=True)
            else:
                fig, ax = plt.subplots(figsize=(8, 4.5), dpi=150)
                ax.plot(labels, values, marker="o", markersize=6, linewidth=2.5, color=primary_light, zorder=4)
                ax.fill_between(range(len(labels)), values, alpha=0.12, color=primary_light, zorder=3)
                max_v = max(values) if values else 1
                ax.set_ylim(0, max_v * 1.12)
                ax.set_ylabel(y_axis.title(), fontsize=10, color=text_color, labelpad=8)
                plt.setp(ax.get_xticklabels(), rotation=30, ha="right", fontsize=8.5)
                apply_clean_spines(ax, show_x_grid=True, show_y_grid=True)

            ax.set_title(title, fontsize=12, color=primary_color, weight="bold", pad=15)
            buf = io.BytesIO()
            fig.tight_layout()
            fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
            buf.seek(0)
            plt.close(fig)
            return buf

    except Exception as e:
        log.warning("Chart draw failed (%s): %s", chart_type, e)
        plt.close("all")
        return None

    return None


def auto_chart_config(section: Dict[str, Any], table_lookup: Dict[str, Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    q = table_lookup.get(section.get("table_name") or "")
    if not q:
        return None
    cols = q["columns"]

    if q.get("source_type") == "influxdb":
        numeric_fields = [c for c in cols if c != "_time"]
        if "_time" in cols and numeric_fields:
            return {"chart_type": "line", "x_axis": "_time", "multi_field": True,
                    "title": section.get("title", q["table"])}
        return None

    if q.get("is_aggregate") and len(cols) >= 2:
        return {"chart_type": "bar", "x_axis": cols[0], "y_axis": cols[1],
                "label": cols[1], "title": section.get("title", q["table"]), "aggregation": None}
    numeric = _find_numeric_column(cols)
    categorical = _find_categorical_column(cols)
    if numeric and categorical:
        return {"chart_type": "bar", "x_axis": categorical, "y_axis": numeric,
                "label": numeric, "title": section.get("title", q["table"]), "aggregation": "avg"}
    return None

# --------------------------------------------------------------------------
# 13. PDF building blocks
# --------------------------------------------------------------------------
_STYLES = getSampleStyleSheet()
_STYLES.add(ParagraphStyle(name="CoverTitle", parent=_STYLES["Title"], fontSize=24,
                            textColor=colors.HexColor(THEME["primary"]), alignment=TA_CENTER, spaceAfter=10))
_STYLES.add(ParagraphStyle(name="CoverSub", parent=_STYLES["Normal"], fontSize=12,
                            textColor=colors.HexColor(THEME["grey"]), alignment=TA_CENTER, spaceAfter=4))
_STYLES.add(ParagraphStyle(name="CoverMeta", parent=_STYLES["Normal"], fontSize=9,
                            textColor=colors.HexColor(THEME["grey"]), alignment=TA_CENTER))
_STYLES.add(ParagraphStyle(name="TOCTitle", parent=_STYLES["Heading1"], fontSize=15,
                            textColor=colors.HexColor(THEME["primary"]), spaceAfter=10))
_STYLES.add(ParagraphStyle(name="SectionTitle", parent=_STYLES["Heading2"], fontSize=13,
                            textColor=colors.HexColor(THEME["primary"]), spaceBefore=12, spaceAfter=5))
_STYLES.add(ParagraphStyle(name="SubHeading", parent=_STYLES["Heading3"], fontSize=10,
                            textColor=colors.HexColor(THEME["grey"]), spaceBefore=6, spaceAfter=3))
_STYLES.add(ParagraphStyle(name="ReportBody", parent=_STYLES["Normal"], fontSize=9.5, leading=13, spaceAfter=4))
_STYLES.add(ParagraphStyle(name="Meta", parent=_STYLES["Normal"], fontSize=7.5, textColor=colors.grey))
_STYLES.add(ParagraphStyle(name="KPILabel", parent=_STYLES["Normal"], fontSize=8,
                            textColor=colors.white, alignment=TA_CENTER))
_STYLES.add(ParagraphStyle(name="KPIValue", parent=_STYLES["Normal"], fontSize=16,
                            textColor=colors.white, alignment=TA_CENTER, leading=18))
_STYLES.add(ParagraphStyle(name="TableCell", parent=_STYLES["Normal"], fontSize=7.5, leading=9))
_STYLES.add(ParagraphStyle(name="TableHeader", parent=_STYLES["Normal"], fontSize=7.5,
                            textColor=colors.white, leading=9))


class NumberedCanvas(pdf_canvas.Canvas):
    def __init__(self, *args, **kwargs):
        pdf_canvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(total_pages)
            pdf_canvas.Canvas.showPage(self)
        pdf_canvas.Canvas.save(self)

    def _draw_footer(self, total_pages: int):
        page_num = self._pageNumber
        if page_num == 1:
            return
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor(THEME["grey"]))
        w, h = landscape(A4)
        self.drawString(12 * mm, 8 * mm, "Manufacturing & Video-Analytics Intelligent Report")
        self.drawRightString(w - 12 * mm, 8 * mm, f"Page {page_num} of {total_pages}")
        self.setStrokeColor(colors.HexColor("#d5d8dc"))
        self.line(12 * mm, 11 * mm, w - 12 * mm, 11 * mm)


class ReportDocTemplate(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph):
            style_name = flowable.style.name
            if style_name == "SectionTitle":
                text = flowable.getPlainText()
                key = f"sec-{abs(hash(text))}-{self.page}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=1, closed=False)
                self.notify("TOCEntry", (1, text, self.page, key))
            elif style_name == "TOCTitle":
                text = flowable.getPlainText()
                key = f"toc-{self.page}"
                self.canv.bookmarkPage(key)
                self.canv.addOutlineEntry(text, key, level=0, closed=False)


def _make_frame_template(page_size):
    frame = Frame(12 * mm, 15 * mm, page_size[0] - 24 * mm, page_size[1] - 27 * mm, id="normal")
    return PageTemplate(id="normal", frames=[frame])


def kpi_card(label: str, value: str, color_hex: str) -> Table:
    t = Table([[Paragraph(value, _STYLES["KPIValue"])],
               [Paragraph(label, _STYLES["KPILabel"])]], colWidths=[42 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor(color_hex)),
        ("TOPPADDING", (0, 0), (-1, 0), 10), ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 0), ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
    ]))
    return t


def build_kpi_row(execution_result: Dict[str, Any]) -> Table:
    total_tables = sum(len(db["queries"]) for db in execution_result["databases"])
    total_rows = sum(q["row_count"] for db in execution_result["databases"] for q in db["queries"])
    failed = sum(1 for db in execution_result["databases"] for q in db["queries"] if q.get("error"))
    has_time_filter = bool(execution_result.get("time_filter_applied") or execution_result.get("flux_time_range"))
    cards = [
        kpi_card("DATABASES QUERIED", str(len(execution_result["databases"])), THEME["primary"]),
        kpi_card("TABLES MATCHED", str(total_tables), THEME["primary_light"]),
        kpi_card("TOTAL RECORDS", f"{total_rows:,}", THEME["accent"]),
        kpi_card("TIME FILTER", "Applied" if has_time_filter else "None",
                  THEME["success"] if has_time_filter else THEME["grey"]),
        kpi_card("FAILED QUERIES", str(failed), THEME["danger"] if failed else THEME["success"]),
    ]
    row = Table([cards], colWidths=[46 * mm] * len(cards))
    row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                              ("LEFTPADDING", (0, 0), (-1, -1), 3), ("RIGHTPADDING", (0, 0), (-1, -1), 3)]))
    return row


def make_data_preview_table(columns: List[str], rows: List[Tuple], max_rows: int = 10, max_cols: int = 8) -> Table:
    cols = columns[:max_cols]
    col_idx = [columns.index(c) for c in cols]
    header = [Paragraph(f"<b>{c}</b>", _STYLES["TableHeader"]) for c in cols]
    data = [header]
    for row in rows[:max_rows]:
        cells = []
        for i in col_idx:
            val = row[i] if i < len(row) else ""
            cells.append(Paragraph(_truncate_label(val, 28), _STYLES["TableCell"]))
        data.append(cells)

    n_cols = len(cols)
    avail_width = landscape(A4)[0] - 24 * mm
    col_width = avail_width / n_cols
    t = Table(data, colWidths=[col_width] * n_cols, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(THEME["primary"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5d8dc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for r in range(1, len(data)):
        if r % 2 == 0:
            style.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor(THEME["bg_alt_row"])))
    t.setStyle(TableStyle(style))
    return t


def make_quality_table(metas: List[Dict[str, Any]]) -> Table:
    header = ["Table", "Records", "Completeness", "Outliers", "Score"]
    data = [[Paragraph(f"<b>{h}</b>", _STYLES["TableHeader"]) for h in header]]
    score_color = {"Good": THEME["success"], "Fair": THEME["warning"], "Needs review": THEME["danger"], "N/A": THEME["grey"]}
    for m in metas:
        dq = m["data_quality"]
        data.append([
            Paragraph(m["table_name"], _STYLES["TableCell"]),
            Paragraph(str(m["total_records"]), _STYLES["TableCell"]),
            Paragraph(f"{dq['completeness_pct']}%", _STYLES["TableCell"]),
            Paragraph(str(len(dq["potential_outliers"])), _STYLES["TableCell"]),
            Paragraph(f'<font color="{score_color.get(dq["score"], THEME["grey"])}"><b>{dq["score"]}</b></font>', _STYLES["TableCell"]),
        ])
    avail_width = landscape(A4)[0] - 24 * mm
    widths = [avail_width * w for w in (0.32, 0.15, 0.2, 0.15, 0.18)]
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(THEME["primary"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5d8dc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]
    for r in range(1, len(data)):
        if r % 2 == 0:
            style.append(("BACKGROUND", (0, r), (-1, r), colors.HexColor(THEME["bg_alt_row"])))
    t.setStyle(TableStyle(style))
    return t


def make_llm_usage_table(usage: Dict[str, Any]) -> Table:
    def fmt_cost(v: Optional[float]) -> str:
        if v is None:
            return "N/A"
        return f"${v:.4f}" if v < 1 else f"${v:.2f}"

    header = ["Model", "Input tokens", "Output tokens", "Total tokens", "Estimated cost"]
    data = [[Paragraph(f"<b>{h}</b>", _STYLES["TableHeader"]) for h in header]]

    if usage.get("fallback_used") or not usage.get("model"):
        data.append([
            Paragraph("None (AI summarisation unavailable)", _STYLES["TableCell"]),
            Paragraph("-", _STYLES["TableCell"]), Paragraph("-", _STYLES["TableCell"]),
            Paragraph("-", _STYLES["TableCell"]), Paragraph("$0.00", _STYLES["TableCell"]),
        ])
    else:
        data.append([
            Paragraph(usage["model"], _STYLES["TableCell"]),
            Paragraph(f"{usage['prompt_tokens']:,}", _STYLES["TableCell"]),
            Paragraph(f"{usage['completion_tokens']:,}", _STYLES["TableCell"]),
            Paragraph(f"{usage['total_tokens']:,}", _STYLES["TableCell"]),
            Paragraph(fmt_cost(usage.get("cost_usd")), _STYLES["TableCell"]),
        ])

    avail_width = landscape(A4)[0] - 24 * mm
    widths = [avail_width * w for w in (0.34, 0.16, 0.16, 0.16, 0.18)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor(THEME["primary"])),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#d5d8dc")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

# --------------------------------------------------------------------------
# 14. Full PDF generation
# --------------------------------------------------------------------------
def generate_pdf_from_llm_sections(
    execution_result: Dict[str, Any],
    llm_sections: List[Dict[str, Any]],
    output_path: str = None,
    metadata_threshold: int = 5,
    llm_usage: Optional[Dict[str, Any]] = None,
) -> str:
    if output_path is None:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"query_report_{ts}.pdf"
    output_path = str(Path(output_path).resolve())

    page_size = landscape(A4)
    doc = ReportDocTemplate(
        output_path, pagesize=page_size,
        leftMargin=12 * mm, rightMargin=12 * mm, topMargin=12 * mm, bottomMargin=15 * mm,
    )
    doc.addPageTemplates([_make_frame_template(page_size)])

    table_lookup: Dict[str, Dict[str, Any]] = {}
    all_metas: List[Dict[str, Any]] = []
    for db in execution_result["databases"]:
        for q in db["queries"]:
            if q["row_count"] > 0:
                table_lookup[q["table"]] = q
                if q.get("source_type") == "influxdb":
                    continue
                all_metas.append(_build_rich_metadata(q["table"], q["columns"], q["rows"]))

    story: List[Any] = []

    story.append(Spacer(1, 45 * mm))
    story.append(Paragraph("Manufacturing & Video-Analytics", _STYLES["CoverTitle"]))
    story.append(Paragraph("Intelligent Report", _STYLES["CoverTitle"]))
    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="40%", thickness=1.4, color=colors.HexColor(THEME["accent"]), hAlign="CENTER"))
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph(f"&ldquo;{execution_result['raw_user_query']}&rdquo;", _STYLES["CoverSub"]))
    story.append(Spacer(1, 14 * mm))
    story.append(Paragraph(f"Generated: {execution_result['generated_at']}", _STYLES["CoverMeta"]))
    if execution_result.get("time_filter_applied") or execution_result.get("flux_time_range"):
        story.append(Paragraph("Time filter applied", _STYLES["CoverMeta"]))
    story.append(PageBreak())

    story.append(Paragraph("Contents", _STYLES["TOCTitle"]))
    toc = TableOfContents()
    toc.levelStyles = [
        ParagraphStyle(name="TOCLevel1", fontSize=10.5, leading=16,
                        textColor=colors.HexColor(THEME["primary"])),
    ]
    story.append(toc)
    story.append(PageBreak())

    story.append(Paragraph("Executive Summary", _STYLES["SectionTitle"]))
    story.append(build_kpi_row(execution_result))
    story.append(Spacer(1, 4 * mm))
    kw_all = sorted({kw for db in execution_result["databases"] for kw in db.get("keywords", [])})
    if kw_all:
        story.append(Paragraph(f"<b>Matched keywords:</b> {', '.join(kw_all)}", _STYLES["ReportBody"]))
    if execution_result.get("flux_time_range"):
        ftr = execution_result["flux_time_range"]
        story.append(Paragraph(
            f"<b>Telemetry window:</b> {ftr['start']} &rarr; {ftr['stop']} (bucketed every {ftr['every']})",
            _STYLES["ReportBody"]))
    story.append(Spacer(1, 6 * mm))

    for section in llm_sections:
        block: List[Any] = []
        title = section.get("title", "Section")
        summary = section.get("summary", "")
        need_chart = section.get("chart", False)
        chart_cfg = section.get("chart_config")
        table_name = section.get("table_name")

        block.append(Paragraph(title, _STYLES["SectionTitle"]))
        block.append(Paragraph(summary.replace("\n", "<br/>"), _STYLES["ReportBody"]))
        block.append(Spacer(1, 2 * mm))

        matched_q = table_lookup.get(table_name) if table_name else None
        if matched_q is None and chart_cfg:
            for q in table_lookup.values():
                if chart_cfg.get("x_axis") in q["columns"] or chart_cfg.get("y_axis") in q["columns"]:
                    matched_q = q
                    break

        if matched_q and matched_q.get("source_type") == "influxdb" and matched_q.get("row_count", 0) > 0:
            need_chart = True

        if matched_q and matched_q.get("aggregation_fallback"):
            block.append(Paragraph(
                "<i>Note: an aggregated view wasn't possible for this table (the source column "
                "isn't numeric on the server), so raw rows are shown instead.</i>",
                _STYLES["Meta"]))

        if need_chart:
            cfg = chart_cfg
            if matched_q and matched_q.get("source_type") == "influxdb":
                cfg = {"chart_type": "line", "x_axis": "_time", "multi_field": True,
                       "title": section.get("title", matched_q["table"])}
            elif matched_q and (not cfg or (cfg.get("x_axis") not in matched_q["columns"]
                                           and cfg.get("y_axis") not in matched_q["columns"])):
                cfg = auto_chart_config(section, table_lookup) or cfg
            if matched_q and cfg:
                buf = draw_chart_from_config(cfg, matched_q["columns"], matched_q["rows"])
                if buf:
                    block.append(Image(buf, width=150 * mm, height=78 * mm))
                    block.append(Spacer(1, 3 * mm))

        if matched_q and matched_q["row_count"] > 0:
            label = "Telemetry preview" if matched_q.get("source_type") == "influxdb" else "Data preview"
            block.append(Paragraph(
                f"{label} &mdash; {matched_q['table']} "
                f"(showing {min(10, matched_q['row_count'])} of {matched_q['row_count']} points/rows)",
                _STYLES["SubHeading"]))
            block.append(make_data_preview_table(matched_q["columns"], matched_q["rows"]))
        elif matched_q and matched_q.get("error"):
            block.append(Paragraph(f"<font color='{THEME['danger']}'>Query failed: {matched_q['error']}</font>",
                                    _STYLES["Meta"]))

        block.append(Spacer(1, 6 * mm))
        story.append(KeepTogether(block))

    story.append(PageBreak())
    story.append(Paragraph("Appendix &mdash; Data Quality", _STYLES["SectionTitle"]))
    if all_metas:
        story.append(make_quality_table(all_metas))
    story.append(Spacer(1, 6 * mm))

    story.append(Paragraph("LLM Usage &amp; Cost", _STYLES["SubHeading"]))
    story.append(make_llm_usage_table(llm_usage or _empty_usage(fallback_used=True)))
    story.append(Spacer(1, 6 * mm))

    aggregation_fallbacks = [(db["database"], q) for db in execution_result["databases"]
                              for q in db["queries"] if q.get("aggregation_fallback")]
    if aggregation_fallbacks:
        story.append(Paragraph("Aggregation Fallbacks", _STYLES["SubHeading"]))
        for db_name, q in aggregation_fallbacks:
            orig = q.get("original_aggregate_error", "unknown error")
            story.append(Paragraph(f"[{db_name}.{q['table']}] Aggregate query failed ({orig}) "
                                    f"- served raw rows instead.", _STYLES["Meta"]))
        story.append(Spacer(1, 4 * mm))

    failed_queries = [(db["database"], q) for db in execution_result["databases"]
                       for q in db["queries"] if q.get("error")]
    if failed_queries:
        story.append(Paragraph("Failed Queries", _STYLES["SubHeading"]))
        for db_name, q in failed_queries:
            story.append(Paragraph(f"[{db_name}.{q['table']}] {q['error']}", _STYLES["Meta"]))

    empty_influx = [(db["database"], q) for db in execution_result["databases"]
                    for q in db["queries"]
                    if q.get("source_type") == "influxdb" and q["row_count"] == 0 and not q.get("error")]
    if empty_influx:
        story.append(Spacer(1, 4 * mm))
        story.append(Paragraph("InfluxDB Measurements With No Data", _STYLES["SubHeading"]))
        for db_name, q in empty_influx:
            tried = q.get("time_windows_tried") or []
            tried_str = ", ".join(f"last {w['hours']}h={w['row_count']} rows" for w in tried) or "no widening attempted"
            story.append(Paragraph(f"[{db_name}.{q['table']}] {tried_str}", _STYLES["Meta"]))

    doc.multiBuild(story, canvasmaker=NumberedCanvas)
    log.info("PDF written to: %s", output_path)
    return output_path


# --------------------------------------------------------------------------
# 15. High-level pipeline
# --------------------------------------------------------------------------
def process_query_and_generate_pdf(user_query: str, pdf_path: str = None, limit_per_table: int = 50) -> str:
    t0 = time.time()
    log.info("Processing: %s", user_query)

    problems = validate_environment()
    for p in problems:
        log.warning("Environment check: %s", p)

    split = customize_and_split_query(user_query)
    if not split["selected_databases"]:
        log.warning("No databases matched the query - check vocabulary / phrasing.")

    sql_result = generate_sql_queries(split, limit_per_table=limit_per_table)
    report = analyze_pipeline_result(sql_result)
    log.info("DBs selected: %s | Queries generated: %d | Status: %s",
              report["databases_selected"], report["total_queries"], report["status"])
    for issue in report["issues_found"]:
        log.debug("Query validator: %s", issue)

    execution = run_all_queries(sql_result)
    total_rows = sum(q["row_count"] for db in execution["databases"] for q in db["queries"])
    log.info("Execution complete: %d row(s)/point(s) across %d table(s)/measurement(s)", total_rows,
              sum(len(db["queries"]) for db in execution["databases"]))

    data_context = prepare_llm_context(execution)
    log.info("LLM context length: %d chars", len(data_context))

    llm_sections, llm_usage = call_llm_with_fallback(user_query, data_context, execution_result=execution)
    log.info("Received %d report section(s)", len(llm_sections))

    pdf_file = generate_pdf_from_llm_sections(execution, llm_sections, output_path=pdf_path, llm_usage=llm_usage)
    log.info("Done in %.1fs -> %s", time.time() - t0, pdf_file)
    return pdf_file


def process_query_and_generate_full_dict(
    user_query: str,
    pdf_path: str = None,
    is_approved: bool = False,
    limit_per_table: int = 50
) -> Dict[str, Any]:
    t0 = time.time()
    log.info("Processing query in v3 pipeline: %s", user_query)

    problems = validate_environment()
    for p in problems:
        log.warning("Environment check: %s", p)

    split = customize_and_split_query(user_query)
    selected_dbs = split.get("selected_databases", [])

    sql_result = generate_sql_queries(split, limit_per_table=limit_per_table)
    report = analyze_pipeline_result(sql_result)

    execution = run_all_queries(sql_result)
    total_rows = sum(q["row_count"] for db in execution.get("databases", []) for q in db.get("queries", []))

    data_context = prepare_llm_context(execution)
    llm_sections, llm_usage = call_llm_with_fallback(user_query, data_context, execution_result=execution)

    os.makedirs("reports", exist_ok=True)
    if not pdf_path:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        pdf_path = os.path.abspath(f"reports/report_{ts}.pdf")

    pdf_file = generate_pdf_from_llm_sections(execution, llm_sections, output_path=pdf_path, llm_usage=llm_usage)

    # Format insights into markdown
    md_blocks = []
    for sec in llm_sections:
        t = sec.get("title", "Analysis")
        s = sec.get("summary", "")
        block = f"### {t}\n{s}"
        if sec.get("key_findings"):
            block += "\n\n**Key Findings:**\n" + "\n".join(f"- {item}" for item in sec["key_findings"])
        if sec.get("recommendations"):
            block += "\n\n**Recommendations:**\n" + "\n".join(f"- {item}" for item in sec["recommendations"])
        if sec.get("metrics"):
            block += "\n\n**Metrics:**\n" + "\n".join(f"- **{k}**: {v}" for k, v in sec["metrics"].items())
        md_blocks.append(block)

    formatted_insights = "\n\n".join(md_blocks) if md_blocks else "Report generated successfully."

    # Format SQL and Flux queries
    query_blocks = []
    for db in execution.get("databases", []):
        db_name = db.get("database", "")
        for q in db.get("queries", []):
            st = q.get("source_type", "sql")
            tbl = q.get("table", "")
            code = q.get("query") or q.get("sql") or ""
            if st == "influxdb":
                query_blocks.append(f"-- [InfluxDB Flux Telemetry: {tbl}]\n{code}")
            elif "mes" in db_name.lower():
                query_blocks.append(f"-- [MES MSSQL: {tbl}]\n{code}")
            else:
                query_blocks.append(f"-- [Video Analytics Postgres: {tbl}]\n{code}")

    combined_sql = "\n\n".join(query_blocks) if query_blocks else "-- Read-only scoped analytical queries"

    # Serialized results preview
    serialized_results = []
    for db in execution.get("databases", []):
        for q in db.get("queries", []):
            serialized_results.append({
                "database": db.get("database"),
                "table": q.get("table"),
                "rows": q.get("row_count", 0),
                "columns": q.get("columns", []),
                "data": q.get("rows", [])[:20]
            })

    pdf_filename = os.path.basename(pdf_file)
    public_api_url = os.getenv("PUBLIC_API_URL", "http://localhost:8001").rstrip("/")
    pdf_url = f"{public_api_url}/reports/{pdf_filename}" if pdf_filename else ""

    dbs_display = ", ".join(selected_dbs) if selected_dbs else "MES, video_analytics, influxdb"
    execution_steps = [
        "Validated schema connectivity (MSSQL MES, Postgres Video Analytics, InfluxDB)",
        f"Selected databases: {dbs_display}",
        f"Generated {len(query_blocks)} queries (Flux telemetry downsampling + Safe SQL SELECT)",
        f"Executed queries: collected {total_rows} point(s)/row(s) across {len(query_blocks)} source(s)",
        "Computed rich metadata & data quality validation scores",
        "Synthesized executive operations narrative & recommendations with LLM intelligence",
        f"Compiled executive multi-page PDF report with embedded charts ({pdf_filename})"
    ]

    return {
        "sql_query": combined_sql,
        "sql_result": serialized_results,
        "insights": formatted_insights,
        "execution_steps": execution_steps,
        "pdf_path": pdf_file,
        "pdf_url": pdf_url,
        "requires_hitl": False,
        "is_approved": is_approved,
        "error_message": ""
    }

