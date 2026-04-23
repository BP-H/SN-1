from __future__ import annotations

"""Simple WebSocket manager for chat messages."""

import asyncio
import json
import os
import threading
from typing import Any, Awaitable, Callable, List, Optional

import websockets

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


class ChatWebSocketManager:
    """Manage a persistent WebSocket connection for chat."""

    def __init__(self, path: str = "/ws/chat") -> None:
        self.url = BACKEND_URL.replace("http", "ws") + path
        self.ws: Optional[websockets.WebSocketClientProtocol] = None
        self._listeners: List[Callable[[dict], Awaitable[None] | None]] = []
        self._status_listeners: List[Callable[[str], Any]] = []
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._task: Optional[asyncio.Task] = None
        self._thread: Optional[threading.Thread] = None

    def add_listener(self, func: Callable[[dict], Awaitable[None] | None]) -> None:
        """Register a coroutine or function to handle incoming messages."""
        self._listeners.append(func)

    def on_status_change(self, func: Callable[[str], Any]) -> None:
        """Register a callback fired when connection status changes."""
        self._status_listeners.append(func)

    def _fire_status(self, status: str) -> None:
        for cb in list(self._status_listeners):
            try:
                cb(status)
            except Exception:
                pass

    async def _connect(self) -> websockets.WebSocketClientProtocol | None:
        try:
            ws = await websockets.connect(self.url)
            self.ws = ws
            self._fire_status("connected")
            return ws
        except Exception:
            self._fire_status("disconnected")
            return None

    async def send(self, message: dict) -> None:
        if not self.ws or self.ws.closed:
            await self._connect()
        if self.ws:
            await self.ws.send(json.dumps(message))

    async def _handle(self, data: str) -> None:
        try:
            payload = json.loads(data)
        except Exception:
            payload = {"text": data}
        for cb in list(self._listeners):
            try:
                result = cb(payload)
                if asyncio.iscoroutine(result):
                    await result
            except Exception:
                pass

    async def _listen(self) -> None:
        retry_delay = 3
        while True:
            ws = self.ws
            if not ws or ws.closed:
                ws = await self._connect()
                if not ws:
                    await asyncio.sleep(retry_delay)
                    continue
            try:
                async for msg in ws:
                    await self._handle(msg)
            except Exception:
                self._fire_status("disconnected")
            finally:
                if ws:
                    try:
                        await ws.close()
                    except Exception:
                        pass
                if self.ws is ws:
                    self.ws = None
            await asyncio.sleep(retry_delay)

    def start(self) -> None:
        """Begin listening for messages in a background thread."""
        if self._loop and self._task and not self._task.done():
            return
        self._loop = asyncio.new_event_loop()
        self._task = self._loop.create_task(self._listen())
        self._thread = threading.Thread(target=self._loop.run_forever, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        if self._loop:
            self._loop.call_soon_threadsafe(self._loop.stop)
            self._loop = None
            self._task = None
            self._thread = None
            self.ws = None

__all__ = ["ChatWebSocketManager"]
