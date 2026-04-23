# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Simple WebSocket server for broadcasting chat messages."""

from __future__ import annotations

import asyncio
import logging
from typing import Set

try:
    import websockets
except Exception:  # pragma: no cover - optional dependency
    websockets = None

CONNECTED: Set["websockets.WebSocketServerProtocol"] = set()

async def _handler(ws: "websockets.WebSocketServerProtocol") -> None:
    """Handle an individual WebSocket connection."""
    CONNECTED.add(ws)
    try:
        async for msg in ws:
            await asyncio.gather(
                *[conn.send(msg) for conn in CONNECTED if conn is not ws],
                return_exceptions=True,
            )
    except Exception:
        logging.exception("WebSocket connection error")
    finally:
        CONNECTED.discard(ws)

async def run_server(host: str = "localhost", port: int = 8765) -> None:
    """Run the message broadcast server forever."""
    if websockets is None:
        raise RuntimeError("websockets package not available")
    async with websockets.serve(_handler, host, port):
        await asyncio.Future()  # run forever


def start_in_background(host: str = "localhost", port: int = 8765) -> None:
    """Start the server in a daemon thread."""
    if websockets is None:
        logging.warning("WebSocket server not started: websockets unavailable")
        return

    loop = asyncio.new_event_loop()

    def _run() -> None:
        asyncio.set_event_loop(loop)
        loop.run_until_complete(run_server(host, port))

    import threading

    thread = threading.Thread(target=_run, daemon=True)
    thread.start()


if __name__ == "__main__":  # pragma: no cover - manual run
    asyncio.run(run_server())
