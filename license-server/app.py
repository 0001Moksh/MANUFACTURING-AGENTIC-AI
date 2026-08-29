from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, send_file, session, url_for
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash, generate_password_hash

from config.settings import ADMIN_PASSWORD, ADMIN_USERNAME, LICENSE_STORAGE_PATH, LOG_PATH, SECRET_KEY
from crypto.signing import public_key_pem
from licensing.generator import build_license_payload, generate_license_file

ADMIN_PASSWORD_HASH = generate_password_hash(ADMIN_PASSWORD)

app = Flask(__name__)
app.config["SECRET_KEY"] = SECRET_KEY

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://",
)


def _load_storage() -> list[dict]:
    if not LICENSE_STORAGE_PATH.exists():
        return []
    try:
        with LICENSE_STORAGE_PATH.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def _save_storage(records: list[dict]) -> None:
    LICENSE_STORAGE_PATH.parent.mkdir(parents=True, exist_ok=True)
    LICENSE_STORAGE_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")


def _save_license_file(license_id: str, content: bytes) -> Path:
    export_dir = LICENSE_STORAGE_PATH.parent / "issued"
    export_dir.mkdir(parents=True, exist_ok=True)
    file_path = export_dir / f"{license_id}.lic"
    file_path.write_bytes(content)
    return file_path


def _log_event(message: str) -> None:
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as fh:
        fh.write(f"{datetime.utcnow().isoformat()}Z {message}\n")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
            session["admin_logged_in"] = True
            _log_event(f"admin_login username={username}")
            return redirect(url_for("dashboard"))
        flash("Invalid username or password.")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("admin_logged_in", None)
    return redirect(url_for("login"))


@app.route("/dashboard")
def dashboard():
    if not session.get("admin_logged_in"):
        return redirect(url_for("login"))
    records = _load_storage()
    active = len([r for r in records if not r.get("revoked")])
    expiring = len([r for r in records if r.get("status") == "EXPIRING_SOON"]) if records else 0
    expired = len([r for r in records if r.get("status") == "EXPIRED"]) if records else 0
    revoked = len([r for r in records if r.get("revoked")]) if records else 0
    return render_template("dashboard.html", total_licenses=len(records), active=active, expiring_soon=expiring, expired=expired, revoked=revoked)


@app.route("/licenses/new", methods=["GET", "POST"])
def create_license():
    if not session.get("admin_logged_in"):
        return redirect(url_for("login"))
    if request.method == "POST":
        payload = {
            "customer_name": request.form.get("customer_name"),
            "customer_id": request.form.get("customer_id"),
            "product": request.form.get("product", "MANUFACTURING_AGENTIC_AI"),
            "license_type": request.form.get("license_type", "ANNUAL"),
            "expires_at": request.form.get("expiry_date"),
            "installation_id": request.form.get("installation_binding", "INSTALL-DEFAULT"),
            "features": request.form.getlist("features"),
            "max_users": int(request.form.get("max_users", 50)),
            "notes": request.form.get("notes", ""),
        }
        record = build_license_payload(
            customer_name=payload["customer_name"],
            customer_id=payload["customer_id"],
            product=payload["product"],
            license_type=payload["license_type"],
            expires_at=payload["expires_at"],
            installation_id=payload["installation_id"],
            features=payload["features"],
            max_users=payload["max_users"],
            notes=payload["notes"],
        )
        license_file = generate_license_file(record)
        records = _load_storage()
        record["license_file"] = license_file.decode("utf-8", errors="replace")
        records.append(record)
        _save_storage(records)
        _save_license_file(record["license_id"], license_file)
        _log_event(f"license_generated customer_id={record['customer_id']} license_id={record['license_id']}")
        return render_template(
            "license_details.html",
            license=record,
            license_text=license_file.decode("utf-8", errors="replace"),
            public_key=public_key_pem(),
            download_url=url_for("download_license", license_id=record["license_id"]),
        )
    return render_template("create_license.html")


@app.route("/licenses/<license_id>/download")
def download_license(license_id: str):
    if not session.get("admin_logged_in"):
        return redirect(url_for("login"))
    file_path = LICENSE_STORAGE_PATH.parent / "issued" / f"{license_id}.lic"
    if not file_path.exists():
        flash("The requested license file was not found.")
        return redirect(url_for("dashboard"))
    return send_file(file_path, as_attachment=True, download_name=f"{license_id}.lic", mimetype="application/octet-stream")


@app.route("/licenses")
def list_licenses():
    if not session.get("admin_logged_in"):
        return redirect(url_for("login"))
    return render_template("dashboard.html", records=_load_storage())


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=False)
