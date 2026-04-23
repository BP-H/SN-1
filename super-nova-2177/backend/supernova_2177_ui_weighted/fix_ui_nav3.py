from pathlib import Path, re

ui = Path("ui.py")
src = ui.read_text(encoding="utf-8")

# --- Remove any old/new copies of the nav block that start at "🗳 Voting" and run
#     until the next top-level (no-indentation) statement.
pattern = re.compile(
    r"(?ms)^[ \t]*if st\.button\(\"🗳 Voting\", key=\"nav_voting\"\):.*?(?=^\S|\Z)"
)
src = re.sub(pattern, "", src)

# --- Insert a clean, top-level block right after the first sidebar section.
# Anchor: the existing Profile nav (most stable).
anchor_pat = re.compile(
    r'(?m)^(?P<i>)[ \t]*if st\.button\("👤 Profile", key="nav_profile"\):\s*\n'
    r'[ \t]*st\.session_state\.current_page = "profile"\s*\n'
    r'[ \t]*st\.rerun\(\)'
)
m = anchor_pat.search(src)
if not m:
    # Fallback: just append at end of file as a new top-level block.
    insert_at = len(src)
else:
    insert_at = m.end()

block = """
# --- unified nav (flat, top-level) ---
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
""".lstrip("\n")

new = src[:insert_at] + ("\n" if insert_at and src[insert_at-1] != "\n" else "") + block + src[insert_at:]
ui.write_text(new, encoding="utf-8")
print("ui.py: sidebar nav reset to a clean, flat block.")
