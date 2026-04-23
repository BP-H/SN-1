#!/usr/bin/env python3
"""
gather_repo_to_md.py

Create ONE Markdown file that contains the text contents of your whole repo.

USAGE (PowerShell or Bash):
    python gather_repo_to_md.py
    python gather_repo_to_md.py --root . --output combined_repo.md
    python gather_repo_to_md.py --max-file-mb 10
    python gather_repo_to_md.py --exclude ".venv;node_modules;dist;build;__pycache__"

Notes:
- Binary files (images, fonts, archives, etc.) are skipped automatically.
- By default there is NO per-file size limit. Use --max-file-mb to set one.
- Default excludes: .git, .venv, node_modules, __pycache__, .mypy_cache, .pytest_cache,
  .DS_Store, .idea, dist, build
"""

from __future__ import annotations
import argparse
import datetime as _dt
import os
import sys
from pathlib import Path
from typing import Iterable, Tuple, Dict

# -------- settings --------

# map extensions to a reasonable code fence language
LANG_MAP: Dict[str, str] = {
    ".py": "python",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".js": "javascript",
    ".jsx": "jsx",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".json": "json",
    ".yml": "yaml",
    ".yaml": "yaml",
    ".toml": "toml",
    ".env": "",
    ".ini": "ini",
    ".cfg": "ini",
    ".txt": "",
    ".md": "markdown",
    ".html": "html",
    ".htm": "html",
    ".css": "css",
    ".scss": "scss",
    ".sass": "sass",
    ".less": "less",
    ".sql": "sql",
    ".sh": "bash",
    ".ps1": "powershell",
    ".bat": "bat",
    ".cmd": "bat",
    ".dockerfile": "dockerfile",
    "Dockerfile": "dockerfile",
    ".xml": "xml",
    ".csv": "csv",
    ".tsv": "tsv",
}

DEFAULT_EXCLUDES = {
    ".git",
    ".venv",
    "node_modules",
    "__pycache__",
    ".mypy_cache",
    ".pytest_cache",
    ".DS_Store",
    ".idea",
    "dist",
    "build",
}

# -------- helpers --------

def _human(n: int) -> str:
    for unit in ("B","KB","MB","GB","TB"):
        if n < 1024:
            return f"{n:.0f}{unit}"
        n /= 1024
    return f"{n:.1f}PB"

def is_probably_text(path: Path, probe_bytes: int = 2048) -> bool:
    """Heuristic: if the first chunk has NULs or very high non-text ratio -> binary."""
    try:
        with path.open("rb") as f:
            chunk = f.read(probe_bytes)
        if b"\x00" in chunk:
            return False
        # try utf-8 decode with 'strict' to catch obvious binaries
        try:
            chunk.decode("utf-8")
            return True
        except UnicodeDecodeError:
            # last resort: cp1252 decode; if that still fails badly, treat as binary
            try:
                chunk.decode("cp1252")
                return True
            except UnicodeDecodeError:
                return False
    except Exception:
        return False

def language_for(path: Path) -> str:
    ext = path.suffix.lower()
    if path.name in LANG_MAP:
        return LANG_MAP[path.name]
    return LANG_MAP.get(ext, "")

def should_skip_dir(dirname: str, extra_excludes: Iterable[str]) -> bool:
    base = dirname.strip("/\\")
    if base in DEFAULT_EXCLUDES:
        return True
    if base in extra_excludes:
        return True
    return False

def walk_files(root: Path, extra_excludes: Iterable[str]) -> Iterable[Path]:
    excludes = set(extra_excludes)
    for dirpath, dirnames, filenames in os.walk(root):
        # mutate dirnames in-place to prune traversal
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d, excludes)]
        for fn in filenames:
            if fn in DEFAULT_EXCLUDES or fn in excludes:
                continue
            p = Path(dirpath) / fn
            yield p

def read_file_text(path: Path) -> Tuple[str, bool]:
    """Return (text, truncated?) reading with utf-8 then fallback cp1252."""
    try:
        return path.read_text(encoding="utf-8", errors="strict"), False
    except Exception:
        try:
            return path.read_text(encoding="utf-8", errors="replace"), False
        except Exception:
            try:
                return path.read_text(encoding="cp1252", errors="replace"), False
            except Exception:
                return "", True

# -------- main --------

def main() -> None:
    ap = argparse.ArgumentParser(description="Bundle a repo into one Markdown file.")
    ap.add_argument("--root", default=".", help="Root folder to scan (default: .)")
    ap.add_argument("--output", default="combined_repo.md",
                    help="Output Markdown file (default: combined_repo.md)")
    ap.add_argument("--max-file-mb", type=float, default=0.0,
                    help="Skip files larger than this many MB (0 means unlimited).")
    ap.add_argument("--exclude", default="",
                    help="Semicolon-separated names to exclude (folders or files).")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    out_path = Path(args.output).resolve()
    extra_excludes = [e for e in args.exclude.split(";") if e.strip()]
    max_bytes = int(args.max_file_mb * 1024 * 1024)

    if not root.exists():
        print(f"[!] Root does not exist: {root}", file=sys.stderr)
        sys.exit(2)

    # write header
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as out:
        ts = _dt.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        out.write(f"# Combined Repository Snapshot\n\n")
        out.write(f"- **Root:** `{root}`\n")
        out.write(f"- **Generated:** {ts}\n")
        out.write(f"- **Excludes:** {sorted(set(DEFAULT_EXCLUDES).union(extra_excludes))}\n")
        if max_bytes > 0:
            out.write(f"- **Max per-file size:** {args.max_file_mb} MB\n")
        else:
            out.write(f"- **Max per-file size:** unlimited\n")
        out.write("\n---\n\n")

    total_files = 0
    total_bytes = 0
    written_files = 0
    skipped_binary = 0
    skipped_size = 0
    errored = 0

    with out_path.open("a", encoding="utf-8") as out:
        for p in sorted(walk_files(root, extra_excludes)):
            total_files += 1
            rel = p.relative_to(root)

            try:
                size = p.stat().st_size
            except Exception:
                size = 0

            if max_bytes > 0 and size > max_bytes:
                skipped_size += 1
                out.write(f"## `{rel.as_posix()}`  \n")
                out.write(f"> Skipped (>{_human(max_bytes)} limit). Actual size: {_human(size)}\n\n")
                continue

            if not is_probably_text(p):
                skipped_binary += 1
                out.write(f"## `{rel.as_posix()}`  \n")
                out.write(f"> Skipped (binary or non-text). Size: {_human(size)}\n\n")
                continue

            lang = language_for(p)
            text, _trunc = read_file_text(p)
            total_bytes += len(text.encode("utf-8", errors="ignore"))
            written_files += 1

            out.write(f"## `{rel.as_posix()}`\n\n")
            out.write(f"```{lang}\n{text}\n```\n\n")

    print(f"[OK] Wrote: {out_path}")
    print(f"  scanned files : {total_files}")
    print(f"  included      : {written_files}")
    print(f"  skipped(binary): {skipped_binary}")
    print(f"  skipped(size) : {skipped_size}")
    print(f"  total text    : {_human(total_bytes)}")

if __name__ == "__main__":
    main()
