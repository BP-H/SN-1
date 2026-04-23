import types
import sys
from pathlib import Path
import pytest
pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import frontend.ui_layout as ui_layout


def test_render_profile_card_includes_env_badge(monkeypatch):
    class DummySt:
        def __init__(self):
            self.out: list[str] = []

        def markdown(self, text, **k):
            self.out.append(str(text))

        def caption(self, text, **k):
            self.out.append(str(text))

        def image(self, *a, **k):
            pass

        def columns(self, *_args, **_kwargs):
            class DummyCol(DummySt):
                def __enter__(self_inner):
                    return self_inner

                def __exit__(self_inner, exc_type, exc, tb):
                    return False

            return DummyCol(), DummyCol()

    dummy_st = DummySt()
    monkeypatch.setattr(ui_layout, 'st', dummy_st)
    monkeypatch.setenv('APP_ENV', 'production')
    ui_layout.render_profile_card('User', 'avatar.png')
    assert any('🚀 Production' in out for out in dummy_st.out)
