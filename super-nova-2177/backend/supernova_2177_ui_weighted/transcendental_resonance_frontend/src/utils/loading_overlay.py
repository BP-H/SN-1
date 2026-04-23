"""UI component displaying a loading spinner during API requests."""

from __future__ import annotations

try:
    from nicegui import ui  # type: ignore
except Exception:  # pragma: no cover - nicegui optional
    class _Dummy:
        def __init__(self, *args, **kwargs):
            pass

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            pass

        def props(self, *_args, **_kwargs):
            return self

        def open(self):  # type: ignore
            pass

        def close(self):  # type: ignore
            pass

    class _UIStub:
        def dialog(self, *args, **kwargs):
            return _Dummy()

        def card(self, *args, **kwargs):
            return _Dummy()

        def spinner(self, *args, **kwargs):
            return _Dummy()

    ui = _UIStub()  # type: ignore

from .api import on_request_start, on_request_end


class LoadingOverlay:
    """Display a simple spinner dialog while API calls are running."""

    def __init__(self) -> None:
        self._count = 0
        self._visible = False
        self._dialog = ui.dialog().props("persistent")
        with self._dialog:
            with ui.card():
                ui.spinner(size="lg")

        on_request_start(self._on_start)
        on_request_end(self._on_end)

    def _on_start(self) -> None:
        self._count += 1
        if not self._visible:
            self._dialog.open()
            self._visible = True

    def _on_end(self) -> None:
        self._count = max(0, self._count - 1)
        if self._count == 0 and self._visible:
            self._dialog.close()
            self._visible = False


__all__ = ["LoadingOverlay"]
