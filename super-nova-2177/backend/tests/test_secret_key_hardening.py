import builtins
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
SUPER_NOVA_DIR = BACKEND_DIR / "supernova_2177_ui_weighted"
for path in (ROOT, BACKEND_DIR, SUPER_NOVA_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import backend.app as backend_app  # noqa: E402
import auth_utils  # noqa: E402


def _block_supernova_import():
    real_import = builtins.__import__

    def guarded_import(name, *args, **kwargs):
        if name == "superNova_2177":
            raise ImportError("blocked for fallback settings test")
        return real_import(name, *args, **kwargs)

    return guarded_import


class SecretKeyHardeningTests(unittest.TestCase):
    def test_production_env_missing_secret_fails(self):
        for marker, value in {
            "SUPERNOVA_ENV": "production",
            "APP_ENV": "prod",
            "ENV": "production",
            "RAILWAY_ENVIRONMENT": "production",
        }.items():
            with self.subTest(marker=marker):
                with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
                    backend_app._fallback_secret_key_from_env({marker: value})

    def test_production_env_placeholder_secret_fails(self):
        for placeholder in ("changeme", "dev", "secret", "default", ""):
            with self.subTest(placeholder=placeholder):
                with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
                    backend_app._fallback_secret_key_from_env(
                        {"SUPERNOVA_ENV": "production", "SECRET_KEY": placeholder}
                    )

    def test_production_env_strong_secret_passes(self):
        self.assertEqual(
            backend_app._fallback_secret_key_from_env(
                {
                    "SUPERNOVA_ENV": "production",
                    "SECRET_KEY": "strong-production-secret-for-tests",
                }
            ),
            "strong-production-secret-for-tests",
        )

    def test_local_dev_missing_secret_keeps_compatibility_default(self):
        self.assertEqual(backend_app._fallback_secret_key_from_env({}), "changeme")
        self.assertEqual(
            backend_app._fallback_secret_key_from_env({"SUPERNOVA_ENV": "development"}),
            "changeme",
        )

    def test_auth_utils_fallback_rejects_missing_secret_in_production(self):
        with patch.dict(os.environ, {"SUPERNOVA_ENV": "production"}, clear=True):
            with patch("builtins.__import__", side_effect=_block_supernova_import()):
                with self.assertRaisesRegex(RuntimeError, "SECRET_KEY"):
                    auth_utils.get_auth_settings()

    def test_auth_utils_fallback_allows_strong_secret_in_production(self):
        env = {
            "SUPERNOVA_ENV": "production",
            "SECRET_KEY": "strong-production-secret-for-tests",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch("builtins.__import__", side_effect=_block_supernova_import()):
                settings = auth_utils.get_auth_settings()

        self.assertEqual(settings.SECRET_KEY, "strong-production-secret-for-tests")
        self.assertEqual(settings.ALGORITHM, "HS256")


if __name__ == "__main__":
    unittest.main()
