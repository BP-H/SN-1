import os, re, sys
from pathlib import Path

ROOT = Path.cwd()
UTILS = ROOT / "utils"
PAGES = ROOT / "pages"
EXTERNAL_PAGE_DIRS = [
    ROOT / "transcendental_resonance_frontend" / "pages",
    ROOT / "app" / "pages",
]

def write(path: Path, txt: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(txt, encoding="utf-8")
    print("wrote //", path.relative_to(ROOT))

write(UTILS / "paths.py",
"""from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT_DIR / 'pages'
EXTERNAL_PAGE_DIRS = [
    ROOT_DIR / 'transcendental_resonance_frontend' / 'pages',
    ROOT_DIR / 'app' / 'pages',
]
def ensure_dirs():
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    for p in EXTERNAL_PAGE_DIRS:
        if p.exists():
            p.mkdir(parents=True, exist_ok=True)
""")

write(UTILS / "page_registry.py",
"""from __future__ import annotations
import re
from pathlib import Path
from typing import Dict
from utils.paths import ROOT_DIR, PAGES_DIR, EXTERNAL_PAGE_DIRS, ensure_dirs
STUB_HEADER = "# STRICTLY A SOCIAL MEDIA PLATFORM\\n# Intellectual Property & Artistic Inspiration\\n# Legal & Ethical Safeguards\\n"
def _slugify(name: str) -> str:
    s = re.sub(r'[^a-zA-Z0-9]+','_', name).strip('_').lower()
    return s or 'page'
def _module_path_for(py: Path) -> str:
    rel = py.relative_to(ROOT_DIR).with_suffix('')
    return '.'.join(rel.parts)
def discover_external_pages():
    for base in EXTERNAL_PAGE_DIRS:
        if not base.exists(): continue
        for p in sorted(base.rglob('*.py')):
            if p.name in {'__init__.py'} or p.name.startswith('_'): continue
            yield (p.stem.replace('_',' ').title(), p)
def write_stub(target_dir: Path, title: str, src: Path) -> Path:
    slug = _slugify(title); stub = target_dir / f"{slug}.py"
    mod = _module_path_for(src)
    txt = STUB_HEADER + f"\\nfrom {mod} import main\\n\\nif __name__ == '__main__':\\n    main()\\n"
    stub.write_text(txt, encoding='utf-8'); return stub
def sync_external_into_pages(verbose: bool=False) -> Dict[str, str]:
    ensure_dirs(); created: Dict[str,str] = {}
    for title, src in discover_external_pages():
        try:
            stub = write_stub(PAGES_DIR, title, src)
            created[title] = str(stub.relative_to(ROOT_DIR))
            if verbose: print("stubbed", title, "->", created[title])
        except Exception as e:
            if verbose: print("skip", src, e)
    return created
def ensure_pages(pages: Dict[str,str]) -> None:
    ensure_dirs()
    for title, module_path in pages.items():
        slug = _slugify(title); stub = PAGES_DIR / f"{slug}.py"
        txt = STUB_HEADER + f"\\nfrom {module_path} import main\\n\\nif __name__ == '__main__':\\n    main()\\n"
        stub.write_text(txt, encoding='utf-8')
""")

PAGES.mkdir(parents=True, exist_ok=True)
if not any(PAGES.glob("*.py")):
    write(PAGES / "home.py", "import streamlit as st\n\ndef main():\n    st.title('Home')\n    st.write('Unified /pages workspace.')\n")

ui = ROOT / "ui.py"
if not ui.exists():
    sys.exit("ui.py not found in repo root. Create ui.py and rerun.")
txt = ui.read_text(encoding="utf-8")

if "from utils.page_registry import" not in txt:
    inject = (
        "\nfrom typing import Dict\n"
        "try:\n"
        "    from utils.paths import PAGES_DIR\n"
        "    from utils.page_registry import ensure_pages, sync_external_into_pages\n"
        "except Exception as _exc:\n"
        "    from pathlib import Path as _P\n"
        "    PAGES_DIR = (_P(__file__).resolve().parent / 'pages')\n"
    )
    m = re.search(r"(import .*?\n)(?!\s)", txt, flags=re.DOTALL)
    idx = m.end() if m else 0
    txt = txt[:idx] + inject + txt[idx:]

if "_bootstrap_pages(" not in txt:
    boot = (
        "\n\ndef _bootstrap_pages() -> None:\n"
        "    PAGES: Dict[str, str] = {}\n"
        "    try:\n"
        "        ensure_pages(PAGES)\n"
        "        sync_external_into_pages(verbose=False)\n"
        "    except Exception as exc:\n"
        "        try:\n"
        "            import streamlit as st\n"
        "            st.sidebar.error(f'page registry issue: {exc}')\n"
        "        except Exception:\n"
        "            print('page registry issue:', exc)\n"
    )
    i = txt.find("def main")
    txt = txt + boot if i == -1 else txt[:i] + boot + txt[i:]

txt = re.sub(r"(def\s+main\([\w\s,]*\):\s*)", r"\1    _bootstrap_pages()\n", txt, count=1)
write(ui, txt)

print("DONE: ui.py is the ONLY entry; /pages is unified via import stubs.")
