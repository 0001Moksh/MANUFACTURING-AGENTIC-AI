import os
import re
import time
import uuid
import threading
import urllib.parse
from datetime import datetime
from typing import Any, Dict, List, Optional

from langchain_core.tools import tool
from sqlalchemy import text

# ─────────────────────────────────────────────────────────────────────────────
# Configuration / shared state
# ─────────────────────────────────────────────────────────────────────────────
_engine = None
_build_rtsp_url = None


def _resolve_storage_base(raw_env_path: Optional[str] = None) -> str:
    """Prefer the current project backend directory over stale env values copied from another machine."""
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    candidates = [backend_root, os.path.abspath(os.path.join(backend_root, ".."))]
    if raw_env_path:
        env_path = urllib.parse.unquote(raw_env_path).replace("%20", " ")
        env_path = os.path.normpath(env_path)
        if env_path not in candidates:
            candidates.insert(1, env_path)
    for candidate in candidates:
        if not candidate:
            continue
        candidate = os.path.normpath(candidate)
        if os.path.isdir(candidate):
            return candidate
    return backend_root


DEFAULT_STORAGE_BASE = _resolve_storage_base(os.getenv("STORAGE_BASE_PATH"))
STORAGE_BASE = _resolve_storage_base(os.getenv("STORAGE_BASE_PATH", DEFAULT_STORAGE_BASE))
ML_SNAPSHOT_DIR = os.path.join(STORAGE_BASE, "storage", "ml_snapshots")

_MODEL_CACHE: Dict[str, Any] = {}
_MODEL_CACHE_ORDER: List[str] = []
_MODEL_CACHE_LOCK = threading.Lock()
_MAX_CACHED_MODELS = 3

# Which registry model fits which user intent (matched against ai_models.name).
_MODEL_INTENTS = [
    ("Fire Detection", ["fire", "smoke", "flame", "burning"]),
    ("Spill Detection", ["spill", "leak", "liquid", "wet floor", "oil on"]),
    ("PPE Kit Office", ["ppe", "helmet", "hardhat", "hard hat", "vest", "safety gear", "gloves", "goggles"]),
]
_DEFAULT_MODEL = "Base Model"

_ML_QUERY_TERMS = [
    "yolo", "run model", "use model", "ml model", "detection model", "detect ", "detection",
    "bounding box", "scan camera", "scan the camera", "fire", "smoke", "spill",
    "ppe", "helmet", "hardhat", "hard hat", "vest", "available models", "which models",
]

_MODEL_COLORS = [(0, 200, 255), (60, 220, 60), (255, 120, 40), (200, 60, 220), (40, 80, 255)]
_DEFAULT_CONFIDENCE = 0.2


def init_ml_tools(engine, build_rtsp_url) -> None:
    """Call once from the main agent file so this module reuses its DB engine + RTSP builder."""
    global _engine, _build_rtsp_url
    _engine = engine
    _build_rtsp_url = build_rtsp_url


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: intent, registry lookup, path resolution
# ─────────────────────────────────────────────────────────────────────────────
def is_ml_detection_query(query: str) -> bool:
    q = (query or "").lower()
    return any(t in q for t in _ML_QUERY_TERMS)


def select_model_for_query(query: str) -> str:
    """Pick the registry model name that best matches what the user asked for."""
    q = (query or "").lower()
    for model_name, keywords in _MODEL_INTENTS:
        if any(k in q for k in keywords):
            if model_name == "PPE Kit Office" and "demo" in q:
                return "PPE Kit Demo"
            return model_name
    return _DEFAULT_MODEL


def _db_rows(sql: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    if _engine is None:
        return [{"error": "Database engine is not initialised (call init_ml_tools)."}]
    try:
        with _engine.connect() as conn:
            return [dict(r._mapping) for r in conn.execute(text(sql), params or {})]
    except Exception as exc:
        return [{"error": str(exc)}]


def _active_models() -> List[Dict[str, Any]]:
    rows = _db_rows("""
        SELECT id, name, version, framework, model_path, trt_engine_path, trt_ready,
               description, is_active
        FROM ai_models
        WHERE is_active = true
        ORDER BY id
    """)
    return [r for r in rows if "error" not in r]


def _find_model(model_name: Optional[str]) -> Optional[Dict[str, Any]]:
    models = _active_models()
    if not models:
        return None
    target = (model_name or _DEFAULT_MODEL).strip().lower()
    for m in models:  # exact
        if str(m["name"]).lower() == target:
            return m
    for m in models:  # partial either direction
        n = str(m["name"]).lower()
        if target in n or n in target:
            return m
    return None


def _resolve_model_file(row: Dict[str, Any]) -> Optional[str]:
    """DB paths are absolute Windows paths; fall back to STORAGE_BASE/storage/models/<name>/<version>."""
    raw = (row.get("model_path") or "").strip()
    candidates: List[str] = []
    if raw:
        candidates.append(raw)
        norm = raw.replace("\\", "/")
        marker = "storage/models/"
        if marker in norm:
            rel = norm.split(marker, 1)[1]
            candidates.append(os.path.normpath(os.path.join(STORAGE_BASE, "storage", "models", rel)))
    folder = os.path.join(STORAGE_BASE, "storage", "models", str(row.get("name")), str(row.get("version")))
    if os.path.isdir(folder):
        for ext in (".pt", ".onnx"):
            for f in sorted(os.listdir(folder)):
                if f.lower().endswith(ext):
                    candidates.append(os.path.join(folder, f))
    # also try the ONNX sibling of the registered .pt
    for c in list(candidates):
        if c.lower().endswith(".pt"):
            candidates.append(c[:-3] + ".onnx")
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def _load_model(path: str):
    """Load (and cache) an Ultralytics YOLO model. Keeps at most _MAX_CACHED_MODELS in memory."""
    with _MODEL_CACHE_LOCK:
        if path in _MODEL_CACHE:
            return _MODEL_CACHE[path]
        from ultralytics import YOLO

        model = YOLO(path)
        _MODEL_CACHE[path] = model
        _MODEL_CACHE_ORDER.append(path)
        while len(_MODEL_CACHE_ORDER) > _MAX_CACHED_MODELS:
            old = _MODEL_CACHE_ORDER.pop(0)
            _MODEL_CACHE.pop(old, None)
        return model


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: camera + frame capture + drawing
# ─────────────────────────────────────────────────────────────────────────────
_STOP_TOKENS = {"cam", "camera", "the", "live", "feed", "stream", "entrance", "gate", "line", "area"}


def _resolve_camera(camera_name: str) -> Optional[Dict[str, Any]]:
    camera_name = (camera_name or "").strip()
    cols = "id, name, ip, port, camera_number, user_id, password, rtsp_template"

    if camera_name.isdigit():
        rows = _db_rows(f"SELECT {cols} FROM cameras WHERE id = :v", {"v": int(camera_name)})
        if rows and "error" not in rows[0]:
            return rows[0]

    rows = _db_rows(f"SELECT {cols} FROM cameras WHERE name ILIKE :v LIMIT 1", {"v": f"%{camera_name}%"})
    if rows and "error" not in rows[0]:
        return rows[0]

    for tok in re.findall(r"[A-Za-z]{4,}", camera_name):
        if tok.lower() in _STOP_TOKENS:
            continue
        rows = _db_rows(f"SELECT {cols} FROM cameras WHERE name ILIKE :v LIMIT 1", {"v": f"%{tok}%"})
        if rows and "error" not in rows[0]:
            return rows[0]

    m = re.search(r"cam(?:era)?[-\s]?0*(\d+)", camera_name, re.IGNORECASE)
    if m:
        rows = _db_rows(f"SELECT {cols} FROM cameras WHERE id = :v", {"v": int(m.group(1))})
        if rows and "error" not in rows[0]:
            return rows[0]
    return None


def _capture_frame(cam: Dict[str, Any]):
    """Grab one fresh BGR frame from the camera RTSP stream (numpy array) or None."""
    try:
        import cv2

        rtsp_url = _build_rtsp_url({
            "camera_number": cam["camera_number"], "user_id": cam["user_id"],
            "password": cam["password"], "rtsp_template": cam["rtsp_template"],
            "ip": cam["ip"], "port": cam["port"],
        })
        cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
        try:
            if not cap.isOpened():
                return None
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            frame = None
            for _ in range(3):
                ok, f = cap.read()
                if ok and f is not None:
                    frame = f
            return frame
        finally:
            cap.release()
    except Exception as exc:
        print(f"[ML Tools] frame capture failed: {exc}")
        return None


def _draw(canvas, dets: List[Dict[str, Any]], color, tag: str) -> None:
    import cv2
    for d in dets:
        x1, y1, x2, y2 = int(d["x1"]), int(d["y1"]), int(d["x2"]), int(d["y2"])
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, 2)
        label = f"{d['class_name']} {d['confidence']:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(canvas, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), color, -1)
        cv2.putText(canvas, label, (x1 + 3, max(10, y1 - 4)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)


def _save_annotated(canvas, camera_id: int) -> Dict[str, str]:
    import cv2
    os.makedirs(ML_SNAPSHOT_DIR, exist_ok=True)
    cutoff = time.time() - 24 * 3600
    for f in os.listdir(ML_SNAPSHOT_DIR):
        fp = os.path.join(ML_SNAPSHOT_DIR, f)
        try:
            if os.path.isfile(fp) and os.path.getmtime(fp) < cutoff:
                os.remove(fp)
        except OSError:
            pass
    filename = f"ml_{camera_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}.jpg"
    path = os.path.join(ML_SNAPSHOT_DIR, filename)
    cv2.imwrite(path, canvas, [cv2.IMWRITE_JPEG_QUALITY, 88])
    return {"path": path, "url": f"/api/video-monitoring/ml-snapshot/{filename}"}


# ─────────────────────────────────────────────────────────────────────────────
# Core inference
# ─────────────────────────────────────────────────────────────────────────────
def _infer(frame, model_row: Dict[str, Any], confidence: float, class_filter: Optional[List[str]]) -> Dict[str, Any]:
    path = _resolve_model_file(model_row)
    if not path:
        return {"model": model_row["name"], "error": f"Model file not found on disk (registered: {model_row.get('model_path')})."}
    try:
        model = _load_model(path)
        res = model.predict(frame, conf=confidence, verbose=False)[0]
    except Exception as exc:
        return {"model": model_row["name"], "error": f"Inference failed: {exc}"}

    names = res.names or {}
    dets: List[Dict[str, Any]] = []
    if res.boxes is not None and len(res.boxes) > 0:
        xyxy = res.boxes.xyxy.cpu().numpy()
        confs = res.boxes.conf.cpu().numpy()
        clss = res.boxes.cls.cpu().numpy().astype(int)
        for (x1, y1, x2, y2), c, k in zip(xyxy, confs, clss):
            cname = str(names.get(int(k), k))
            if class_filter and cname.lower() not in class_filter:
                continue
            dets.append({
                "class_name": cname, "class_index": int(k), "confidence": round(float(c), 3),
                "x1": round(float(x1)), "y1": round(float(y1)), "x2": round(float(x2)), "y2": round(float(y2)),
            })

    counts: Dict[str, int] = {}
    for d in dets:
        counts[d["class_name"]] = counts.get(d["class_name"], 0) + 1
    violations = {k: v for k, v in counts.items() if re.match(r"^(no|without|missing)[\s_\-]", k.lower())}
    return {
        "model": model_row["name"], "version": model_row.get("version"),
        "model_file": os.path.basename(path), "detections": dets,
        "counts": counts, "violation_classes": violations, "total": len(dets),
    }


def _summarise(camera_label: str, results: List[Dict[str, Any]], confidence: float) -> str:
    lines = [f"ML detection on a live frame from **{camera_label}** (confidence >= {confidence:.2f}):", ""]
    for r in results:
        if r.get("error"):
            lines.append(f"- **{r['model']}**: could not run - {r['error']}")
        elif r["total"] == 0:
            lines.append(f"- **{r['model']}**: nothing detected.")
        else:
            parts = ", ".join(f"{v} x {k}" for k, v in sorted(r["counts"].items(), key=lambda kv: -kv[1]))
            line = f"- **{r['model']}**: {r['total']} detection(s) - {parts}."
            if r["violation_classes"]:
                line += " Possible violations: " + ", ".join(f"{v} x {k}" for k, v in r["violation_classes"].items()) + "."
            lines.append(line)
    return "\n".join(lines)


def run_ml_detection_impl(
    camera_name: str,
    model_names: Optional[List[str]] = None,
    user_query: Optional[str] = None,
    confidence: float = _DEFAULT_CONFIDENCE,
    classes: Optional[str] = None,
) -> Dict[str, Any]:
    """Capture ONE frame, run one or more registry models on it, return detections + annotated snapshot."""
    confidence = max(0.05, min(float(confidence), 0.99))
    class_filter = [c.strip().lower() for c in classes.split(",") if c.strip()] if classes else None
    captured_at = datetime.now().isoformat()

    cam = _resolve_camera(camera_name)
    if not cam:
        return {"success": False, "message": f"Camera '{camera_name}' was not found in the cameras table.", "data": None}

    if not model_names:
        model_names = [select_model_for_query(user_query or "")]
    model_rows, missing = [], []
    for n in model_names:
        row = _find_model(n)
        (model_rows if row else missing).append(row or n)
    if not model_rows:
        return {"success": False, "message": f"No active model matches {missing}. Use list_ml_models to see what is registered.", "data": None}

    frame = _capture_frame(cam)
    if frame is None:
        return {"success": False, "message": f"Could not capture a live frame from {cam['name']}; the camera may be offline.", "data": None}

    canvas = frame.copy()
    results = []
    for i, row in enumerate(model_rows):
        r = _infer(frame, row, confidence, class_filter)
        results.append(r)
        if not r.get("error"):
            _draw(canvas, r["detections"], _MODEL_COLORS[i % len(_MODEL_COLORS)], r["model"])

    saved = _save_annotated(canvas, cam["id"])
    summary = _summarise(cam["name"], results, confidence)
    if missing:
        summary += f"\n\nRequested but not registered/active: {', '.join(missing)}."

    return {
        "success": any(not r.get("error") for r in results),
        "message": f"Ran {len(results)} model(s) on one live frame from {cam['name']}",
        "data": {
            "camera_id": cam["id"], "camera_name": cam["name"], "captured_at": captured_at,
            "snapshot_url": saved["url"], "snapshot_path": saved["path"],
            "results": results, "summary": summary, "vlm_response": summary,
            "detections": [d for r in results if not r.get("error") for d in r["detections"]],
            "capture_source": "RTSP live frame + ML model inference",
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# LangChain tools exposed to the Video Agent
# ─────────────────────────────────────────────────────────────────────────────
@tool
def list_ml_models() -> Dict[str, Any]:
    """List the active ML detection models registered in the ai_models table (name, version, framework, whether the file exists)."""
    models = _active_models()
    if not models:
        return {"success": False, "message": "No active models found in ai_models.", "data": None}
    out = [{
        "id": m["id"], "name": m["name"], "version": m["version"], "framework": m["framework"],
        "file_found": _resolve_model_file(m) is not None,
    } for m in models]
    return {"success": True, "message": f"{len(out)} active models", "data": {"models": out}}


@tool
def run_ml_detection(
    camera_name: str,
    model_name: Optional[str] = None,
    user_query: Optional[str] = None,
    confidence: float = _DEFAULT_CONFIDENCE,
    classes: Optional[str] = None,
) -> Dict[str, Any]:
    """Run ONE registered YOLO model (e.g. 'Fire Detection', 'Spill Detection', 'PPE Kit Office', 'Base Model')
    on a single live frame of a camera. If model_name is omitted, the best model is chosen from user_query.
    classes is an optional comma-separated filter (e.g. 'person,helmet'). Returns detections and an annotated snapshot."""
    names = [model_name] if model_name else None
    return run_ml_detection_impl(camera_name, names, user_query, confidence, classes)


@tool
def run_multi_model_scan(
    camera_name: str,
    model_names: Optional[str] = "Fire Detection,Spill Detection,PPE Kit Office",
    confidence: float = _DEFAULT_CONFIDENCE,
) -> Dict[str, Any]:
    """Run several registered models (comma-separated names) on the SAME live frame for a full hazard scan
    (fire + spill + PPE by default). Returns combined detections and one annotated snapshot."""
    names = [n.strip() for n in (model_names or "").split(",") if n.strip()]
    return run_ml_detection_impl(camera_name, names or None, None, confidence, None)


ml_video_tools = [list_ml_models, run_ml_detection, run_multi_model_scan]
