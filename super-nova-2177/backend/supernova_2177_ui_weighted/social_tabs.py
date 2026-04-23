# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
import asyncio
import streamlit as st
from frontend.theme import set_theme
from streamlit_helpers import (
    alert,
    safe_container,
    header,
    get_active_user,
    ensure_active_user,
)



def safe_markdown(text: str, **kwargs) -> None:
    """Render text as Markdown, stripping invalid characters."""
    clean = text.encode("utf-8", errors="ignore").decode("utf-8")
    st.markdown(clean, **kwargs)

try:
    from frontend_bridge import dispatch_route
except Exception:  # pragma: no cover - optional dependency
    dispatch_route = None  # type: ignore

try:
    from db_models import (
        SessionLocal,
        Harmonizer,
        init_db,
        seed_default_users,
    )
except Exception:  # pragma: no cover - optional
    SessionLocal = None  # type: ignore
    Harmonizer = None  # type: ignore

    def init_db() -> None:  # type: ignore
        pass

    def seed_default_users() -> None:  # type: ignore
        pass

ensure_active_user()


def _run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
        return loop.run_until_complete(coro)


def _load_profile(username: str) -> tuple[dict, dict, dict]:
    """Helper to fetch profile data via routes."""
    if SessionLocal is None or Harmonizer is None or dispatch_route is None:
        raise RuntimeError("Social features unavailable")
    with SessionLocal() as db:
        user = _run_async(dispatch_route("get_user", {"username": username}, db=db))
        followers = _run_async(
            dispatch_route("get_followers", {"username": username}, db=db)
        )
        following = _run_async(
            dispatch_route("get_following", {"username": username}, db=db)
        )
    return user, followers, following


set_theme("light")



def render_social_tab(main_container=None) -> None:
    """Render basic social interactions."""
    if main_container is None:
        main_container = st

    current_user = get_active_user()
    container_ctx = safe_container(main_container)
    with container_ctx:
        header("Friends & Followers")


        if dispatch_route is None or SessionLocal is None or Harmonizer is None:
            st.info("Social routes not available")
            return

        cols = st.columns(2)
        with cols[0]:
            current_user = st.text_input(
                "Current User",
                value=current_user,
                key="active_user",
                placeholder="Username",
            )
        with cols[1]:
            target = st.text_input(
                "Target Username",
                key="target_username",
                placeholder="Friend to follow",
            )

        if st.button("Follow/Unfollow", use_container_width=True) and target and current_user:
            with SessionLocal() as db:
                user_obj = db.query(Harmonizer).filter(Harmonizer.username == current_user).first()
                if not user_obj:
                    st.error("Active user not found in DB")
                else:
                    with st.spinner("Working on it..."):
                        try:
                            result = _run_async(
                                dispatch_route(
                                    "follow_user",
                                    {"username": target},
                                    db=db,
                                    current_user=user_obj,
                                )
                            )
                            if st.session_state.get("beta_mode"):
                                st.json(result)
                            st.toast("Success!")
                        except Exception as exc:  # pragma: no cover - UI feedback only
                            alert(f"Operation failed: {exc}", "error")

        st.divider()
        if current_user:
            try:
                user, followers, following = _load_profile(current_user)
            except Exception as exc:
                alert(f"Profile fetch failed: {exc}", "error")
                return
            safe_markdown(f"### Profile: {user.get('username', current_user)}")
            st.write(user.get("bio", ""))
            st.markdown("**Followers**")
            st.write(followers.get("followers", []))
            st.markdown("**Following**")
            st.write(following.get("following", []))
