from pathlib import Path

root = Path(".")
updated = 0

for p in (root / "pages").rglob("*.py"):
    text = p.read_text(encoding="utf-8")
    new = text

    # 1) Streamlit API change
    new = new.replace("st.experimental_rerun()", "st.rerun()")
    new = new.replace("streamlit.experimental_rerun()", "streamlit.rerun()")

    # 2) Profile card signature
    new = new.replace("def render_profile_card():", "def render_profile_card(data=None):")

    if new != text:
        p.write_text(new, encoding="utf-8")
        print("updated", p)
        updated += 1

print("files updated:", updated)
