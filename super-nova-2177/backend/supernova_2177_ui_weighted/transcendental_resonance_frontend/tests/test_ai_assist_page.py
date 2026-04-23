# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from transcendental_resonance_frontend.tr_pages.ai_assist_page import ai_assist_page

def test_ai_assist_page_is_async():
    assert inspect.iscoroutinefunction(ai_assist_page)
