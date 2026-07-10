import unittest

from backend.public_route_paths import (
    normalize_public_route_segment,
    public_profile_path,
    public_route_path,
)


class PublicRoutePathTests(unittest.TestCase):
    def test_unicode_identity_is_preserved_and_percent_encoded(self):
        cases = {
            "태하": "/users/%ED%83%9C%ED%95%98",
            "Güngör": "/users/G%C3%BCng%C3%B6r",
            "José": "/users/Jos%C3%A9",
            "Open Science DAO": "/users/Open%20Science%20DAO",
        }
        for username, expected in cases.items():
            with self.subTest(username=username):
                self.assertEqual(normalize_public_route_segment(username), username)
                self.assertEqual(public_profile_path(username), expected)

    def test_structural_characters_are_removed_without_collapsing_unicode_names(self):
        self.assertEqual(normalize_public_route_segment("  @태/하?x#y\\z\x00  "), "태하xyz")
        self.assertEqual(public_route_path("connector/profiles", "@José/../?"), "/connector/profiles/Jos%C3%A9..")
        self.assertNotEqual(
            normalize_public_route_segment("태하"),
            normalize_public_route_segment("타하"),
        )


if __name__ == "__main__":
    unittest.main()
