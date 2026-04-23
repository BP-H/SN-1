# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Messages page – delegates to the reusable chat UI."""

from __future__ import annotations

import streamlit as st
from frontend.theme import apply_theme
from streamlit_helpers import theme_toggle, inject_global_styles
from chat_ui import render_chat_interface

apply_theme("light")
inject_global_styles()


def main(main_container=None) -> None:
    """Render the chat interface inside the given container (or the page itself)."""
    theme_toggle("Dark Mode", key_suffix="messages")
    render_chat_interface(main_container)


def render() -> None:  # for multipage apps that expect a `render` symbol
    main()


if __name__ == "__main__":
    main()
