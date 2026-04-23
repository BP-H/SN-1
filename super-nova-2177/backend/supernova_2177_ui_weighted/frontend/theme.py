# frontend/theme.py
# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Theme management for superNova_2177."""

import streamlit as st

_THEME_CSS_KEY = "_theme_css_injected"

def set_theme(theme: str):
    if theme == "dark":
        st.markdown("<style>body { background-color: #333; color: white; }</style>", unsafe_allow_html=True)
    else:
        st.markdown("<style>body { background-color: white; color: black; }</style>", unsafe_allow_html=True)

def inject_global_styles(force: bool = False) -> None:
    if st.session_state.get(_THEME_CSS_KEY) and not force:
        return
    st.markdown("""
        <style>
            .stApp { font-family: Arial, sans-serif; }
            /* Global styles */
        </style>
    """, unsafe_allow_html=True)
    st.session_state[_THEME_CSS_KEY] = True

def initialize_theme(name: str = "light") -> None:
    set_theme(name)
    inject_global_styles(force=True)

def apply_theme(name: str = "light") -> None:
    initialize_theme(name)

def inject_modern_styles(force: bool = False) -> None:
    inject_global_styles(force)

def get_accent_color() -> str:
    return "#4f8bf9"
