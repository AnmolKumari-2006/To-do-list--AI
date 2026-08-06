from datetime import datetime
from flask import Blueprint, jsonify, request, session

from extensions import db
from models import Category, Notification, Task, User


data_bp = Blueprint("data", __name__)


def _current_user_or_error():
    user_id = session.get("user_id")
    if not user_id:
        return None, (jsonify({"error": "Not logged in."}), 401)

    user = db.session.get(User, user_id)
    if not user:
        session.clear()
        return None, (jsonify({"error": "Not logged in."}), 401)
    return user, None


def _parse_task_datetime(date_str, time_str):
    if not date_str or not time_str:
        return None
    try:
        return datetime.fromisoformat(f"{date_str}T{time_str}")
    except ValueError:
        try:
            return datetime.strptime(time_str, "%H:%M")
        except ValueError:
            return None


def _validate_reminder(due_date, due_time, reminder_value):
    if not reminder_value or not due_date:
        return True
    try:
        reminder_dt = datetime.fromisoformat(reminder_value)
    except ValueError:
        return True
    due_dt = _parse_task_datetime(due_date, due_time or "23:59")
    if not due_dt:
        return True
    return reminder_dt <= due_dt


def _parse_reminder_datetime(reminder_value):
    try:
        return datetime.fromisoformat(reminder_value)
    except (TypeError, ValueError):
        return None


def _sync_task_notification(task):
    if not task:
        return

    notification = Notification.query.filter_by(task_id=task.id).first()
    if task.reminder_time:
        remind_at = _parse_reminder_datetime(task.reminder_time)
        if remind_at:
            message = f"Reminder: {task.title}"
            if notification:
                notification.remind_at = remind_at
                notification.message = message
                notification.status = "pending"
                notification.sent_at = None
            else:
                db.session.add(Notification(
                    user_id=task.user_id,
                    task_id=task.id,
                    remind_at=remind_at,
                    message=message,
                    status="pending",
                ))
            return

    if notification:
        db.session.delete(notification)


def _task_to_payload(task):
    data = task.to_dict()
    data["created_at"] = task.created_at.isoformat() if task.created_at else None
    data["updated_at"] = task.updated_at.isoformat() if task.updated_at else None
    return data


@data_bp.route("/tasks", methods=["GET"])
def list_tasks():
    user, err = _current_user_or_error()
    if err is not None:
        return err

    tasks = Task.query.filter_by(user_id=user.id).order_by(Task.created_at.desc()).all()
    return jsonify({"tasks": [_task_to_payload(task) for task in tasks]}), 200


@data_bp.route("/notifications", methods=["GET"])
def list_notifications():
    user, err = _current_user_or_error()
    if err is not None:
        return err

    notifications = Notification.query.filter_by(user_id=user.id).order_by(Notification.remind_at.desc()).all()
    return jsonify({"notifications": [notification.to_dict() for notification in notifications]}), 200


@data_bp.route("/notifications/due", methods=["GET"])
def get_due_notifications():
    user, err = _current_user_or_error()
    if err is not None:
        return err

    now = datetime.now()
    due_notifications = Notification.query.filter_by(user_id=user.id, status="pending").filter(Notification.remind_at <= now).all()
    results = [notification.to_dict() for notification in due_notifications]
    for notification in due_notifications:
        notification.status = "sent"
        notification.sent_at = datetime.now()
    if due_notifications:
        db.session.commit()
    return jsonify({"notifications": results}), 200


@data_bp.route("/tasks", methods=["POST"])
def create_task():
    user, err = _current_user_or_error()
    if err is not None:
        return err

    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Task title is required."}), 400

    category_id = data.get("category")
    category = None
    if category_id:
        category = Category.query.filter_by(id=category_id, user_id=user.id).first()
        if not category:
            return jsonify({"error": "Selected category is invalid."}), 400

    due_date_value = (data.get("due_date") or "").strip() or None
    due_time_value = (data.get("due_time") or "").strip() or None
    reminder_value = (data.get("reminder_time") or "").strip() or None
    if reminder_value and not _validate_reminder(due_date_value, due_time_value, reminder_value):
        return jsonify({"error": "Reminder must be at or before the task due date and time."}), 400

    task = Task(
        user_id=user.id,
        category_id=category.id if category else None,
        title=title,
        description=(data.get("description") or "").strip() or None,
        priority=(data.get("priority") or "medium").strip().lower() or "medium",
        status=(data.get("status") or "pending").strip().lower() or "pending",
        pinned=bool(data.get("pinned", False)),
        due_date=due_date_value,
        due_time=due_time_value,
        reminder_time=reminder_value,
    )
    db.session.add(task)
    db.session.commit()
    _sync_task_notification(task)
    db.session.commit()
    return jsonify({"task": _task_to_payload(task)}), 201


@data_bp.route("/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    user, err = _current_user_or_error()
    if err is not None:
        return err

    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return jsonify({"error": "Task not found."}), 404

    data = request.get_json(silent=True) or {}

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "Task title is required."}), 400
        task.title = title
    if "description" in data:
        task.description = (data.get("description") or "").strip() or None
    if "priority" in data:
        task.priority = (data.get("priority") or "medium").strip().lower() or "medium"
    if "status" in data:
        task.status = (data.get("status") or "pending").strip().lower() or "pending"
    if "pinned" in data:
        task.pinned = bool(data.get("pinned", False))
    if "due_date" in data:
        task.due_date = (data.get("due_date") or "").strip() or None
    if "due_time" in data:
        task.due_time = (data.get("due_time") or "").strip() or None
    if "reminder_time" in data:
        reminder_value = (data.get("reminder_time") or "").strip() or None
        if reminder_value and not _validate_reminder(task.due_date, task.due_time, reminder_value):
            return jsonify({"error": "Reminder must be at or before the task due date and time."}), 400
        task.reminder_time = reminder_value
    elif task.reminder_time and ("due_date" in data or "due_time" in data):
        if task.reminder_time and not _validate_reminder(task.due_date, task.due_time, task.reminder_time):
            return jsonify({"error": "Existing reminder must still be at or before the updated due date and time."}), 400
    if "category" in data:
        category_id = data.get("category")
        if category_id:
            category = Category.query.filter_by(id=category_id, user_id=user.id).first()
            if not category:
                return jsonify({"error": "Selected category is invalid."}), 400
            task.category_id = category.id
        else:
            task.category_id = None

    db.session.commit()
    _sync_task_notification(task)
    db.session.commit()
    return jsonify({"task": _task_to_payload(task)}), 200


@data_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    user, err = _current_user_or_error()
    if err is not None:
        return err

    task = Task.query.filter_by(id=task_id, user_id=user.id).first()
    if not task:
        return jsonify({"error": "Task not found."}), 404

    db.session.delete(task)
    db.session.commit()
    return jsonify({"ok": True}), 200


@data_bp.route("/categories", methods=["GET"])
def list_categories():
    user, err = _current_user_or_error()
    if err is not None:
        return err

    categories = Category.query.filter_by(user_id=user.id).order_by(Category.id.asc()).all()
    return jsonify({"categories": [category.to_dict() for category in categories]}), 200


@data_bp.route("/categories", methods=["POST"])
def create_category():
    user, err = _current_user_or_error()
    if err is not None:
        return err

    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Category name is required."}), 400

    category = Category(
        user_id=user.id,
        name=name,
        color=(data.get("color") or "#8b6bff").strip() or "#8b6bff",
        icon=(data.get("icon") or "fa-tag").strip() or "fa-tag",
    )
    db.session.add(category)
    db.session.commit()
    return jsonify({"category": category.to_dict()}), 201


@data_bp.route("/categories/<int:category_id>", methods=["PUT"])
def update_category(category_id):
    user, err = _current_user_or_error()
    if err is not None:
        return err

    category = Category.query.filter_by(id=category_id, user_id=user.id).first()
    if not category:
        return jsonify({"error": "Category not found."}), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "Category name is required."}), 400
        category.name = name
    if "color" in data:
        category.color = (data.get("color") or "#8b6bff").strip() or "#8b6bff"
    if "icon" in data:
        category.icon = (data.get("icon") or "fa-tag").strip() or "fa-tag"

    db.session.commit()
    return jsonify({"category": category.to_dict()}), 200


@data_bp.route("/categories/<int:category_id>", methods=["DELETE"])
def delete_category(category_id):
    user, err = _current_user_or_error()
    if err is not None:
        return err

    category = Category.query.filter_by(id=category_id, user_id=user.id).first()
    if not category:
        return jsonify({"error": "Category not found."}), 404

    tasks = Task.query.filter_by(user_id=user.id, category_id=category.id).all()
    for task in tasks:
        task.category_id = None

    db.session.delete(category)
    db.session.commit()
    return jsonify({"ok": True}), 200
