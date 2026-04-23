"""Reusable chat UI components."""
from __future__ import annotations

import streamlit as st
from modern_ui import apply_modern_styles
from streamlit_helpers import safe_container, header

apply_modern_styles()

DUMMY_CONVOS = [
    {"user": "Alice", "preview": "Hey there!"},
    {"user": "Bob", "preview": "Let's catch up."},
]


def init_chat_state() -> None:
    """Initialize session state for chat."""
    st.session_state.setdefault("conversations", DUMMY_CONVOS)
    st.session_state.setdefault(
        "messages", {c["user"]: [] for c in st.session_state["conversations"]}
    )
    if "active_chat" not in st.session_state:
        st.session_state["active_chat"] = DUMMY_CONVOS[0]["user"] if DUMMY_CONVOS else ""


def render_conversation_list() -> None:
    """Display the list of conversations and allow selection."""
    users = [c["user"] for c in st.session_state["conversations"]]
    active = st.session_state.get("active_chat")
    if active not in users and users:
        active = users[0]
    col1, col2 = st.columns([0.25, 0.75])
    with col1:
        selected = (
            st.radio(
                "Conversations",
                users,
                index=users.index(active),
                label_visibility="collapsed",
            )
            if users
            else ""
        )
        st.session_state["active_chat"] = selected
    with col2:
        st.write("Recent")
        if users:
            st.write(st.session_state["conversations"][users.index(selected)]["preview"])


def render_chat_panel(user: str) -> None:
    """Render chat messages and input box for ``user``."""
    header(f"Chat with {user}")
    msgs = st.session_state["messages"].setdefault(user, [])
    for msg in msgs:
        st.write(f"{msg['sender']}: {msg['text']}")

    key_prefix = f"{st.session_state.get('active_page', 'global')}_"
    txt = st.text_input("Message", key=f"{key_prefix}msg_input")
    if st.button("Send", key=f"{key_prefix}send_btn") and txt:
        msgs.append({"sender": "You", "text": txt})
        st.session_state.msg_input = ""
        st.rerun()
    if st.button("Start Video Call", key=f"{key_prefix}video_call"):
        st.toast("Video call integration pending")


def render_chat_ui(main_container=None) -> None:
    """Render the full chat UI."""
    if main_container is None:
        main_container = st
    init_chat_state()
    container_ctx = safe_container(main_container)
    with container_ctx:
        header("✉️ Messages")
        if not st.session_state["conversations"]:
            st.info("No conversations yet")
            return
        user = st.session_state.get("active_chat")
        render_conversation_list()
        st.divider()
        if user:
            render_chat_panel(user)


__all__ = [
    "render_chat_ui",
    "init_chat_state",
    "render_conversation_list",
    "render_chat_panel",
]
