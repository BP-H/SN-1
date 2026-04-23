# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect

from transcendental_resonance_frontend.tr_pages import register_page, network_page


def test_register_page_importable():
    assert inspect.iscoroutinefunction(register_page)


def test_network_page_importable():
    assert inspect.iscoroutinefunction(network_page)
