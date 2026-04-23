import types
import sys
from pathlib import Path
import pytest

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import feed_renderer


def test_render_feed_renders_each_entry(monkeypatch):
    calls = []

    def dummy_render(post):
        calls.append(post)

    dummy_st = types.SimpleNamespace(info=lambda *a, **k: None, session_state={})
    monkeypatch.setattr(feed_renderer, "render_post_card", dummy_render)
    monkeypatch.setattr(feed_renderer, "st", dummy_st)

    posts = [
        ("alice", "img1.png", "hi"),
        ("bob", "img2.png", "hello"),
    ]

    feed_renderer.render_feed(posts)
    assert len(calls) == len(posts)

