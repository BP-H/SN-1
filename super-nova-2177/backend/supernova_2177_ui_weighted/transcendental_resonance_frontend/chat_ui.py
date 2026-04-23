# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Helpers for chat message rendering with bubble styling."""

from __future__ import annotations

import streamlit as st

_BUBBLE_CSS = """
<style>
.chat-container {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
}
.chat-bubble {
    padding: 0.5rem 1rem;
    border-radius: 1rem;
    max-width: 80%;
    word-wrap: break-word;
}
.chat-bubble.user {
    align-self: flex-end;
    background: var(--accent);
    color: white;
}
.chat-bubble.other {
    align-self: flex-start;
    background: var(--card);
    color: var(--text-muted);
}
</style>
"""


def inject_chat_styles() -> None:
    """Inject CSS for chat bubbles once per session."""
    if not st.session_state.get("_chat_styles_injected"):
        st.markdown(_BUBBLE_CSS, unsafe_allow_html=True)
        st.session_state["_chat_styles_injected"] = True


def render_message_bubbles(messages: list[dict], *, current_user: str = "You") -> None:
    """Render ``messages`` in bubble containers."""
    inject_chat_styles()
    container = st.container()
    container.markdown("<div class='chat-container'>", unsafe_allow_html=True)
    for entry in messages:
        sender = entry.get("sender", "")
        text = entry.get("text", "")
        role = "user" if sender == current_user else "other"
        container.markdown(
            f"<div class='chat-bubble {role}'>{text}</div>", unsafe_allow_html=True
        )
    container.markdown("</div>", unsafe_allow_html=True)
