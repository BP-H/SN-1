# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

import types
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import modern_ui_components as mui


def test_render_modern_sidebar_default_container(monkeypatch):
    calls = []
    def dummy_radio(label, options, key=None, index=0):
        calls.append(options)
        return options[index]

    dummy_st = types.SimpleNamespace(
        markdown=lambda *a, **k: None,
        radio=dummy_radio,
        sidebar=types.SimpleNamespace(markdown=lambda *a, **k: None, radio=dummy_radio),
        session_state={},
        warning=lambda *a, **k: None,
        error=lambda *a, **k: None,
    )
    monkeypatch.setattr(mui, "USE_OPTION_MENU", False)
    monkeypatch.setattr(mui, "st", dummy_st)
    monkeypatch.setattr(mui.Path, "exists", lambda self: True)
    pages = {"A": "a", "B": "b"}
    assert mui.render_modern_sidebar(pages) == "A"
    assert calls, "buttons rendered"


class TrackingDict(dict):
    def __init__(self, *a, **k):
        self.calls = 0
        super().__init__(*a, **k)

    def __setitem__(self, key, value):
        self.calls += 1
        super().__setitem__(key, value)


def test_render_modern_sidebar_state_changes(monkeypatch):
    monkeypatch.setattr(mui, "USE_OPTION_MENU", False)
    session = TrackingDict(sidebar_nav="A")

    def dummy_radio(label, options, key=None, index=0):
        return options[index]

    dummy_st = types.SimpleNamespace(
        markdown=lambda *a, **k: None,
        radio=dummy_radio,
        sidebar=types.SimpleNamespace(markdown=lambda *a, **k: None, radio=dummy_radio),
        session_state=session,
        warning=lambda *a, **k: None,
        error=lambda *a, **k: None,
    )

    monkeypatch.setattr(mui, "st", dummy_st)
    monkeypatch.setattr(mui.Path, "exists", lambda self: True)
    pages = {"A": "a", "B": "b"}

    # No change expected
    mui.render_modern_sidebar(pages)
    assert session.calls == 0

    # Change returned value
    def radio_b(label, options, key=None, index=0):
        return options[1]

    dummy_st.radio = radio_b
    dummy_st.sidebar.radio = radio_b
    mui.render_modern_sidebar(pages)
    assert session["sidebar_nav"] == "B"
    assert session.calls == 1

