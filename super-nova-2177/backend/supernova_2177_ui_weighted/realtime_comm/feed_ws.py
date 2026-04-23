# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""WebSocket utilities for real-time feed updates."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict, Any, Set

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except Exception:  # pragma: no cover - optional dependency
    websockets = None
    WebSocketServerProtocol = object  # type: ignore

SUBSCRIBERS: Set[WebSocketServerProtocol] = set()
POSTS: list[Dict[str, Any]] = []


async def _handler(ws: WebSocketServerProtocol) -> None:
    """Handle a feed subscriber connection."""
    SUBSCRIBERS.add(ws)
    try:
        for post in POSTS:
            await ws.send(json.dumps(post))
        async for _ in ws:
            pass  # clients don't send messages
    except Exception:  # pragma: no cover - log and drop connection
        logging.exception("Feed websocket error")
    finally:
        SUBSCRIBERS.discard(ws)


async def broadcast(post: Dict[str, Any]) -> None:
    """Broadcast ``post`` to all active subscribers."""
    POSTS.append(post)
    if not SUBSCRIBERS:
        return
    msg = json.dumps(post)
    await asyncio.gather(
        *[client.send(msg) for client in list(SUBSCRIBERS)],
        return_exceptions=True,
    )


async def run_server(host: str = "localhost", port: int = 8766) -> None:
    """Run the feed websocket server forever."""
    if websockets is None:  # pragma: no cover - depends on optional dep
        raise RuntimeError("websockets package not available")
    async with websockets.serve(_handler, host, port):
        await asyncio.Future()


_server_thread = None


def start_in_background(host: str = "localhost", port: int = 8766) -> None:
    """Start the feed websocket server in a background thread."""
    global _server_thread
    if _server_thread and _server_thread.is_alive():
        return
    if websockets is None:
        logging.warning("Feed server not started: websockets unavailable")
        return

    loop = asyncio.new_event_loop()

    def _run() -> None:
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_server(host, port))

    import threading

    _server_thread = threading.Thread(target=_run, daemon=True)
    _server_thread.start()


async def subscribe_feed(_: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure the feed server is running and return its WebSocket URL."""
    start_in_background()
    return {"ws_url": "ws://localhost:8766"}


async def post_update(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Broadcast a new post to subscribers."""
    post = payload.get("post", payload)
    await broadcast(post)
    return {"status": "ok"}


__all__ = ["start_in_background", "subscribe_feed", "post_update", "broadcast"]
