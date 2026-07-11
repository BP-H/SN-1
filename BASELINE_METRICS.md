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

## M3 Frontend Feed Overhaul - 2026-07-09

- Source branch: `m3-frontend-feed-overhaul` (M3.1 bounded embeds + count-fed ranking, M3.2 memoized cards, M3.3 frozen order, M3.4 expired system vote, M3.5 hygiene, M3.6 voting_closed UI)
- Environment: same probe harness as the M2 rows (`tests/test_m2_feed_read_overhaul.py` subprocess probe: local `TestClient`, SQLite, `DB_MODE=central`, temporary uploads directory)
- Endpoint pair: `GET /proposals?filter=latest&limit=30` (uncapped) vs the read FE7 now issues, `GET /proposals?filter=latest&limit=30&embedded_comments_limit=3&embedded_votes_limit=25`
- Response bytes are the uncompressed JSON body; gzip (M1.1) still applies on the wire.

| Fixture | Uncapped bytes | Capped bytes | Reduction |
| --- | ---: | ---: | ---: |
| busy (30 posts x 20 votes x 10 comments) | 110,170 | 62,074 | 43.7% |
| heavy (30 posts x 80 votes x 30 comments) | 309,217 | 67,230 | 78.3% |

Notes:

- On the M2 busy fixture the 20 votes/post sit under the 25-vote embed cap, so only comments are capped (43.7%). Once embedded votes exceed the cap the reduction approaches the -80% target (78.3% on the heavy fixture) while `like_count`/`dislike_count`/`comment_count` keep the true totals.
- Capped bytes stay roughly constant as engagement grows (62 KB -> 67 KB while uncapped tripled), i.e. the feed page is now bounded in bytes as well as queries.
- Displayed counts, vote breakdowns, and comment threads read the additive fields; full arrays load on demand (single-proposal read) when a card is opened.

## C1 Correctness Lock - 2026-07-10

- Source branch: `codex/c1-correctness-lock`
- Fixture: heavy feed (30 posts x 80 votes x 30 comments)
- Endpoint: `GET /proposals?filter=latest&limit=30&embedded_comments_limit=3&embedded_votes_limit=20`
- Measurement: local `TestClient`, SQLite, warm request followed by a measured request with SQLAlchemy statement instrumentation

| Items | SQL statements | Uncompressed response bytes | Inline `data:image` |
| ---: | ---: | ---: | --- |
| 30 | 10 | 81,120 | no |

The voter identity preview was reduced from 25 to 20 records per card to keep
the response below 80 KiB after adding the authoritative three-species
`vote_summary` and explicit preview-completeness fields. Scalar totals and
weighted results still use every vote, and complete voter identities still load
on demand. The backend continues to support and test a 25-record preview.
