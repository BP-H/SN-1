# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytest.importorskip("streamlit")
pytestmark = [
    pytest.mark.requires_nicegui,
    pytest.mark.requires_streamlit,
]

import sys
import types

import streamlit as st
from streamlit.testing.v1 import AppTest


def run_validation_page():
    from transcendental_resonance_frontend.tr_pages.validation import main
    main()


def test_validation_page_renders(monkeypatch):
    dummy_ui = types.ModuleType("ui")

    def render_validation_ui(*args, **kwargs):
        st.checkbox("dummy")

    dummy_ui.render_validation_ui = render_validation_ui
    sys.modules["ui"] = dummy_ui
    import importlib
    import transcendental_resonance_frontend.tr_pages.validation as validation
    importlib.reload(validation)
    at = AppTest.from_function(run_validation_page)
    at.run()
    assert len(at.exception) == 0
    assert len(at.checkbox) > 0


