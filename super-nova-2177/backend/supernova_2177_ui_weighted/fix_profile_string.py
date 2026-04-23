from pathlib import Path
p = Path("pages/profile.py")
text = p.read_text(encoding="utf-8").splitlines()
fixed = False
good = "st.markdown(f\"<div style='text-align:right'>{_status_icon('offline')}</div>\", unsafe_allow_html=True)"

for i, line in enumerate(text):
    if ("text-align:right" in line) or ("render_status_icon" in line) or ("_status_icon(" in line):
        text[i] = "    " + good
        fixed = True
        break

if not fixed:
    # If not found, inject the status line just under the title line
    for i, line in enumerate(text):
        if "st.title(" in line:
            text.insert(i+1, "    " + good)
            fixed = True
            break

p.write_text("\n".join(text) + "\n", encoding="utf-8")
print("patched:", fixed)
