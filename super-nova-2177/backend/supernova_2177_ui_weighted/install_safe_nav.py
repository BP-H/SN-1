# install_safe_nav.py
from pathlib import Path
import textwrap

root = Path(".")
ui = root/"ui.py"
router = root/"router.py"

# 1) Drop-in router that loads pages by slug and calls main()/render()/app()
router.write_text(textwrap.dedent("""
    import importlib
    import streamlit as st

    DEFAULT_PAGE = "feed"
    # Map slugs -> module names in pages/
    PAGE_FILES = {
        "feed": "feed",
        "chat": "chat",
        "messages": "messages",
        "profile": "profile",
        "proposals": "proposals",
        "decisions": "decisions",
        "execution": "execution",
    }

    def set_page(slug: str):
        st.session_state["current_page"] = slug

    def render_current():
        slug = st.session_state.get("current_page", DEFAULT_PAGE)
        mod_name = PAGE_FILES.get(slug, slug)
        try:
            mod = importlib.import_module(f"pages.{mod_name}")
        except Exception as e:
            st.error(f"Page '{slug}' not found (pages/{mod_name}.py). {e}")
            return
        for fn in ("main","render","app"):
            if hasattr(mod, fn) and callable(getattr(mod, fn)):
                return getattr(mod, fn)()
        st.warning(f"pages/{mod_name}.py has no main()/render()/app().")
""").strip()+"\n", encoding="utf-8")

# 2) Append a "safe nav" section at the *end* of ui.py so it appears at the bottom of the sidebar
append = textwrap.dedent("""
    # === SAFE NAV (appended) ===
    import os, streamlit as st
    import router as _router

    if "current_page" not in st.session_state:
        st.session_state["current_page"] = "feed"

    # backend toggle status
    use_real = st.session_state.get("use_real_backend", False)
    url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000")

    # bottom-of-sidebar nav (real buttons, full width)
    st.sidebar.divider()
    st.sidebar.markdown("### Quick navigation")
    cols = st.sidebar.columns(2)
    with cols[0]:
        if st.button("🏠 Feed", key="nav_feed_btn"): _router.set_page("feed"); st.rerun()
        if st.button("💬 Chat", key="nav_chat_btn"): _router.set_page("chat"); st.rerun()
        if st.button("📬 Messages", key="nav_messages_btn"): _router.set_page("messages"); st.rerun()
        if st.button("👤 Profile", key="nav_profile_btn"): _router.set_page("profile"); st.rerun()
    with cols[1]:
        if st.button("📄 Proposals", key="nav_proposals_btn"): _router.set_page("proposals"); st.rerun()
        if st.button("✅ Decisions", key="nav_decisions_btn"): _router.set_page("decisions"); st.rerun()
        if st.button("⚙️ Execution", key="nav_execution_btn"): _router.set_page("execution"); st.rerun()

    st.sidebar.caption(f"Backend: {'REAL ' + url if use_real else 'DEMO (fake_api)'}")

    # render the chosen page (safe no-op if already rendered earlier)
    try:
        _router.render_current()
    except Exception as e:
        st.error(f"Render error: {e}")
""").strip()+"\n"

ui.write_text(ui.read_text(encoding="utf-8") + "\n\n" + append, encoding="utf-8")
print("Installed router.py and appended safe bottom-of-sidebar buttons.")
""")

Run it:
```powershell
python .\install_safe_nav.py
