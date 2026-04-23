# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Modern UI helpers for Streamlit pages."""
# ruff: noqa: E501

import streamlit as st
import logging
from frontend import theme

logger = logging.getLogger(__name__)

try:
    from streamlit_lottie import st_lottie
    HAS_LOTTIE = True
except ImportError:
    st_lottie = None
    HAS_LOTTIE = False

def render_lottie_animation(url: str, *, height: int = 200, fallback: str = "🚀") -> None:
    """Display a Lottie animation if available, otherwise show a fallback icon."""
    if HAS_LOTTIE and st_lottie is not None:
        st_lottie(url, height=height)
    else:
        st.markdown(
            f"<div style='font-size:{height // 4}px'>{fallback}</div>",
            unsafe_allow_html=True,
        )

def apply_modern_styles() -> None:
    """Inject global CSS using theme variables and local assets."""
    from modern_ui_components import SIDEBAR_STYLES

    theme.inject_global_styles()

    if st.session_state.get("_modern_ui_css_injected"):
        logger.debug("Modern UI CSS already injected; skipping extra assets")
        return

    css = """
    <script type="module" src="/static/lucide-react.min.js"></script>
    <style>
    body, .stApp {
        background: var(--bg);
        color: var(--text);
        font-family: 'Inter', sans-serif;
    }
    .card, .custom-container {
        background: var(--card);
        border-radius: 1rem;
        box-shadow: 0 2px 6px rgba(0,0,0,0.08);
        transition: transform .2s ease, box-shadow .2s ease;
    }
    .card:hover, .custom-container:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .insta-card {
        display: flex;
        flex-direction: column;
        background: var(--card);
        border-radius: 1rem;
        overflow: hidden;
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
        transition: transform .2s ease, box-shadow .2s ease;
    }
    .insta-card img {
        width: 100%;
        height: auto;
    }
    .insta-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
    }
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)
    st.markdown(SIDEBAR_STYLES, unsafe_allow_html=True)
    st.session_state["_modern_ui_css_injected"] = True

def inject_premium_styles() -> None:
    """Backward compatible alias for :func:`apply_modern_styles`."""
    apply_modern_styles()

def render_modern_header() -> None:
    """Render the premium glassy header."""
    st.markdown(
        """
        <div style="
            background: var(--card);
            backdrop-filter: blur(20px);
            padding: 1.5rem 2rem;
            margin: -2rem -3rem 3rem -3rem;
            border-bottom: 1px solid var(--accent);
            border-radius: 0 0 16px 16px;
        ">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="
                        background: var(--accent);
                        border-radius: 12px;
                        padding: 0.75rem;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">
                        <span style="font-size: 1.5rem;">🚀</span>
                    </div>
                    <div>
                        <h1 style="margin: 0; color: var(--text-muted); font-size: 1.75rem; font-weight: 700;">
                            superNova_2177
                        </h1>
                        <p style="margin: 0; color: var(--text-muted); font-size: 0.9rem;">Validation Analyzer</p>
                    </div>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center;">
                    <div style="
                        background: var(--bg);
                        border: 1px solid var(--accent);
                        border-radius: 8px;
                        padding: 0.5rem 1rem;
                        color: var(--accent);
                        font-size: 0.85rem;
                        font-weight: 500;
                    ">
                        ✓ Online
                    </div>
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )

def render_validation_card() -> None:
    """Render the main validation card container."""
    st.markdown(
        """
        <div style="
            background: var(--card);
            backdrop-filter: blur(20px);
            border: 1px solid var(--card);
            border-radius: 16px;
            padding: 2rem;
            margin-bottom: 2rem;
            transition: all 0.3s ease;
        " onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 12px 40px rgba(0,0,0,0.3)'"
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
    """,
        unsafe_allow_html=True,
    )

def render_stats_section(stats: dict | None = None) -> None:
    """Display quick stats using a responsive flexbox layout."""
    try:
        accent = theme.get_accent_color()
    except Exception:
        accent = getattr(getattr(theme, "LIGHT_THEME", object()), "accent", "#0077B5")

    css = f"""
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
        background: var(--card);
        backdrop-filter: blur(15px);
        border: 1px solid var(--card);
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
    """
    st.markdown(css, unsafe_allow_html=True)

    default_stats = {
        "runs": "0",
        "proposals": "12",
        "success_rate": "94%",
        "accuracy": "98.2%",
    }
    data = {**default_stats, **(stats or {})}

    entries = [
        ("🏃‍♂️", "Runs", data["runs"]),
        ("📝", "Proposals", data["proposals"]),
        ("⚡", "Success Rate", data["success_rate"]),
        ("🎯", "Accuracy", data["accuracy"]),
    ]
    cards_html = []
    for icon, label, value in entries:
        cards_html.append(
            f"""
            <div class="stats-card">
              <div style="font-size:2rem; margin-bottom:0.5rem;">{icon}</div>
              <div class="stats-value">{value}</div>
              <div class="stats-label">{label}</div>
            </div>
            """
        )
    st.markdown(
        f"<div class='stats-container'>{''.join(cards_html)}</div>",
        unsafe_allow_html=True,
    )
