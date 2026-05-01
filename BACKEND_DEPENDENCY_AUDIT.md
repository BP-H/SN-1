# Backend Dependency Audit

This note records the alpha cold-start dependency audit for the active backend.
The production backend install target is:

```txt
super-nova-2177/backend/requirements.txt
```

Optional ML, scientific, and analysis experiments use:

```txt
super-nova-2177/backend/requirements-ml.txt
```

Protected core was inspected only by search. It was not edited.

## Current Result

The active FastAPI wrapper (`super-nova-2177/backend/app.py`) does not directly
import `pandas`, `torch`, `matplotlib`, `scipy`, `statsmodels`, `pygame`, or
`qutip`.

`super-nova-2177/backend/supernova_runtime.py` imports protected
`supernovacore.py` at startup. That protected core treats these heavy packages
as optional through safe imports or guarded imports. Because the optional ML
target already carries the heavy packages, the production requirements file no
longer includes duplicate optional entries for `pandas`, `torch`, `matplotlib`,
or `scipy`.

## Package-By-Package Audit

| Package | Active wrapper import? | Import paths found | Result |
| --- | --- | --- | --- |
| `pandas` | No | protected core safe import; legacy/off-path UI modules `pages/animate_gaussian.py`, `voting_ui.py` | Kept in `requirements-ml.txt`; removed from production `requirements.txt`. |
| `torch` | No | protected core guarded optional import | Kept in `requirements-ml.txt`; removed from production `requirements.txt`. |
| `matplotlib` | No | protected core safe import; `api_key_input.py`; `scientific_utils.py` lazy import | Kept in `requirements-ml.txt`; removed from production `requirements.txt`. |
| `scipy` | No | protected core safe imports for integration/optimization | Kept in `requirements-ml.txt`; removed from production `requirements.txt`. |
| `statsmodels` | No | protected core safe import | Already only in `requirements-ml.txt`; no production change. |
| `pygame` | No | protected core safe import; `realtime_comm/video_chat.py` guarded import | Already only in `requirements-ml.txt`; no production change. |
| `qutip` | No | protected core guarded optional import; `governance_config.py` | Already only in `requirements-ml.txt`; no production change. |

## Startup Verification

The active backend startup path was import-checked with the audited heavy
packages blocked in Python import hooks. `backend.app` still imported without
requiring those optional packages.

## Deferred

No runtime import rewrites were made. A future dedicated dependency PR can go
further only after proving protected-core optional behavior and any off-path
scientific UI usage in a clean environment.
