import os
import sys
import unittest

BACKEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

import config
from app import create_app
from extensions import db


class UserIsolationTests(unittest.TestCase):
    def setUp(self):
        config.Config.SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
        config.Config.SECRET_KEY = "test-secret"
        self.app = create_app()
        self.app.config.update(TESTING=True)
        self.client = self.app.test_client()
        self.app_context = self.app.app_context()
        self.app_context.push()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        self.app_context.pop()

    def test_tasks_and_categories_are_scoped_to_the_logged_in_user(self):
        first_res = self.client.post(
            "/api/auth/register",
            json={"name": "Alice", "email": "alice@example.com", "password": "password123"},
        )
        self.assertEqual(first_res.status_code, 201)

        second_res = self.client.post(
            "/api/auth/register",
            json={"name": "Bob", "email": "bob@example.com", "password": "password123"},
        )
        self.assertEqual(second_res.status_code, 201)

        self.client.post(
            "/api/auth/logout",
            json={},
        )

        alice_login = self.client.post(
            "/api/auth/login",
            json={"email": "alice@example.com", "password": "password123"},
        )
        self.assertEqual(alice_login.status_code, 200)

        alice_categories = self.client.post(
            "/api/categories",
            json={"name": "Alice Only", "color": "#123456", "icon": "fa-star"},
        )
        self.assertEqual(alice_categories.status_code, 201)

        alice_tasks = self.client.post(
            "/api/tasks",
            json={"title": "Alice task", "priority": "high", "due_date": "2026-08-04"},
        )
        self.assertEqual(alice_tasks.status_code, 201)

        self.client.post(
            "/api/auth/logout",
            json={},
        )

        login_res = self.client.post(
            "/api/auth/login",
            json={"email": "bob@example.com", "password": "password123"},
        )
        self.assertEqual(login_res.status_code, 200)

        categories_res = self.client.get("/api/categories")
        self.assertEqual(categories_res.status_code, 200)
        categories_payload = categories_res.get_json()
        category_names = [item["name"] for item in categories_payload["categories"]]
        self.assertNotIn("Alice Only", category_names)

        tasks_res = self.client.get("/api/tasks")
        self.assertEqual(tasks_res.status_code, 200)
        tasks_payload = tasks_res.get_json()
        self.assertEqual(tasks_payload["tasks"], [])


if __name__ == "__main__":
    unittest.main()
