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


def run_image_probe(probe: str, extra_env=None) -> dict:
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
        env.update(extra_env or {})
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

    def test_ai_generation_uses_backend_media_origin_and_inline_upload_image_data(self):
        probe = textwrap.dedent(
            """
            import json
            import sys
            from pathlib import Path
            from types import SimpleNamespace

            project_root = Path.cwd()
            backend_dir = project_root / "backend"
            for path in (project_root, backend_dir):
                path_text = str(path)
                if path_text not in sys.path:
                    sys.path.insert(0, path_text)

            import backend.app as backend_app

            captured = {}

            class FakeResponse:
                def __enter__(self):
                    return self
                def __exit__(self, exc_type, exc, tb):
                    return False
                def read(self):
                    payload = {
                        "generated_comment": "The image shows visible context for the proposal.",
                        "reasoning_summary": "Image and text were reviewed together.",
                        "reasoning_text": "The model received image content and proposal text.",
                    }
                    return json.dumps({"choices": [{"message": {"content": json.dumps(payload)}}]}).encode("utf-8")

            def fake_urlopen(request, timeout=0):
                captured["body"] = json.loads(request.data.decode("utf-8"))
                return FakeResponse()

            backend_app.urllib.request.urlopen = fake_urlopen
            Path(backend_app.uploads_dir).mkdir(parents=True, exist_ok=True)
            (Path(backend_app.uploads_dir) / "vision-source.png").write_bytes(
                b"\\x89PNG\\r\\n\\x1a\\n" + (b"\\x00" * 64)
            )
            proposal = SimpleNamespace(
                id=42,
                title="Visual Harbor Plan",
                description="Coordinate the harbor cleanup with the attached image as evidence.",
                userName="alice",
                author_type="human",
                image="vision-source.png",
                video="",
                file="",
                link="",
                payload={},
                voting_deadline=None,
            )
            generated = backend_app._generate_locked_ai_delegate_comment(
                proposal=proposal,
                actor_payload={
                    "display_name": "Nova Vision",
                    "ai_actor_username": "nova-vision",
                    "model_identity": "mock-gpt-mini",
                    "ai_actor_context": {
                        "traits": ["Visual analysis"],
                        "persona_summary": "Looks carefully at visible context.",
                    },
                },
                focus="Use the attached image and text together.",
            )
            message_content = captured["body"]["messages"][1]["content"]
            text_part = message_content[0]["text"]
            image_urls = [
                part.get("image_url", {}).get("url")
                for part in message_content
                if part.get("type") == "image_url"
            ]
            context = backend_app._proposal_public_context(proposal)
            result = {
                "generation_source": generated.get("generation_source"),
                "generated_comment": generated.get("generated_comment"),
                "public_context_image_urls": context.get("media", {}).get("image_urls", []),
                "image_urls": image_urls,
                "text_part": text_part,
            }
            print("IMAGE_FALLBACK_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_image_probe(
            probe,
            extra_env={
                "PUBLIC_BASE_URL": "https://2177.tech",
                "NEXT_PUBLIC_API_URL": "https://sn-1-production.up.railway.app",
                "OPENAI_API_KEY": "test-openai-key",
                "OPENAI_MODEL": "mock-gpt-mini",
            },
        )

        self.assertEqual(result["generation_source"], "openai")
        self.assertIn("image", result["generated_comment"].lower())
        self.assertEqual(
            result["public_context_image_urls"],
            ["https://sn-1-production.up.railway.app/uploads/vision-source.png"],
        )
        self.assertTrue(any(url.startswith("data:image/png;base64,") for url in result["image_urls"]))
        self.assertFalse(any(url.startswith("https://2177.tech/uploads/") for url in result["image_urls"]))
        self.assertIn("[image data sent as OpenAI image_url input]", result["text_part"])
        self.assertNotIn("data:image/png;base64,", result["text_part"])

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
            fallback_stream = client.get(image_after_missing_file)
            result = {
                "created_status": created.status_code,
                "detail_status": detail.status_code,
                "file_existed_before": file_existed_before,
                "created_image": upload_url,
                "image_after_missing_file": image_after_missing_file,
                "expected_fallback_url": f"/uploads-fallback/{proposal_id}/0",
                "fallback_stream_status": fallback_stream.status_code,
                "fallback_stream_content_type": fallback_stream.headers.get("content-type", ""),
                "fallback_bytes_match": fallback_stream.content == png,
            }
            print("IMAGE_FALLBACK_RESULT=" + json.dumps(result, sort_keys=True))
            """
        )

        result = run_image_probe(probe)

        self.assertEqual(result["created_status"], 200)
        self.assertEqual(result["detail_status"], 200)
        self.assertTrue(result["file_existed_before"])
        self.assertTrue(result["created_image"].startswith("/uploads/"))
        # Since the M2 feed overhaul the image survives a missing upload file
        # as a stable streaming URL instead of inline base64 in the JSON.
        self.assertEqual(
            result["image_after_missing_file"], result["expected_fallback_url"]
        )
        self.assertEqual(result["fallback_stream_status"], 200)
        self.assertTrue(result["fallback_stream_content_type"].startswith("image/"))
        self.assertTrue(result["fallback_bytes_match"])


if __name__ == "__main__":
    unittest.main()
