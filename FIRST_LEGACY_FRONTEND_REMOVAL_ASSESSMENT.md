# First Legacy Frontend Removal Assessment

Branch: `cleanup/delete-retired-frontend-nova`

Mode: first explicit legacy source-folder deletion after launcher retirement.

## Summary

`frontend-social-seven` remains the only active/default frontend. The active
backend remains `super-nova-2177/backend/app.py`.

After PR #120 retired the local launcher paths for `frontend-nova`, this pass ran
a fresh reference check and deleted only:

- `super-nova-2177/frontend-nova`
- `super-nova-2177/start_frontend_nova.ps1`

No other legacy frontend folder was deleted.

## Fresh Reference Check Results

The post-retirement reference check covered:

- `frontend-nova`
- `start_frontend_nova`
- `Frontend Nova`
- `nova` launcher option
- package, workspace, deployment, workflow, Docker, Vercel, Railway, and launcher
  references

Results before deletion:

- `run_local.py` had no runnable `nova` frontend entry.
- `start_supernova.ps1` option 5 exited with a retired/off-path message and did
  not launch `frontend-nova`.
- `start_frontend_nova.ps1` was a retired stub and did not run `npm`.
- Package/deployment/workflow checks found no active reference outside
  `frontend-nova` itself.
- Remaining references were cleanup/status docs, the read-only cleanup inventory
  script, retired launcher text, or source self-references inside
  `frontend-nova`.

That made `frontend-nova` safe to delete as the first explicit legacy
source-folder removal.

## Deletion Performed

Deleted:

- `super-nova-2177/frontend-nova`
- `super-nova-2177/start_frontend_nova.ps1`

Updated:

- `LEGACY_CLEANUP_ROADMAP.md`
- `super-nova-2177/REPO_STATUS.md`
- `CLEANUP_CANDIDATES_SNAPSHOT.md`
- `MAINTENANCE_AUDIT.md`
- `scripts/list_cleanup_candidates.py`
- `super-nova-2177/start_supernova.ps1`
- `CHANGELOG.md`

`scripts/list_cleanup_candidates.py` no longer lists `frontend-nova` as a current
tracked cleanup candidate because the folder is gone.

## Active Surfaces Preserved

- `super-nova-2177/frontend-social-seven` was not deleted or modified.
- `super-nova-2177/backend/app.py` was not modified.
- Production deployment config was not modified.
- MCP runtime behavior was not modified.
- `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py` remains
  protected and must have zero diff.

## Next Deletion Readiness

The next legacy source-folder deletion should be a separate PR with a fresh
reference check. Do not delete additional legacy frontend folders by analogy.
Likely next candidates still need their own launcher, package, deployment, and
workflow review.

## Rollback Plan

Rollback is a single revert of this deletion PR. The revert restores the
`frontend-nova` source folder, the retired `start_frontend_nova.ps1` stub, and
the prior cleanup documentation.
