from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Optional

import streamlit as st

_PROFILE_CSS_PATH = Path(__file__).resolve().parent / "profile_theme.css"

DEFAULT_USER = {
    "username": "JaneDoe",
    "bio": "Dreaming across dimensions and sharing vibes.",
    "followers": 128,
    "following": 75,
    "posts": 34,
    "avatar_url": "https://placehold.co/150x150",  # placeholder avatar
    "website": "https://example.com",
    "location": "Wonderland",
    "feed": [f"https://placehold.co/300x300?text=Post+{i}" for i in range(1, 7)],
}


def inject_profile_styles() -> None:
    """Load profile-specific CSS styles if not already injected."""
    if st.session_state.get("_profile_css_injected"):
        return
    try:
        css = _PROFILE_CSS_PATH.read_text()
        st.markdown(f"<style>{css}</style>", unsafe_allow_html=True)
        st.session_state["_profile_css_injected"] = True
    except Exception as exc:  # pragma: no cover - file may be missing
        st.warning(f"Failed to load profile styles: {exc}")


def _stats_item(label: str, value: int | str) -> str:
    return f"<div class='item'><strong>{value}</strong><span>{label}</span></div>"


def render_profile_card(user_data: Optional[Dict[str, object]] = None) -> None:
    """Render a visual profile card with a small gallery."""
    inject_profile_styles()
    data = user_data or DEFAULT_USER

    feed: List[str] = list(data.get("feed", []))
    stats_html = "".join(
        [
            _stats_item("Followers", data.get("followers", 0)),
            _stats_item("Following", data.get("following", 0)),
            _stats_item("Posts", data.get("posts", 0)),
        ]
    )

    with st.container():
        st.markdown("<div class='profile-container'>", unsafe_allow_html=True)
        col1, col2 = st.columns([0.25, 0.75])
        with col1:
            st.markdown(
                f"<img class='profile-pic' src='{data.get('avatar_url')}' alt='avatar'>",
                unsafe_allow_html=True,
            )
        with col2:
            st.markdown(
                f"<p class='username'>{data.get('username')}</p>",
                unsafe_allow_html=True,
            )
            bio = data.get("bio")
            if bio:
                st.markdown(f"<p class='bio'>{bio}</p>", unsafe_allow_html=True)
            st.markdown(f"<div class='stats'>{stats_html}</div>", unsafe_allow_html=True)
            website = data.get("website")
            location = data.get("location")
            extra = []
            if website:
                extra.append(
                    f"<span>🔗 <a href='{website}' target='_blank'>{website}</a></span>"
                )
            if location:
                extra.append(f"<span>📍 {location}</span>")
            if extra:
                st.markdown("<div class='extra'>" + " | ".join(extra) + "</div>", unsafe_allow_html=True)

        if feed:
            st.markdown("<div class='feed-grid'>", unsafe_allow_html=True)
            for src in feed:
                st.markdown(
                    f"<img src='{src}' class='feed-thumb' alt='feed item'>",
                    unsafe_allow_html=True,
                )
            st.markdown("</div>", unsafe_allow_html=True)
        st.markdown("</div>", unsafe_allow_html=True)


__all__ = ["render_profile_card", "inject_profile_styles", "DEFAULT_USER"]
