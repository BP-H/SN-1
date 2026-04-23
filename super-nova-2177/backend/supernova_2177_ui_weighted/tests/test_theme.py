import types
import sys
from pathlib import Path
import pytest

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import frontend.theme as theme  # noqa: E402


def test_theme_application_and_idempotent_styles(monkeypatch):
    calls = []

    def dummy_markdown(text, **kwargs):
        calls.append(text)

    dummy_st = types.SimpleNamespace(markdown=dummy_markdown, session_state={})
    monkeypatch.setattr(theme, "st", dummy_st)

    theme.inject_modern_styles("light")
    assert dummy_st.session_state["_theme"] == "light"
    assert theme.get_accent_color() == theme.LIGHT_THEME.accent

    # Second call switches theme but should not inject global styles again
    theme.inject_modern_styles("dark")
    assert dummy_st.session_state["_theme"] == "dark"
    assert theme.get_accent_color() == theme.DARK_THEME.accent

    # Global styles should only be injected once
    fa_calls = [c for c in calls if "font-awesome" in c.lower()]
    assert len(fa_calls) == 1

    # Modern styles (e.g. Glassmorphic) should also only be injected once
    glass_calls = [c for c in calls if "Glassmorphic" in c]
    assert len(glass_calls) == 1

