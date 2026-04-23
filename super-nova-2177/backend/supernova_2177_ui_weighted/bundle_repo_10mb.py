#!/usr/bin/env python3
"""
bundle_repo_10mb.py
Create a single Markdown file with (most) text content of the repo,
capped at ~10 MB, so it can be shared with an AI assistant.
"""

from __future__ import annotations
import os
from pathlib import Path
import sys
import time
import mimetypes

# ---------- CONFIG ----------
MAX_BYTES = int(9.8 * 1024 * 1024)  # ~9.8 MB to stay under 10MB limits
OUTPUT_NAME = "_bundle_10mb.md"
REPO_ROOT = Path(__file__).resolve().parent

# Directories to skip entirely
SKIP_DIRS = {
    ".git", ".hg", ".svn", ".venv", "venv", "__pycache__", "node_modules",
    "dist", "build", ".next", ".cache", ".mypy_cache", ".pytest_cache",
    ".idea", ".vscode", ".ruff_cache", ".coverage", "coverage",
    ".DS_Store", ".terraform", ".gradle",
}

# File extensions considered "textish" enough to include
TEXT_EXTS = {
    ".py", ".pyi", ".ipynb", ".md", ".rst", ".txt",
    ".json", ".toml", ".yaml", ".yml", ".ini", ".cfg",
    ".csv", ".tsv",
    ".html", ".css", ".js", ".ts", ".tsx",
    ".vue", ".svelte",
    ".sh", ".bat", ".ps1", ".cmd",
    ".sql",
}

# Per-file soft cap (to avoid one giant log eating the whole budget)
PER_FILE_MAX_BYTES = 250_000  # ~244 KB
# ----------------------------

def is_probably_text(path: Path) -> bool:
    # First pass: extension allow-list
    if path.suffix.lower() in TEXT_EXTS:
        return True
    # Fallback: use mimetype guess
    mt, _ = mimetypes.guess_type(str(path))
    if mt is None:
        return False
    return mt.startswith("text/") or mt in ("application/json",)

def fence_lang_for(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".py": "python",
        ".js": "javascript",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".vue": "vue",
        ".svelte": "svelte",
        ".json": "json",
        ".yaml": "yaml",
        ".yml": "yaml",
        ".toml": "toml",
        ".ini": "ini",
        ".cfg": "ini",
        ".md": "markdown",
        ".html": "html",
        ".css": "css",
        ".sh": "bash",
        ".ps1": "powershell",
        ".bat": "bat",
        ".sql": "sql",
        ".txt": "",
        ".csv": "csv",
        ".tsv": "tsv",
        ".pyi": "python",
        ".ipynb": "json",
    }.get(ext, "")

def should_skip_dir(dirpath: Path) -> bool:
    name = dirpath.name
    if name in SKIP_DIRS:
        return True
    # Very large folders by pattern
    if name.startswith(".") and name not in {".github"}:
        # skip unknown dot-dirs except workflows
        return True
    return False

def gather_files(root: Path) -> list[Path]:
    files: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirpath = Path(dirpath)
        # prune dirs in-place
        dirnames[:] = [d for d in dirnames if not should_skip_dir(dirpath / d)]
        for fname in filenames:
            p = dirpath / fname
            if p.name == OUTPUT_NAME:
                continue
            # quick binary filter
            if not is_probably_text(p):
                continue
            files.append(p)
    # stable ordering
    files.sort()
    return files

def read_truncated(path: Path, limit: int) -> str:
    try:
        data = path.read_bytes()
    except Exception as e:
        return f"<<ERROR reading {path}: {e}>>\n"
    if len(data) > limit:
        head = data[:limit]
        try:
            text = head.decode("utf-8", errors="replace")
        except Exception:
            text = str(head)[:limit]
        text += f"\n\n<<TRUNCATED {path.name}: {len(data)-limit} bytes omitted>>\n"
        return text
    else:
        try:
            return data.decode("utf-8", errors="replace")
        except Exception:
            return str(data)

def main() -> int:
    out_path = REPO_ROOT / OUTPUT_NAME
    files = gather_files(REPO_ROOT)

    header = (
        f"# Repo bundle: {REPO_ROOT.name}\n\n"
        f"- Generated: {time.strftime('%Y-%m-%d %H:%M:%S')}\n"
        f"- Root: `{REPO_ROOT}`\n"
        f"- File count (text-ish): {len(files)}\n"
        f"- Max size: {MAX_BYTES} bytes\n\n"
        f"> Non-text & large/binary paths are skipped. Some files may be truncated.\n\n"
    )
    blob = header.encode("utf-8")
    total = len(blob)
    parts = [blob]

    for p in files:
        rel = p.relative_to(REPO_ROOT)
        fence = fence_lang_for(p)
        prolog = f"\n\n---\n\n## `{rel.as_posix()}`\n\n```{fence}\n".encode("utf-8")
        epilog = b"\n```\n"
        candidate = prolog + read_truncated(p, PER_FILE_MAX_BYTES).encode("utf-8") + epilog

        if total + len(candidate) > MAX_BYTES:
            parts.append(b"\n\n---\n\n<<SIZE LIMIT REACHED â€“ remaining files omitted>>\n")
            break

        parts.append(candidate)
        total += len(candidate)

    out_path.write_bytes(b"".join(parts))
    print(f"Created: {out_path}  ({total} bytes)")
    return 0

if __name__ == "__main__":
    sys.exit(main())

