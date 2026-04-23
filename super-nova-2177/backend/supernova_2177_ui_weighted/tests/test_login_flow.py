import os
import sys
import importlib
from pathlib import Path

root = Path(__file__).resolve().parents[1]
package_root = root.parent
if str(package_root) not in sys.path:
    sys.path.insert(0, str(package_root))

from fastapi.testclient import TestClient
import superNova_2177 as sn
import db_models
import login_router
import uuid
import pytest


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_MODE", "central")
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    db_models.init_db(f"sqlite:///{db_path}")
    monkeypatch.setenv("SECRET_KEY", "testsecret")
    importlib.reload(db_models)
    importlib.reload(login_router)
    sn_mod = importlib.reload(sn)
    sn_mod.create_database()
    sn_mod.create_app()
    sn_mod.Base.metadata.drop_all(bind=sn_mod.engine)
    sn_mod.Base.metadata.create_all(bind=sn_mod.engine)
    client = TestClient(sn_mod.app)
    with sn_mod.SessionLocal() as db:
        user = sn_mod.Harmonizer(
            username="bob",
            email="b@example.com",
            hashed_password=sn_mod.get_password_hash("password"),
        )
        db.add(user)
        db.commit()
    return client


def test_login_success(client):
    resp = client.post("/login", data={"username": "bob", "password": "password"})
    assert resp.status_code == 200
    assert "session" in resp.cookies
    payload = resp.json()
    assert payload["detail"] == "login successful"
    assert payload["token_type"] == "bearer"
    assert payload["user"]["username"] == "bob"
    assert payload["universe_id"]


def test_token_includes_user_metadata(client):
    resp = client.post("/token", data={"username": "bob", "password": "password"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["access_token"]
    assert payload["token_type"] == "bearer"
    assert payload["universe_id"]
    assert payload["user"]["username"] == "bob"


def test_login_failure(client):
    resp = client.post("/login", data={"username": "bob", "password": "wrong"})
    assert resp.status_code == 401


def test_logout_clears_cookie(client):
    client.post("/login", data={"username": "bob", "password": "password"})
    assert "session" in client.cookies
    resp = client.post("/logout")
    assert resp.status_code == 200
    assert "session" not in client.cookies or client.cookies.get("session") == ""
