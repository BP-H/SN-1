# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import pytest
pytest.importorskip("nicegui")
pytestmark = pytest.mark.requires_nicegui

from utils import demo_data


def test_load_users_non_empty():
    users = demo_data.load_users()
    assert isinstance(users, list)
    assert users  # should not be empty when sample file exists
