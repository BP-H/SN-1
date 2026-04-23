# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from transcendental_resonance_frontend.tr_pages.profile_page import profile_page

def test_profile_page_is_async():
    assert inspect.iscoroutinefunction(profile_page)


def test_profile_page_calls_influence_score_api():
    source = inspect.getsource(profile_page)
    assert "/users/me/influence-score" in source
