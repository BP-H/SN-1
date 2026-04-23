import sys
import types
from pathlib import Path
import pytest

pytest.importorskip("streamlit")
pytestmark = pytest.mark.requires_streamlit

# Ensure repository root is importable
root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

import ui
from utils.paths import PAGES_DIR


def test_pages_labels_generated_from_slugs():
    pages = ui.build_pages(PAGES_DIR)
    # Each label must be slug.replace('_', ' ').title()
    for label, slug in pages.items():
        assert label == slug.replace("_", " ").title()
    # PAGES constant should match build_pages result
    assert ui.PAGES == pages


def test_each_page_appears_once():
    pages = ui.build_pages(PAGES_DIR)
    labels = list(pages.keys())
    slugs = list(pages.values())
    assert len(labels) == len(set(labels))
    assert len(slugs) == len(set(slugs))

