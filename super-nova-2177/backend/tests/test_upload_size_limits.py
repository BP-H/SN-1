import json
import os
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def run_upload_probe(probe: str) -> dict:
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        upload_dir = tmp_path / "uploads"
        db_path = tmp_path / "upload_size_limits.sqlite"
        env = os.environ.copy()
        env.update(
            {
                "DATABASE_URL": f"sqlite:///{db_path.as_posix()}",
                "DB_MODE": "central",
                "SECRET_KEY": "strong-test-secret-for-upload-size-limits",
                "SUPERNOVA_ENV": "development",
                "APP_ENV": "development",
                "ENV": "development",
                "UPLOADS_DIR": str(upload_dir),
                "UPLOAD_IMAGE_MAX_BYTES": "16",
                "UPLOAD_AVATAR_MAX_BYTES": "16",
                "UPLOAD_VIDEO_MAX_BYTES": "32",
                "UPLOAD_DOCUMENT_MAX_BYTES": "16",
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
        if line.startswith("UPLOAD_SIZE_LIMIT_RESULT=")
    ]
    if not result_lines:
        raise AssertionError(f"probe result missing\nstdout:\n{completed.stdout}")
    return json.loads(result_lines[-1].split("=", 1)[1])


PROBE_PREAMBLE = """
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

client = TestClient(backend_app.app)
upload_dir = Path(os.environ["UPLOADS_DIR"])


def uploaded_files():
    if not upload_dir.exists():
        return []
    return sorted(item.name for item in upload_dir.iterdir() if item.is_file())
"""


class UploadSizeLimitTests(unittest.TestCase):
    def test_small_valid_image_upload_still_succeeds_with_existing_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-image",
                files={"file": ("avatar.png", b"small-image", "image/png")},
            )
            payload = response.json()
            result = {
                "status_code": response.status_code,
                "keys": sorted(payload.keys()),
                "url": payload.get("url", ""),
                "filename": payload.get("filename", ""),
                "content_type": payload.get("content_type"),
                "profile_synced": payload.get("profile_synced"),
                "files": uploaded_files(),
            }
            print("UPLOAD_SIZE_LIMIT_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_upload_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(
            set(result["keys"]),
            {"content_type", "filename", "profile_synced", "sync_error", "url"},
        )
        self.assertTrue(result["filename"].endswith(".png"))
        self.assertEqual(result["url"], f"/uploads/{result['filename']}")
        self.assertEqual(result["content_type"], "image/png")
        self.assertFalse(result["profile_synced"])
        self.assertEqual(result["files"], [result["filename"]])

    def test_octet_stream_image_with_allowed_extension_still_succeeds(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-image",
                files={"file": ("mobile-photo.jpg", b"small-image", "application/octet-stream")},
            )
            payload = response.json()
            result = {
                "status_code": response.status_code,
                "filename": payload.get("filename", ""),
                "url": payload.get("url", ""),
                "files": uploaded_files(),
            }
            print("UPLOAD_SIZE_LIMIT_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_upload_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertTrue(result["filename"].endswith(".jpg"))
        self.assertEqual(result["url"], f"/uploads/{result['filename']}")
        self.assertEqual(result["files"], [result["filename"]])

    def test_unsupported_image_extension_still_fails_without_file(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-image",
                files={"file": ("avatar.exe", b"small-image", "application/octet-stream")},
            )
            result = {
                "status_code": response.status_code,
                "detail": response.json().get("detail"),
                "files": uploaded_files(),
            }
            print("UPLOAD_SIZE_LIMIT_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_upload_probe(probe)

        self.assertEqual(result["status_code"], 400)
        self.assertEqual(result["detail"], "Uploaded file must be an image")
        self.assertEqual(result["files"], [])

    def test_small_valid_document_upload_still_succeeds_with_existing_shape(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-file",
                files={"file": ("note.txt", b"small-note", "text/plain")},
            )
            payload = response.json()
            result = {
                "status_code": response.status_code,
                "keys": sorted(payload.keys()),
                "filename": payload.get("filename", ""),
                "url": payload.get("url", ""),
                "files": uploaded_files(),
            }
            print("UPLOAD_SIZE_LIMIT_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_upload_probe(probe)

        self.assertEqual(result["status_code"], 200)
        self.assertEqual(set(result["keys"]), {"filename", "url"})
        self.assertTrue(result["filename"].endswith(".txt"))
        self.assertEqual(result["url"], f"/uploads/{result['filename']}")
        self.assertEqual(result["files"], [result["filename"]])

    def test_oversized_image_fails_and_removes_partial_file(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-image",
                files={"file": ("too-large.png", b"x" * 17, "image/png")},
            )
            result = {
                "status_code": response.status_code,
                "detail": response.json().get("detail"),
                "files": uploaded_files(),
            }
            print("UPLOAD_SIZE_LIMIT_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_upload_probe(probe)

        self.assertEqual(result["status_code"], 413)
        self.assertEqual(result["detail"], "Uploaded file is too large")
        self.assertEqual(result["files"], [])

    def test_oversized_document_fails_and_removes_partial_file(self):
        probe = PROBE_PREAMBLE + textwrap.dedent(
            """
            response = client.post(
                "/upload-file",
                files={"file": ("too-large.pdf", b"x" * 17, "application/pdf")},
            )
            result = {
                "status_code": response.status_code,
                "detail": response.json().get("detail"),
                "files": uploaded_files(),
            }
            print("UPLOAD_SIZE_LIMIT_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_upload_probe(probe)

        self.assertEqual(result["status_code"], 413)
        self.assertEqual(result["detail"], "Uploaded file is too large")
        self.assertEqual(result["files"], [])


if __name__ == "__main__":
    unittest.main()
