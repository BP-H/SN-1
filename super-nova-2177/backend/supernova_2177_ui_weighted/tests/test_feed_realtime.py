import asyncio
import json

import pytest
import websockets

from pathlib import Path
import sys

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import frontend_bridge
from realtime_comm import feed_ws


@pytest.mark.asyncio
async def test_post_updates_received_live():
    feed_ws.start_in_background("localhost", 8766)
    await asyncio.sleep(0.1)
    uri = "ws://localhost:8766"
    async with websockets.connect(uri) as ws:
        await frontend_bridge.dispatch_route(
            "post_update", {"post": {"user": "alice", "text": "hi"}}
        )
        msg = await asyncio.wait_for(ws.recv(), timeout=2)
        data = json.loads(msg)
        assert data["user"] == "alice"
        assert data["text"] == "hi"
