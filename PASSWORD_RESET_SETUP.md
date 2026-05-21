# SuperNova Password Reset Setup

Password reset for backend password accounts is opt-in email delivery. The app can show the reset flow now, but production reset emails are sent only after SMTP and reset URL settings are configured on the backend host.

## Required Backend Env

- `SUPERNOVA_PASSWORD_RESET_PUBLIC_BASE_URL`
  - Required for real email delivery. Public frontend origin for reset links, for example `https://2177.tech`.
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

The frontend may send its current origin as `redirect_base_url`, but the backend does not trust that host for production reset links. Request-provided reset hosts are accepted only when `SUPERNOVA_PASSWORD_RESET_ALLOW_REQUEST_BASE_URL=1` and the requested host is local development, such as `http://localhost:3007`.

## Behavior

- Reset requests return a generic response so account existence is not exposed.
- Reset request email lookup prefers exact email matches first, then username fallback, so username/email collisions do not target the wrong account.
- SMTP delivery is scheduled after the reset request response and mail failures are not exposed to callers.
- Reset links expire quickly.
- Existing password hashes invalidate old reset links after a successful password change.
- No DB schema migration is required.
- If SMTP/reset URL settings are missing, the UI says reset email delivery is not configured yet.

## Notes

Supabase OAuth provider login is separate from backend password accounts. Supabase can send its own recovery emails for Supabase Auth users, but SuperNova backend password accounts need the SMTP settings above.
