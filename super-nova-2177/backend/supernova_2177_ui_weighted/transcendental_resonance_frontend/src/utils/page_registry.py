# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Utility helpers for managing Streamlit page modules."""

from __future__ import annotations

from pathlib import Path
import logging
import os
import sys
from disclaimers import (
    STRICTLY_SOCIAL_MEDIA,
    INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION,
    LEGAL_ETHICAL_SAFEGUARDS,
)

logger = logging.getLogger(__name__)
logger.propagate = False


def clean_duplicate_pages(pages_dir: Path) -> list[str]:
    """Remove page modules that collide case-insensitively.

    Parameters
    ----------
    pages_dir:
        Directory containing page modules.

    Returns
    -------
    list[str]
        Names of files that were removed.
    """
    removed: list[str] = []
    by_lower: dict[str, list[Path]] = {}
    for f in pages_dir.glob("*.py"):
        by_lower.setdefault(f.stem.lower(), []).append(f)

    for slug_lower, paths in by_lower.items():
        if len(paths) <= 1:
            continue
        # Prefer an exact lowercase match if it exists, otherwise the
        # lexicographically first file becomes canonical.
        canonical = next(
            (p for p in paths if p.name == f"{slug_lower}.py"),
            sorted(paths, key=lambda p: p.name)[0],
        )
        for p in paths:
            if p is canonical:
                continue
            p.unlink(missing_ok=True)
            removed.append(p.name)
            logger.info("Removed duplicate page module %s", p.name)
    return removed


def ensure_pages(pages: dict[str, str], pages_dir: Path) -> None:
    """Ensure placeholder page modules exist for each slug.

    Parameters
    ----------
    pages:
        Mapping of display labels to page slugs.
    pages_dir:
        Directory where page modules are stored.
    """
    pages_dir.mkdir(parents=True, exist_ok=True)

    # warn if any case-variant files exist that could conflict on
    # case-insensitive filesystems
    debug_mode = os.getenv("DEV") or "--debug" in sys.argv

    by_lower: dict[str, list[Path]] = {}
    for f in pages_dir.glob("*.py"):
        by_lower.setdefault(f.stem.lower(), []).append(f)

    for slug_lower, paths in by_lower.items():
        if len(paths) > 1:
            names = [p.name for p in paths]
            logger.warning(
                "Case-insensitive file collision for '%s': %s",
                slug_lower,
                ", ".join(sorted(names)),
            )

    if debug_mode:
        clean_duplicate_pages(pages_dir)

    for slug in pages.values():
        slug = slug.lower()
        file_path = pages_dir / f"{slug}.py"
        if not file_path.exists():
            file_path.write_text(
                f"# {STRICTLY_SOCIAL_MEDIA}\n"
                f"# {INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION}\n"
                f"# {LEGAL_ETHICAL_SAFEGUARDS}\n"
                "import streamlit as st\n\n"
                "def main() -> None:\n"
                "    st.write('Placeholder')\n"
            )
            logger.info("Created placeholder page module %s", file_path.name)


try:
    from utils.paths import get_pages_dir as _get_pages_dir
except Exception:  # pragma: no cover - fallback when utils.paths is missing

    def _get_pages_dir() -> Path:
        return Path(__file__).resolve().parents[3] / "pages"


def get_pages_dir() -> Path:
    """Return the canonical directory for Streamlit page modules."""
    return _get_pages_dir()


__all__ = ["ensure_pages", "get_pages_dir", "clean_duplicate_pages"]
