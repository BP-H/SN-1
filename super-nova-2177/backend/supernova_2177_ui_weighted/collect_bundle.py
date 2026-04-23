from pathlib import Path
import sys

ROOT = Path(".").resolve()
targets = [
    ROOT/"ui.py",
    ROOT/"app.py",
    ROOT/"fake_api.py",
    ROOT/"frontend",
    ROOT/"pages",
]
out = ROOT/"_support_bundle.txt"

def iter_files():
    for t in targets:
        if t.is_file() and t.suffix in {".py",".css",".toml"}:
            yield t
        elif t.is_dir():
            for f in sorted(t.rglob("*")):
                if f.is_file() and f.suffix in {".py",".css",".toml"}:
                    yield f

lines = []
for f in iter_files():
    rel = f.relative_to(ROOT)
    lines.append("\n" + "#"*80 + f"\n# FILE: {rel}\n" + "#"*80 + "\n")
    try:
        lines.append(f.read_text(encoding="utf-8"))
    except Exception as e:
        lines.append(f"\n# [could not read: {e}]\n")

out.write_text("".join(lines), encoding="utf-8")
print(f"Wrote {out} (attach this for review)")
