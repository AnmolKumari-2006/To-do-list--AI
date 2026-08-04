import os
from dotenv import load_dotenv

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
INSTANCE_DIR = os.path.join(BASE_DIR, "instance")
os.makedirs(INSTANCE_DIR, exist_ok=True)  # SQLite won't create this folder itself

load_dotenv(os.path.join(BASE_DIR, ".env"))  # loads GOOGLE_CLIENT_ID etc. if present


class Config:
    # SQLite database lives in backend/instance/taskpilot.db (created above
    # the first time the app runs).
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(INSTANCE_DIR, "taskpilot.db")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Used to sign the session cookie (login state). Change this to a random
    # string before deploying anywhere real — this default is fine for local dev.
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-change-me")

    # Google OAuth ("Continue with Google"). Get these from Google Cloud
    # Console → APIs & Services → Credentials, and put them in backend/.env
    # (never commit that file — see .gitignore).
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")