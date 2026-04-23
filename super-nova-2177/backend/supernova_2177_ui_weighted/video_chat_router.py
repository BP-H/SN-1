# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""WebSocket endpoints for experimental video chat."""

from __future__ import annotations

import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Any, List


from realtime_comm.video_chat import VideoChatManager

router = APIRouter()


class ConnectionManager:
    """Track active video chat websocket connections."""

    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: Any, sender: WebSocket) -> None:
        data = json.dumps(message) if not isinstance(message, str) else message
        for conn in list(self.active):
            if conn is not sender:
                try:
                    await conn.send_text(data)
                except Exception:
                    self.disconnect(conn)


manager = ConnectionManager()
video_manager = VideoChatManager()


@router.websocket("/ws/video")
async def video_ws(websocket: WebSocket) -> None:
    """Relay video chat signaling messages between participants."""
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                event = json.loads(data)
            except Exception:
                await manager.broadcast(data, sender=websocket)
                continue

            msg_type = event.get("type")

            if msg_type == "chat":
                text = event.get("text", "")
                lang = event.get("lang", "en")
                video_manager.handle_chat(text, lang)

            elif msg_type == "frame":
                frame = event.get("data")
                if frame:
                    video_manager.analyze_frame("remote", frame.encode())

            elif msg_type == "translate":
                user = event.get("user", "")
                target = event.get("lang", "en")
                text = event.get("text", "")
                video_manager.translate_audio(user, target, text)
                result = json.dumps({
                    "type": "translation",
                    "user": user,
                    "text": text,
                    "translation": next(
                        (s.translation_overlay for s in video_manager.active_streams if s.user_id == user),
                        text,
                    ),
                })
                await manager.broadcast(result, sender=None)

            elif msg_type == "voice":
                await manager.broadcast(event, sender=websocket)

            else:
                await manager.broadcast(event, sender=websocket)

    except WebSocketDisconnect:
        manager.disconnect(websocket)
