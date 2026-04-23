# pages/messages_center.py

# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Messages / Chat Center with placeholder data and modern UI."""

from __future__ import annotations

import asyncio
import streamlit as st
from frontend.theme import apply_theme
from streamlit_helpers import safe_container, theme_toggle, inject_global_styles
from status_indicator import render_status_icon
from utils import api

# ─── Apply global styles ────────────────────────────────────────────────────────
apply_theme("light")
inject_global_styles()

# ─── Dummy data ────────────────────────────────────────────────────────────────
DUMMY_CONVERSATIONS: dict[str, list[dict[str, str]]] = {
    "alice": [
        {"user": "alice", "text": "Hey! How’s it going?"},
        {"user": "You", "text": "All good here – you? 😊"},
    ],
    "bob": [
        {
            "user": "bob",
            "text": "Check out this cool image!",
            "image": "https://placehold.co/300x200?text=Demo+Image",
        }
    ],
}


async def _post_message(target: str, text: str) -> None:
    """Call the backend API asynchronously."""
    await api.api_call("POST", f"/messages/{target}", {"text": text})


def send_message(target: str, text: str) -> None:
    """Append locally or POST remotely, then flip a little toggle to refresh."""
    if api.OFFLINE_MODE:
        st.session_state["conversations"][target].append({"user": "You", "text": text})
    else:
        try:
            asyncio.run(_post_message(target, text))
        except Exception:
            st.toast("❌ Failed to send", icon="⚠️")
    # Toggle this so Streamlit knows to re-run
    st.session_state["_refresh_chat"] = not st.session_state.get("_refresh_chat", False)


# ─── Page Entrypoint ───────────────────────────────────────────────────────────
def main(container: st.DeltaGenerator | None = None) -> None:
    if container is None:
        container = st

    st.session_state.setdefault("conversations", DUMMY_CONVERSATIONS.copy())
    theme_toggle("Dark Mode", key_suffix="msg_center")
    st.session_state["active_page"] = "messages_center"

    # ── Header ──────────────────────────────────────────────────────────
    with safe_container(container):
        col_title, col_status = st.columns([8, 1])
        with col_title:
            st.header("💬 Messages")
        with col_status:
            render_status_icon()

        # ── Conversation Selector ───────────────────────────────────────
        convos = list(st.session_state["conversations"].keys())
        selected = st.selectbox("Select Conversation", convos)

        # ── Chat Thread ────────────────────────────────────────────────
        thread = st.session_state["conversations"][selected]
        with st.container():
            st.subheader(f"Chat with {selected.capitalize()}")
            # Render past messages
            for msg in thread:
                "assistant" if msg["user"] != "You" else "user"
                avatar = msg.get(
                    "avatar", f"https://robohash.org/{msg['user']}.png?size=40x40"
                )
                with st.chat_message(msg["user"], avatar=avatar):
                    if img := msg.get("image"):
                        st.image(
                            img,
                            use_container_width=True,
                            alt=msg.get("text", "message image"),
                        )

                    st.write(msg["text"])

            # Input box
            user_input = st.chat_input("Type your message…")
            if user_input:
                send_message(selected, user_input)

        # ── Refresh Button (in case offline) ───────────────────────────
        if st.button("🔄 Refresh"):
            st.session_state["_refresh_chat"] = not st.session_state.get(
                "_refresh_chat", False
            )


def render() -> None:
    main()


if __name__ == "__main__":
    main()
