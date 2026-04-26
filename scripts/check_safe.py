#!/usr/bin/env python3
"""Run the safest repeatable SuperNova checks.

This helper intentionally runs only existing verification paths. It does not
start servers, mutate data, deploy, or enforce new auth/product behavior.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "super-nova-2177"
SMOKE_SCRIPT = ROOT / "scripts" / "smoke_protocol.py"
CORE_DIFF_PATHS = (
    "super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py",
    "super-nova-2177/frontend-vite-basic/supernovacore.py",
)


def run(label: str, command: list[str], cwd: Path = ROOT) -> int:
    print(f"\n== {label} ==")
    print(" ".join(command))
    completed = subprocess.run(command, cwd=str(cwd))
    if completed.returncode == 0:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label} ({completed.returncode})")
    return int(completed.returncode)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run safe SuperNova verification checks.")
    parser.add_argument("--base-url", default="https://2177.tech", help="Public base URL for protocol smoke checks")
    parser.add_argument(
        "--skip-live",
        action="store_true",
        help="Skip the public protocol smoke check when offline or avoiding network calls",
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    failures = 0

    failures += run(
        "backend federation safety tests",
        [sys.executable, "-m", "unittest", "backend.tests.test_public_federation_safety"],
        cwd=BACKEND_DIR,
    )

    if not args.skip_live:
        failures += run(
            "public protocol smoke",
            [sys.executable, str(SMOKE_SCRIPT), args.base_url],
            cwd=ROOT,
        )

    failures += run(
        "supernovacore.py zero diff",
        ["git", "-c", "safe.directory=D:/synk/FE4-main", "diff", "--", *CORE_DIFF_PATHS],
        cwd=ROOT,
    )

    if failures:
        print(f"\nSafe checks failed: {failures}")
        return 1
    print("\nAll safe checks passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
