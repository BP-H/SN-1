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
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import backend.app as backend_app  # noqa: E402


def run_image_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "image_fallback.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-image-fallback",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(Path(tmpdir) / "uploads"),
            }
        )
        env.pop("RAILWAY_ENVIRONMENT", None)
        completed = subprocess.run(
            [sys.executable, "-c", probe],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )

    if completed.returncode != 0:
        raise AssertionError(
            f"probe failed\nstdout:\n{completed.stdout}\nstderr:\n{completed.stderr}"
        )
    result_lines = [
        line
        for line in completed.stdout.splitlines()
        if line.startswith("IMAGE_FALLBACK_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


class LegacyUploadMediaPathTests(unittest.TestCase):
    def test_media_payload_does_not_double_legacy_upload_prefix(self):
        media = backend_app._media_payload(
            "uploads/legacy-image.jpg",
            "",
            "",
            "uploads/legacy-file.pdf",
        )

        self.assertEqual(media["image"], "/uploads/legacy-image.jpg")
        self.assertEqual(media["images"], ["/uploads/legacy-image.jpg"])
        self.assertEqual(media["file"], "/uploads/legacy-file.pdf")

    def test_media_payload_handles_legacy_upload_prefix_inside_image_list(self):
        media = backend_app._media_payload(
            '["uploads/one.jpg", "/uploads/two.jpg", "three.jpg"]',
        )

        self.assertEqual(
            media["images"],
            ["/uploads/one.jpg", "/uploads/two.jpg", "/uploads/three.jpg"],
        )

    def test_media_payload_uses_data_fallback_when_uploaded_file_is_missing(self):
        data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
        media = backend_app._media_payload(
            "missing-image.png",
            payload_value={"image_data_urls": [data_url]},
        )

        self.assertEqual(media["image"], data_url)
        self.assertEqual(media["images"], [data_url])

    def test_media_payload_prefers_upload_url_when_uploaded_file_exists(self):
        upload_path = Path(backend_app.uploads_dir) / "existing-alpha-image.png"
        upload_path.write_bytes(b"\x89PNG\r\n\x1a\n" + (b"\x00" * 16))
        try:
            media = backend_app._media_payload(
                "existing-alpha-image.png",
                payload_value={"image_data_urls": ["data:image/png;base64,unused"]},
            )
        finally:
            upload_path.unlink(missing_ok=True)

        self.assertEqual(media["image"], "/uploads/existing-alpha-image.png")
        self.assertEqual(media["images"], ["/uploads/existing-alpha-image.png"])

    def test_created_proposal_image_survives_missing_upload_file(self):
        probe = textwrap.dedent(
            """
            import json
            import sys
            from pathlib import Path

            from fastapi.testclient import TestClient

            project_root = Path.cwd()
            backend_dir = project_root / "backend"
            for path in (project_root, backend_dir):
                path_text = str(path)
                if path_text not in sys.path:
                    sys.path.insert(0, path_text)

            import backend.app as backend_app
            from db_models import Base

            client = TestClient(backend_app.app)

            def current_bind():
                session = backend_app.SessionLocal()
                try:
                    return session.get_bind()
                finally:
                    session.close()

            Base.metadata.create_all(bind=current_bind())
            db = backend_app.SessionLocal()
            try:
                db.add(backend_app.Harmonizer(
                    username="alice",
                    email="alice@example.test",
                    hashed_password="test",
                    species="human",
                    profile_pic="default.jpg",
                ))
                db.commit()
            finally:
                db.close()

            headers = {"Authorization": f"Bearer {backend_app._create_wrapper_access_token('alice')}"}
            png = b"\\x89PNG\\r\\n\\x1a\\n" + (b"\\x00" * 64)
            created = client.post(
                "/proposals",
                data={
                    "title": "Persistent image",
                    "body": "This image should survive a missing upload file.",
                    "author": "alice",
                    "author_type": "human",
                },
                files={"images": ("persistent.png", png, "image/png")},
                headers=headers,
            )
            created_payload = created.json()
            proposal_id = created_payload.get("id")
            upload_url = created_payload.get("media", {}).get("image", "")
            upload_file = Path(backend_app.uploads_dir) / upload_url.rsplit("/", 1)[-1]
            file_existed_before = upload_file.exists()
            upload_file.unlink(missing_ok=True)
            detail = client.get(f"/proposals/{proposal_id}")
            detail_payload = detail.json()
            image_after_missing_file = detail_payload.get("media", {}).get("image", "")
            result = {
                "created_status": created.status_code,
                "detail_status": detail.status_code,
                "file_existed_before": file_existed_before,
                "created_image": upload_url,
                "image_after_missing_file_prefix": image_after_missing_file[:22],
                "image_after_missing_file_is_data": image_after_missing_file.startswith("data:image/png;base64,"),
            }
            print("IMAGE_FALLBACK_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_image_probe(probe)

        self.assertEqual(result["created_status"], 200)
        self.assertEqual(result["detail_status"], 200)
        self.assertTrue(result["file_existed_before"])
        self.assertTrue(result["created_image"].startswith("/uploads/"))
        self.assertTrue(result["image_after_missing_file_is_data"])


if __name__ == "__main__":
    unittest.main()
