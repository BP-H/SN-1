from pathlib import Path
ROOT_DIR = Path(__file__).resolve().parents[1]
PAGES_DIR = ROOT_DIR / 'pages'
EXTERNAL_PAGE_DIRS = [
    ROOT_DIR / 'transcendental_resonance_frontend' / 'pages',
    ROOT_DIR / 'app' / 'pages',
]
def ensure_dirs():
    PAGES_DIR.mkdir(parents=True, exist_ok=True)
    for p in EXTERNAL_PAGE_DIRS:
        if p.exists():
            p.mkdir(parents=True, exist_ok=True)
