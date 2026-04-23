# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
import streamlit as st
from ui_utils import render_modern_layout
from db_models import init_db, seed_default_users, ProposalVote
from sqlalchemy.orm import Session
try:
    from streamlit_javascript import st_javascript
except Exception:  # pragma: no cover - optional dependency
    def st_javascript(*_a, **_k):
        return ""
import jwt
from superNova_2177 import get_settings


def check_session() -> bool:
    """Return ``True`` if a valid session cookie is present."""
    cookies = st_javascript("document.cookie") or ""
    if not cookies:
        return True
    token = None
    for part in cookies.split(";"):
        if part.strip().startswith("session="):
            token = part.split("=", 1)[1]
    if not token:
        return False
    settings = get_settings()
    try:
        jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return True
    except Exception:
        return False


def get_proposal_votes(session: Session):
    """Fetch votes from the proposal_votes_records table."""
    return session.query(ProposalVote).all()


def main() -> None:
    """Launch the Streamlit UI after ensuring the database is ready."""
    init_db()
    seed_default_users()
    if not check_session():
        st.warning("Please log in to continue.")
        return
    render_modern_layout()


if __name__ == "__main__":
    main()
