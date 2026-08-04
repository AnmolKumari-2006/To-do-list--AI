from datetime import datetime
from extensions import db


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(180), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=True)  # null for Google accounts
    auth_provider = db.Column(db.String(20), nullable=False, default="local")  # "local" | "google"
    theme = db.Column(db.String(10), nullable=False, default="dark")  # "dark" | "light"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    categories = db.relationship("Category", backref="user", lazy=True, cascade="all, delete-orphan")
    tasks = db.relationship("Task", backref="user", lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {"id": self.id, "name": self.name, "email": self.email, "theme": self.theme}


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(60), nullable=False)
    color = db.Column(db.String(20), nullable=False, default="#8b6bff")  # hex color, matches store.js
    icon = db.Column(db.String(40), nullable=False, default="fa-tag")   # Font Awesome class

    tasks = db.relationship("Task", backref="category", lazy=True)

    def to_dict(self):
        return {"id": self.id, "name": self.name, "color": self.color, "icon": self.icon}


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    priority = db.Column(db.String(10), nullable=False, default="medium")  # high | medium | low
    status = db.Column(db.String(15), nullable=False, default="pending")   # pending | completed
    pinned = db.Column(db.Boolean, nullable=False, default=False)

    due_date = db.Column(db.String(10), nullable=True)     # "YYYY-MM-DD"
    due_time = db.Column(db.String(5), nullable=True)      # "HH:MM"
    reminder_time = db.Column(db.String(5), nullable=True)  # "HH:MM"

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category_id,
            "priority": self.priority,
            "status": self.status,
            "pinned": self.pinned,
            "due_date": self.due_date,
            "due_time": self.due_time,
            "reminder_time": self.reminder_time,
        }