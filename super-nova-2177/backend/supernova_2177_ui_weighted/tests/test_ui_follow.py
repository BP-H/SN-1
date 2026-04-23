import os
import sys
from pathlib import Path

import pytest

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import ui_adapters


def test_follow_adapter_stub_toggle(monkeypatch):
    # Force stub mode by disabling backend function
    monkeypatch.setattr(ui_adapters, "toggle_follow", None)
    ui_adapters._STUB_FOLLOWING.clear()

    ok, msg = ui_adapters.follow_adapter("alice")
    assert ok and msg == "Followed"

    ok, msg = ui_adapters.follow_adapter("alice")
    assert ok and msg == "Unfollowed"


def test_follow_adapter_backend_success(monkeypatch):
    async def fake_toggle(username: str):
        return {"message": "Followed"}

    monkeypatch.setattr(ui_adapters, "toggle_follow", fake_toggle)
    ok, msg = ui_adapters.follow_adapter("bob")
    assert ok and msg == "Followed"


def test_follow_adapter_backend_error(monkeypatch, caplog):
    async def bad_toggle(username: str):
        raise RuntimeError("boom")

    monkeypatch.setattr(ui_adapters, "toggle_follow", bad_toggle)
    with caplog.at_level("ERROR"):
        ok, msg = ui_adapters.follow_adapter("bob")
    assert not ok
    assert "boom" in msg
    assert any("failed" in record.message.lower() for record in caplog.records)

