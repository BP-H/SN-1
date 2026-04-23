import types
import sys
from pathlib import Path

import pytest

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import ui_adapters
import superNova_2177 as sn


class DummySession:
    def __enter__(self):
        return "db"

    def __exit__(self, exc_type, exc, tb):
        pass


def test_search_users_adapter_stub(monkeypatch):
    monkeypatch.setattr(ui_adapters, "use_real_backend", lambda: False)
    res = ui_adapters.search_users_adapter("al")
    assert res == ui_adapters.DUMMY_USERS


def test_search_users_adapter_real_backend(monkeypatch):
    monkeypatch.setattr(ui_adapters, "use_real_backend", lambda: True)
    monkeypatch.setattr(sn, "SessionLocal", lambda: DummySession())

    def fake_search(q, db):
        assert q == "al"
        assert db == "db"
        return [{"username": "alice"}, {"username": "albert"}]

    monkeypatch.setattr(sn, "search_users", fake_search)
    res = ui_adapters.search_users_adapter("al")
    assert res == ["alice", "albert"]


def test_search_users_adapter_failure(monkeypatch, caplog):
    monkeypatch.setattr(ui_adapters, "use_real_backend", lambda: True)
    monkeypatch.setattr(sn, "SessionLocal", lambda: DummySession())

    def bad_search(q, db):
        raise RuntimeError("boom")

    monkeypatch.setattr(sn, "search_users", bad_search)
    with caplog.at_level("ERROR"):
        res = ui_adapters.search_users_adapter("al")
    assert res == [ui_adapters.ERROR_MESSAGE]
    assert any("search_users_adapter failed" in r.message for r in caplog.records)
