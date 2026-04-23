import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import superNova_2177 as sn
import db_models


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_MODE", "central")
    db_path = tmp_path / "test.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")
    monkeypatch.setenv("SECRET_KEY", "testsecret")
    db_models.init_db(f"sqlite:///{db_path}")

    importlib.reload(db_models)
    sn_mod = importlib.reload(sn)
    sn_mod.create_database()
    sn_mod.create_app()
    sn_mod.Base.metadata.drop_all(bind=sn_mod.engine)
    sn_mod.Base.metadata.create_all(bind=sn_mod.engine)
    with sn_mod.SessionLocal() as db:
        users = [
            sn_mod.Harmonizer(
                username="alice",
                email="alice@example.com",
                hashed_password=sn_mod.get_password_hash("pw"),
            ),
            sn_mod.Harmonizer(
                username="bob",
                email="bob@example.com",
                hashed_password=sn_mod.get_password_hash("pw"),
            ),
        ]
        db.add_all(users)
        db.commit()
    return TestClient(sn_mod.app)


def test_search_users_basic(client):
    import superNova_2177 as sn_mod
    with sn_mod.SessionLocal() as db:
        data = sn_mod.search_users("al", db)
    usernames = [u["username"] for u in data]
    assert "alice" in usernames


def test_search_users_result_limit(client):
    import superNova_2177 as sn_mod
    with sn_mod.SessionLocal() as db:
        for i in range(10):
            db.add(
                sn_mod.Harmonizer(
                    username=f"user{i}",
                    email=f"user{i}@example.com",
                    hashed_password=sn_mod.get_password_hash("pw"),
                )
            )
        db.commit()
    with sn_mod.SessionLocal() as db:
        resp = sn_mod.search_users("user", db)
    assert len(resp) <= 5


def test_ui_adapter_backend_on(client, monkeypatch):
    import importlib
    monkeypatch.setenv("ENABLE_SEARCH_BACKEND", "1")
    import ui_adapters
    ui_adapters = importlib.reload(ui_adapters)
    results, err = ui_adapters.search_users("al")
    assert err is None
    usernames = [u["username"] for u in results]
    assert "alice" in usernames


def test_ui_adapter_backend_off(client, monkeypatch):
    import importlib
    monkeypatch.delenv("ENABLE_SEARCH_BACKEND", raising=False)
    import ui_adapters
    ui_adapters = importlib.reload(ui_adapters)
    results, err = ui_adapters.search_users("al")
    assert results is None and err is None
