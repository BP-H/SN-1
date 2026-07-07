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

## M2 Feed Read Overhaul - 2026-07-07

- Source branch: `m2-feed-data-overhaul` (M2.1 counts, M2.2 batched serializer, M2.3 fallback-by-URL)
- Environment: local `TestClient`, SQLite, `DB_MODE=central`, temporary uploads directory
- Endpoint: `GET /proposals?filter=latest&limit=30`
- Measurement method: same as M1.0 (temporary `before_cursor_execute` listener in a scratch script, not committed). Response bytes below are the uncompressed JSON body; gzip (M1.1) still applies on the wire.
- p50 is the median of 5 sequential in-process requests after warm-up.

| Fixture | Serializer | Status | Items | SQL statements | Response bytes | p50 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| M1.0 replica (30 posts, no votes/comments) | batched (default) | 200 | 30 | 9 | 63,312 | 27.5 |
| busy (30 posts x 20 votes x 10 comments, comment votes) | legacy (`FEED_SERIALIZER=legacy`) | 200 | 30 | 1,355 | 100,466 | 1,401.5 |
| busy (same data) | batched (default) | 200 | 30 | 10 | 100,466 | 73.3 |

Notes:

- The legacy and batched rows return byte-identical JSON (same 100,466 bytes); the batched path only changes how the data is loaded. The equivalence is also locked in by `tests/test_m2_feed_read_overhaul.py`.
- The Playbook Part 8B budget of <=12 SQL statements for the capped page is met (10 on the busy fixture, uncapped).
- Response-bytes reduction on busy pages lands with M3 (FE sends `embedded_comments_limit`/`embedded_votes_limit` and reads the additive counts) and with M2.3 whenever disk bytes are missing (fallback images now serialize as ~30-byte URLs instead of <=3 MB inline base64).
