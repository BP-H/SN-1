# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards

import sys
from pathlib import Path
from textwrap import dedent

root = Path(__file__).resolve().parents[1]
if str(root) not in sys.path:
    sys.path.insert(0, str(root))

from governance.patch_monitor import check_patch_compliance
from disclaimers import (
    STRICTLY_SOCIAL_MEDIA,
    INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION,
    LEGAL_ETHICAL_SAFEGUARDS,
)


def test_check_patch_compliance_flags_missing_disclaimers():
    patch = dedent(
        '''
        diff --git a/foo.py b/foo.py
        index 0000000..1111111 100644
        --- a/foo.py
        +++ b/foo.py
        @@
        +print("hello")
        '''
    )
    issues = check_patch_compliance(patch)
    assert issues == ["New additions missing required disclaimers"]


def test_check_patch_compliance_passes_when_file_contains_disclaimers(tmp_path):
    file_path = tmp_path / "bar.py"
    file_path.write_text(
        "\n".join(
            [
                STRICTLY_SOCIAL_MEDIA,
                INTELLECTUAL_PROPERTY_ARTISTIC_INSPIRATION,
                LEGAL_ETHICAL_SAFEGUARDS,
            ]
        )
    )
    patch = dedent(
        f'''
        diff --git a/{file_path} b/{file_path}
        index 0000000..1111111 100644
        --- a/{file_path}
        +++ b/{file_path}
        @@
        +print("update")
        diff --git a/x b/x
        '''
    )
    issues = check_patch_compliance(patch)
    assert issues == []

