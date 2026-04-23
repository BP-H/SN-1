import importlib
import sys
from pathlib import Path
import pytest

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))


def test_ui_layout_paths_fallback(monkeypatch):
    sys.modules.pop("utils.paths", None)
    import frontend.ui_layout as ui_layout
    importlib.reload(ui_layout)
    assert isinstance(ui_layout.ROOT_DIR, Path)
    assert isinstance(ui_layout.PAGES_DIR, Path)
