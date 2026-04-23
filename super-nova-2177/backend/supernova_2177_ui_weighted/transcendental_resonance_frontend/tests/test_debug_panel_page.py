# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from transcendental_resonance_frontend.tr_pages.debug_panel_page import debug_panel_page


def test_debug_panel_page_is_async():
    assert inspect.iscoroutinefunction(debug_panel_page)


def test_debug_panel_page_uses_routes():
    source = inspect.getsource(debug_panel_page)
    assert "ROUTES" in source
