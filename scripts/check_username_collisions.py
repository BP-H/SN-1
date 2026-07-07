#!/usr/bin/env python
"""Read-only preflight for case-insensitive username collisions.

Run this before promoting the harmonizers lower-username read index to UNIQUE.
The report intentionally includes only public-ish usernames and row ids; it
never prints emails, password hashes, tokens, secrets, or raw database URLs.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

from sqlalchemy import text


REPO_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = REPO_ROOT / "super-nova-2177"
BACKEND_DIR = PROJECT_ROOT / "backend"

for import_path in (PROJECT_ROOT, BACKEND_DIR):
    path_text = str(import_path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

try:
    from db_utils import SessionLocal
except Exception as exc:  # pragma: no cover - import failure path is operator-facing
    print(f"FAIL unable to load backend database session: {type(exc).__name__}", file=sys.stderr)
    raise SystemExit(2) from exc


def _collision_groups(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        username = str(row.get("username") or "").strip()
        if not username:
            continue
        grouped.setdefault(username.lower(), []).append(
            {
                "id": row.get("id"),
                "username": username,
            }
        )
    return {key: entries for key, entries in grouped.items() if len(entries) > 1}


def load_username_rows() -> list[dict[str, Any]]:
    session = SessionLocal()
    try:
        rows = session.execute(
            text(
                "SELECT id, username FROM harmonizers "
                "WHERE username IS NOT NULL AND trim(username) != ''"
            )
        ).mappings()
        return [dict(row) for row in rows]
    finally:
        session.close()


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Report case-insensitive username collisions without mutating the database."
    )
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON output.")
    args = parser.parse_args()

    try:
        collisions = _collision_groups(load_username_rows())
    except Exception as exc:
        message = f"FAIL unable to inspect harmonizers usernames: {type(exc).__name__}"
        if args.json:
            print(json.dumps({"ok": False, "error": message}, sort_keys=True))
        else:
            print(message)
        return 2

    payload = {
        "ok": not bool(collisions),
        "collision_group_count": len(collisions),
        "collisions": collisions,
    }
    if args.json:
        print(json.dumps(payload, sort_keys=True))
    elif collisions:
        print("FAIL case-insensitive username collisions found")
        for normalized, entries in sorted(collisions.items()):
            visible = ", ".join(f"{entry['username']}#{entry['id']}" for entry in entries)
            print(f"- {normalized}: {visible}")
    else:
        print("PASS no case-insensitive username collisions found")

    return 1 if collisions else 0


if __name__ == "__main__":
    raise SystemExit(main())
