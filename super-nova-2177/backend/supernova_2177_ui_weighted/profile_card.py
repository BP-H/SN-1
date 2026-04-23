# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Minimal profile card component used across pages."""

import os
import streamlit as st


def render_profile_card(username: str, avatar_url: str) -> None:
    """Render a compact profile card with an environment badge."""
    env = os.getenv("APP_ENV", "development").lower()
    badge = "🚀 Production" if env.startswith("prod") else "🧪 Development"

    st.markdown("<div class='glass-card'>", unsafe_allow_html=True)
    col1, col2 = st.columns([0.25, 0.75])
    with col1:
        st.image(avatar_url, width=48, use_container_width=True, alt=f"{username} avatar")

    with col2:
        st.markdown(f"**{username}**")
        st.caption(badge)
    st.markdown("</div>", unsafe_allow_html=True)


__all__ = ["render_profile_card"]
