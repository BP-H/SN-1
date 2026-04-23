# ui.py
# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Main Streamlit UI entry point for supernNova_2177."""
import sys

from typing import Dict
try:
    from utils.paths import PAGES_DIR
    from utils.page_registry import ensure_pages, sync_external_into_pages
except Exception as _exc:
    from pathlib import Path as _P
    PAGES_DIR = (_P(__file__).resolve().parent / 'pages')
from pathlib import Path
import os
import argparse
import streamlit as st
import importlib.util
import numpy as np  # For random low stats
import warnings
from ui_adapters import follow_adapter, search_users_adapter, ERROR_MESSAGE
from signup_adapter import register_user

# Suppress potential deprecation warnings
warnings.filterwarnings("ignore", category=UserWarning)

# ---------------------------------------------------------------------------
# Backend toggle
# ---------------------------------------------------------------------------
_USE_REAL_BACKEND = False
_backend_module = None


def _init_backend_toggle() -> None:
    """Initialize backend usage from env vars or CLI flags."""
    global _USE_REAL_BACKEND, _backend_module

    env_flag = os.getenv("USE_REAL_BACKEND", "0").lower() in {"1", "true", "yes"}
    cli_flags = {"--real-backend", "--use-real-backend"}
    cli_flag = any(flag in sys.argv for flag in cli_flags)
    if cli_flag:
        sys.argv = [arg for arg in sys.argv if arg not in cli_flags]

    _USE_REAL_BACKEND = env_flag or cli_flag
    if _USE_REAL_BACKEND:
        try:
            import superNova_2177 as _backend_module  # noqa: F401
        except Exception as e:  # pragma: no cover - import failure path
            warnings.warn(f"Real backend requested but not available: {e}")
            _USE_REAL_BACKEND = False
            _backend_module = None


def use_backend() -> bool:
    """Return True when the real backend should be used."""
    return _USE_REAL_BACKEND


_init_backend_toggle()

# Path for Cloud/local
sys.path.insert(0, str(Path(__file__).parent / "mount/src")) if Path(
    __file__
).parent.joinpath("mount/src").exists() else sys.path.insert(
    0, str(Path(__file__).parent)
)

# Imports
try:
    from streamlit_helpers import (
        alert,
        header,
        theme_selector,
        safe_container,
        shared_header,
        shared_footer,
    )
    from frontend.theme import initialize_theme
except ImportError as e:
    # Use fallback functions instead of stopping
    def alert(text):
        st.info(text)

    def header(text):
        st.header(text)

    def theme_selector():
        st.selectbox("Theme", ["dark"], key="theme")

    def safe_container():
        return st.container()

    def shared_header(title="superNova_2177"):
        st.header(title)

    def shared_footer(text="© 2024 superNova_2177"):
        st.caption(text)

    def initialize_theme(theme):
        pass

    st.warning(f"Helpers import failed: {e}, using fallbacks.")


def _determine_backend(argv=None, env=None) -> bool:
    """Return True if the real backend should be used.

    CLI flags take precedence over environment variables. Supported
    environment variable values are case-insensitive variants of
    ``1/true/yes/on`` and ``0/false/no/off``.
    """

    if argv is None:
        argv = sys.argv[1:]
    if env is None:
        env = os.environ

    parser = argparse.ArgumentParser(add_help=False)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--use-backend", dest="use_backend", action="store_true")
    group.add_argument("--no-backend", dest="use_backend", action="store_false")
    parser.set_defaults(use_backend=None)
    args, _ = parser.parse_known_args(argv)

    if args.use_backend is not None:
        return args.use_backend

    env_val = env.get("USE_REAL_BACKEND")
    if env_val is not None:
        lowered = env_val.strip().lower()
        if lowered in {"1", "true", "yes", "on"}:
            return True
        if lowered in {"0", "false", "no", "off"}:
            return False

    return False


_USE_REAL_BACKEND = _determine_backend()


def use_real_backend() -> bool:
    """Return whether the UI should connect to the real backend."""
    return st.session_state.get("use_real_backend", _USE_REAL_BACKEND)


def load_page(page_name: str):
    base_paths = [
        Path("mount/src/pages"),
        Path(__file__).parent / "pages",
        Path(__file__).parent / "transcendental_resonance_frontend/tr_pages",
    ]
    module_path = None
    for base in base_paths:
        candidate = base / f"{page_name}.py"
        if candidate.exists():
            module_path = candidate
            break

    if not module_path:
        st.info(f"Page '{page_name}' is coming soon! Stay tuned for updates.")
        return

    try:
        spec = importlib.util.spec_from_file_location(page_name, module_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        if hasattr(module, "main"):
            module.main()
        elif hasattr(module, "render"):
            module.render()
        else:
            st.warning(f"No main/render in {page_name}.py - showing placeholder.")
            st.write(
                f"Placeholder for {page_name.capitalize()} "
                f"(add main() to {page_name}.py)"
            )
    except Exception as e:
        st.error(f"Error loading {page_name}: {e}")
        st.exception(e)


def build_pages(pages_dir: Path) -> dict[str, str]:
    """Return a mapping of page labels to slugs."""
    pages = {}
    for path in pages_dir.glob("*.py"):
        slug = path.stem
        label = slug.replace("_", " ").title()
        pages[label] = slug
    return pages


# Preload available pages for navigation and tests
PAGES = build_pages(Path(__file__).parent / "pages")


def load_page_with_fallback(choice: str, module_paths: list[str] | None = None) -> None:
    """Placeholder for legacy fallback loader."""
    pass


def _render_fallback(choice: str) -> None:
    """Fallback renderer stub used in tests."""
    pass


def show_preview_badge(text: str) -> None:
    """Display a simple preview badge."""
    st.write(text)


# Main - Dark theme with subtle pink polish, FIXED STICKY LAYOUT


def _bootstrap_pages() -> None:
    PAGES: Dict[str, str] = {}
    try:
        ensure_pages(PAGES)
        sync_external_into_pages(verbose=False)
    except Exception as exc:
        try:
            import streamlit as st
            st.sidebar.error(f'page registry issue: {exc}')
        except Exception:
            print('page registry issue:', exc)
def main() -> None:
    global _USE_REAL_BACKEND
    st.set_page_config(
        page_title="supernNova_2177", layout="wide", initial_sidebar_state="expanded"
    )
    st.session_state.setdefault("theme", "dark")
    st.session_state.setdefault("conversations", {})  # Fix NoneType
    st.session_state.setdefault("current_page", "feed")  # Default page
    st.session_state.setdefault("use_real_backend", _USE_REAL_BACKEND)
    initialize_theme(st.session_state["theme"])

    # Fixed CSS
    st.markdown(
        """
    <style>
        header[data-testid="stHeader"] {
            position: sticky !important;
            top: 0 !important;
            z-index: 100 !important;
        }
        [data-testid="stSidebarNav"] { display: none !important; }
        [data-testid="stSidebar"] {
            position: sticky !important;
            top: 0 !important;
            height: 100vh !important;
            overflow-y: auto !important;
            background-color: #18181b !important;
            color: white !important;
            border-radius: 10px;
            padding: 0px;
            margin: 0px;
            width: 190px;
            z-index: 2147483647 !important;
        }
        [data-testid="stSidebar"] .stMarkdown,
        [data-testid="stSidebar"] .stButton,
        [data-testid="stSidebar"] .stSelectbox,
        [data-testid="stSidebar"] > div {
            text-align: left !important;
        }
        [data-testid="stSidebar"] button {
            background-color: #18181b !important;
            color: white !important;
            padding: 2px 5px !important;
            margin: 3px 0 !important;
            width: 100% !important;
            height: 30px !important;
            border: none !important;
            border-radius: 8px !important;
            font-size: 14px !important;
            display: flex !important;
            justify-content: flex-start !important;
            align-items: center !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        [data-testid="stSidebar"] button:hover,
        [data-testid="stSidebar"] button:focus {
            background-color: #2a2a2e !important;
            box-shadow: 0 0 5px rgba(255, 255, 255, 0.3) !important;
            outline: none !important;
        }
        [data-testid="stSidebar"] button[kind="secondary"]
        :has(span:contains("supernNova")) {
            font-size: 28px !important;
            font-weight: bold !important;
            justify-content: center !important;
            padding: 15px 0px !important;
            margin-bottom: 15px !important;
            height: auto !important;
        }
        [data-testid="stSidebar"] button[kind="secondary"]
        :has(span:contains("supernNova")):hover {
            box-shadow: none !important;
        }
        .stApp {
            background-color: #0a0a0a !important;
            color: white !important;
        }
        .main .block-container {
            padding-top: 20px !important;
            padding-bottom: 90px !important;
        }
        .content-card {
            border: 1px solid #333;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            transition: border 0.2s;
            color: white !important;
        }
        .content-card:hover {
            border: 1px solid #ff1493;
        }
        [data-testid="stMetricLabel"] { color: white !important; }
        [data-testid="stMetricValue"] { color: white !important; }
        [data-testid="stSidebar"] img {
            border-radius: 50% !important;
            margin: 0 auto !important;
            display: block !important;
        }
        [data-testid="stTextInput"] > div {
            background-color: #28282b !important;
            border-radius: 9px !important;
            border: none !important;
        }
        [data-testid="stTextInput"] input {
            background-color: transparent !important;
            color: white !important;
            padding-left: 10px;
        }
        @media (max-width: 768px) {
            [data-testid="stSidebar"] button {
                height: 35px !important;
                font-size: 12px !important;
            }
        }
    </style>
    """,
        unsafe_allow_html=True,
    )

    # Sidebar
    with st.sidebar:
        # --- workflow buttons ---
        if st.button("📄 Proposals", key="nav_proposals_sidebar"):
            st.session_state.current_page = "proposals"
            st.rerun()
        if st.button("✅ Decisions", key="nav_decisions_sidebar"):
            st.session_state.current_page = "decisions"
            st.rerun()
        if st.button("⚙️ Execution", key="nav_execution_sidebar"):
            st.session_state.current_page = "execution"
            st.rerun()

        # --- failsafe menu (works even if buttons fail) ---
        labels = ['Feed','Chat','Messages','Profile','Proposals','Decisions','Execution']
        slugs  = ['feed','chat','messages','profile','proposals','decisions','execution']
        current = st.session_state.get('current_page','feed')
        try: idx = slugs.index(current)
        except ValueError: idx = 0
        choice = st.radio('Go to page:', labels, index=idx, key='nav_radio')
        st.session_state.current_page = slugs[labels.index(choice)]
        # --- workflow buttons ---
        if st.button("📄 Proposals", key="nav_proposals_sidebar"):
            st.session_state.current_page = "proposals"
            st.rerun()
        if st.button("✅ Decisions", key="nav_decisions_sidebar"):
            st.session_state.current_page = "decisions"
            st.rerun()
        if st.button("⚙️ Execution", key="nav_execution_sidebar"):
            st.session_state.current_page = "execution"
            st.rerun()

        # --- failsafe menu (works even if buttons fail) ---
        labels = ['Feed','Chat','Messages','Profile','Proposals','Decisions','Execution']
        slugs  = ['feed','chat','messages','profile','proposals','decisions','execution']
        current = st.session_state.get('current_page','feed')
        try: idx = slugs.index(current)
        except ValueError: idx = 0
        choice = st.radio('Go to page:', labels, index=idx, key='nav_radio')
        st.session_state.current_page = slugs[labels.index(choice)]
        if st.button("💫 superNova_2177 💫", use_container_width=True):
            st.session_state.search_bar = ""
            st.session_state.current_page = "feed"
            st.rerun()

        st.text_input(
            "Search",
            key="search_bar",
            placeholder="🔍 Search posts, people...",
            label_visibility="collapsed",
        )

        use_backend = st.toggle("Use real backend", value=use_real_backend())
        _USE_REAL_BACKEND = use_backend
        os.environ["USE_REAL_BACKEND"] = "1" if use_backend else "0"
        st.session_state.use_real_backend = use_backend

        st.image("assets/profile_pic.png", width=100)
        st.subheader("taha_gungor")
        st.caption("ceo / test_tech")
        st.caption("artist / will = ...")
        st.caption("New York, New York, United States")
        st.caption("test_tech")
        st.divider()
        st.metric("Profile viewers", np.random.randint(2000, 2500))
        st.metric("Post impressions", np.random.randint(1400, 1600))
        st.divider()

        if st.button("🏠 Test Tech", key="manage_test_tech"):
            st.session_state.current_page = "test_tech"
            st.rerun()
        if st.button("✨ supernNova_2177", key="manage_supernova"):
            st.session_state.current_page = "supernova_2177"
            st.rerun()
        if st.button("🌍 GLOBALRUNWAY", key="manage_globalrunway"):
            st.session_state.current_page = "globalrunway"
            st.rerun()
        if st.button("🖼️ Show all >", key="manage_showall"):
            st.write("All pages (placeholder list).")
        st.divider()

        if st.button("📰 Feed", key="nav_feed"):
            st.session_state.current_page = "feed"
            st.rerun()
        if st.button("💬 Chat", key="nav_chat"):
            st.session_state.current_page = "chat"
            st.rerun()
        if st.button("📬 Messages", key="nav_messages"):
            st.session_state.current_page = "messages"
            st.rerun()
if __name__ == "__main__":
    main()
if st.button("🗳 Voting", key="nav_voting"):
    st.session_state.current_page = "voting"
    st.rerun()
if st.button("📄 Proposals", key="nav_proposals"):
    st.session_state.current_page = "proposals"
    st.rerun()
if st.button("✅ Decisions", key="nav_decisions"):
    st.session_state.current_page = "decisions"
    st.rerun()
if st.button("⚙️ Execution", key="nav_execution"):
    st.session_state.current_page = "execution"
    st.rerun()