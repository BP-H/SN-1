# Backend Baseline Metrics

## M1.0 Baseline - 2026-07-07

- Source commit: `87f255b` (`origin/master`)
- Environment: local `TestClient`, SQLite, `DB_MODE=central`, temporary uploads directory
- Fixture: 1 human author, 30 proposals, no comments/votes
- Endpoint: `GET /proposals?filter=latest&limit=30`
- Measurement method: temporary SQLAlchemy `before_cursor_execute` listener in a scratch script; script was not committed

| Request | Status | Items | SQL statements | Response bytes |
| --- | ---: | ---: | ---: | ---: |
| first | 200 | 30 | 155 | 11,322 |
| second | 200 | 30 | 155 | 11,322 |

Notes:

- The repeated 155-statement count captures the current read path before the M1 hardening pack.
- The temporary SQLite file stayed open briefly on Windows cleanup after the result printed; no scratch script or database file is committed.
