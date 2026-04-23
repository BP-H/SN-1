from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent
fp = ROOT / "pages" / "profile.py"
txt = fp.read_text(encoding="utf-8")

# 1) Ensure a robust status icon wrapper exists (idempotent)
if "_status_icon(" not in txt:
    txt = txt.replace(
        "import streamlit as st",
        "import streamlit as st\n"
        "\n"
        "# --- status icon wrapper that works with 0 or 1 arg implementations ---\n"
        "try:\n"
        "    from status_indicator import render_status_icon\n"
        "except Exception:\n"
        "    def render_status_icon(*args, **kwargs):\n"
        "        return '🔴'\n"
        "def _status_icon(status='offline'):\n"
        "    try:\n"
        "        import inspect\n"
        "        if len(inspect.signature(render_status_icon).parameters) == 0:\n"
        "            out = render_status_icon()\n"
        "        else:\n"
        "            out = render_status_icon(status=status)\n"
        "    except Exception:\n"
        "        out = '🟢' if status == 'online' else '🔴'\n"
        "    return out if isinstance(out, str) else ''\n",
        1,
    )

# 2) Delete any broken HTML status lines (these caused the unterminated string)
txt = re.sub(r'.*text-align:right.*\n?', '', txt)

# 3) Insert a safe right-aligned status using columns (no HTML strings)
status_block = (
    "    # right-aligned status (safe, no raw HTML)\n"
    "    _c1, _c2 = st.columns([8, 1])\n"
    "    with _c2:\n"
    "        st.markdown(_status_icon('offline'))\n"
)

if "st.subheader(\"Profile\")" in txt and status_block not in txt:
    txt = txt.replace("st.subheader(\"Profile\")", "st.subheader(\"Profile\")\n" + status_block, 1)
elif "st.title(\"superNova_2177\")" in txt and status_block not in txt:
    txt = txt.replace("st.title(\"superNova_2177\")", "st.title(\"superNova_2177\")\n" + status_block, 1)

# 4) Avoid duplicate huge title (keep the UI header; page can comment out its own)
txt = txt.replace('st.title("superNova_2177")', "# st.title(\"superNova_2177\")  # UI header already shows title")

fp.write_text(txt, encoding="utf-8")
print("profile.py patched")
