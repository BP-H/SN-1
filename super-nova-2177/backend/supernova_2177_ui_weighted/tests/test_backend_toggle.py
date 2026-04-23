import sys
from pathlib import Path
import pytest

pytest.importorskip("streamlit")

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import ui


def test_default_false():
    assert ui._determine_backend([], {}) is False


def test_env_var(monkeypatch):
    assert ui._determine_backend([], {"USE_REAL_BACKEND": "1"}) is True
    assert ui._determine_backend([], {"USE_REAL_BACKEND": "0"}) is False


def test_cli_flags_override_env():
    assert ui._determine_backend(["--use-backend"], {}) is True
    # CLI flag should override env var
    assert ui._determine_backend(["--no-backend"], {"USE_REAL_BACKEND": "1"}) is False
