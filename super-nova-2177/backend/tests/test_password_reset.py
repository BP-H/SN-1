import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

import password_hashing  # noqa: E402
import password_reset  # noqa: E402


class PasswordResetTests(unittest.TestCase):
    def test_reset_code_verifies_and_is_invalid_after_password_change(self):
        original_hash = password_hashing.hash_password_strict("old-secret")
        next_hash = password_hashing.hash_password_strict("new-secret")
        code = password_reset.create_password_reset_code(
            user_id=12,
            email="human@example.test",
            hashed_password=original_hash,
            secret_key="strong-reset-test-secret",
            now=1000,
            ttl_seconds=300,
        )

        self.assertTrue(
            password_reset.verify_password_reset_code(
                code,
                user_id=12,
                email="human@example.test",
                hashed_password=original_hash,
                secret_key="strong-reset-test-secret",
                now=1100,
            )
        )
        self.assertFalse(
            password_reset.verify_password_reset_code(
                code,
                user_id=12,
                email="human@example.test",
                hashed_password=next_hash,
                secret_key="strong-reset-test-secret",
                now=1100,
            )
        )

    def test_reset_code_expires_and_rejects_wrong_email(self):
        hashed = password_hashing.hash_password_strict("old-secret")
        code = password_reset.create_password_reset_code(
            user_id=12,
            email="human@example.test",
            hashed_password=hashed,
            secret_key="strong-reset-test-secret",
            now=1000,
            ttl_seconds=300,
        )

        self.assertFalse(
            password_reset.verify_password_reset_code(
                code,
                user_id=12,
                email="other@example.test",
                hashed_password=hashed,
                secret_key="strong-reset-test-secret",
                now=1100,
            )
        )
        self.assertFalse(
            password_reset.verify_password_reset_code(
                code,
                user_id=12,
                email="human@example.test",
                hashed_password=hashed,
                secret_key="strong-reset-test-secret",
                now=1401,
            )
        )

    def test_request_response_is_safe_and_does_not_include_secret_material(self):
        payload = password_reset.password_reset_request_response(email_configured=True)
        encoded = json.dumps(payload).lower()

        self.assertEqual(payload["ok"], True)
        self.assertEqual(payload["email_configured"], True)
        for private_key in ("secret", "smtp", "database", "code", "hashed_password"):
            self.assertNotIn(private_key, encoded)

    def test_reset_base_url_requires_configured_url_unless_local_dev_flag_allows_it(self):
        self.assertEqual(
            password_reset.resolve_password_reset_base_url(
                "https://attacker.example/reset",
                environ={"SUPERNOVA_PASSWORD_RESET_ALLOW_REQUEST_BASE_URL": "0"},
            ),
            "",
        )
        self.assertEqual(
            password_reset.resolve_password_reset_base_url(
                "https://attacker.example/reset",
                environ={"SUPERNOVA_PASSWORD_RESET_ALLOW_REQUEST_BASE_URL": "1"},
            ),
            "",
        )
        self.assertEqual(
            password_reset.resolve_password_reset_base_url(
                "http://localhost:3000",
                environ={"SUPERNOVA_PASSWORD_RESET_ALLOW_REQUEST_BASE_URL": "1"},
            ),
            "http://localhost:3000",
        )
        self.assertEqual(
            password_reset.resolve_password_reset_base_url(
                "https://attacker.example/reset",
                environ={"SUPERNOVA_PASSWORD_RESET_PUBLIC_BASE_URL": "https://2177.tech"},
            ),
            "https://2177.tech",
        )

    def test_debug_reset_base_url_only_for_local_origin_with_flag(self):
        # Disabled by default — no link is ever logged without the opt-in flag.
        self.assertEqual(
            password_reset.resolve_password_reset_debug_base_url(
                "http://localhost:3007", environ={}
            ),
            "",
        )
        # Enabled + local origin → usable base URL for a console-logged link.
        self.assertEqual(
            password_reset.resolve_password_reset_debug_base_url(
                "http://localhost:3007",
                environ={"SUPERNOVA_PASSWORD_RESET_DEBUG_LOG": "1"},
            ),
            "http://localhost:3007",
        )
        # Enabled but a NON-local origin is refused, so prod hosts never get a
        # logged reset link even if the flag is left on by accident.
        self.assertEqual(
            password_reset.resolve_password_reset_debug_base_url(
                "https://2177.tech",
                environ={"SUPERNOVA_PASSWORD_RESET_DEBUG_LOG": "1"},
            ),
            "",
        )

    def test_password_reset_ttl_parser_handles_invalid_values(self):
        self.assertEqual(password_reset._safe_positive_int("120", 1800), 120)
        self.assertEqual(password_reset._safe_positive_int("", 1800), 1800)
        self.assertEqual(password_reset._safe_positive_int("not-a-number", 1800), 1800)
        self.assertEqual(password_reset._safe_positive_int("-5", 1800), 1800)

    def test_password_reset_request_prefers_email_match_over_username_collision(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "password_reset_collision.sqlite"
            env = {
                key: value
                for key, value in os.environ.items()
                if key.upper() not in {"SUPERNOVA_ACCESS_TOKEN_MINUTES", "DATABASE_URL"}
            }
            env.update(
                {
                    "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                    "DB_MODE": "central",
                    "SECRET_KEY": "strong-test-secret-for-password-reset-collision",
                    "SUPERNOVA_ACCESS_TOKEN_MINUTES": "720",
                    "SUPERNOVA_ENV": "development",
                    "APP_ENV": "development",
                    "ENV": "development",
                    "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
                    "SUPERNOVA_PASSWORD_RESET_PUBLIC_BASE_URL": "https://2177.tech",
                    "SUPERNOVA_PASSWORD_RESET_SMTP_HOST": "smtp.example.test",
                    "SUPERNOVA_PASSWORD_RESET_FROM": "noreply@example.test",
                }
            )
            env.pop("RAILWAY_ENVIRONMENT", None)

            probe = textwrap.dedent(
                """
                import json
                import sys
                from pathlib import Path

                from fastapi.testclient import TestClient

                root = Path.cwd()
                backend_dir = root / "backend"
                for path in (root, backend_dir):
                    path_text = str(path)
                    if path_text not in sys.path:
                        sys.path.insert(0, path_text)

                import backend.app as backend_app
                from password_hashing import hash_password_strict

                client = TestClient(backend_app.app)
                captured = []

                def fake_send(**kwargs):
                    captured.append(kwargs)

                backend_app._send_password_reset_email_safely = fake_send

                db = backend_app.SessionLocal()
                try:
                    account_a = backend_app.Harmonizer(
                        username="victim@example.test",
                        email="a@example.test",
                        hashed_password=hash_password_strict("a-secret"),
                        bio="a",
                        species="human",
                        profile_pic="default.jpg",
                        is_active=True,
                        consent_given=True,
                    )
                    account_b = backend_app.Harmonizer(
                        username="victim",
                        email="victim@example.test",
                        hashed_password=hash_password_strict("b-secret"),
                        bio="b",
                        species="human",
                        profile_pic="default.jpg",
                        is_active=True,
                        consent_given=True,
                    )
                    db.add(account_a)
                    db.add(account_b)
                    db.commit()
                finally:
                    db.close()

                response = client.post(
                    "/auth/password-reset/request",
                    json={"identifier": "victim@example.test"},
                )
                print("PASSWORD_RESET_COLLISION_RESULT=" + json.dumps({
                    "status": response.status_code,
                    "body": response.json(),
                    "captured": captured,
                }, sort_keys=True))
                """
            )

            completed = subprocess.run(
                [sys.executable, "-c", probe],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
        )
        result_lines = [
            line
            for line in completed.stdout.splitlines()
            if line.startswith("PASSWORD_RESET_COLLISION_RESULT=")
        ]
        self.assertTrue(result_lines, msg=f"probe result missing\nstdout:\n{completed.stdout}")
        result = json.loads(result_lines[-1].split("=", 1)[1])

        self.assertEqual(result["status"], 200)
        self.assertEqual(result["body"]["ok"], True)
        self.assertEqual(result["body"]["email_configured"], True)
        self.assertEqual(len(result["captured"]), 1)
        self.assertEqual(result["captured"][0]["to_email"], "victim@example.test")
        self.assertEqual(result["captured"][0]["username"], "victim")

    def test_password_reset_confirm_route_updates_password_without_schema_change(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "password_reset.sqlite"
            env = {
                key: value
                for key, value in os.environ.items()
                if key.upper() not in {"SUPERNOVA_ACCESS_TOKEN_MINUTES", "DATABASE_URL"}
            }
            env.update(
                {
                    "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                    "DB_MODE": "central",
                    "SECRET_KEY": "strong-test-secret-for-password-reset",
                    "SUPERNOVA_ACCESS_TOKEN_MINUTES": "720",
                    "SUPERNOVA_ENV": "development",
                    "APP_ENV": "development",
                    "ENV": "development",
                    "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
                }
            )
            env.pop("RAILWAY_ENVIRONMENT", None)

            probe = textwrap.dedent(
                """
                import json
                import sys
                from pathlib import Path

                from fastapi.testclient import TestClient

                root = Path.cwd()
                backend_dir = root / "backend"
                for path in (root, backend_dir):
                    path_text = str(path)
                    if path_text not in sys.path:
                        sys.path.insert(0, path_text)

                import backend.app as backend_app
                from password_hashing import hash_password_strict, verify_password_with_legacy_upgrade
                from password_reset import create_password_reset_code

                client = TestClient(backend_app.app)
                db = backend_app.SessionLocal()
                try:
                    user = backend_app.Harmonizer(
                        username="reset-user",
                        email="reset-user@example.test",
                        hashed_password=hash_password_strict("old-secret"),
                        bio="reset",
                        species="human",
                        profile_pic="default.jpg",
                        is_active=True,
                        consent_given=True,
                    )
                    db.add(user)
                    db.commit()
                    db.refresh(user)
                    code = create_password_reset_code(
                        user_id=user.id,
                        email=user.email,
                        hashed_password=user.hashed_password,
                        secret_key=backend_app.get_settings().SECRET_KEY,
                    )
                finally:
                    db.close()

                request_response = client.post(
                    "/auth/password-reset/request",
                    json={"identifier": "missing@example.test", "redirect_base_url": "https://2177.tech"},
                )
                reset_response = client.post(
                    "/auth/password-reset/confirm",
                    json={"code": code, "password": "new-secret"},
                )
                login_old = client.post("/auth/login", json={"username": "reset-user", "password": "old-secret"})
                login_new = client.post("/auth/login", json={"username": "reset-user", "password": "new-secret"})

                db = backend_app.SessionLocal()
                try:
                    changed = db.query(backend_app.Harmonizer).filter(
                        backend_app.func.lower(backend_app.Harmonizer.username) == "reset-user"
                    ).first()
                    verified, legacy_upgrade = verify_password_with_legacy_upgrade("new-secret", changed.hashed_password)
                    result = {
                        "request_status": request_response.status_code,
                        "request_body": request_response.json(),
                        "reset_status": reset_response.status_code,
                        "reset_body": reset_response.json(),
                        "old_login_status": login_old.status_code,
                        "new_login_status": login_new.status_code,
                        "new_hash_verifies": verified,
                        "new_hash_legacy": legacy_upgrade,
                    }
                finally:
                    db.close()

                print("PASSWORD_RESET_RESULT=" + json.dumps(result, sort_keys=True))
                """
            )

            completed = subprocess.run(
                [sys.executable, "-c", probe],
                cwd=ROOT,
                env=env,
                capture_output=True,
                text=True,
                timeout=120,
                check=False,
            )

        self.assertEqual(
            completed.returncode,
            0,
            msg=f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}",
        )
        result_lines = [
            line
            for line in completed.stdout.splitlines()
            if line.startswith("PASSWORD_RESET_RESULT=")
        ]
        self.assertTrue(result_lines, msg=f"probe result missing\nstdout:\n{completed.stdout}")
        result = json.loads(result_lines[-1].split("=", 1)[1])

        self.assertEqual(result["request_status"], 200)
        self.assertEqual(result["request_body"]["ok"], True)
        self.assertEqual(result["request_body"]["email_configured"], False)
        self.assertNotIn("reset-user", json.dumps(result["request_body"]))
        self.assertEqual(result["reset_status"], 200)
        self.assertEqual(result["reset_body"]["ok"], True)
        self.assertEqual(result["old_login_status"], 401)
        self.assertEqual(result["new_login_status"], 200)
        self.assertTrue(result["new_hash_verifies"])
        self.assertFalse(result["new_hash_legacy"])


if __name__ == "__main__":
    unittest.main()
