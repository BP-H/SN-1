# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Simple connectivity indicator for Streamlit apps."""

from __future__ import annotations

import os


import requests
import streamlit as st

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


def check_backend(endpoint: str = "/status") -> bool:
    """Return ``True`` if ``endpoint`` responds successfully."""
    try:
        resp = requests.get(f"{BACKEND_URL}{endpoint}", timeout=5)
        resp.raise_for_status()
    except Exception:
        return False
    return True


def render_status_icon(*, endpoint: str = "/status") -> None:
    """Display a colored dot indicating backend connectivity."""
    ok = check_backend(endpoint)
    color = "green" if ok else "red"
    label = "Online" if ok else "Offline"
    st.markdown(
        f"<span style='color:{color};font-size:1.2rem;'>\u25CF</span> {label}",
        unsafe_allow_html=True,
    )

