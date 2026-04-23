# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from utils.layout import search_widget, page_container


def test_search_widget_defined():
    assert inspect.isfunction(search_widget)


def test_search_widget_uses_combined_search():
    src = inspect.getsource(search_widget)
    assert "combined_search" in src


def test_page_container_has_no_nav_bar():
    src = inspect.getsource(page_container)
    assert "navigation_bar()" not in src
