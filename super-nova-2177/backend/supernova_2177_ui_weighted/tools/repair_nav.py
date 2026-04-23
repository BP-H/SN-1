# tools/repair_nav.py
import os, textwrap, pathlib, json, zipfile, importlib
ROOT = pathlib.Path(__file__).resolve().parents[1]
UI = ROOT / "ui.py"
PAGES_DIR = ROOT / "pages"

UI_CODE = r"""
# === superNova_2177 unified UI (stable) ===
from __future__ import annotations
import os, importlib, streamlit as st

APP_TITLE = "superNova_2177"

# --- backend toggle wiring (pages read env via _use_backend) ---
def _set_backend_env(use_real: bool, url: str) -> None:
    os.environ["USE_REAL_BACKEND"] = "1" if use_real else "0"
    os.environ["BACKEND_URL"] = url or os.environ.get("BACKEND_URL","http://127.0.0.1:8000")

# --- pages registry (explicit order) ---
PAGES = {
    "Feed":       "pages.feed",
    "Chat":       "pages.chat",
    "Messages":   "pages.messages",
    "Profile":    "pages.profile",
    "Proposals":  "pages.proposals",
    "Decisions":  "pages.decisions",
    "Execution":  "pages.execution",
}

def _render_page(name: str):
    mod = importlib.import_module(PAGES[name])
    fn = getattr(mod, "render", None) or getattr(mod, "main", None)
    if fn is None:
        st.error(f"{name} page has no render() or main()")
        return
    fn()

def main():
    st.set_page_config(page_title=APP_TITLE, layout="wide")
    st.title(APP_TITLE)

    # Sidebar navigation (single source of truth)
    with st.sidebar:
        st.markdown("### Go to page:")
        current = st.session_state.get("current_page", "Feed")
        current = st.radio(
            "", list(PAGES.keys()),
            index=list(PAGES.keys()).index(current) if current in PAGES else 0,
            label_visibility="collapsed",
            key="nav_radio_sidebar"
        )
        st.session_state["current_page"] = current

        st.divider()
        use_real = st.toggle("Use real backend", value=(os.environ.get("USE_REAL_BACKEND","0") in ("1","true","yes")), key="use_real_toggle")
        api_url  = st.text_input("Backend URL", os.environ.get("BACKEND_URL","http://127.0.0.1:8000"), key="backend_url_input")
        _set_backend_env(use_real, api_url)

    # Quick actions (unique keys so no duplicate-key crashes)
    st.markdown(" ")
    c1,c2,c3,c4 = st.columns([1,1,1,6])
    if c1.button("🗳️ Voting",    key="navbtn_voting"):    st.session_state["current_page"]="Decisions"; st.rerun()
    if c2.button("📄 Proposals",  key="navbtn_proposals"): st.session_state["current_page"]="Proposals"; st.rerun()
    if c3.button("✅ Decisions",  key="navbtn_decisions"): st.session_state["current_page"]="Decisions"; st.rerun()
    # (Execution stays accessible after decisions)
    if c4.button("⚙️ Execution",  key="navbtn_execution"): st.session_state["current_page"]="Execution"; st.rerun()

    # Render the chosen page
    _render_page(st.session_state["current_page"])

if __name__ == "__main__":
    main()
"""

def write(path: pathlib.Path, text: str):
    path.write_text(text, encoding="utf-8")
    print("wrote", path.relative_to(ROOT))

# backup once
bak = UI.with_suffix(".backup.py")
if not bak.exists():
    try: bak.write_text(UI.read_text(encoding="utf-8"), encoding="utf-8"); print("backup ->", bak.name)
    except FileNotFoundError: pass

write(UI, UI_CODE)
print("UI repaired ✅")

# also produce a tiny collector for support bundles
COLLECT = ROOT / "tools" / "collect_pages.py"
COLLECT_CODE = r'''
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
out = ROOT / "support_bundle.txt"
targets = [ROOT/"ui.py"] + sorted((ROOT/"pages").glob("*.py"))
with out.open("w", encoding="utf-8") as f:
    for p in targets:
        f.write(f"\n===== {p.relative_to(ROOT)} =====\n")
        f.write(p.read_text(encoding="utf-8"))
print("wrote", out)
'''
write(COLLECT, COLLECT_CODE)
print("Collector added -> tools/collect_pages.py ✅")
