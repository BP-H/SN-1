# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Utilities for rendering a simple (or custom) social feed."""

from __future__ import annotations

from typing import Iterable, Dict, Any, Tuple

import streamlit as st

import html

from streamlit_helpers import sanitize_text, render_post_card
from modern_ui_components import shadcn_card

# Track rendered posts for incremental updates
_FEED_INDEX_KEY = "_feed_render_index"
_FEED_CONTAINER_KEY = "_feed_container"

# --- default demo posts -------------------------------------------------------
DEMO_POSTS: list[Tuple[str, str, str]] = [
    (
        "alice",
        "https://picsum.photos/seed/alice/400/300",
        "Enjoying the sunshine!",
    ),
    (
        "bob",
        "https://picsum.photos/seed/bob/400/300",
        "Hiking adventures today.",
    ),
    (
        "carol",
        "https://picsum.photos/seed/carol/400/300",
        "Coffee time at my favourite spot.",
    ),
]


# -----------------------------------------------------------------------------


def render_feed(posts: Iterable[Any] | None = None) -> None:
    """Render a simple scrolling feed of posts with incremental updates."""

    active = st.session_state.get("active_user", "guest")
    if posts is None or not list(posts):
        posts = DEMO_POSTS if active in {"guest", "demo_user"} else []
    else:
        posts = list(posts)

    import contextlib

    container = st.session_state.get(_FEED_CONTAINER_KEY)
    if container is None:
        container_fn = getattr(st, "container", None)
        container = container_fn() if callable(container_fn) else contextlib.nullcontext()
        st.session_state[_FEED_CONTAINER_KEY] = container

    start = st.session_state.get(_FEED_INDEX_KEY, 0)
    posts_to_render = posts[start:]

    if start == 0 and not posts_to_render:
        info_fn = getattr(container, "info", getattr(st, "info", None))
        if info_fn:
            info_fn("No posts to display")
        return

    with container:
        for entry in posts_to_render:
            if isinstance(entry, dict):
                user = sanitize_text(entry.get("user") or entry.get("username", ""))
                image = sanitize_text(entry.get("image", ""))
                caption = sanitize_text(entry.get("text") or entry.get("caption", ""))
                likes = entry.get("likes", 0)
            else:
                user, image, caption = entry
                likes = 0

            render_post_card({
                "image": image,
                "text": f"**{html.escape(user)}**: {caption}" if user else caption,
                "likes": likes,
            })

    st.session_state[_FEED_INDEX_KEY] = start + len(posts_to_render)


def render_mock_feed() -> None:
    """Convenience wrapper that simply calls :func:`render_feed` with demo data."""
    render_feed(DEMO_POSTS)


__all__ = ["render_feed", "render_mock_feed", "DEMO_POSTS"]

