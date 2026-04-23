from pathlib import Path
import re

fp = Path("pages/profile.py")
txt = fp.read_text(encoding="utf-8")

# 1) In the import block, alias the real function so we never shadow it
#    from frontend.profile_card import (..., render_profile_card, ...)
# -> from frontend.profile_card import (..., render_profile_card as _render_profile_card, ...)
def _alias_render_profile_card(m):
    inside = m.group(1)
    inside = re.sub(r"\brender_profile_card\b", "render_profile_card as _render_profile_card", inside)
    return "from frontend.profile_card import (" + inside + ")"

txt = re.sub(
    r"from\s+frontend\.profile_card\s+import\s*\((.*?)\)",
    _alias_render_profile_card,
    txt,
    flags=re.S,
)

# 2) Remove any old broken wrapper block if present
txt = re.sub(
    r"# --- compatibility wrapper.*?# --- end wrapper ---\s*",
    "",
    txt,
    flags=re.S,
)

# 3) Insert a fresh, SAFE wrapper right after the import block
wrapper = """
# --- compatibility wrapper for render_profile_card (SAFE) ---
import inspect as _inspect

def render_profile_card_compat(data):
    try:
        n = len(_inspect.signature(_render_profile_card).parameters)
    except Exception:
        n = 0
    if n >= 1:
        return _render_profile_card(data)
    else:
        return _render_profile_card()
# --- end wrapper ---
"""

m = re.search(r"from\s+frontend\.profile_card\s+import\s*\([^\)]*\)\s*", txt, flags=re.S)
if m:
    pos = m.end()
    txt = txt[:pos] + "\n" + wrapper + txt[pos:]
else:
    txt = wrapper + "\n" + txt

# 4) If a previous search/replace broke the wrapper into self-calls, fix that
txt = txt.replace(
    "render_profile_card_compat(data) if _RPC_PARAMS else render_profile_card_compat(data)",
    "render_profile_card_compat(data)",
)

# 5) Ensure the page calls the compat wrapper (safe no-op if already done)
txt = txt.replace("render_profile_card(data)", "render_profile_card_compat(data)")

fp.write_text(txt, encoding="utf-8")
print("profile.py patched safely.")
