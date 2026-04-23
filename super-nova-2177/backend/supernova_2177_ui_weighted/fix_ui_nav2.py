from pathlib import Path
import re

ui = Path("ui.py")
txt = ui.read_text(encoding="utf-8")

# 1) Remove any existing proposals/decisions/execution button lines (and their 2-line bodies)
lines, out, skip = txt.splitlines(), [], False
for line in lines:
    if ('key="nav_proposals"' in line or 'key="nav_decisions"' in line or 'key="nav_execution"' in line):
        skip = True
        continue
    if skip and ('st.session_state.current_page' in line or 'st.rerun()' in line):
        continue
    if skip:
        skip = False
    out.append(line)
txt = "\n".join(out)

# 2) Find the Profile button (our anchor) and capture its indentation
pat = (r'(?m)^(?P<i>[ \t]*)if st\.button\("👤 Profile", key="nav_profile"\):\s*\n'
       r'(?P=i)[ \t]+st\.session_state\.current_page = "profile"\s*\n'
       r'(?P=i)[ \t]+st\.rerun\(\)')
m = re.search(pat, txt)
if not m:
    print("Anchor not found; aborting.")
    raise SystemExit(1)

indent = m.group('i')
insert_at = m.end()

# 3) Insert a clean, flat block at the same indent level
block = (
    "\n"
    f"{indent}if st.button(\"📄 Proposals\", key=\"nav_proposals\"):\n"
    f"{indent}    st.session_state.current_page = \"proposals\"\n"
    f"{indent}    st.rerun()\n"
    f"{indent}if st.button(\"✅ Decisions\", key=\"nav_decisions\"):\n"
    f"{indent}    st.session_state.current_page = \"decisions\"\n"
    f"{indent}    st.rerun()\n"
    f"{indent}if st.button(\"⚙️ Execution\", key=\"nav_execution\"):\n"
    f"{indent}    st.session_state.current_page = \"execution\"\n"
    f"{indent}    st.rerun()\n"
)

new_txt = txt[:insert_at] + block + txt[insert_at:]
ui.write_text(new_txt, encoding="utf-8")
print("ui.py nav normalized at indent:", repr(indent))
