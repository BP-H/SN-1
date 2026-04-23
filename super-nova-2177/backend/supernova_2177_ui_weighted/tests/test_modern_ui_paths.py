import importlib
import sys
from pathlib import Path
import pytest

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))


def test_modern_ui_components_paths_fallback(monkeypatch):
    sys.modules.pop("utils.paths", None)
    import modern_ui_components as mui
    importlib.reload(mui)
    assert isinstance(mui.ROOT_DIR, Path)
    assert isinstance(mui.PAGES_DIR, Path)
