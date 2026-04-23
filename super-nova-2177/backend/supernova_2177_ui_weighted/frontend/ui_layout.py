# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
# ruff: noqa
"""Central UI-layout helpers.

Key helpers
-----------
main_container()            â€“ main page container
sidebar_container()         â€“ Streamlit sidebar wrapper
render_top_bar()            â€“ sticky translucent navbar
                             (logo Â· search Â· bell Â· beta Â· avatar)
render_sidebar_nav(...)     â€“ vertical nav
                             (option-menu or radio fallback)
render_title_bar(icon,txt)  â€“ page H1 with emoji / icon
show_preview_badge(text)    â€“ floating â€œPreviewâ€ badge
render_profile_card(user)   â€“ proxy around profile_card.render_profile_card
"""

from __future__ import annotations

import importlib
import os
from pathlib import Path
from typing import Dict, Iterable, Optional
from uuid import uuid4

import streamlit as st
from modern_ui_components import SIDEBAR_STYLES
from profile_card import render_profile_card as _render_profile_card
from frontend import theme

try:
    from streamlit_javascript import st_javascript
except Exception:  # pragma: no cover - optional dependency

    def st_javascript(*_a, **_kw):
        return None


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# CONSTANTS & GLOBAL CSS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
_EMOJI_FALLBACK = "ðŸ”–"

# Slide-in drawer & mobile bottom tabs
DRAWER_CSS = """
<style>
[data-testid='stSidebar'] {
  background: var(--card);
  border-right: 1px solid rgba(255,255,255,0.1);
  transition: transform 0.3s ease;
  z-index: 1002;
}
[data-testid='stSidebar'].collapsed {
  transform: translateX(-100%);
}
@media(min-width:768px) {
  [data-testid='stSidebar'] {
    transform: none !important;
  }
}
#drawer_btn {
  display: none;
  background: none;
  border: none;
  color: var(--accent);
  font-size: 1.3rem;
  cursor: pointer;
}
@media(max-width:768px) {
  #drawer_btn {
    display: block;
  }
}
</style>
"""


BOTTOM_TAB_TEMPLATE = """
<style>
.sn-bottom-tabs{
  position: {position};
  bottom: 0;
  left: 0;
  right: 0;
  display: none;
  background: var(--card);
  border-top: 1px solid rgba(255,255,255,0.1);
  z-index: 1001;
}
.sn-bottom-tabs a{
  flex: 1;
  text-align: center;
  padding: .4rem 0;
  color: var(--text-muted);
  text-decoration: none;
}


.sn-bottom-tabs a i{font-size:1.2rem;}
.sn-bottom-tabs a.active{color:{accent};}
@media(max-width:768px){
  .sn-bottom-tabs{display:flex;align-items:center;justify-content:space-around;}
}
@media(min-width:768px){.sn-bottom-tabs{display:none!important;}}
</style>
<div class='sn-bottom-tabs'>
  <a href='#' data-tag='home'><i class='fa-solid fa-house'></i></a>
  <a href='#' data-tag='video'><i class='fa-solid fa-video'></i></a>
  <a href='#' data-tag='network'><i class='fa-solid fa-user-group'></i></a>
  <a href='#' data-tag='notifications'><i class='fa-solid fa-bell'></i></a>
  <a href='#' data-tag='jobs'><i class='fa-solid fa-briefcase'></i></a>
</div>
<script>
  var active='{active}';
  document.querySelectorAll('.sn-bottom-tabs a').forEach(a=>{
    if(a.dataset.tag===active){a.classList.add('active');}
  });
</script>
"""

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€  repo paths (fallback if utils.paths missing)
try:
    _paths = importlib.import_module("utils.paths")
    ROOT_DIR: Path = _paths.ROOT_DIR
    PAGES_DIR: Path = _paths.PAGES_DIR
except Exception:  # pragma: no cover
    ROOT_DIR = Path(__file__).resolve().parents[1]
    PAGES_DIR = ROOT_DIR / "pages"

# optional pretty-sidebar package
try:
    from streamlit_option_menu import option_menu

    USE_OPTION_MENU = True
except ImportError:  # pragma: no cover
    USE_OPTION_MENU = False


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# BASIC CONTAINERS
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
def main_container() -> st.delta_generator.DeltaGenerator:
    """Main content container (injects base CSS once)."""
    theme.inject_modern_styles()
    return st.container()


def sidebar_container() -> st.delta_generator.DeltaGenerator:
    """Sidebar wrapper implementing a slide-in drawer."""
    if "_drawer_css" not in st.session_state:
        st.markdown(DRAWER_CSS, unsafe_allow_html=True)
        st.session_state["_drawer_css"] = True
    st.markdown(
        """
        <script>
        const toggle=window.parent.document.getElementById('drawer_toggle');
        const sb=document.querySelector('[data-testid="stSidebar"]');
        function syncDrawer(){
            if(!sb) return;
            const open = toggle? toggle.checked : window.innerWidth>=768;
            sb.classList.toggle('collapsed', !open);
            if(toggle) localStorage.setItem('drawer_open', open);
        }
        syncDrawer();
        toggle?.addEventListener('change', syncDrawer);
        window.addEventListener('resize', syncDrawer);
        </script>
        """,
        unsafe_allow_html=True,
    )
    return st.sidebar


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# PROFILE CARD PROXY
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
def render_profile_card(username: str, avatar_url: str) -> None:
    """Call *profile_card.render_profile_card* with the current Streamlit ctx."""
    import profile_card as _pc

    original_st = _pc.st
    _pc.st = st
    try:
        _render_profile_card(username, avatar_url)
    finally:
        _pc.st = original_st


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# TOP BAR (mobile-friendly)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
def render_top_bar() -> None:
    if "PYTEST_CURRENT_TEST" in os.environ:  # unit-test stub safety
        return

    # Determine initial drawer state using localStorage and viewport width
    if "_drawer_open" not in st.session_state:
        stored = None
        try:
            stored = st_javascript("window.localStorage.getItem('drawer_open')")
        except Exception:
            stored = None
        if isinstance(stored, str) and stored:
            st.session_state["_drawer_open"] = stored.lower() == "true"
        else:
            try:
                width = st_javascript("window.innerWidth")
                st.session_state["_drawer_open"] = bool(width) and int(width) >= 768
            except Exception:
                st.session_state["_drawer_open"] = True

    # inject styles & FA icons once
    st.markdown(
        """
<link rel="stylesheet"
      href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
.sn-topbar{
  position:sticky;top:0;inset-inline:0;z-index:1001;
  display:flex;align-items:center;gap:.75rem;
  padding:.6rem 1rem;backdrop-filter:blur(10px);
  background:var(--card);
}
@media(max-width:600px){.sn-topbar{flex-wrap:wrap}}
.sn-topbar input[type='text']{
  flex:1;padding:.45rem .7rem;border-radius:8px;
  border:1px solid var(--card);min-width:140px;
  background:var(--bg);font-size:.9rem;
}
#drawer_btn{background:none;border:none;color:var(--accent);font-size:1.3rem;cursor:pointer;display:none}
@media(max-width:768px){#drawer_btn{display:block}}
.sn-bell{position:relative;background:none;border:none;font-size:1.3rem;color:var(--accent);cursor:pointer}
.sn-bell::before{font-family:"Font Awesome 6 Free";font-weight:900;content:"\\f0f3"}
.sn-bell[data-count]::after{
  content:attr(data-count);position:absolute;top:-.35rem;right:-.45rem;
  background:var(--accent);color:var(--bg);border-radius:999px;padding:0 .33rem;
  font-size:.62rem;line-height:1;
}
</style>
<div class="sn-topbar">
""",
        unsafe_allow_html=True,
    )

    # layout: menu | logo | search | bell | beta | avatar
    cols = st.columns([1, 1, 4, 1, 2, 1])
    if len(cols) < 6:  # mocked st.columns
        st.markdown("</div>", unsafe_allow_html=True)
        return
    menu_col, logo_col, search_col, bell_col, beta_col, avatar_col = cols

    checked = "checked" if st.session_state.get("_drawer_open", True) else ""
    drawer_html = f"""
        <input type='checkbox' id='drawer_toggle' {checked} hidden>
        <label for='drawer_toggle' id='drawer_btn'>â˜°</label>
        <script>
          const dt=document.getElementById('drawer_toggle');
          const saved = localStorage.getItem('drawer_open');
          if(dt && saved !== null) dt.checked = saved === 'true';
          function storeDrawer(){{
            if(dt) localStorage.setItem('drawer_open', dt.checked);
          }}
          dt?.addEventListener('change', storeDrawer);
        </script>
    """
    menu_col.markdown(drawer_html, unsafe_allow_html=True)

    logo_col.markdown(
        '<i class="fa-solid fa-rocket fa-lg"></i>', unsafe_allow_html=True
    )

    # search box with suggestions
    pid = st.session_state.get("active_page", "global")
    q_key = f"{pid}_search"
    q = search_col.text_input(
        "Search", placeholder="Searchâ€¦", key=q_key, label_visibility="hidden"
    )
    if q:
        recent = st.session_state.setdefault("_recent_q", [])
        if q not in recent:
            recent.append(q)
            st.session_state["_recent_q"] = recent[-6:]

    if sugs := st.session_state.get("_recent_q"):
        options = "".join(f"<option value='{s}'></option>" for s in sugs)
        data_list = f"<datalist id='recent-sugs'>{options}</datalist>"
        script = (
            "<script>window.parent.document.querySelector("
            "'.sn-topbar input[type=text]')?.setAttribute('list','recent-sugs');"
            "</script>"
        )
        search_col.markdown(data_list + script, unsafe_allow_html=True)

    # notifications bell
    n_notes = len(st.session_state.get("notifications", []))
    bell_html = (
        f'<button class="sn-bell" data-count="{n_notes or ""}" '
        'aria-label="Notifications"></button>'
    )
    bell_col.markdown(bell_html, unsafe_allow_html=True)
    with bell_col.popover("Notifications"):
        if n_notes:
            for note in st.session_state["notifications"]:
                st.write(note)
        else:
            st.write("No notifications")

    # beta toggle
    beta = beta_col.toggle("Beta", value=st.session_state.get("beta_mode", False))
    st.session_state["beta_mode"] = beta
    try:
        st.query_params["beta"] = "1" if beta else "0"
    except Exception:
        pass

    # avatar placeholder
    avatar_col.markdown(
        '<i class="fa-regular fa-circle-user fa-lg"></i>', unsafe_allow_html=True
    )

    # close .sn-topbar
    st.markdown("</div>", unsafe_allow_html=True)

    render_bottom_tab_bar()


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SIDEBAR NAV
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
def _render_sidebar_nav(
    page_links: Iterable[str] | Dict[str, str],
    icons: Optional[Iterable[str]] = None,
    *,
    key: Optional[str] = None,
    default: Optional[str] = None,
    session_key: str = "active_page",
) -> str:
    """Vertical sidebar nav; returns the *label* of the chosen page."""
    raw_pairs = (
        list(page_links.items())
        if isinstance(page_links, dict)
        else [(None, p) for p in page_links]
    )
    icons = list(icons or [None] * len(raw_pairs))
    key = key or f"nav_{uuid4().hex}"

    mapping: Dict[str, str] = {}
    icon_map: Dict[str, Optional[str]] = {}
    for (lbl, path), ico in zip(raw_pairs, icons):
        slug = Path(path).stem.lower()
        lbl = lbl or Path(path).stem.replace("_", " ").title()
        if lbl in mapping:  # de-dupe â€“ keep first
            continue
        mapping[lbl] = slug
        icon_map[lbl] = ico

    # keep only pages that actually exist
    choices: list[tuple[str, str]] = []
    for lbl, slug in mapping.items():
        page_ok = any(
            (ROOT_DIR / slug).with_suffix(".py").exists()
            or (PAGES_DIR / slug).with_suffix(".py").exists()
        )
        if page_ok:
            choices.append((lbl, slug))

    if not choices:
        return ""

    default_lbl = default or choices[0][0]
    active_lbl = st.session_state.get(session_key, default_lbl)
    if active_lbl not in [label for label, _ in choices]:
        active_lbl = default_lbl
    default_idx = [label for label, _ in choices].index(active_lbl)

    with st.sidebar:
        st.markdown(SIDEBAR_STYLES, unsafe_allow_html=True)
        st.markdown("<div class='glass-card sidebar-nav'>", unsafe_allow_html=True)

        # 1ï¸âƒ£ native page_link if available (Streamlit 1.29+)
        if hasattr(st.sidebar, "page_link"):
            for lbl, slug in choices:
                ico = icon_map.get(lbl) or _EMOJI_FALLBACK
                st.sidebar.page_link(f"/pages/{slug}.py", label=lbl, icon=ico, help=lbl)
            chosen = active_lbl

        # 2ï¸âƒ£ pretty option-menu
        elif USE_OPTION_MENU:
            chosen = option_menu(
                menu_title="",
                options=[label for label, _ in choices],
                icons=[icon_map.get(label) or "dot" for label, _ in choices],
                orientation="vertical",
                key=key,
                default_index=default_idx,
            )

        # 3ï¸âƒ£ fallback radio
        else:
            radio_labels = [
                f"{icon_map.get(lbl) or ''} {lbl}".strip() for lbl, _ in choices
            ]
            picked = st.radio(
                "Navigation",
                radio_labels,
                index=default_idx,
                key=key,
                label_visibility="collapsed",
            )
            chosen = choices[radio_labels.index(picked)][0]

        st.markdown("</div>", unsafe_allow_html=True)

    st.session_state[session_key] = chosen
    return chosen


# public alias (+ legacy compat)
def render_sidebar_nav(*a, **kw):
    """Wrapper so legacy code using *render_modern_sidebar* keeps working."""
    if globals().get("render_modern_sidebar") is not render_sidebar_nav:
        return globals()["render_modern_sidebar"](*a, **kw)
    return _render_sidebar_nav(*a, **kw)


render_modern_sidebar = render_sidebar_nav  # legacy alias


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# TITLE & BADGE
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
def render_title_bar(icon: str, label: str) -> None:
    """Large H1 with emoji/icon."""
    st.markdown(
        f"<h1 style='display:flex;align-items:center;gap:.6rem;margin-bottom:1rem'>"
        f"<span>{icon}</span><span>{label}</span></h1>",
        unsafe_allow_html=True,
    )


def show_preview_badge(text: str = "Preview") -> None:
    """Floating badge in the top-right corner."""
    st.markdown(
        f"<div style='position:fixed;top:1.1rem;right:1.1rem;"
        f"background:var(--accent);color:var(--bg);padding:.28rem .6rem;border-radius:6px;"
        f"box-shadow:0 2px 6px rgba(0,0,0,.15);z-index:999'>"
        f"<i class='fa-solid fa-triangle-exclamation'></i>&nbsp;{text}</div>",
        unsafe_allow_html=True,
    )


def render_bottom_tab_bar(position: str = "fixed") -> None:
    """Bottom navigation bar for mobile screens.

    Parameters
    ----------
    position : str
        CSS ``position`` value for the tab bar (e.g., ``"fixed"`` or ``"static"``).
    """
    # Resolve theme accent safely
    try:
        accent = theme.get_accent_color()
    except Exception:
        # Fallback to a sensible default if theme access fails
        try:
            accent = theme.LIGHT_THEME.accent  # type: ignore[attr-defined]
        except Exception:
            accent = "#6C63FF"

    # Resolve active tab & CSS position with safe fallbacks
    try:
        active = st.session_state.get("active_page", "home")
    except Exception:
        active = "home"

    try:
        css_position = st.session_state.get("tab_bar_position", position)
    except Exception:
        css_position = position

    # Render, but never crash the UI if formatting fails
    try:
        st.markdown(
            BOTTOM_TAB_TEMPLATE.format(
                accent=accent, active=active, position=css_position
            ),
            unsafe_allow_html=True,
        )
    except Exception:
        return


# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
__all__ = [
    "main_container",
    "sidebar_container",
    "render_sidebar_nav",
    "render_title_bar",
    "show_preview_badge",
    "render_profile_card",
    "render_top_bar",
    "render_bottom_tab_bar",
]

