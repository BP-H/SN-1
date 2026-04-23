"""Convenience exports for frontend utilities."""

from .theme import (
    apply_theme,
    set_theme,
    inject_modern_styles,
    inject_global_styles,
    get_accent_color,
)
from .assets import story_css, story_js, reaction_css, scroll_js

__all__ = [
    "apply_theme",
    "set_theme",
    "inject_modern_styles",
    "inject_global_styles",
    "get_accent_color",
    "story_css",
    "story_js",
    "reaction_css",
    "scroll_js",
]
