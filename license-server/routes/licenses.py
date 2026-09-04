from flask import Blueprint

bp = Blueprint("licenses", __name__)

@bp.route("/internal/licenses")
def list_licenses():
    return "License API" 
