import re
from flask import Blueprint, request, jsonify, session, url_for, redirect
from werkzeug.security import generate_password_hash, check_password_hash

from extensions import db
from models import User, Category

auth_bp = Blueprint("auth", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

DEFAULT_CATEGORIES = [
    ("Study", "#8b6bff", "fa-book"),
    ("Work", "#22d3ee", "fa-briefcase"),
    ("Personal", "#f6a723", "fa-user"),
    ("Shopping", "#fb5573", "fa-bag-shopping"),
    ("Health", "#2fd18f", "fa-heart-pulse"),
]


@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email and password are all required."}), 400
    if not EMAIL_RE.match(email):
        return jsonify({"error": "That email address doesn't look valid."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({"error": "An account with that email already exists."}), 409

    user = User(name=name, email=email, password_hash=generate_password_hash(password), theme="dark")
    db.session.add(user)
    db.session.flush()  # get user.id before committing

    # Give every new user their own copy of the default categories.
    for cat_name, color, icon in DEFAULT_CATEGORIES:
        db.session.add(Category(user_id=user.id, name=cat_name, color=color, icon=icon))

    db.session.commit()

    session.clear()
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = User.query.filter_by(email=email).first()
    if not user or user.auth_provider != "local" or not check_password_hash(user.password_hash, password):
        if user and user.auth_provider == "google":
            return jsonify({"error": "This account uses Google Sign-In. Please continue with Google instead."}), 401
        return jsonify({"error": "Incorrect email or password."}), 401

    session.clear()
    session["user_id"] = user.id
    return jsonify({"user": user.to_dict()}), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not logged in."}), 401
    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return jsonify({"error": "Not logged in."}), 401
    return jsonify({"user": user.to_dict()}), 200


# ---------------------------------------------------------------------------
# Google Sign-In
# ---------------------------------------------------------------------------

@auth_bp.route("/google/login")
def google_login():
    from oauth import oauth
    redirect_uri = url_for("auth.google_callback", _external=True)
    return oauth.google.authorize_redirect(redirect_uri, prompt="select_account")


@auth_bp.route("/google/callback")
def google_callback():
    from oauth import oauth
    from flask import current_app
    try:
        token = oauth.google.authorize_access_token()
        userinfo = token.get("userinfo") or oauth.google.userinfo()
    except Exception as err:
        current_app.logger.exception("Google OAuth callback failed: %s", err)
        return redirect("/login.html?error=google_failed")

    email = (userinfo.get("email") or "").strip().lower()
    name = userinfo.get("name") or email.split("@")[0]
    if not email:
        return redirect("/login.html?error=google_failed")

    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(name=name, email=email, password_hash=None, auth_provider="google", theme="dark")
        db.session.add(user)
        db.session.flush()
        for cat_name, color, icon in DEFAULT_CATEGORIES:
            db.session.add(Category(user_id=user.id, name=cat_name, color=color, icon=icon))
        db.session.commit()
    elif user.auth_provider != "google":
        # An account with this email already exists via email/password.
        # Link it instead of creating a duplicate — same person, new login method.
        user.auth_provider = "google"
        db.session.commit()

    session.clear()
    session["user_id"] = user.id
    return redirect("/")