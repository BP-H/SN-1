import sys
import os
from fastapi import FastAPI

current_path = os.path.dirname(__file__)
if current_path not in sys.path:
    sys.path.insert(0, current_path)

try:
    from .db_models import Base, engine
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully.")
except ImportError as e:
    print(f"Warning: Could not import db_models: {e}")

app = FastAPI()
