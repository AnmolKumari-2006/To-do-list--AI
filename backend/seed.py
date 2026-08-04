from datetime import date, timedelta
from werkzeug.security import generate_password_hash


def seed_demo_data(db):
    """Populate the DB with the same demo user/categories/tasks that
    store.js seeds into localStorage — only runs if the users table is empty,
    so it's safe to call on every startup."""
    from models import User, Category, Task

    if User.query.first():
        return  # already seeded, do nothing

    user = User(
        name="Ayesha Raza",
        email="ayesha@example.com",
        password_hash=generate_password_hash("password123"),
        theme="dark",
    )
    db.session.add(user)
    db.session.flush()  # so user.id is available below

    cat_defs = [
        ("Study", "#8b6bff", "fa-book"),
        ("Work", "#22d3ee", "fa-briefcase"),
        ("Personal", "#f6a723", "fa-user"),
        ("Shopping", "#fb5573", "fa-bag-shopping"),
        ("Health", "#2fd18f", "fa-heart-pulse"),
    ]
    categories = {}
    for name, color, icon in cat_defs:
        c = Category(user_id=user.id, name=name, color=color, icon=icon)
        db.session.add(c)
        db.session.flush()
        categories[name] = c

    today = date.today()
    task_defs = [
        ("Submit Database Assignment", "Normalize schema to 3NF and push to GitHub.", "Study", "high", today, "18:00", "17:00", "pending", True),
        ("Team standup notes", "Summarize sprint blockers for the AI module.", "Work", "medium", today, "10:00", None, "completed", False),
        ("Buy groceries", "Milk, eggs, coffee, fruit.", "Shopping", "low", today + timedelta(days=1), None, None, "pending", False),
        ("Gym — leg day", None, "Health", "medium", today, "19:00", "18:30", "pending", False),
        ("Prepare AI Advisor demo", "Record a 2-minute walkthrough of the recommendation flow.", "Study", "high", today + timedelta(days=2), "12:00", None, "pending", False),
        ("Pay electricity bill", None, "Personal", "medium", today - timedelta(days=1), None, None, "pending", False),
        ("Plan weekend trip", "Shortlist 2 hill-station options.", "Personal", "low", today + timedelta(days=4), None, None, "pending", False),
    ]
    for title, desc, cat_name, priority, due_date, due_time, reminder_time, status, pinned in task_defs:
        t = Task(
            user_id=user.id,
            category_id=categories[cat_name].id,
            title=title,
            description=desc,
            priority=priority,
            due_date=due_date.isoformat(),
            due_time=due_time,
            reminder_time=reminder_time,
            status=status,
            pinned=pinned,
        )
        db.session.add(t)

    db.session.commit()
