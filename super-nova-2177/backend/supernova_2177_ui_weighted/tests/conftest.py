# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

"""Pytest configuration for optional UI dependencies."""

import importlib.util
import pytest

try:
    HAS_STREAMLIT = importlib.util.find_spec("streamlit") is not None
except (ValueError, ImportError):
    HAS_STREAMLIT = False

try:
    HAS_NICEGUI = importlib.util.find_spec("nicegui") is not None
except (ValueError, ImportError):
    HAS_NICEGUI = False



def pytest_configure(config: pytest.Config) -> None:
    config.addinivalue_line(
        "markers",
        "requires_streamlit: mark test to require the streamlit package",
    )
    config.addinivalue_line(
        "markers",
        "requires_nicegui: mark test to require the nicegui package",
    )


def pytest_runtest_setup(item: pytest.Item) -> None:
    if item.get_closest_marker("requires_streamlit") and not HAS_STREAMLIT:
        pytest.skip("streamlit not installed")
    if item.get_closest_marker("requires_nicegui") and not HAS_NICEGUI:
        pytest.skip("nicegui not installed")


@pytest.fixture(autouse=True)
def _streamlit_poll(monkeypatch: pytest.MonkeyPatch) -> None:
    """Force fast file watching and disable external network calls."""
    monkeypatch.setenv("STREAMLIT_WATCHER_TYPE", "poll")


@pytest.fixture(autouse=True)
def _disable_network(monkeypatch: pytest.MonkeyPatch) -> None:
    """Prevent outgoing network connections except to localhost."""
    import socket

    real_create_connection = socket.create_connection

    def guard(address, *args, **kwargs):
        host = address[0]
        if host not in {"127.0.0.1", "localhost"}:
            raise RuntimeError("External network connections disabled during tests")
        return real_create_connection(address, *args, **kwargs)

    monkeypatch.setattr(socket, "create_connection", guard)
    yield
    monkeypatch.setattr(socket, "create_connection", real_create_connection)

