# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from transcendental_resonance_frontend.tr_pages.events_page import events_page

def test_events_page_is_async():
    assert inspect.iscoroutinefunction(events_page)

def test_events_page_has_search_widgets():
    src = inspect.getsource(events_page)
    assert "ui.input('Search'" in src
    assert "ui.select(['name', 'date']" in src
    assert "ui.date(" in src
