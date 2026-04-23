# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Renders the chat interface for the Streamlit app."""

import streamlit as st
from modern_ui import apply_modern_styles
from streamlit_helpers import safe_container, header


VALID_ROLES = {"user", "assistant"}


def _is_valid_message(message: object) -> bool:
    """Return True if a message is well-formed."""
    return (
        isinstance(message, dict)
        and "role" in message
        and "content" in message
        and message["role"] in VALID_ROLES
    )

DUMMY_CONVOS = [
    {"user": "alice", "messages": [{"role": "user", "content": "Hey!"}, {"role": "assistant", "content": "How are you?"}]},
    {"user": "bob", "messages": [{"role": "user", "content": "I'm good, thanks!"}]},
]

def init_chat_state():
    """Initializes session state variables for the chat."""
    st.session_state.setdefault("conversations", DUMMY_CONVOS)

    convos = st.session_state.get("conversations", [])
    if isinstance(convos, list):
        messages: dict[str, list[dict]] = {}
        for c in convos:
            if not (isinstance(c, dict) and "user" in c):
                print(f"Skipping malformed conversation: {c}")
                continue
            valid_msgs = []
            for m in c.get("messages", []):
                if _is_valid_message(m):
                    valid_msgs.append(m)
                else:
                    print(f"Skipping malformed message: {m}")
            messages[c["user"]] = valid_msgs
        st.session_state.setdefault("messages", messages)
    else:
        st.session_state.setdefault("messages", {})

    if "active_chat" not in st.session_state:
        st.session_state["active_chat"] = DUMMY_CONVOS[0]["user"] if DUMMY_CONVOS else None

def render_chat_interface(container=None):
    """Renders the main chat UI components."""
    apply_modern_styles()
    init_chat_state()

    if container is None:
        container = st.container()

    with safe_container(container):
        active_user = st.selectbox("Select Conversation", options=st.session_state.messages.keys())
        st.session_state["active_chat"] = active_user

        if active_user:
            header(f"Chat with {active_user}")
            # Display messages
            for message in st.session_state.messages.get(active_user, []):
                if _is_valid_message(message):
                    with st.chat_message(message["role"]):
                        st.write(message["content"])
                else:
                    st.warning(f"Skipping malformed message: {message}")

            # Chat input
            if prompt := st.chat_input("Say something"):
                st.session_state.messages[active_user].append({"role": "user", "content": prompt})
                # Simple echo for demonstration
                st.session_state.messages[active_user].append({"role": "assistant", "content": f"Echo: {prompt}"})
                st.rerun()
