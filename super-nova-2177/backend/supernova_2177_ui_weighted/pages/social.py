# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Friends & Followers page."""

import streamlit as st
from frontend.theme import apply_theme

from social_tabs import render_social_tab
from streamlit_helpers import (
    safe_container,
    render_mock_feed,
    theme_toggle,
    inject_global_styles,
)
from feed_renderer import render_feed

# Initialize theme & global styles once
apply_theme("light")
inject_global_styles()


def main(main_container=None) -> None:
    """Render the social page content within ``main_container``."""
    if main_container is None:
        main_container = st
    theme_toggle("Dark Mode", key_suffix="social")

    container_ctx = safe_container(main_container)
    with container_ctx:
        render_social_tab()
        st.divider()
        render_mock_feed()
        render_feed()


def render() -> None:
    """Wrapper to keep page loading consistent."""
    main()


if __name__ == "__main__":
    main()
