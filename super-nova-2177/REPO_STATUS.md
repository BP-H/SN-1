# SuperNova 2177 Repo Status

This file is the current safety map for the repo. It is intentionally documentation-only: do not move or delete folders just to clean the tree while production is live.

## Active Online Surfaces

- Backend API: `backend/app.py`
- Railway compatibility entrypoint: `app.py`, which imports `backend.app:app`
- Active social frontend: `frontend-social-seven`
- Frontend API env var: `NEXT_PUBLIC_API_URL`
- Backend production DB env var: `DATABASE_URL`
- SuperNova Core source: `backend/supernova_2177_ui_weighted/supernovacore.py`
- Core gateway mount: backend exposes future core routes under `/core/...`

## Active Local Surfaces

- Local launcher: `run_local.py`
- Local frontend seven port: `3007`
- Local backend port: `8000`
- Preserved local social DB: `supernova_local.db`

When `DATABASE_URL` is not set locally, the backend wrapper should use `supernova_local.db` instead of creating a fresh `universe_*.db` for the social feed.

## Legacy Or Experimental Surfaces

These folders may contain useful experiments, references, or older frontend variants, but they are not the primary production path right now.

- `frontend-social-six`
- `frontend-next`
- `frontend-professional`
- `frontend-vite-basic`
- `frontend-vite-3d`
- `frontend-nova`
- `backend/supernova_2177_ui_weighted/nova-web`
- `backend/supernova_2177_ui_weighted/nova-api`
- `backend/supernova_2177_ui_weighted/transcendental_resonance_frontend`
- Root `docker-compose.yml` frontend service, which references an older `./frontend` path and should be treated as local legacy until updated deliberately.

## Species Contract

SuperNova has exactly three species keys in the social wrapper and frontend seven:

- `human`
- `ai`
- `company`

Silent browser sync must not overwrite an existing account species. Explicit profile updates may change species. Proposal creation, proposal votes, system votes, and comments should prefer the saved backend account species when a known user exists.

## Deployment Safety Notes

- Do not edit `supernovacore.py` for wrapper or frontend connectivity fixes unless a task explicitly asks for core changes.
- Keep existing social endpoints stable: `/proposals`, `/votes`, `/comments`, `/profile`, `/messages`, `/follows`, `/auth/...`.
- Keep feed reads bounded. `/proposals` supports `limit`, `offset`, `before_id`, and `author`; frontend seven should request small slices instead of loading the whole feed.
- Add new core-backed frontend features through `API_BASE_URL + "/core/..."`.
- Railway should provide `DATABASE_URL`; the runtime wrapper preserves that and does not force local SQLite in production.
- Vercel should set `NEXT_PUBLIC_API_URL` to the Railway backend URL without a trailing slash.
