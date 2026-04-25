"""Compatibility wrapper for legacy imports.

Historically the project imported symbols from ``superNova_2177``. The
actual implementation now lives in ``supernovacore.py``. Re-exporting the
public surface here keeps older modules, tests, and scripts working while
the package is gradually normalized.
"""

try:
    from .supernovacore import *  # noqa: F401,F403
except ImportError:  # pragma: no cover - supports legacy top-level imports
    from supernovacore import *  # noqa: F401,F403
