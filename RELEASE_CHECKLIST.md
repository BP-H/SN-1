# Release Checklist

Use this checklist before tagging a release or promoting a deployment. It is intentionally conservative and assumes v1 remains manual-preview-only.

## Required Checks

- [ ] `python scripts/check_safe.py --local-only`
- [ ] `python scripts/check_safe.py`
- [ ] Backend federation/safety tests pass.
- [ ] FE7 lint passes.
- [ ] FE7 production build passes.
- [ ] Protected core diff is zero unless the release explicitly includes reviewed core work.
- [ ] Public protocol smoke reports zero failures.

## Governance And Protocol Review

- [ ] No automatic execution route was added.
- [ ] No company webhook route was added.
- [ ] No ActivityPub inbox write was added.
- [ ] No Webmention fetching or feed mutation was added.
- [ ] No real domain verification fetching was added without SSRF-safe design and review.
- [ ] Portable exports remain public-only and exclude private fields.
- [ ] Domain preview remains preview-only.
- [ ] v1 schemas remain manual-preview-only.

## Documentation Review

- [ ] `CHANGELOG.md` is updated.
- [ ] `PROTOCOL_GUARANTEE_MATRIX.md` is accurate.
- [ ] `README.md` still points to active surfaces and safety docs.
- [ ] Any new protocol surface has matching docs, tests, and smoke coverage.

## Release Boundary

Do not tag a release if it introduces silent autonomy, value custody/distribution, private-data export expansion, unreviewed auth enforcement changes, or unreviewed database migrations.
