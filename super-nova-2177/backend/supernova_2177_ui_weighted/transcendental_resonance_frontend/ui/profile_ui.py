"""Back-compat wrapper for the refactored profile-card UI."""
from __future__ import annotations

# Re-export the new implementation so legacy imports continue to work
from .profile_card import (
    DEFAULT_USER,
    inject_profile_styles,
    render_profile_card,
)

# Historical alias
render_profile = render_profile_card

__all__ = [
    "render_profile_card",
    "render_profile",
    "inject_profile_styles",
    "DEFAULT_USER",
]
