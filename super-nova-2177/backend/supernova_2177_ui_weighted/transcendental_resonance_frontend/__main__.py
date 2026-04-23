"""Entry point for ``python -m transcendental_resonance_frontend``."""

try:
    from nicegui import ui  # type: ignore
except Exception:  # pragma: no cover - nicegui optional
    ui = None


def run() -> None:
    """Launch the NiceGUI interface."""
    if ui is None:
        print("NiceGUI is required to run the frontend. Please install it via 'pip install nicegui'.")
        return
    ui.label("Loading UI...")
    from .src.main import run_app
    run_app()


if __name__ == "__main__":
    run()
