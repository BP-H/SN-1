"""Compatibility wrapper for legacy imports.

Historically the project imported symbols from ``superNova_2177``. The
actual implementation now lives in ``supernovacore.py``. Re-exporting the
public surface here keeps older modules, tests, and scripts working while
the package is gradually normalized.
"""

from .supernovacore import *  # noqa: F401,F403
