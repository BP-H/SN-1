# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Dashboard for reviewing flagged content."""

from __future__ import annotations

try:
    from nicegui import ui
except Exception:  # pragma: no cover - fallback to Streamlit
    ui = None  # type: ignore
    import streamlit as st

from utils.api import TOKEN, api_call, listen_ws
from utils.layout import page_container
from utils.styles import get_theme

from .login_page import login_page


@ui.page("/moderation")
async def moderation_dashboard_page() -> None:
    """Display flagged content requiring moderation."""
    if not TOKEN:
        ui.open(login_page)
        return

    theme = get_theme()
    with page_container(theme):
        ui.label("Moderation Dashboard").classes("text-2xl font-bold mb-4").style(
            f"color: {theme['accent']};"
        )

        items_column = ui.column().classes("w-full")

        async def refresh_items() -> None:
            flags = await api_call("GET", "/moderation/flags") or []
            items_column.clear()
            if not flags:
                ui.label("No flagged content.").classes("text-sm opacity-50")
                return
            for item in flags:
                with items_column:
                    with ui.card().classes("w-full mb-2").style(
                        "border: 1px solid #333; background: #1e1e1e;"
                    ):
                        ui.label(item.get("content", "")).classes("text-sm mb-1")
                        reason = item.get("reason", "unknown")
                        ui.label(f"Reason: {reason}").classes("text-xs mb-2")
                        with ui.row().classes("w-full justify-end"):
                            for action in ["approve", "reject", "censor", "ban"]:
                                async def perform(a=action, fid=item.get("id")) -> None:
                                    await api_call(
                                        "POST",
                                        f"/moderation/flags/{fid}",
                                        {"action": a},
                                    )
                                    await refresh_items()

                                ui.button(a.capitalize(), on_click=perform).classes(
                                    "mr-2"
                                ).style(
                                    f"background: {theme['primary']}; color: {theme['text']};"
                                )

        await refresh_items()
        ui.timer(15, lambda: ui.run_async(refresh_items()))

        async def handle_event(event: dict) -> None:
            if event.get("type") == "moderation_flagged":
                await refresh_items()

        ws_task = listen_ws(handle_event)
        ui.context.client.on_disconnect(lambda: ws_task.cancel())

if ui is None:
    def moderation_dashboard_page(*_a, **_kw):
        """Fallback moderation dashboard when NiceGUI is unavailable."""
        st.info('Moderation dashboard requires NiceGUI.')

