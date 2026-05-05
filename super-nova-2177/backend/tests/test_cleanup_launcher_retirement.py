from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[3]
APP_ROOT = ROOT / "super-nova-2177"


class CleanupLauncherRetirementTests(unittest.TestCase):
    def test_frontend_professional_source_is_deleted_after_launcher_retirement(self):
        self.assertFalse((APP_ROOT / "frontend-professional").exists())
        self.assertFalse((APP_ROOT / "start_frontend_professional.ps1").exists())

        run_local = (APP_ROOT / "run_local.py").read_text(encoding="utf-8")
        self.assertNotIn('"professional"', run_local)
        self.assertNotIn("frontend-professional", run_local)

        launcher = (APP_ROOT / "start_supernova.ps1").read_text(encoding="utf-8")
        self.assertIn('"2" = "__retired_frontend_professional"', launcher)
        self.assertIn("frontend-professional local launchers were retired", launcher)
        self.assertNotIn('"frontend-professional" = 5173', launcher)

        repo_status = (APP_ROOT / "REPO_STATUS.md").read_text(encoding="utf-8")
        self.assertIn("Active social frontend: `frontend-social-seven`", repo_status)
        self.assertIn("The only active/default frontend is `frontend-social-seven`", repo_status)

        roadmap = (ROOT / "LEGACY_CLEANUP_ROADMAP.md").read_text(encoding="utf-8")
        self.assertIn("super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py", roadmap)
        self.assertIn("frontend-professional` | Deleted after launcher retirement", roadmap)


if __name__ == "__main__":
    unittest.main()
