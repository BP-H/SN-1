"""Content moderation panel for reviewing flagged posts."""

try:
    from nicegui import ui
except Exception:  # pragma: no cover - fallback to Streamlit
    ui = None  # type: ignore
    import streamlit as st

from utils.api import TOKEN, api_call, listen_ws
from utils.layout import page_container
from utils.styles import get_theme

from .login_page import login_page


@ui.page('/moderation')
async def moderation_page() -> None:
    """Display flagged content for review with live updates."""
    if not TOKEN:
        ui.open(login_page)
        return

    THEME = get_theme()
    with page_container(THEME):
        ui.label('Moderation').classes('text-2xl font-bold mb-4').style(
            f'color: {THEME["accent"]};'
        )

        flags_column = ui.column().classes('w-full')

        async def refresh_flags() -> None:
            """Reload the list of flagged content."""
            flags = await api_call('GET', '/moderation/flags') or []
            flags_column.clear()
            if not flags:
                ui.label('No flagged content').classes('text-sm')
                return
            for flag in flags:
                with flags_column:
                    with ui.card().classes('w-full mb-2').style(
                        'border: 1px solid #333; background: #1e1e1e;'
                    ):
                        ui.label(flag.get('summary', 'Flagged Item')).classes('text-sm font-bold')
                        if reason := flag.get('reason'):
                            ui.label(reason).classes('text-sm')

        await refresh_flags()
        ui.timer(15, lambda: ui.run_async(refresh_flags()))

        async def handle_event(event: dict) -> None:
            if event.get('type') in {'flagged', 'moderation_flagged'}:
                await refresh_flags()

        ws_task = listen_ws(handle_event)
        ui.context.client.on_disconnect(lambda: ws_task.cancel())

if ui is None:
    def moderation_page(*_a, **_kw):
        """Fallback moderation page when NiceGUI is unavailable."""
        st.info('Moderation page requires NiceGUI.')

