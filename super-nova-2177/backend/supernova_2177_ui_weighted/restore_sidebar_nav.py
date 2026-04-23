from pathlib import Path, re

ui = Path("ui.py")
txt = ui.read_text(encoding="utf-8")

# 1) Remove the bad main-area block we added earlier (starts at 'unified nav')
txt = re.sub(r"(?ms)^# --- unified nav.*?(?=^\S|\Z)", "", txt)

# 2) Ensure a with st.sidebar: block exists; if not, create one near the top after first import
if "with st.sidebar:" not in txt:
    # insert a minimal sidebar section after the first occurrence of "import streamlit as st"
    txt = txt.replace(
        "import streamlit as st",
        "import streamlit as st\n\n# --- sidebar container ---\nwith st.sidebar:\n    st.markdown('### Navigation')\n",
        1,
    )

# 3) Inject clean sidebar buttons for Proposals/Decisions/Execution immediately
#    after the "with st.sidebar:" line (flat, correct indent)
lines = txt.splitlines()
out = []
inserted = False
for i, line in enumerate(lines):
    out.append(line)
    if not inserted and line.strip().startswith("with st.sidebar:"):
        indent = line[:len(line) - len(line.lstrip())] + "    "  # one level in
        block = [
            f"{indent}# --- workflow buttons ---",
            f'{indent}if st.button("📄 Proposals", key="nav_proposals_sidebar"):',
            f'{indent}    st.session_state.current_page = "proposals"',
            f'{indent}    st.rerun()',
            f'{indent}if st.button("✅ Decisions", key="nav_decisions_sidebar"):',
            f'{indent}    st.session_state.current_page = "decisions"',
            f'{indent}    st.rerun()',
            f'{indent}if st.button("⚙️ Execution", key="nav_execution_sidebar"):',
            f'{indent}    st.session_state.current_page = "execution"',
            f'{indent}    st.rerun()',
            "",
            f"{indent}# --- failsafe menu (works even if buttons fail) ---",
            f"{indent}labels = ['Feed','Chat','Messages','Profile','Proposals','Decisions','Execution']",
            f"{indent}slugs  = ['feed','chat','messages','profile','proposals','decisions','execution']",
            f"{indent}current = st.session_state.get('current_page','feed')",
            f"{indent}try: idx = slugs.index(current)",
            f"{indent}except ValueError: idx = 0",
            f"{indent}choice = st.radio('Go to page:', labels, index=idx, key='nav_radio')",
            f"{indent}st.session_state.current_page = slugs[labels.index(choice)]",
        ]
        out.extend(block)
        inserted = True

txt = "\n".join(out)

ui.write_text(txt, encoding="utf-8")
print("Sidebar nav restored (buttons + failsafe radio).")
