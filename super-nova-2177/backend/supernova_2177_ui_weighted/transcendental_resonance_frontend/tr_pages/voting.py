# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Governance and voting page."""

import streamlit as st
from frontend.theme import apply_theme
from voting_ui import render_voting_tab
from streamlit_helpers import safe_container, theme_toggle, inject_global_styles

# Initialize theme & global styles once
apply_theme("light")
inject_global_styles()


def main(main_container=None) -> None:
    """Render the Governance and Voting page inside ``main_container``."""
    if main_container is None:
        main_container = st

    theme_toggle("Dark Mode", key_suffix="voting")

    container_ctx = safe_container(main_container)
    with container_ctx:
        render_voting_tab(main_container=main_container)


def render() -> None:
    """Wrapper to keep page loading consistent."""
    main()


if __name__ == "__main__":
    main()
