# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
import asyncio
import json
import streamlit as st
from streamlit_helpers import safe_container
import pandas as pd
try:
    from st_aggrid import AgGrid, GridOptionsBuilder
except Exception:  # pragma: no cover - optional dependency
    AgGrid = None  # type: ignore
    GridOptionsBuilder = None  # type: ignore
from streamlit_helpers import alert, inject_global_styles

try:
    from frontend_bridge import dispatch_route
except Exception:  # pragma: no cover - optional dependency
    dispatch_route = None  # type: ignore

VOTING_CSS = """
<style>
.app-container { padding: 1rem; }
.card {
    background: #111;
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
}
.card input,
.card textarea,
.card select {
    border-radius: 8px;
    padding: 0.5rem;
}
.button-primary > button {
    background-color: #007aff;
    color: #fff;
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.button-primary > button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(0,122,255,0.5);
    filter: brightness(1.05);
}
.ag-theme-streamlit .ag-header,
.ag-theme-streamlit .ag-header-viewport {
    background-color: #007aff !important;
}
.ag-theme-streamlit .ag-header-cell-label {
    color: #fff;
    font-weight: bold;
}
.ag-grid-container {
    max-height: 400px;
    overflow-y: auto;
}
.app-container { padding: 1rem; }
.card {
    background: #fff;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: box-shadow 0.2s ease, transform 0.2s ease;
}
.card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.card input,
.card textarea,
.card select {
    border-radius: 8px;
    padding: 0.5rem;
}
.button-primary > button {
    background-color: #1DA1F2;
    color: #fff;
    border-radius: 8px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.button-primary > button:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 20px rgba(29,161,242,0.5);
    filter: brightness(1.05);
}
.ag-theme-streamlit .ag-header,
.ag-theme-streamlit .ag-header-viewport {
    background-color: #1DA1F2 !important;
}
.ag-theme-streamlit .ag-header-cell-label {
    color: #fff;
    font-weight: bold;
}
.ag-grid-container {
    max-height: 400px;
    overflow-y: auto;
}
</style>
"""

def _sanitize_markdown(text: str) -> str:
    """Return a UTF-8 safe string for ``st.markdown``."""
    if isinstance(text, bytes):
        return text.decode("utf-8", "ignore")
    return text.encode("utf-8", "ignore").decode("utf-8", "ignore")


def safe_markdown(text: str, **kwargs) -> None:
    """Render markdown after sanitizing the input text."""
    st.markdown(_sanitize_markdown(text), **kwargs)


def _run_async(coro):
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return asyncio.run(coro)
    else:
        if loop.is_running():
            return asyncio.run_coroutine_threadsafe(coro, loop).result()
        return loop.run_until_complete(coro)


def render_proposals_tab(main_container=None) -> None:
    """Display proposal creation, listing and voting controls."""
    if main_container is None:
        main_container = st

    container_ctx = safe_container(main_container)
    with container_ctx:
        if AgGrid is None or GridOptionsBuilder is None:
            alert(
                "st_aggrid is not installed – proposal features unavailable.",
                "warning",
            )
            return
        if dispatch_route is None:
            alert(
                "Governance routes not enabled—enable them in config.",
                "warning",
            )
            return

        safe_markdown("<div class='app-container'>", unsafe_allow_html=True)

        col1, col2 = st.columns([1, 1])

        with col1:
            safe_markdown("<div class='card'>", unsafe_allow_html=True)
            with st.form("create_proposal_form"):
                st.write("Create Proposal")
                title = st.text_input("Title")
                description = st.text_area("Description")
                author_id = st.number_input("Author ID", value=1, step=1)
                group_id = st.text_input("Group ID")
                voting_deadline = st.date_input("Voting Deadline")
                safe_markdown("<div class='button-primary'>", unsafe_allow_html=True)
                submitted = st.form_submit_button("Create")
                safe_markdown("</div>", unsafe_allow_html=True)
            safe_markdown("</div>", unsafe_allow_html=True)

        with col2:
            safe_markdown("<div class='card'>", unsafe_allow_html=True)
            safe_markdown("<div class='button-primary'>", unsafe_allow_html=True)
            if st.button("Refresh Proposals", key="refresh_proposals"):
                with st.spinner("Working on it..."):
                    try:
                        res = _run_async(dispatch_route("list_proposals", {}))
                        st.session_state["proposals_cache"] = res.get("proposals", [])
                        st.toast("Success!")
                    except Exception as exc:
                        alert(f"Failed to load proposals: {exc}", "error")
            safe_markdown("</div>", unsafe_allow_html=True)

        proposals = st.session_state.get("proposals_cache", [])
        if proposals:
            simple = [
                {
                    "id": p.get("id"),
                    "title": p.get("title"),
                    "status": p.get("status"),
                    "deadline": p.get("voting_deadline"),
                }
                for p in proposals
            ]
            df = pd.DataFrame(simple)
            gb = GridOptionsBuilder.from_dataframe(df)
            gb.configure_default_column(filter=True, sortable=True, resizable=True)
            safe_markdown("<div class='ag-grid-container'>", unsafe_allow_html=True)
            AgGrid(
                df,
                gridOptions=gb.build(),
                theme="streamlit",
                fit_columns_on_grid_load=True,
            )
            safe_markdown("</div>", unsafe_allow_html=True)

        with st.form("vote_proposal_form"):
            st.write("Vote on Proposal")
            ids = [p.get("id") for p in proposals]
            prop_id = (
                st.selectbox("Proposal", ids)
                if ids
                else st.number_input("Proposal ID", value=1, step=1)
            )
            harmonizer_id = st.number_input(
                "Harmonizer ID", value=1, step=1, key="harmonizer_id_vote"
            )
            vote_choice = st.selectbox("Vote", ["yes", "no", "abstain"])
            vote_sub = st.form_submit_button("Submit Vote")
        safe_markdown("</div>", unsafe_allow_html=True)

        if submitted:
            payload = {
                "title": title,
                "description": description,
                "author_id": int(author_id),
                "group_id": group_id or None,
                "voting_deadline": voting_deadline.isoformat(),
            }
            with st.spinner("Working on it..."):
                try:
                    res = _run_async(dispatch_route("create_proposal", payload))
                    alert(f"Proposal {res.get('proposal_id')} created", "info")
                    st.toast("Success!")
                except Exception as exc:
                    alert(f"Create failed: {exc}", "error")

        if vote_sub:
            payload = {
                "proposal_id": prop_id,
                "harmonizer_id": int(harmonizer_id),
                "vote": vote_choice,
            }
            with st.spinner("Working on it..."):
                try:
                    res = _run_async(dispatch_route("vote_proposal", payload))
                    alert(f"Vote recorded id {res.get('vote_id')}", "info")
                    st.toast("Success!")
                except Exception as exc:
                    alert(f"Vote failed: {exc}", "error")

        safe_markdown("</div>", unsafe_allow_html=True)


def render_governance_tab(main_container=None) -> None:
    """Display generic vote registry operations."""
    if main_container is None:
        main_container = st

    container_ctx = safe_container(main_container)
    with container_ctx:
        if AgGrid is None or GridOptionsBuilder is None:
            alert(
                "st_aggrid is not installed – governance features unavailable.",
                "warning",
            )
            return
        if dispatch_route is None:
            alert(
                "Governance routes not enabled—enable them in config.",
                "warning",
            )
            return
        with st.container():
            safe_markdown("<div class='tab-box'>", unsafe_allow_html=True)
            if st.button("Refresh Votes"):
                with st.spinner("Working on it..."):
                    try:
                        res = _run_async(dispatch_route("load_votes", {}))
                        st.session_state["votes_cache"] = res.get("votes", [])
                        st.toast("Success!")
                    except Exception as exc:
                        alert(f"Failed to load votes: {exc}", "error")

        votes = st.session_state.get("votes_cache", [])
        if votes:
            df = pd.DataFrame(votes)
            gb = GridOptionsBuilder.from_dataframe(df)
            gb.configure_default_column(filter=True, sortable=True, resizable=True)
            AgGrid(
                df,
                gridOptions=gb.build(),
                theme="streamlit",
                fit_columns_on_grid_load=True,
            )

        with st.container():
            with st.form("record_vote_form"):
                st.write("Record Vote")
                species = st.selectbox("Species", ["human", "ai", "company"])
                extra_json = st.text_input("Extra Fields (JSON)", value="{}")
                submit = st.form_submit_button("Record")
            if submit:
                try:
                    extra = json.loads(extra_json or "{}")
                except Exception as exc:
                    alert(f"Invalid JSON: {exc}", "error")
                else:
                    payload = {"species": species, **extra}
                    with st.spinner("Working on it..."):
                        try:
                            _run_async(dispatch_route("record_vote", payload))
                            alert("Vote recorded", "info")
                            st.toast("Success!")
                        except Exception as exc:
                            alert(f"Record failed: {exc}", "error")
            safe_markdown("</div>", unsafe_allow_html=True)


def render_agent_ops_tab(main_container=None) -> None:
    """Expose protocol agent management routes."""
    if main_container is None:
        main_container = st

    container_ctx = safe_container(main_container)
    with container_ctx:
        if dispatch_route is None:
            alert(
                "Governance routes not enabled—enable them in config.",
                "warning",
            )
            return
        with st.container():
            safe_markdown("<div class='tab-box'>", unsafe_allow_html=True)
            if st.button("Reload Agent List"):
                with st.spinner("Working on it..."):
                    try:
                        res = _run_async(dispatch_route("list_agents", {}))
                        st.session_state["agent_list"] = res.get("agents", [])
                        st.toast("Success!")
                    except Exception as exc:
                        alert(f"Load failed: {exc}", "error")

        agents = st.session_state.get("agent_list", [])
        st.write("Available Agents", agents)

        with st.container():
            with st.form("launch_agents_form"):
                launch_sel = st.multiselect("Agents to launch", agents)
                llm_backend = st.selectbox(
                    "LLM Backend", ["", "dummy", "GPT-4o", "Claude-3", "Gemini"]
                )
                provider = st.text_input("Provider")
                api_key = st.text_input("API Key", type="password")
                launch = st.form_submit_button("Launch Agents")
        if launch:
            payload = {
                "agents": launch_sel,
                "llm_backend": llm_backend or None,
                "provider": provider,
                "api_key": api_key,
            }
            with st.spinner("Working on it..."):
                try:
                    res = _run_async(dispatch_route("launch_agents", payload))
                    if st.session_state.get("beta_mode"):
                        st.json(res)
                    st.toast("Success!")
                except Exception as exc:
                    alert(f"Launch failed: {exc}", "error")

        if st.button("Step Agents"):
            with st.spinner("Working on it..."):
                try:
                    res = _run_async(dispatch_route("step_agents", {}))
                    if st.session_state.get("beta_mode"):
                        st.json(res)
                    st.toast("Success!")
                except Exception as exc:
                    alert(f"Step failed: {exc}", "error")
            safe_markdown("</div>", unsafe_allow_html=True)


def render_logs_tab(main_container=None) -> None:
    """Provide simple audit trace explanation."""
    if main_container is None:
        main_container = st

    container_ctx = safe_container(main_container)
    with container_ctx:
        if dispatch_route is None:
            alert(
                "Governance routes not enabled—enable them in config.",
                "warning",
            )
            return
        with st.container():
            safe_markdown("<div class='tab-box'>", unsafe_allow_html=True)
            trace_text = st.text_area("Audit Trace JSON", value="{}", height=200)
            if st.button("Explain Trace"):
                try:
                    trace = json.loads(trace_text or "{}")
                except Exception as exc:
                    alert(f"Invalid JSON: {exc}", "error")
                else:
                    with st.spinner("Working on it..."):
                        try:
                            res = _run_async(
                                dispatch_route("explain_audit", {"trace": trace})
                            )
                            st.text_area("Explanation", value=res, height=150)
                            st.toast("Success!")
                        except Exception as exc:
                            alert(f"Explain failed: {exc}", "error")
            safe_markdown("</div>", unsafe_allow_html=True)


def render_voting_tab(main_container=None) -> None:
    """High level tab combining proposal and vote management."""
    if main_container is None:
        main_container = st

    container_ctx = safe_container(main_container)
    with container_ctx:
        inject_global_styles()
        st.markdown(VOTING_CSS, unsafe_allow_html=True)
        sub1, sub2, sub3, sub4 = st.tabs(
            [
                "Proposal Hub",
                "Governance",
                "Agent Ops",
                "Logs",
            ]
        )
        render_proposals_tab(main_container=sub1)
        render_governance_tab(main_container=sub2)
        render_agent_ops_tab(main_container=sub3)
        render_logs_tab(main_container=sub4)
