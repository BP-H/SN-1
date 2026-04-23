from __future__ import annotations
import re
from pathlib import Path
from typing import Dict
from utils.paths import ROOT_DIR, PAGES_DIR, EXTERNAL_PAGE_DIRS, ensure_dirs
STUB_HEADER = "# STRICTLY A SOCIAL MEDIA PLATFORM\n# Intellectual Property & Artistic Inspiration\n# Legal & Ethical Safeguards\n"
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
    txt = STUB_HEADER + f"\nfrom {mod} import main\n\nif __name__ == '__main__':\n    main()\n"
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
        txt = STUB_HEADER + f"\nfrom {module_path} import main\n\nif __name__ == '__main__':\n    main()\n"
        stub.write_text(txt, encoding='utf-8')
