# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from transcendental_resonance_frontend.tr_pages.vibenodes_page import vibenodes_page

def test_vibenodes_page_is_async():
    assert inspect.iscoroutinefunction(vibenodes_page)

def test_vibenodes_page_has_search_widgets():
    src = inspect.getsource(vibenodes_page)
    assert "ui.input('Search'" in src
    assert "ui.select(['name', 'date', 'trending']" in src
