# Social Seven Auth Setup

Frontend 7 supports two account paths:

- Backend username/password accounts through the Railway/FastAPI backend.
- Supabase OAuth for Google, Facebook, and GitHub.

## Required environment variables

For local development, create `frontend-social-seven/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

For Vercel, set the same variables in the Vercel project settings. Use your Railway backend URL for `NEXT_PUBLIC_API_URL`.

## Supabase provider setup

In Supabase, enable each OAuth provider you want:

- Google
- Facebook
- GitHub

Allowed redirect URLs should include:

- `http://127.0.0.1:3007`
- `http://localhost:3007`
- your Vercel production URL
- any Vercel preview URLs you plan to test with

The code uses the current browser origin as the OAuth redirect target, so Supabase must allow every origin you expect users to sign in from.

## Local start

Backend:

```powershell
cd D:\synk\FE4-main\super-nova-2177
.\start_backend.ps1
```

Frontend 7:

```powershell
cd D:\synk\FE4-main\super-nova-2177
.\start_frontend_social_seven.ps1
```

## Notes

- If Supabase env vars are missing, provider buttons are disabled and backend username/password signup still works.
- Google login is the "Continue with Google" path. Gmail email/password accounts are separate backend password accounts.
- Uploaded avatars are protected by the backend and should not be overwritten by provider/session avatars during normal login sync.
