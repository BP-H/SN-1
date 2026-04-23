# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Reusable UI components with a modern aesthetic."""

from __future__ import annotations

import importlib
import streamlit as st
from typing import Optional, Dict
from contextlib import contextmanager
from pathlib import Path

try:
    # Prefer the shared path constants if available
    _paths = importlib.import_module("utils.paths")
    ROOT_DIR = _paths.ROOT_DIR
    PAGES_DIR = _paths.PAGES_DIR
    get_pages_dir = _paths.get_pages_dir
except Exception:  # pragma: no cover – fallback for isolated execution
    ROOT_DIR = Path(__file__).resolve().parents[1]  # repo root
    PAGES_DIR = ROOT_DIR / "pages"

    def get_pages_dir() -> Path:
        return PAGES_DIR


from streamlit_helpers import safe_container
from modern_ui import apply_modern_styles

from frontend import theme

try:
    from streamlit_javascript import st_javascript
except Exception:  # pragma: no cover - optional dependency or missing runtime

    def st_javascript(*_args, **_kwargs) -> None:
        """Fallback no-op when ``streamlit_javascript`` is unavailable."""
        return None


HAS_LUCIDE = importlib.util.find_spec("lucide-react") is not None
LUCIDE_LOADED_KEY = "_lucide_js_loaded"

try:
    from streamlit_option_menu import option_menu

    USE_OPTION_MENU = True
except Exception:  # pragma: no cover - optional dependency
    option_menu = None  # type: ignore
    USE_OPTION_MENU = False

# Sidebar styling for lightweight text-based navigation.
# Inject this CSS string with ``st.markdown`` to keep sidebar navigation
# consistent across pages.
SIDEBAR_STYLES = """
<style>
[data-testid="stSidebar"] {
    background: var(--card);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    transition: transform 0.3s ease;
}
[data-testid="stSidebar"].collapsed {
    transform: translateX(-100%);
}
.sidebar-toggle {
    position: fixed;
    top: 0.5rem;
    left: 0.5rem;
    z-index: 1000;
    background: var(--card);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    padding: 0.25rem 0.5rem;
    display: none;
}
@media (max-width: 1024px) {
    .sidebar-toggle { display: block; }
}
.sidebar-nav {
    display: flex;
    flex-direction: column;
    padding: 0;
    margin-bottom: 1rem;
    font-size: 0.9rem;
}
.sidebar-nav.horizontal {
    flex-direction: row;
    align-items: center;
}
.sidebar-nav .nav-item {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-muted);
    transition: background 0.2s ease, color 0.2s ease;
}
.sidebar-nav .nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
}
.sidebar-nav .nav-item.active {
    background: var(--accent);
    color: var(--bg);
}
</style>
"""

# Minimal styling inspired by Shadcn UI
SHADCN_CARD_CSS = """
<style>
.shadcn-card {
    background: var(--card);
    border: 1px solid rgba(0, 0, 0, 0.1);
    border-radius: 0.5rem;
    padding: 1rem;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    margin-bottom: 1rem;
}
.shadcn-card-title {
    font-weight: 600;
    margin-bottom: 0.5rem;
}
</style>
"""


@contextmanager
def shadcn_card(title: Optional[str] = None):
    """Context manager that renders content inside a Shadcn-style card."""
    st.markdown(SHADCN_CARD_CSS, unsafe_allow_html=True)
    st.markdown("<div class='shadcn-card'>", unsafe_allow_html=True)
    if title:
        st.markdown(
            f"<div class='shadcn-card-title'>{title}</div>", unsafe_allow_html=True
        )
    with st.container() as container:
        yield container
    st.markdown("</div>", unsafe_allow_html=True)


def shadcn_tabs(labels: list[str]):
    """Render Streamlit tabs with Shadcn styling."""
    st.markdown(SHADCN_CARD_CSS, unsafe_allow_html=True)
    return st.tabs(labels)


def _icon_html(name: str) -> str:
    """Return HTML for an icon."""
    if not name:
        return ""
    if name.startswith("fa"):
        return f"<i class='{name}'></i>"
    if HAS_LUCIDE:
        return f"<i class='icon' data-lucide='{name}'></i>"
    return name


def render_modern_layout() -> None:
    """Apply global styles and base glassmorphism containers."""
    apply_modern_styles()
    st.markdown(
        """
        <style>
        .glass-card {
            background: rgba(255,255,255,0.3);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.4);
            backdrop-filter: blur(14px);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            padding: 1rem;
            margin-bottom: 1rem;
            transition: box-shadow 0.2s ease, transform 0.2s ease;
        }
        .glass-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


def render_modern_header(title: str) -> None:
    """Display a translucent header."""
    st.markdown(
        f"<div class='glass-card' style='text-align:center'>"
        f"<h2 style='margin:0'>{title}</h2>"
        "</div>",
        unsafe_allow_html=True,
    )


def render_modern_sidebar(
    pages: Dict[str, str],
    container: Optional[st.delta_generator.DeltaGenerator] = None,
    icons: Optional[Dict[str, str]] = None,
    *,
    session_key: str = "sidebar_nav",
    horizontal: bool = False,
) -> str:
    """Render navigation links styled as modern text tabs.

    ``session_key`` determines where the active page is stored in
    ``st.session_state`` so multiple sidebars can coexist without collisions.
    """
    if container is None:
        container = st.sidebar

    # Resolve page paths dynamically from likely locations

    page_dir_candidates = [
        Path.cwd() / "pages",
        ROOT_DIR / "pages",
        Path(__file__).resolve().parent / "pages",
        get_pages_dir(),
    ]

    existing_dirs = [d for d in page_dir_candidates if d.exists()]

    valid_pages: Dict[str, str] = {}

    missing_pages: list[str] = []

    for label, page_ref in pages.items():
        slug = str(page_ref).strip("/").split("?")[0].rsplit(".", 1)[-1]

        exists = any((d / f"{slug}.py").exists() for d in existing_dirs)

        if existing_dirs and not exists:
            missing_pages.append(label)

        # Always include the page so fallback placeholders can render
        valid_pages[label] = page_ref

    if missing_pages:
        msg = "Unknown pages: " + ", ".join(missing_pages)

        if hasattr(st, "warning"):
            st.warning(msg, icon="⚠️")

        else:  # pragma: no cover - used in tests with SimpleNamespace
            print(msg)

    if not valid_pages:
        st.error("No valid pages available", icon="⚠️")

        return ""

    pages = valid_pages

    opts = list(pages.keys())
    if not opts:
        st.error("No valid pages configured", icon="⚠️")
        return ""
    icon_map = icons or {}

    # Default session state for selected page
    st.session_state.setdefault(session_key, opts[0])
    if st.session_state.get(session_key) not in opts:
        msg = f"Unknown page '{st.session_state.get(session_key)}'"
        if hasattr(st, "toast"):
            st.toast(msg, icon="⚠️")
        else:  # pragma: no cover - used in tests with SimpleNamespace
            print(msg)
        st.session_state[session_key] = opts[0]

    widget_key = f"{session_key}_ctrl"
    orientation_cls = "horizontal" if horizontal else "vertical"

    collapsed_key = f"{session_key}_collapsed"
    if hasattr(st, "button") and callable(getattr(st, "button")):
        if collapsed_key not in st.session_state:
            try:
                width = st_javascript("window.innerWidth")
                st.session_state[collapsed_key] = bool(width) and int(width) <= 1024
            except Exception:
                st.session_state[collapsed_key] = False

        if st.button("☰", key=f"{collapsed_key}_btn"):
            st.session_state[collapsed_key] = not st.session_state[collapsed_key]
    else:
        # fallback in case st.button is unavailable (optional)
        st.session_state.get(collapsed_key, False)

    container_ctx = safe_container(container)
    with container_ctx:
        st.markdown(SIDEBAR_STYLES, unsafe_allow_html=True)
        script = (
            "<script>var sb=document.querySelector('[data-testid=\"stSidebar\"]'); "
            f"if(sb) sb.classList.toggle('collapsed', {str(st.session_state.get(collapsed_key, False)).lower()});"  # noqa: E501
            "</script>"
        )
        st.markdown(script, unsafe_allow_html=True)
        st.markdown(
            f"<div class='glass-card sidebar-nav {orientation_cls}'>",
            unsafe_allow_html=True,
        )

        try:
            if USE_OPTION_MENU and option_menu is not None:
                choice = option_menu(
                    menu_title=None,
                    options=opts,
                    icons=[icon_map.get(o, "dot") for o in opts],
                    orientation="horizontal" if horizontal else "vertical",
                    key=widget_key,
                    default_index=opts.index(
                        st.session_state.get(session_key, opts[0])
                    ),
                )
            elif horizontal:
                # Render as horizontal buttons
                columns = container.columns(len(opts))
                for col, label in zip(columns, opts):
                    disp = f"{_icon_html(icon_map.get(label, ''))} {label}".strip()
                    if col.button(disp, key=f"{widget_key}_{label}"):
                        st.session_state[session_key] = label
                choice = st.session_state[session_key]
            else:
                # Vertical fallback (radio or buttons)
                choice_disp = st.radio(
                    "Navigate",
                    [f"{_icon_html(icon_map.get(o, ''))} {o}".strip() for o in opts],
                    key=widget_key,
                    index=opts.index(st.session_state.get(session_key, opts[0])),
                )
                choice = opts[
                    [
                        f"{_icon_html(icon_map.get(o, ''))} {o}".strip() for o in opts
                    ].index(choice_disp)
                ]

        except Exception:
            # Final fallback
            choice = st.session_state.get(session_key, opts[0])

        if st.session_state.get(session_key) != choice:
            st.session_state[session_key] = choice

        st.markdown("</div>", unsafe_allow_html=True)
        if HAS_LUCIDE:
            if not st.session_state.get(LUCIDE_LOADED_KEY):
                st.markdown(
                    "<script src='https://unpkg.com/lucide@latest'></script>",
                    unsafe_allow_html=True,
                )
                st.session_state[LUCIDE_LOADED_KEY] = True
            st.markdown(
                "<script>lucide.createIcons();</script>", unsafe_allow_html=True
            )
        return choice


def render_validation_card(entry: dict) -> None:
    """Display a single validation entry."""
    validator = entry.get("validator") or entry.get("validator_id", "N/A")
    target = entry.get("target", entry.get("subject", "N/A"))
    score = entry.get("score", "N/A")
    st.markdown(
        f"""
        <div class='glass-card'>
            <strong>{validator}</strong> → <em>{target}</em><br>
            <span>Score: {score}</span>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_post_card(entry: dict) -> None:
    """Render a simple content card using ``.sn-card`` styles."""
    user = entry.get("user") or entry.get("validator") or entry.get("author", "")
    content = entry.get("text") or entry.get("content")
    if content is None:
        target = entry.get("target") or entry.get("subject")
        score = entry.get("score")
        content = f"<strong>{user}</strong> → <em>{target}</em>" + (
            f"<br>Score: {score}" if score is not None else ""
        )
    st.markdown(
        f"<div class='sn-card' style='background:white;padding:1rem;margin-bottom:1rem;'>{content}</div>",  # noqa: E501
        unsafe_allow_html=True,
    )


def render_stats_section(stats: dict) -> None:
    """Display quick stats using a responsive flexbox layout."""
    try:
        accent = theme.get_accent_color()
    except Exception:
        accent = theme.LIGHT_THEME.accent  # Safe fallback to known value

    try:
        st.markdown(
            f"""
            <style>
            .stats-container {{
                display: flex;
                flex-wrap: wrap;
                gap: 1rem;
                justify-content: space-between;
            }}
            .stats-card {{
                flex: 1 1 calc(25% - 1rem);
                min-width: 120px;
                background: rgba(255, 255, 255, 0.03);
                backdrop-filter: blur(15px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 1.5rem;
                text-align: center;
                transition: transform 0.3s ease;
            }}
            .stats-card:hover {{
                transform: scale(1.02);
            }}
            .stats-value {{
                color: {accent};
                font-size: calc(1.5rem + 0.3vw);
                font-weight: 700;
                margin-bottom: 0.25rem;
            }}
            .stats-label {{
                color: var(--text-muted);
                font-size: calc(0.8rem + 0.2vw);
                font-weight: 500;
            }}
            @media (max-width: 768px) {{
                .stats-card {{
                    flex: 1 1 calc(50% - 1rem);
                }}
            }}
            @media (max-width: 480px) {{
                .stats-card {{
                    flex: 1 1 100%;
                }}
            }}
            </style>
            """,
            unsafe_allow_html=True,
        )

        entries = [
            ("🏃‍♂️", "Runs", stats.get("runs", 0)),
            ("📝", "Proposals", stats.get("proposals", "N/A")),
            ("⚡", "Success Rate", stats.get("success_rate", "N/A")),
            ("🎯", "Accuracy", stats.get("accuracy", "N/A")),
        ]

        st.markdown("<div class='stats-container'>", unsafe_allow_html=True)
        for icon, label, value in entries:
            st.markdown(
                f"""
                <div class='stats-card'>
                    <div style='font-size:2rem;margin-bottom:0.5rem;'>{icon}</div>
                    <div class='stats-value'>{value}</div>
                    <div class='stats-label'>{label}</div>
                </div>
                """,
                unsafe_allow_html=True,
            )
        st.markdown("</div>", unsafe_allow_html=True)
    except Exception:
        return


__all__ = [
    "SIDEBAR_STYLES",
    "SHADCN_CARD_CSS",
    "shadcn_card",
    "shadcn_tabs",
    "render_modern_layout",
    "render_modern_header",
    "render_modern_sidebar",
    "render_validation_card",
    "render_post_card",
    "render_stats_section",
]
