# Social Six Setup

This frontend is the sixth SuperNova UI and is based on the original `frontend-next`, with a social-first identity flow.

## Required environment variables

Create `frontend-social-six/.env.local` and add:

```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

## Supabase provider setup

Enable the providers you want in the Supabase dashboard:

- Google
- Facebook
- GitHub

For each provider, add these redirect URLs:

- `http://127.0.0.1:3001`
- `http://localhost:3001`

If you deploy this frontend later, also add the deployed URL as an allowed redirect URL.

## Start locally

Backend:

```powershell
cd C:\Users\tahag\OneDrive\Documents\FE4-main\super-nova-2177
.\start_backend.ps1
```

Social Six frontend:

```powershell
cd C:\Users\tahag\OneDrive\Documents\FE4-main\super-nova-2177
.\start_frontend_social_six.ps1
```

Or use the unified launcher and choose option `6`.

## What this frontend adds

- Google, Facebook, and GitHub login entry points
- automatic provider name + profile photo import
- optional custom avatar upload on top of provider identity
- profile species and display-name overrides without losing provider data
- launcher support as a first-class frontend option
