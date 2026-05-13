import hashlib
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
SUPER_NOVA_DIR = BACKEND_DIR / "supernova_2177_ui_weighted"
for path in (ROOT, BACKEND_DIR, SUPER_NOVA_DIR):
    path_text = str(path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)

import password_hashing  # noqa: E402
import db_models  # noqa: E402


class PasswordHashingTests(unittest.TestCase):
    def test_shared_pbkdf2_helper_hashes_and_verifies_without_bare_sha(self):
        hashed = password_hashing.hash_password_pbkdf2("correct horse")

        self.assertTrue(hashed.startswith(f"{password_hashing.PBKDF2_HASH_PREFIX}$"))
        self.assertFalse(password_hashing.is_legacy_sha256_hash(hashed))
        self.assertTrue(password_hashing.verify_password_pbkdf2("correct horse", hashed))
        self.assertFalse(password_hashing.verify_password_pbkdf2("wrong horse", hashed))

    def test_strict_hashing_does_not_create_bare_sha256(self):
        hashed = password_hashing.hash_password_strict("correct horse")
        verified, legacy_upgrade = password_hashing.verify_password_with_legacy_upgrade(
            "correct horse",
            hashed,
        )

        self.assertFalse(password_hashing.is_legacy_sha256_hash(hashed))
        self.assertTrue(verified)
        self.assertFalse(legacy_upgrade)

    def test_legacy_sha256_detection_and_verification(self):
        legacy = hashlib.sha256("legacy-password".encode()).hexdigest()

        self.assertTrue(password_hashing.is_legacy_sha256_hash(legacy))
        self.assertTrue(
            password_hashing.verify_legacy_sha256_password("legacy-password", legacy)
        )
        self.assertFalse(
            password_hashing.verify_legacy_sha256_password("wrong-password", legacy)
        )
        self.assertEqual(
            password_hashing.verify_password_with_legacy_upgrade(
                "legacy-password",
                legacy,
            ),
            (True, True),
        )
        self.assertEqual(
            password_hashing.verify_password_with_legacy_upgrade("wrong-password", legacy),
            (False, True),
        )

    def test_harmonizer_set_password_does_not_store_bare_sha256(self):
        harmonizer = db_models.Harmonizer(
            username="hash-test",
            email="hash-test@example.test",
            hashed_password="placeholder",
        )

        harmonizer.set_password("new-secret")

        self.assertFalse(password_hashing.is_legacy_sha256_hash(harmonizer.hashed_password))
        self.assertTrue(harmonizer.verify_password("new-secret"))
        self.assertFalse(harmonizer.verify_password("wrong-secret"))

    def test_harmonizer_verify_password_accepts_pbkdf2_hashes(self):
        harmonizer = db_models.Harmonizer(
            username="pbkdf2-test",
            email="pbkdf2-test@example.test",
            hashed_password=password_hashing.hash_password_pbkdf2("pbkdf2-secret"),
        )

        self.assertTrue(harmonizer.verify_password("pbkdf2-secret"))
        self.assertFalse(harmonizer.verify_password("wrong-secret"))

    def test_seed_default_users_does_not_create_bare_sha256_hashes(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "seed_default_users.sqlite"
            db_models.init_db(f"sqlite:///{db_path.as_posix()}")
            db_models.seed_default_users()

            session = db_models.SessionLocal()
            try:
                users = {
                    user.username: user.hashed_password
                    for user in session.query(db_models.Harmonizer).filter(
                        db_models.Harmonizer.username.in_(["guest", "demo_user"])
                    )
                }
            finally:
                session.close()
                db_models.engine.dispose()

        self.assertEqual(set(users), {"guest", "demo_user"})
        for username, hashed in users.items():
            with self.subTest(username=username):
                self.assertFalse(password_hashing.is_legacy_sha256_hash(hashed))
                verified, legacy_upgrade = password_hashing.verify_password_with_legacy_upgrade(
                    username,
                    hashed,
                )
                self.assertTrue(verified)
                self.assertFalse(legacy_upgrade)

    def test_legacy_login_upgrades_hash_after_successful_password_auth(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "legacy_login_upgrade.sqlite"
            env = {
                key: value
                for key, value in os.environ.items()
                if key.upper() != "SUPERNOVA_ACCESS_TOKEN_MINUTES"
            }
            env.update(
                {
                    "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                    "DB_MODE": "central",
                    "SECRET_KEY": "strong-test-secret-for-password-hashing",
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
                import hashlib
                import json
                import os
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
                from db_models import Base
                from password_hashing import (
                    is_legacy_sha256_hash,
                    verify_password_with_legacy_upgrade,
                )

                client = TestClient(backend_app.app)
                db = backend_app.SessionLocal()
                try:
                    Base.metadata.create_all(bind=db.get_bind())
                    legacy_hash = hashlib.sha256("legacy-secret".encode()).hexdigest()
                    user = backend_app.Harmonizer(
                        username="legacy-user",
                        email="legacy-user@example.test",
                        hashed_password=legacy_hash,
                        bio="legacy",
                        species="human",
                        profile_pic="default.jpg",
                        is_active=True,
                        consent_given=True,
                    )
                    db.add(user)
                    db.commit()
                finally:
                    db.close()

                response = client.post(
                    "/auth/login",
                    json={"username": "legacy-user", "password": "legacy-secret"},
                )

                db = backend_app.SessionLocal()
                try:
                    upgraded = db.query(backend_app.Harmonizer).filter(
                        backend_app.func.lower(backend_app.Harmonizer.username)
                        == "legacy-user"
                    ).first()
                    upgraded_hash = upgraded.hashed_password
                    verified, legacy_upgrade = verify_password_with_legacy_upgrade(
                        "legacy-secret",
                        upgraded_hash,
                    )
                    result = {
                        "status_code": response.status_code,
                        "has_token": bool(response.json().get("access_token"))
                        if response.status_code == 200
                        else False,
                        "upgraded_is_legacy_sha": is_legacy_sha256_hash(upgraded_hash),
                        "upgraded_verifies": verified,
                        "upgraded_needs_legacy_upgrade": legacy_upgrade,
                    }
                finally:
                    db.close()

                print("AUTH_PASSWORD_HASHING_RESULT=" + json.dumps(result, sort_keys=True))
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
            if line.startswith("AUTH_PASSWORD_HASHING_RESULT=")
        ]
        self.assertTrue(result_lines, msg=f"probe result missing\nstdout:\n{completed.stdout}")
        result = json.loads(result_lines[-1].split("=", 1)[1])

        self.assertEqual(result["status_code"], 200)
        self.assertTrue(result["has_token"])
        self.assertFalse(result["upgraded_is_legacy_sha"])
        self.assertTrue(result["upgraded_verifies"])
        self.assertFalse(result["upgraded_needs_legacy_upgrade"])


if __name__ == "__main__":
    unittest.main()
