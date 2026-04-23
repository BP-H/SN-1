# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import importlib
from pathlib import Path
import sys

import pytest
pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

if "utils" in sys.modules:
    pkg = sys.modules["utils"]
    if hasattr(pkg, "__path__"):
        pkg.__path__.append(str(root / "utils"))
else:
    import importlib
    importlib.import_module("utils.paths")

from disclaimers import (
    STRICTLY_SOCIAL_MEDIA,
    INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION,
    LEGAL_ETHICAL_SAFEGUARDS,
)


def test_messages_page_has_main_and_disclaimers():
    messages = importlib.import_module("pages.messages")
    assert callable(getattr(messages, "main", None))

    lines = Path(messages.__file__).read_text().splitlines()
    assert STRICTLY_SOCIAL_MEDIA in "".join(lines[:3])
    assert INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION in "".join(lines[:3])
    assert LEGAL_ETHICAL_SAFEGUARDS in "".join(lines[:3])
