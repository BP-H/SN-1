import sys
import unittest
from pathlib import Path

from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

import backend.app as backend_app  # noqa: E402


client = TestClient(backend_app.app)


class UploadRoutesExtractionTests(unittest.TestCase):
    def test_upload_routes_are_registered_from_dedicated_router(self):
        app_text = (BACKEND_DIR / "app.py").read_text(encoding="utf-8")
        module_text = (BACKEND_DIR / "routers" / "uploads.py").read_text(encoding="utf-8")

        self.assertIn("from .routers.uploads import create_uploads_router", app_text)
        self.assertIn("app.include_router(create_uploads_router(", app_text)
        self.assertNotIn('@app.post("/upload-image"', app_text)
        self.assertNotIn('@app.post("/upload-file"', app_text)
        self.assertIn('@router.post("/upload-image"', module_text)
        self.assertIn('@router.post("/upload-file"', module_text)

        registered = {
            (getattr(route, "path", ""), tuple(sorted(getattr(route, "methods", set()) or set())))
            for route in backend_app.app.routes
        }
        self.assertIn(("/upload-image", ("POST",)), registered)
        self.assertIn(("/upload-file", ("POST",)), registered)

    def test_static_uploads_mount_stays_in_backend_app(self):
        app_text = (BACKEND_DIR / "app.py").read_text(encoding="utf-8")
        module_text = (BACKEND_DIR / "routers" / "uploads.py").read_text(encoding="utf-8")

        self.assertIn('app.mount("/uploads", SuperNovaUploadStaticFiles(directory=uploads_dir), name="uploads")', app_text)
        self.assertNotIn("StaticFiles", module_text)
        self.assertIn("/uploads", {getattr(route, "path", "") for route in backend_app.app.routes})

    def test_static_uploads_keep_legacy_extensionless_images_renderable(self):
        legacy_name = "legacy-extensionless-image-test"
        legacy_path = Path(backend_app.uploads_dir) / legacy_name
        legacy_path.write_bytes(b"\xff\xd8\xff\xe0\x00\x10JFIF" + (b"\x00" * 32))
        try:
            response = client.get(f"/uploads/{legacy_name}")
        finally:
            legacy_path.unlink(missing_ok=True)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.headers.get("content-type", "").startswith("image/jpeg"))

    def test_upload_routes_keep_existing_validation_shape(self):
        image_response = client.post(
            "/upload-image",
            files={"file": ("not-image.exe", b"hello", "application/octet-stream")},
        )
        file_response = client.post(
            "/upload-file",
            files={"file": ("bad.exe", b"hello", "application/octet-stream")},
        )

        self.assertEqual(image_response.status_code, 400)
        self.assertEqual(image_response.json(), {"detail": "Uploaded file must be an image"})
        self.assertEqual(file_response.status_code, 400)
        self.assertEqual(file_response.json(), {"detail": "Uploaded file type is not supported"})


if __name__ == "__main__":
    unittest.main()
