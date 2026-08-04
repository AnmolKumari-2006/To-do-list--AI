from flask_sqlalchemy import SQLAlchemy

# Created here (not inside app.py) so both app.py and models.py can import
# the same `db` instance without circular-import problems.
db = SQLAlchemy()
