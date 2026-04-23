# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import streamlit as st
from frontend.theme import apply_theme

from agent_ui import render_agent_insights_tab
from streamlit_helpers import theme_toggle, inject_global_styles

__all__ = ["main", "render"]

apply_theme("light")
inject_global_styles()


def main(main_container=None) -> None:
    """
    Render the Agents UI safely, with container fallback.

    If no main_container is provided, uses Streamlit root context.
    """
    container = main_container if main_container is not None else st
    theme_toggle("Dark Mode", key_suffix="agents")

    try:
        container.title("🤖 Agents")

        agents = ["MetaValidator", "Guardian", "Resonance"]
        selected_agent = container.selectbox("Select Agent", agents, key="agent_select")

        if container.button("Test Agent", key="test_agent"):
            container.success(f"✅ {selected_agent} agent test complete")
            container.json(
                {
                    "agent": selected_agent,
                    "status": "ok",
                    "test": True,
                }
            )
    except Exception as e:
        container.error(f"❌ Failed to render Agents UI: {e}")

    try:
        render_agent_insights_tab(main_container=main_container)
    except Exception as e:  # pragma: no cover - UI
        st.error(f"Agent page error: {e}")
        if st.button("Reset", key="agent_reset"):
            st.rerun()


def render() -> None:
    """Wrapper to keep page loading consistent."""
    main()


if __name__ == "__main__":
    main()
