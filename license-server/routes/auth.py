from flask import Blueprint

bp = Blueprint("auth", __name__)

@bp.route("/internal/login")
def login():
    return "Admin login endpoint" 
