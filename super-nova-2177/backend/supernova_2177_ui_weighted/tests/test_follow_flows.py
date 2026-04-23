import importlib
from types import SimpleNamespace

import sys
from pathlib import Path
import importlib.util

root = Path(__file__).resolve().parents[1]
sys.path.append(str(root))
spec = importlib.util.spec_from_file_location("social.backend", root / "social" / "backend.py")
backend = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(backend)  # type: ignore


def _reset():
    backend._mock_users.clear()


def test_follow_flow_mock(monkeypatch):
    _reset()
    backend.USE_MOCK = True
    alice = SimpleNamespace(username="alice")
    backend.toggle_follow("bob", current_user=alice)
    assert backend.get_followers("bob")["count"] == 1
    backend.toggle_follow("bob", current_user=alice)
    assert backend.get_followers("bob")["count"] == 0


def test_follow_flow_real(monkeypatch):
    _reset()
    backend.USE_MOCK = False
    monkeypatch.setattr(backend, "_real_toggle", backend._mock_toggle_follow)
    monkeypatch.setattr(backend, "_real_get_user", backend._mock_get_user)
    monkeypatch.setattr(backend, "_real_get_followers", backend._mock_get_followers)
    monkeypatch.setattr(backend, "_real_get_following", backend._mock_get_following)
    alice = SimpleNamespace(username="alice")
    backend.toggle_follow("bob", current_user=alice)
    assert backend.get_followers("bob")["count"] == 1
    backend.toggle_follow("bob", current_user=alice)
    assert backend.get_followers("bob")["count"] == 0
