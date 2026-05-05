from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = ROOT / "super-nova-2177"


class LegacyFrontendCleanupCloseoutTests(unittest.TestCase):
    def test_closeout_doc_exists_and_names_final_state(self):
        closeout_path = ROOT / "LEGACY_FRONTEND_CLEANUP_CLOSEOUT.md"
        self.assertTrue(closeout_path.exists())
        closeout = closeout_path.read_text(encoding="utf-8")

        for expected in [
            "legacy frontend cleanup sprint is closed",
            "super-nova-2177/frontend-social-seven",
            "super-nova-2177/backend/app.py",
            "super-nova-2177/frontend-vite-basic",
            "super-nova-2177/frontend-vite-basic/supernovacore.py",
            "super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py",
            "nova-web",
            "nova-api",
            "transcendental_resonance_frontend",
            "manual alpha browser smoke",
            "durable object storage",
        ]:
            self.assertIn(expected, closeout)

    def test_deleted_frontends_are_not_active_launchable_targets(self):
        run_local = (APP_ROOT / "run_local.py").read_text(encoding="utf-8")
        launcher = (APP_ROOT / "start_supernova.ps1").read_text(encoding="utf-8")

        for frontend in [
            "frontend-nova",
            "frontend-professional",
            "frontend-vite-3d",
            "frontend-next",
            "frontend-social-six",
        ]:
            self.assertNotIn(f'"{frontend}" = ', launcher)
            self.assertNotIn(f'"{frontend}": {{', run_local)

        self.assertIn("frontend-social-seven", launcher)
        self.assertIn("social-seven", run_local)
        self.assertIn("active/default FE7", run_local)

    def test_frontend_vite_basic_retained_as_protected_core_surface(self):
        self.assertTrue((APP_ROOT / "frontend-vite-basic").exists())
        self.assertTrue((APP_ROOT / "frontend-vite-basic" / "supernovacore.py").exists())

        for path in [
            ROOT / "LEGACY_FRONTEND_CLEANUP_CLOSEOUT.md",
            ROOT / "CLEANUP_CANDIDATES_SNAPSHOT.md",
            ROOT / "LEGACY_CLEANUP_ROADMAP.md",
            ROOT / "MAINTENANCE_AUDIT.md",
            APP_ROOT / "REPO_STATUS.md",
            APP_ROOT / "LOCAL_DEV.md",
        ]:
            text = path.read_text(encoding="utf-8")
            self.assertIn("frontend-vite-basic", text, msg=str(path))
            self.assertIn("protected", text.lower(), msg=str(path))
            self.assertIn("supernovacore.py", text, msg=str(path))

    def test_protected_core_zero_diff_guard_remains_documented(self):
        closeout = (ROOT / "LEGACY_FRONTEND_CLEANUP_CLOSEOUT.md").read_text(
            encoding="utf-8"
        )
        safe_check = (ROOT / "scripts" / "check_safe.py").read_text(encoding="utf-8")

        self.assertIn("git diff --exit-code HEAD", closeout)
        self.assertIn('"diff"', safe_check)
        self.assertIn('"--exit-code"', safe_check)
        self.assertIn('"HEAD"', safe_check)

        for expected in [
            "super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py",
            "super-nova-2177/frontend-vite-basic/supernovacore.py",
        ]:
            self.assertIn(expected, closeout)
            self.assertIn(expected, safe_check)


if __name__ == "__main__":
    unittest.main()
