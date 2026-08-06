import atexit
import os
from datetime import datetime
from flask import Flask, send_from_directory, request, redirect, session
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from config import Config
from extensions import db
from models import Notification, User, Category, Task
from seed import seed_demo_data

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))


def create_app():
    app = Flask(
        __name__,
        static_folder=FRONTEND_DIR,  # serve the existing frontend folder as-is
        static_url_path="",          # so tasks.html is served at /tasks.html, css/style.css at /css/style.css, etc.
    )
    app.config.from_object(Config)

    db.init_app(app)

    from oauth import init_oauth
    init_oauth(app)

    with app.app_context():
        db.create_all()       # creates instance/taskpilot.db + tables on first run
        seed_demo_data(db)    # adds demo user/categories/tasks only if the DB is empty

    # --- Frontend routes ---------------------------------------------------
    @app.route("/")
    def landing():
        if session.get("user_id"):
            return send_from_directory(app.static_folder, "index.html")
        return send_from_directory(app.static_folder, "login.html")

    @app.route('/<path:filename>')
    def serve_static(filename):
        # Protect authenticated pages and allow public access to login/register assets.
        public_pages = {'login.html', 'register.html', 'css/style.css', 'images/logo-light.png', 'images/logo-dark.png', 'js/auth.js', 'js/store.js'}
        if filename in public_pages or filename.startswith('images/') or filename.startswith('css/') or filename.startswith('js/'):
            return send_from_directory(app.static_folder, filename)

        if filename in {'index.html', 'tasks.html', 'calendar.html', 'statistics.html', 'settings.html'}:
            if not session.get('user_id'):
                return redirect('/login.html')
        return send_from_directory(app.static_folder, filename)

    # --- API routes ----------------------------------------------------
    from routes_health import health_bp
    from routes_auth import auth_bp
    from routes_data import data_bp
    app.register_blueprint(health_bp, url_prefix="/api")
    app.register_blueprint(auth_bp, url_prefix="/api/auth")
    app.register_blueprint(data_bp, url_prefix="/api")

    if os.environ.get("WERKZEUG_RUN_MAIN") or not app.debug:
        start_notification_scheduler(app)

    return app


def _send_due_notifications(app):
    with app.app_context():
        now = datetime.now()
        due_notifications = Notification.query.filter(
            Notification.status == "pending",
            Notification.remind_at <= now,
        ).all()
        if not due_notifications:
            return

        for notice in due_notifications:
            app.logger.info(
                "Reminder ready for notification %s for task %s user %s: %s",
                notice.id,
                notice.task_id,
                notice.user_id,
                notice.message,
            )


def start_notification_scheduler(app):
    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        func=_send_due_notifications,
        trigger=IntervalTrigger(minutes=1),
        args=[app],
        id="notification_dispatcher",
        replace_existing=True,
    )
    scheduler.start()
    atexit.register(lambda: scheduler.shutdown(wait=False))
    app.logger.info("Notification scheduler started")


if __name__ == "__main__":
    app = create_app()
    app.run(debug=True, port=5000)