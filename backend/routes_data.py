from flask import Blueprint, jsonify, request, session

from extensions import db
from models import Category, Task, User


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

    task = Task(
        user_id=user.id,
        category_id=category.id if category else None,
        title=title,
        description=(data.get("description") or "").strip() or None,
        priority=(data.get("priority") or "medium").strip().lower() or "medium",
        status=(data.get("status") or "pending").strip().lower() or "pending",
        pinned=bool(data.get("pinned", False)),
        due_date=(data.get("due_date") or "").strip() or None,
        due_time=(data.get("due_time") or "").strip() or None,
        reminder_time=(data.get("reminder_time") or "").strip() or None,
    )
    db.session.add(task)
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
        task.reminder_time = (data.get("reminder_time") or "").strip() or None
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
