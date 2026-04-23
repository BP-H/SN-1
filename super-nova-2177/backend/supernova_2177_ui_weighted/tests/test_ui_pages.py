# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import importlib
import contextlib
import types
from pathlib import Path
import sys

import pytest

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit
import streamlit as st  # noqa: E402

# Ensure repository root is importable
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

# Provide a minimal stub for ``modern_ui`` to avoid syntax errors during import.
stub_modern_ui = types.ModuleType("modern_ui")
stub_modern_ui.inject_modern_styles = lambda *a, **k: None
stub_modern_ui.apply_modern_styles = lambda *a, **k: None
stub_modern_ui.render_stats_section = lambda *a, **k: None
sys.modules.setdefault("modern_ui", stub_modern_ui)
importlib.import_module("utils.paths")  # ensures namespace package is created
stub_page_registry = types.ModuleType("utils.page_registry")
stub_page_registry.ensure_pages = lambda *a, **k: None
sys.modules.setdefault("utils.page_registry", stub_page_registry)

import modern_ui_components as mui  # noqa: E402
import ui  # noqa: E402


def test_unknown_page_triggers_fallback(monkeypatch):
    monkeypatch.setenv("UI_DEBUG_PRINTS", "0")
    importlib.reload(ui)

    fallback_called = {}
    monkeypatch.setattr(
        ui,
        "_render_fallback",
        lambda choice: fallback_called.setdefault("choice", choice),
    )
    monkeypatch.setattr(
        ui, "load_page_with_fallback", lambda choice, paths: ui._render_fallback(choice)
    )
    monkeypatch.setattr(ui, "get_st_secrets", lambda: {})
    monkeypatch.setattr(mui, "render_modern_sidebar", lambda *a, **k: "Ghost")
    monkeypatch.setattr(ui, "render_modern_sidebar", lambda *a, **k: "Ghost")

    class Dummy(contextlib.AbstractContextManager):
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def container(self):
            return Dummy()

        def expander(self, *a, **k):
            return Dummy()

        def tabs(self, labels):
            tab_calls.append(labels)
            return [Dummy() for _ in labels]

    tab_calls = []
    monkeypatch.setattr(st, "set_page_config", lambda *a, **k: None)
    monkeypatch.setattr(st, "expander", lambda *a, **k: Dummy())
    monkeypatch.setattr(st, "container", lambda: Dummy())
    monkeypatch.setattr(st, "columns", lambda *a, **k: [Dummy(), Dummy(), Dummy()])
    monkeypatch.setattr(
        st, "tabs", lambda labels: tab_calls.append(labels) or [Dummy() for _ in labels]
    )
    for fn in [
        "markdown",
        "info",
        "error",
        "warning",
        "write",
        "button",
        "file_uploader",
        "text_input",
        "text_area",
        "divider",
        "progress",
        "json",
        "subheader",
        "radio",
        "toggle",
    ]:
        monkeypatch.setattr(st, fn, lambda *a, **k: None)

    monkeypatch.setattr(st, "session_state", {})
    monkeypatch.setattr(st, "query_params", {})

    for helper in [
        "initialize_theme",
        "render_status_icon",
        "render_simulation_stubs",
        "render_stats_section",
    ]:
        monkeypatch.setattr(ui, helper, lambda *a, **k: None)

    monkeypatch.setattr(
        ui, "render_api_key_ui", lambda *a, **k: {"model": "dummy", "api_key": ""}
    )

    ui.main()

    assert fallback_called.get("choice") == "Ghost"


def test_main_defaults_to_validation(monkeypatch):
    monkeypatch.setenv("UI_DEBUG_PRINTS", "0")
    importlib.reload(ui)

    loaded = {}
    monkeypatch.setattr(
        ui,
        "load_page_with_fallback",
        lambda choice, paths: loaded.setdefault("choice", choice),
    )
    monkeypatch.setattr(ui, "get_st_secrets", lambda: {})
    monkeypatch.setattr(
        mui,
        "render_modern_sidebar",
        lambda *a, **k: st.session_state.get("active_page"),
    )
    monkeypatch.setattr(
        ui, "render_modern_sidebar", lambda *a, **k: st.session_state.get("active_page")
    )

    class Dummy(contextlib.AbstractContextManager):
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            return False

        def container(self):
            return Dummy()

        def expander(self, *a, **k):
            return Dummy()

        def tabs(self, labels):
            return [Dummy() for _ in labels]

    monkeypatch.setattr(st, "set_page_config", lambda *a, **k: None)
    monkeypatch.setattr(st, "expander", lambda *a, **k: Dummy())
    monkeypatch.setattr(st, "container", lambda: Dummy())
    monkeypatch.setattr(st, "columns", lambda *a, **k: [Dummy(), Dummy(), Dummy()])
    monkeypatch.setattr(st, "tabs", lambda labels: [Dummy() for _ in labels])
    for fn in [
        "markdown",
        "info",
        "error",
        "warning",
        "write",
        "button",
        "file_uploader",
        "text_input",
        "text_area",
        "divider",
        "progress",
        "json",
        "subheader",
        "radio",
        "toggle",
    ]:
        monkeypatch.setattr(st, fn, lambda *a, **k: None)

    session = {"sidebar_nav": "Ghost"}
    monkeypatch.setattr(st, "session_state", session)
    params = {"page": "Unknown"}
    monkeypatch.setattr(st, "query_params", params)

    for helper in [
        "initialize_theme",
        "render_status_icon",
        "render_simulation_stubs",
        "render_stats_section",
    ]:
        monkeypatch.setattr(ui, helper, lambda *a, **k: None)

    monkeypatch.setattr(
        ui, "render_api_key_ui", lambda *a, **k: {"model": "dummy", "api_key": ""}
    )
    monkeypatch.setattr(
        mui, "render_modern_sidebar", lambda *a, **k: session.get("sidebar_nav")
    )
    monkeypatch.setattr(
        ui, "render_modern_sidebar", lambda *a, **k: session.get("sidebar_nav")
    )

    ui.main()

    assert params.get("page") == "validation"
    assert session.get("sidebar_nav") == "validation"
    # Optional, if you also defined `loaded` earlier:
    # assert loaded.get("choice") == "Validation"


def test_fallback_rendered_once(monkeypatch):
    monkeypatch.setenv("UI_DEBUG_PRINTS", "0")
    importlib.reload(ui)

    # No-op patches for Streamlit usage within _render_fallback
    monkeypatch.setattr(st, "toast", lambda *a, **k: None)
    monkeypatch.setattr(ui, "show_preview_badge", lambda *a, **k: None)

    called = {"count": 0}
    monkeypatch.setattr(
        ui,
        "render_modern_validation_page",
        lambda: called.__setitem__("count", called["count"] + 1),
    )

    ui._fallback_rendered.clear()
    ui._render_fallback("Validation")
    ui._render_fallback("Validation")

    assert called["count"] == 1
    assert "validation" in ui._fallback_rendered  # Use normalized slug form


def test_render_stats_section_uses_flexbox(monkeypatch):
    """render_stats_section should output flexbox-based layout."""
    outputs = []

    dummy_st = types.SimpleNamespace(markdown=lambda html, **k: outputs.append(html))

    monkeypatch.setattr(mui, "st", dummy_st)

    stats = {"runs": 1, "proposals": 2, "success_rate": "90%", "accuracy": "95%"}
    mui.render_stats_section(stats)

    combined = "\n".join(outputs)
    assert "stats-container" in combined
    assert "stats-card" in combined
