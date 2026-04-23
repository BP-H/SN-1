from pathlib import Path
import re

p = Path("ui.py")
s = p.read_text(encoding="utf-8")

orig = s

# 1) Kill the old “Go to page” radio block (it caused page duplication/bugs)
#    We remove any block that starts with 'Go to page:' and contains st.radio with page names.
s = re.sub(
    r"(#\s*Go to page:.*?\n)(?:.*?st\.radio\(.*?(Feed|Chat|Messages|Profile|Proposals|Decisions|Execution).*?\)\s*\n(?:.*\n){0,10})",
    r"# [removed by repair_ui_nav] (custom radio nav)\n",
    s,
    flags=re.DOTALL,
)

# 2) De-activate the top button strip if present (bad keys + no routing).
#    We just comment out the button lines but keep the layout so the page title area stays nice.
def comment_out_button(label_key):
    # turns: if st.button("📄 Proposals", key="nav_proposals"):
    # into:  # [removed] if st.button("📄 Proposals", key="nav_proposals_top"):
    pattern = rf'(\s*)if\s+st\.button\(".*?",\s*key="nav_{label_key}"\s*\):'
    def _sub(m):
        indent = m.group(1)
        return f'{indent}# [removed by repair_ui_nav] {m.group(0).strip()}'
    return re.sub(pattern, _sub, s)

for k in ("voting","proposals","decisions","execution"):
    s = comment_out_button(k)

# Also harden: rename any remaining top keys to *_top to avoid StreamlitDuplicateElementKey
s = s.replace('key="nav_voting"',    'key="nav_voting_top"')
s = s.replace('key="nav_proposals"', 'key="nav_proposals_top"')
s = s.replace('key="nav_decisions"', 'key="nav_decisions_top"')
s = s.replace('key="nav_execution"', 'key="nav_execution_top"')

# 3) Make sure we don’t leave half-empty if-blocks that cause IndentationError:
#    Replace lone 'if st.button...' bodies we commented with a harmless pass line.
s = re.sub(r'(# \[removed by repair_ui_nav].*?\n)(\s*)([^\s#].*)', r'\1\2pass  # keep layout\n\2\3', s)

# 4) Save only if changed
if s != orig:
    p.write_text(s, encoding="utf-8")
    print("ui.py patched. Top nav disabled, duplicate keys avoided, sidebar-only nav active.")
else:
    print("No changes were needed. (Script found nothing to patch.)")
