import tempfile
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
for path in (ROOT, BACKEND_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)

from ai_media_prompt_inputs import (  # noqa: E402
    absolute_public_media_url,
    clean_public_url,
    collect_openai_image_urls,
    image_data_url_from_upload_media_value,
    proposal_openai_media_payload,
    redact_image_data_urls,
    resolve_media_public_base_url,
)


def upload_relative_path(value: str) -> str:
    text = str(value or "").strip()
    if text.startswith("https://backend.example.test/uploads/"):
        return text.rsplit("/uploads/", 1)[1]
    if text.startswith("/uploads/"):
        return text[len("/uploads/") :]
    return ""


class AiMediaPromptInputHelperTests(unittest.TestCase):
    def test_public_url_helpers_normalize_and_choose_backend_media_origin(self):
        self.assertEqual(clean_public_url(" backend.example.test/// "), "https://backend.example.test")
        self.assertEqual(clean_public_url("https://frontend.example.test///"), "https://frontend.example.test")
        self.assertEqual(clean_public_url("not a valid url"), "")
        self.assertEqual(
            resolve_media_public_base_url(
                public_base_url="https://frontend.example.test",
                environ={"NEXT_PUBLIC_API_URL": "https://backend.example.test///"},
            ),
            "https://backend.example.test",
        )

    def test_absolute_public_media_url_uses_media_origin_for_uploads(self):
        self.assertEqual(
            absolute_public_media_url(
                "image.png",
                uploads_url=lambda value: f"/uploads/{value}",
                public_base_url="https://frontend.example.test",
                media_public_base_url="https://backend.example.test",
            ),
            "https://backend.example.test/uploads/image.png",
        )

    def test_upload_media_value_can_be_inlined_for_prompt_image_input(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = Path(tmpdir) / "inline.png"
            image_path.write_bytes(b"\x89PNG\r\n\x1a\n" + (b"\x00" * 32))

            data_url = image_data_url_from_upload_media_value(
                "https://backend.example.test/uploads/inline.png",
                uploads_dir=tmpdir,
                max_bytes=1024,
                upload_relative_path=upload_relative_path,
                sniff_media_type=lambda path: "image/png",
            )

        self.assertTrue(data_url.startswith("data:image/png;base64,"))

    def test_proposal_media_payload_uses_inline_images_without_storing_raw_public_image_list(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            image_path = Path(tmpdir) / "proposal.png"
            image_path.write_bytes(b"\x89PNG\r\n\x1a\n" + (b"\x00" * 32))

            media = proposal_openai_media_payload(
                {
                    "media": {
                        "image_urls": ["https://backend.example.test/uploads/proposal.png"],
                        "indicators": ["1 image(s)"],
                    }
                },
                uploads_dir=tmpdir,
                max_bytes=1024,
                upload_relative_path=upload_relative_path,
                sniff_media_type=lambda path: "image/png",
            )

        self.assertNotIn("image_urls", media)
        self.assertEqual(
            media["public_media_reference_text"],
            "https://backend.example.test/uploads/proposal.png",
        )
        self.assertEqual(media["indicators"], ["1 image(s)"])
        self.assertEqual(len(media["image_data_urls"]), 1)
        self.assertTrue(media["image_data_urls"][0].startswith("data:image/png;base64,"))

    def test_collection_and_redaction_preserve_safe_prompt_text(self):
        payload = {
            "media": {
                "image_data_urls": ["data:image/png;base64,abc123"],
                "public_media_reference_text": "https://backend.example.test/uploads/proposal.png",
            }
        }

        self.assertEqual(
            collect_openai_image_urls(payload),
            ["data:image/png;base64,abc123"],
        )
        redacted = redact_image_data_urls(payload)
        self.assertEqual(
            redacted["media"]["image_data_urls"],
            ["[image data sent as OpenAI image_url input]"],
        )
        self.assertEqual(
            redacted["media"]["public_media_reference_text"],
            "https://backend.example.test/uploads/proposal.png",
        )


if __name__ == "__main__":
    unittest.main()
