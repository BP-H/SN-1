# SuperNova Password Reset Setup

Password reset for backend password accounts is opt-in email delivery. The app can show the reset flow now, but production reset emails are sent only after SMTP and reset URL settings are configured on the backend host.

## Required Backend Env

- `SUPERNOVA_PASSWORD_RESET_PUBLIC_BASE_URL`
  - Public frontend origin for reset links, for example `https://2177.tech`.
- `SUPERNOVA_PASSWORD_RESET_SMTP_HOST`
  - SMTP server hostname.
- `SUPERNOVA_PASSWORD_RESET_SMTP_PORT`
  - Optional. Defaults to `587`.
- `SUPERNOVA_PASSWORD_RESET_FROM`
  - Sender address shown in reset emails.
- `SUPERNOVA_PASSWORD_RESET_SMTP_USERNAME`
  - Optional SMTP username.
- `SUPERNOVA_PASSWORD_RESET_SMTP_PASSWORD`
  - Optional SMTP password.
- `SUPERNOVA_PASSWORD_RESET_SMTP_TLS`
  - Optional. Defaults to enabled.

The backend also accepts legacy aliases such as `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USERNAME`, and `SMTP_PASSWORD`.

## Behavior

- Reset requests return a generic response so account existence is not exposed.
- Reset links expire quickly.
- Existing password hashes invalidate old reset links after a successful password change.
- No DB schema migration is required.
- If SMTP/reset URL settings are missing, the UI says reset email delivery is not configured yet.

## Notes

Supabase OAuth provider login is separate from backend password accounts. Supabase can send its own recovery emails for Supabase Auth users, but SuperNova backend password accounts need the SMTP settings above.
