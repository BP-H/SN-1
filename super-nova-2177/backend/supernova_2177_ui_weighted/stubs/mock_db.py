"""Simplified in-memory database stand-ins used during testing."""

from __future__ import annotations

from datetime import datetime
import streamlit as st


class MockHarmonizer:
    """Lightweight Harmonizer replacement."""

    def __init__(self, id: int = 1, username: str = "demo") -> None:
        self.id = id
        self.username = username


class UniverseBranch:
    class timestamp:
        @staticmethod
        def desc() -> None:
            return None

    def __init__(self, id: str, status: str, timestamp: datetime) -> None:
        self.id = id
        self.status = status
        self.timestamp = timestamp


class MockQuery(list):
    def __init__(self, data: list | None = None) -> None:
        super().__init__(data or [])

    def order_by(self, *_a, **_k) -> "MockQuery":
        return self

    def limit(self, *_a, **_k) -> "MockQuery":
        return self

    def all(self) -> list:
        return list(self)

    def first(self):
        return self[0] if self else None


class MockSessionLocal:
    def __enter__(self) -> "MockSessionLocal":
        return self

    def __exit__(self, *_exc) -> None:
        pass

    def query(self, model):
        data = []
        if model is MockHarmonizer:
            data = st.session_state.get("mock_data", {}).get("harmonizers", [])
        elif model is UniverseBranch:
            data = st.session_state.get("mock_data", {}).get("universe_branches", [])
        return MockQuery(data)


# Aliases mirroring the real models
Harmonizer = MockHarmonizer
SessionLocal = MockSessionLocal


# Initialize default session state data if needed
if "mock_data" not in st.session_state:
    st.session_state["mock_data"] = {
        "harmonizers": [MockHarmonizer()],
        "universe_branches": [UniverseBranch("1", "active", datetime.utcnow())],
    }
