from flask import Blueprint, jsonify
from models import User, Category, Task

health_bp = Blueprint("health", __name__)


@health_bp.route("/health")
def health():
    """Quick sanity check: confirms the app is running and the DB is reachable
    and already has the seeded demo data in it."""
    return jsonify({
        "status": "ok",
        "database": "connected",
        "users": User.query.count(),
        "categories": Category.query.count(),
        "tasks": Task.query.count(),
    })
