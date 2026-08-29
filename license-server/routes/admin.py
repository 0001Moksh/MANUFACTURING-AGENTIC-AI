from flask import Blueprint

bp = Blueprint("admin", __name__)

@bp.route("/internal/dashboard")
def dashboard():
    return "Admin dashboard" 
