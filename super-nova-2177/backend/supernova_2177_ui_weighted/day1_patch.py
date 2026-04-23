from pathlib import Path
import re, textwrap

ROOT = Path(__file__).resolve().parent

def write(p: Path, s: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8")
    print("wrote", p.relative_to(ROOT))

# --- 1A) Fix legacy st.experimental_rerun -> st.rerun in enter_metaverse ---
em = ROOT / "pages" / "enter_metaverse.py"
if em.exists():
    txt = em.read_text(encoding="utf-8")
    new = txt.replace("st.experimental_rerun()", "st.rerun()")
    if new != txt:
        write(em, new)
    else:
        print("no change", em.relative_to(ROOT))

# --- 1B) Replace pages/profile.py with a safe, self-contained version ---
profile_py = textwrap.dedent("""
    from __future__ import annotations
    import os, inspect
    from typing import Any, Dict
    import streamlit as st

    # Optional import for the fancy card; we fall back to a simple renderer if missing.
    try:
        from frontend.profile_card import render_profile_card  # unknown signature across revisions
    except Exception:
        render_profile_card = None  # type: ignore

    # Optional tiny status icon (avoid crashing if helper module isn't present)
    try:
        from status_indicator import render_status_icon
    except Exception:
        def render_status_icon(status: str = "offline"):
            return "🟢" if status == "online" else "🔴"

    def _render_profile_card_simple(data: Dict[str, Any]) -> None:
        st.markdown(f"### @{data.get('username','guest')}")
        if data.get("avatar_url"):
            st.image(data["avatar_url"], width=96)
        st.write(data.get("bio",""))
        cols = st.columns(2)
        cols[0].metric("Followers", data.get("followers", 0))
        cols[1].metric("Following", data.get("following", 0))

    def _render_profile_card_compat(data: Dict[str, Any]) -> None:
        # If we don't have the fancy card, use the simple one
        if render_profile_card is None:
            return _render_profile_card_simple(data)

        try:
            sig = inspect.signature(render_profile_card)
        except Exception:
            return _render_profile_card_simple(data)

        params = sig.parameters

        # Case A: function takes no params
        if len(params) == 0:
            return render_profile_card()  # type: ignore[misc]

        # Build kwargs dynamically to satisfy various historical signatures
        kwargs: Dict[str, Any] = {}
        # common variants we’ve seen: (data), (*, username, avatar_url)
        if "data" in params:
            # pass positionally if it's positional-only, else as kw
            if list(params.values())[0].kind is inspect.Parameter.POSITIONAL_ONLY:
                return render_profile_card(data)  # type: ignore[misc]
            kwargs["data"] = data
        if "username" in params:
            kwargs["username"] = data.get("username", "guest")
        if "avatar_url" in params:
            kwargs["avatar_url"] = data.get("avatar_url", "")

        try:
            return render_profile_card(**kwargs)  # type: ignore[misc]
        except TypeError:
            # Fall back if we guessed wrong
            return _render_profile_card_simple(data)

    # Demo data if no backend
    def _demo_profile(username: str) -> Dict[str, Any]:
        return {
            "username": username or "guest",
            "avatar_url": "",
            "bio": "Explorer of superNova_2177.",
            "followers": 2315,
            "following": 1523,
            "status": "offline",
        }

    def _get_profile_from_backend(username: str) -> Dict[str, Any]:
        import json, urllib.request
        backend = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")
        url = f"{backend}/profile/{username}"
        with urllib.request.urlopen(url) as r:
            return json.loads(r.read().decode("utf-8"))

    def main():
        st.title("superNova_2177")
        st.toggle("Dark Mode", value=True, key="darkmode", help="visual only")

        # Right-side status
        st.markdown(
            f"<div style='text-align:right'>{render_status_icon('offline')} Offline</div>",
            unsafe_allow_html=True,
        )

        username = st.text_input("Username", value="guest")
        use_backend = os.getenv("USE_REAL_BACKEND") == "1"

        try:
            data = _get_profile_from_backend(username) if use_backend else _demo_profile(username)
        except Exception as exc:
            st.warning(f"Backend unavailable, using demo data. ({exc})")
            data = _demo_profile(username)

        _render_profile_card_compat(data)

    # Streamlit expects this
    def render() -> None:
        main()
""").strip() + "\n"

write(ROOT / "pages" / "profile.py", profile_py)

# --- 2) Minimal FastAPI backend (optional) ---
backend_app = textwrap.dedent("""
    from __future__ import annotations
    from fastapi import FastAPI
    from pydantic import BaseModel

    app = FastAPI(title="superNova_2177 backend", version="0.1")

    class Profile(BaseModel):
        username: str
        avatar_url: str | None = ""
        bio: str | None = "Explorer of superNova_2177."
        followers: int = 2315
        following: int = 1523
        status: str = "online"

    @app.get("/health")
    def health():  # simple ready check
        return {"ok": True}

    @app.get("/profile/{username}", response_model=Profile)
    def profile(username: str) -> Profile:
        # stub: echoes username with canned numbers
        return Profile(username=username)
""").strip() + "\n"

write(ROOT / "backend" / "app.py", backend_app)
write(ROOT / "backend" / "__init__.py", "")
print("Done.")
