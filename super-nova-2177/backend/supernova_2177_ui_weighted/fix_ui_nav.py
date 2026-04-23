from pathlib import Path
import re

ui = Path("ui.py")
s = ui.read_text(encoding="utf-8")

# Canonical nav block (each if has its own body)
block = (
    'if st.button("🗳 Voting", key="nav_voting"):\n'
    '    st.session_state.current_page = "voting"\n'
    '    st.rerun()\n'
    'if st.button("📄 Proposals", key="nav_proposals"):\n'
    '    st.session_state.current_page = "proposals"\n'
    '    st.rerun()\n'
    'if st.button("✅ Decisions", key="nav_decisions"):\n'
    '    st.session_state.current_page = "decisions"\n'
    '    st.rerun()\n'
    'if st.button("⚙️ Execution", key="nav_execution"):\n'
    '    st.session_state.current_page = "execution"\n'
    '    st.rerun()\n'
)

anchor = 'if st.button("🗳 Voting", key="nav_voting"):'

# Replace the single anchor line (with any leading spaces) with the full, correct block
s = re.sub(r'^[ \t]*' + re.escape(anchor) + r'[ \t]*$', block, s, count=1, flags=re.M)

# Remove any previously injected nested nav buttons (the buggy ones indented under Voting)
s = re.sub(
    r'\n[ \t]{4,}if st\.button\("📄 Proposals", key="nav_proposals"\):\n'
    r'[ \t]{8}st\.session_state\.current_page = "proposals"\n'
    r'[ \t]{8}st\.rerun\(\)\n'
    r'[ \t]{4,}if st\.button\("✅ Decisions", key="nav_decisions"\):\n'
    r'[ \t]{8}st\.session_state\.current_page = "decisions"\n'
    r'[ \t]{8}st\.rerun\(\)\n'
    r'[ \t]{4,}if st\.button\("⚙️ Execution", key="nav_execution"\):\n'
    r'[ \t]{8}st\.session_state\.current_page = "execution"\n'
    r'[ \t]{8}st\.rerun\(\)\n',
    '\n',
    s,
    flags=re.M
)

ui.write_text(s, encoding="utf-8")
print("ui.py nav normalized")
