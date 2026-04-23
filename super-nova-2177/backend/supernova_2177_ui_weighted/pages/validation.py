# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Validation analysis page."""

import importlib
import streamlit as st
from frontend.theme import apply_theme
from streamlit_helpers import safe_container, theme_toggle, inject_global_styles

# Resolve and inject theme/styles once at import time
apply_theme("light")
inject_global_styles()


# --------------------------------------------------------------------
# Dynamic loader with graceful degradation
# --------------------------------------------------------------------
def _fallback_validation_ui(*_a, **_k):
    st.warning("Validation UI unavailable")


def _load_render_ui():
    """Try to import ui.render_validation_ui, else return a stub."""
    try:
        mod = importlib.import_module("ui")
        return getattr(mod, "render_validation_ui", _fallback_validation_ui)
    except Exception:  # pragma: no cover
        return _fallback_validation_ui


render_validation_ui = _load_render_ui()


# --------------------------------------------------------------------
# Page decorator (works even if Streamlit’s multipage API absent)
# --------------------------------------------------------------------
def _page_decorator(func):
    if hasattr(st, "experimental_page"):
        return st.experimental_page("Validation")(func)
    return func


# --------------------------------------------------------------------
# Main entry point
# --------------------------------------------------------------------
@_page_decorator
def main(main_container=None) -> None:
    """Render the validation UI inside a safe container."""
    if main_container is None:
        main_container = st
    theme_toggle("Dark Mode", key_suffix="validation")

    global render_validation_ui
    # Reload if we initially fell back but the real module may now exist
    if render_validation_ui is _fallback_validation_ui:
        render_validation_ui = _load_render_ui()

    container_ctx = safe_container(main_container)

    try:
        with container_ctx:
            render_validation_ui(main_container=main_container)
    except AttributeError:
        # If safe_container gave an unexpected object, fall back
        render_validation_ui(main_container=main_container)


def render() -> None:
    """Alias used by other modules/pages."""
    main()


if __name__ == "__main__":
    main()
