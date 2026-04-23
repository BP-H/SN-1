# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Experimental video chat page."""

from __future__ import annotations

import json

try:
    from nicegui import ui
except Exception:  # pragma: no cover - fallback to Streamlit
    ui = None  # type: ignore
    import streamlit as st

from utils.api import TOKEN, WS_CONNECTION, connect_ws
from utils.layout import page_container
from utils.styles import get_theme

from realtime_comm import VideoChatManager

from .login_page import login_page


@ui.page("/video-chat")
async def video_chat_page() -> None:
    """Simple camera demo with WebSocket signaling."""
    if not TOKEN:
        ui.open(login_page)
        return

    THEME = get_theme()
    with page_container(THEME):
        ui.label("Video Chat").classes("text-2xl font-bold mb-4").style(
            f'color: {THEME["accent"]};'
        )

        manager = VideoChatManager()

        local_cam = ui.camera().classes("w-full mb-4")
        remote_view = ui.video().props("autoplay playsinline").classes("w-full mb-4")
        caption = ui.label().classes("text-sm mb-2")

        messages = (
            ui.column()
            .classes("w-full mb-4")
            .style("max-height: 200px; overflow-y: auto")
        )
        message_input = ui.input(placeholder="Type a message").classes("w-full mb-2")
        send_button = ui.button("Send")

        translate_input = ui.input("Text to translate").classes("w-full mb-2")
        translate_lang = ui.input("Target language code", value="en").classes("w-full mb-4")

        join_button = ui.button("Join Call")
        share_button = ui.button("Share Screen")


        async def handle_event(event: dict) -> None:
            if event.get("type") == "frame":
                remote_view.source = event.get("data")
            elif event.get("type") == "chat":
                with messages:
                    ui.chat_message(event.get("text", ""), name="Remote")
                manager.translate_audio("remote", "en", event.get("text", ""))
            elif event.get("type") == "translation":
                caption.text = event.get("translation")
            elif event.get("type") == "screen_share":
                remote_view.source = event.get("data")


        async def start_ws() -> None:
            global WS_CONNECTION
            ws = await connect_ws("/ws/video")
            if not ws:
                return
            try:
                async for message in ws:
                    try:
                        data = json.loads(message)
                    except Exception:
                        continue
                    await handle_event(data)
            finally:
                if not ws.closed:
                    await ws.close()
                if WS_CONNECTION is ws:
                    WS_CONNECTION = None


        async def join_call() -> None:
            try:
                ws_task = ui.run_async(start_ws())
                ui.context.client.on_disconnect(lambda: ws_task.cancel())
            except Exception:  # pragma: no cover - network issues
                ui.notify("Realtime updates unavailable", color="warning")
                join_button.disable()
                local_cam.disable()


        async def send_frame() -> None:
            if WS_CONNECTION and local_cam.value:
                await WS_CONNECTION.send_text(json.dumps({
                    "type": "frame",
                    "data": local_cam.value
                }))


        async def send_chat() -> None:
            if WS_CONNECTION and message_input.value:
                await WS_CONNECTION.send_text(json.dumps({
                    "type": "chat",
                    "text": message_input.value
                }))
                with messages:
                    ui.chat_message(message_input.value, name="You", sent=True)
                manager.translate_audio("local", "en", message_input.value)
                message_input.value = ""


        async def send_translation() -> None:
            if WS_CONNECTION and translate_input.value:
                await WS_CONNECTION.send_text(json.dumps({
                    "type": "translate",
                    "user": "local-user",
                    "lang": translate_lang.value or "en",
                    "text": translate_input.value
                }))
                translate_input.value = ""


        join_button.on_click(lambda: ui.run_async(join_call()))
        share_button.on_click(lambda: WS_CONNECTION and WS_CONNECTION.send_text(
            json.dumps({"type": "screen_share"})))

        local_cam.on("capture", lambda _: ui.run_async(send_frame()))
        send_button.on_click(lambda: ui.run_async(send_chat()))
        translate_input.on("submit", lambda _: ui.run_async(send_translation()))

        ui.label("Note: Video chat is unavailable when offline.").classes(
            "text-xs opacity-75 mt-2"
        )

if ui is None:
    def video_chat_page(*_a, **_kw):
        """Fallback video chat page when NiceGUI is unavailable."""
        st.info('Video chat page requires NiceGUI.')



