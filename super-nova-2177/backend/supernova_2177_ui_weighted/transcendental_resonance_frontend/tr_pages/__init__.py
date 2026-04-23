"""Lazy-loading access to page modules for the Transcendental Resonance frontend."""

__all__ = [
    "agents",
    "ai_assist_page",
    "chat",
    "debug_panel_page",
    "events_page",
    "explore_page",
    "feed",
    "feed_page",
    "forks_page",
    "groups_page",
    "login_page",
    "messages",
    "messages_center",
    "messages_page",
    "moderation_dashboard_page",
    "moderation_page",
    "music_page",
    "network_analysis_page",
    "network_page",  # alias for network_analysis_page
    "notifications_page",
    "profile",
    "profile_page",
    "proposals_page",
    "recommendations_page",
    "resonance_music",
    "social",
    "status_page",
    "system_insights_page",
    "upload_page",
    "validation",
    "validator_graph_page",
    "vibenodes_page",
    "video_chat",
    "video_chat_page",
    "voting",
    "register_page",  # alias for login_page
]


def __getattr__(name):
    """Dynamically load page functions from their modules."""
    if name in __all__:
        module_map = {
            "register_page": "login_page",
            "network_page": "network_analysis_page",
        }
        module_name = module_map.get(name, name)
        module = __import__(f"transcendental_resonance_frontend.tr_pages.{module_name}", fromlist=[name])
        return getattr(module, name if hasattr(module, name) else "main")
    raise AttributeError(name)
