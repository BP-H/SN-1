# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

import inspect
from utils.features import (
    quick_post_button,
    high_contrast_switch,
    skeleton_loader,
)


def test_quick_post_button_callable():
    assert callable(quick_post_button)


def test_high_contrast_switch_callable():
    assert callable(high_contrast_switch)


def test_skeleton_loader_callable():
    assert callable(skeleton_loader)
