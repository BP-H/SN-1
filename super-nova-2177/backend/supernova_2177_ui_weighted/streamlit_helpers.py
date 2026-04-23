# streamlit_helpers.py
# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Unified Streamlit UI helper utilities."""
from __future__ import annotations  # Fixed typo

import html
from contextlib import contextmanager
from typing import Any, Literal, Dict, List

import streamlit as st
from frontend.theme import set_theme, inject_global_styles


# Utilities
def sanitize_text(x: Any) -> str:
    return html.escape(str(x), quote=False) if x is not None else ""


@contextmanager
def safe_container(container=None):
    yield container or st


def header(txt: str):
    st.markdown(f"<h2>{sanitize_text(txt)}</h2>", unsafe_allow_html=True)


def alert(msg: str, type: Literal["info", "warning", "error"] = "info"):
    getattr(st, type, st.info)(msg)


# Theme
def theme_toggle(label: str = "Dark mode", key_suffix: str = "default") -> str:
    key = f"theme_toggle_{key_suffix}"
    cur = st.session_state.get("theme", "light")
    is_dark = st.toggle(label, value=(cur == "dark"), key=key)
    new = "dark" if is_dark else "light"
    if new != cur:
        st.session_state["theme"] = new
        set_theme(new)
        st.rerun()
    return new


def theme_selector(label: str = "Theme", key_suffix: str = "legacy") -> str:
    mapping = {"Light": "light", "Dark": "dark"}
    rev = {v: k for k, v in mapping.items()}
    cur = rev.get(st.session_state.get("theme", "light"), "Light")
    choice = st.selectbox(
        label,
        list(mapping),
        index=list(mapping).index(cur),
        key=f"theme_sel_{key_suffix}",
    )
    if mapping[choice] != st.session_state.get("theme", "light"):
        st.session_state["theme"] = mapping[choice]
        set_theme(mapping[choice])
        st.rerun()
    return mapping[choice]


# Shared layout components
def shared_header(title: str = "superNova_2177") -> None:
    """Render a consistent application header."""
    st.markdown(
        f"<div class='app-header'><h1>{sanitize_text(title)}</h1></div>",
        unsafe_allow_html=True,
    )


def shared_footer(text: str = "© 2024 superNova_2177") -> None:
    """Render a consistent application footer."""
    st.markdown(
        (
            "<div class='app-footer' "
            "style='text-align:center; padding-top:1rem; color:#888;'>"
            f"{sanitize_text(text)}</div>"
        ),
        unsafe_allow_html=True,
    )


# Legacy
def get_active_user() -> str | None:
    return st.session_state.get("active_user")


def ensure_active_user():
    st.session_state.setdefault("active_user", "guest")


@contextmanager
def centered_container(**kwargs):
    with st.container(**kwargs) as c:
        st.markdown(
            "<style>[data-testid='column']{margin-left:auto!important;margin-right:auto!important;}</style>",
            unsafe_allow_html=True,
        )
        yield c


def render_post_card(*args, **kwargs):
    st.warning("Post card placeholder.")


def render_instagram_grid(*args, **kwargs):
    st.info("Instagram grid placeholder.")


# State Fix
def _normalise_conversations_state():
    convs = st.session_state.get("conversations")
    if isinstance(convs, list):
        upgraded: Dict[str, Dict[str, Any]] = {}
        for i, c in enumerate(convs):
            if isinstance(c, dict):
                user = c.get("user", f"unknown_{i}")
                msgs: List[Dict[str, str]] = c.get("messages", [])
                preview = msgs[-1].get("content", "") if msgs else ""
                upgraded[user] = {"messages": msgs, "preview": preview}
        st.session_state["conversations"] = upgraded


_normalise_conversations_state()
inject_global_styles()  # Early

__all__ = [
    "sanitize_text",
    "safe_container",
    "alert",
    "header",
    "theme_toggle",
    "theme_selector",
    "get_active_user",
    "centered_container",
    "render_post_card",
    "render_instagram_grid",
    "ensure_active_user",
    "shared_header",
    "shared_footer",
]
