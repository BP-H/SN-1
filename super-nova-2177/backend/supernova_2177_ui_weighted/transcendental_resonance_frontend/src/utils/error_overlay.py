from __future__ import annotations

"""Simple overlay component to surface fatal errors."""

try:  # pragma: no cover - optional dependency
    from nicegui import ui
except ModuleNotFoundError:  # pragma: no cover - fallback when NiceGUI missing
    ui = None  # type: ignore[assignment]


class ErrorOverlay:
    """Display an overlay with an error message, or fallback to stdout."""

    def __init__(self) -> None:
        if ui is None:
            self._dialog = None
            self._label = None
        else:
            self._dialog = ui.dialog().props("persistent")
            with self._dialog:
                with ui.card():
                    self._label = ui.label("Error")
                    ui.button("Close", on_click=self.hide)

    def show(self, message: str) -> None:
        if self._dialog is None:
            print(message)
            return
        self._label.text = message
        if not self._dialog.open:
            self._dialog.open()

    def hide(self) -> None:
        if self._dialog is None:
            return
        if self._dialog.open:
            self._dialog.close()


__all__ = ["ErrorOverlay"]