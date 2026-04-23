# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import logging
from pathlib import Path
import sys

import pytest

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from transcendental_resonance_frontend.src.utils.page_registry import ensure_pages
from disclaimers import (
    STRICTLY_SOCIAL_MEDIA,
    INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION,
    LEGAL_ETHICAL_SAFEGUARDS,
)


def create_duplicates(dir_path: Path) -> None:
    dir_path.mkdir(parents=True, exist_ok=True)
    (dir_path / "Foo.py").write_text("# foo\n")
    (dir_path / "foo.py").write_text("# foo lowercase\n")


def count_slug_files(dir_path: Path, slug: str) -> int:
    return len([p for p in dir_path.glob("*.py") if p.stem.lower() == slug])


def test_duplicates_removed_in_dev(tmp_path, monkeypatch, caplog):
    pages_dir = tmp_path / "pages"
    create_duplicates(pages_dir)
    pages = {"Foo": "foo"}
    monkeypatch.setenv("DEV", "1")
    monkeypatch.setattr(sys, "argv", ["prog"])
    logger = logging.getLogger(
        "transcendental_resonance_frontend.src.utils.page_registry"
    )
    logger.propagate = True

    with caplog.at_level(
        logging.INFO, logger="transcendental_resonance_frontend.src.utils.page_registry"
    ):
        ensure_pages(pages, pages_dir)

    assert count_slug_files(pages_dir, "foo") == 1
    assert any("Removed duplicate page module" in r.message for r in caplog.records)


def test_duplicates_preserved_without_flags(tmp_path, monkeypatch):
    pages_dir = tmp_path / "pages"
    create_duplicates(pages_dir)
    pages = {"Foo": "foo"}
    monkeypatch.delenv("DEV", raising=False)
    monkeypatch.setattr(sys, "argv", ["prog"])

    ensure_pages(pages, pages_dir)

    assert count_slug_files(pages_dir, "foo") == 2


def test_duplicates_removed_with_debug_flag(tmp_path, monkeypatch, caplog):
    pages_dir = tmp_path / "pages"
    create_duplicates(pages_dir)
    pages = {"Foo": "foo"}
    monkeypatch.delenv("DEV", raising=False)
    monkeypatch.setattr(sys, "argv", ["prog", "--debug"])
    logger = logging.getLogger(
        "transcendental_resonance_frontend.src.utils.page_registry"
    )
    logger.propagate = True

    with caplog.at_level(
        logging.INFO, logger="transcendental_resonance_frontend.src.utils.page_registry"
    ):
        ensure_pages(pages, pages_dir)

    assert count_slug_files(pages_dir, "foo") == 1
    assert any("Removed duplicate page module" in r.message for r in caplog.records)


def test_disclaimers_intact_after_cleanup(tmp_path, monkeypatch):
    pages_dir = tmp_path / "pages"
    pages_dir.mkdir(parents=True, exist_ok=True)
    canonical = pages_dir / "foo.py"
    canonical.write_text(
        f"# {STRICTLY_SOCIAL_MEDIA}\n"
        f"# {INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION}\n"
        f"# {LEGAL_ETHICAL_SAFEGUARDS}\n"
        "print('hi')\n"
    )
    (pages_dir / "Foo.py").write_text("print('dup')\n")
    pages = {"Foo": "foo"}
    monkeypatch.setenv("DEV", "1")
    monkeypatch.setattr(sys, "argv", ["prog"])

    ensure_pages(pages, pages_dir)

    lines = canonical.read_text().splitlines()
    assert lines[0] == f"# {STRICTLY_SOCIAL_MEDIA}"
    assert lines[1] == f"# {INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION}"
    assert lines[2] == f"# {LEGAL_ETHICAL_SAFEGUARDS}"
    assert count_slug_files(pages_dir, "foo") == 1
