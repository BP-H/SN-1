## Summary

- 

## Safety Checklist

- [ ] I did not touch `super-nova-2177/backend/supernova_2177_ui_weighted/supernovacore.py` unless this PR explicitly requires core work.
- [ ] I did not add automatic execution, company webhooks, ActivityPub inbox writes, Webmention fetching, or remote feed mutation.
- [ ] I did not expose private data through public endpoints or exports.
- [ ] Public federation/protocol changes remain read-only or preview-only.
- [ ] Existing FE7 routes and backend social routes remain compatible.

## Verification

- [ ] Backend federation/safety tests passed, if backend behavior changed.
- [ ] FE7 lint/build passed, if frontend behavior changed.
- [ ] `supernovacore.py` diff was reviewed and is empty unless intentionally changed.
