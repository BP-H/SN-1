# Local Development

## Quick start

Run the backend and choose a frontend interactively:

```bash
python run_local.py
```

List the available frontend targets:

```bash
python run_local.py --list-frontends
```

Run only the backend:

```bash
python run_local.py --backend-only
```

Start a specific frontend:

```bash
python run_local.py --frontend next
python run_local.py --frontend professional
python run_local.py --frontend vite-basic
python run_local.py --frontend vite-3d
```

## What the launcher does

- Starts the FastAPI backend on `http://127.0.0.1:8000`
- Writes the correct local API URL into the selected frontend's `.env.local`
- Starts the selected frontend on its assigned local port

## Default local ports

- `backend`: `8000`
- `next`: `3000`
- `professional`: `5173`
- `vite-basic`: `5174`
- `vite-3d`: `5175`

## Requirements

- Python with the backend dependencies installed
- Node.js with `npm`
- Frontend dependencies installed in each frontend you want to run
