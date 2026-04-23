"""Minimal Streamlit UI for experimental video chat."""

from __future__ import annotations

import asyncio
import streamlit as st

from frontend.theme import apply_theme
from ai_video_chat import create_session
from video_chat_router import ConnectionManager
from streamlit_helpers import safe_container, header, theme_toggle, inject_global_styles

# Initialize theme & global styles once on import
apply_theme("light")
inject_global_styles()


def _run_async(coro):
    """Run ``coro`` regardless of event loop state."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
        return loop.run_until_complete(coro)


manager = ConnectionManager()


def main(main_container=None) -> None:
    """Render the simple video chat demo."""
    container = main_container if main_container is not None else st
    theme_toggle("Dark Mode", key_suffix="video_chat")

    container_ctx = safe_container(container)
    with container_ctx:
        header("🎥 Video Chat")

        session = st.session_state.get("video_chat_session")
        messages = st.session_state.setdefault("video_chat_messages", [])

        if session is None:
            if st.button("Start Session", key="video_chat_start"):
                session = create_session(["local-user"])
                _run_async(session.start())
                st.session_state["video_chat_session"] = session
                st.success("Session started")
        else:
            st.write(f"Session ID: {session.session_id}")
            if st.button("End Session", key="video_chat_end"):
                _run_async(session.end())
                st.session_state["video_chat_session"] = None
                st.session_state["video_chat_messages"] = []
                st.success("Session ended")
                return

            msg = st.text_input("Message", key="video_chat_input")
            if st.button("Send", key="video_chat_send"):
                if msg:
                    payload = {"type": "chat", "text": msg, "lang": "en"}
                    _run_async(manager.broadcast(payload, sender=None))
                    messages.append(f"You: {msg}")
                    st.session_state["video_chat_input"] = ""

            st.markdown("**Chat Log**")
            for line in messages:
                st.write(line)


def render() -> None:
    """Wrapper for Streamlit multipage support."""
    main()


if __name__ == "__main__":
    main()
