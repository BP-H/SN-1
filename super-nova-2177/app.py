"""Railway compatibility entrypoint.

This module exposes ``app`` at the repository root so platforms
that expect ``app:app`` (e.g., some Railway templates) can import
``backend.app`` without extra PYTHONPATH tweaks.
"""

import sys
from pathlib import Path

# Ensure the backend package is importable even if the working directory changes.
backend_path = Path(__file__).resolve().parent / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from backend.app import app  # noqa: E402  (import after sys.path tweak)

__all__ = ["app"]
