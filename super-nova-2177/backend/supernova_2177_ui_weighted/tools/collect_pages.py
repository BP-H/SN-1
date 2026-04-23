
import pathlib, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
out = ROOT / "support_bundle.txt"
targets = [ROOT/"ui.py"] + sorted((ROOT/"pages").glob("*.py"))
with out.open("w", encoding="utf-8") as f:
    for p in targets:
        f.write(f"\n===== {p.relative_to(ROOT)} =====\n")
        f.write(p.read_text(encoding="utf-8"))
print("wrote", out)
