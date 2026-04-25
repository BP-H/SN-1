from __future__ import annotations

import importlib
import os
import sys
import traceback
import types
from pathlib import Path
from typing import Any, Dict, List


BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
SUPER_NOVA_DIR = BACKEND_DIR / "supernova_2177_ui_weighted"

for runtime_path in (BACKEND_DIR, SUPER_NOVA_DIR):
    path_text = str(runtime_path)
    if path_text not in sys.path:
        sys.path.insert(0, path_text)


_RUNTIME_CACHE: Dict[str, Any] | None = None


def _sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.resolve().as_posix()}"


def _configure_database_environment() -> tuple[str, str]:
    """Keep core on the app's persisted DB instead of random universe DBs.

    Production/Railway should provide DATABASE_URL and continue using it. Local
    development falls back to the existing root supernova_local.db so frontend
    feeds keep showing the data users already created before the core mount.
    """
    existing_database_url = os.environ.get("DATABASE_URL")
    explicit_db_mode = os.environ.get("DB_MODE")

    if existing_database_url:
        os.environ.setdefault("DB_MODE", "central")
        return existing_database_url, "DATABASE_URL"

    preferred_local_db = PROJECT_DIR / "supernova_local.db"
    legacy_backend_db = BACKEND_DIR / "supernova_local.db"
    local_db = preferred_local_db if preferred_local_db.exists() else legacy_backend_db
    local_url = _sqlite_url(local_db)

    if not explicit_db_mode or explicit_db_mode == "local":
        source = "local-supernova-local"
    else:
        source = "local-fallback"

    os.environ["DB_MODE"] = "central"
    os.environ["DATABASE_URL"] = local_url

    return local_url, source


def _install_optional_import_guards() -> None:
    os.environ.setdefault("MPLBACKEND", "Agg")

    try:
        snappy_module = importlib.import_module("snappy")
        if hasattr(snappy_module, "compress") and hasattr(snappy_module, "decompress"):
            return
        raise RuntimeError("installed snappy package is not python-snappy")
    except Exception:
        sys.modules.pop("snappy", None)
        stub = types.ModuleType("snappy")
        stub.__supernova_stub__ = True
        stub.compress = lambda data, *args, **kwargs: data
        stub.decompress = lambda data, *args, **kwargs: data
        sys.modules["snappy"] = stub


def _core_route_summary(core_app: Any) -> List[Dict[str, Any]]:
    routes: List[Dict[str, Any]] = []
    if core_app is None:
        return routes

    for route in getattr(core_app, "routes", []):
        path = getattr(route, "path", None)
        if not path or path in {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}:
            continue
        methods = sorted(
            method
            for method in getattr(route, "methods", set())
            if method not in {"HEAD", "OPTIONS"}
        )
        routes.append({"path": path, "methods": methods})

    return sorted(routes, key=lambda item: (item["path"], ",".join(item["methods"])))


def _route_key(route: Any) -> tuple[str | None, tuple[str, ...]]:
    methods = tuple(sorted(getattr(route, "methods", set()) or []))
    return getattr(route, "path", None), methods


def _attach_late_core_router_routes(core: Any, core_app: Any) -> None:
    core_router = getattr(core, "router", None)
    app_router = getattr(core_app, "router", None)
    if core_router is None or app_router is None:
        return

    existing = {_route_key(route) for route in getattr(core_app, "routes", [])}
    for route in getattr(core_router, "routes", []):
        key = _route_key(route)
        if key[0] and key not in existing:
            app_router.routes.append(route)
            existing.add(key)


def _model_map(db_models: Any) -> Dict[str, Any]:
    names = (
        "Comment",
        "Decision",
        "Harmonizer",
        "Proposal",
        "ProposalVote",
        "Run",
        "SystemState",
        "VibeNode",
    )
    return {name: getattr(db_models, name) for name in names}


def load_supernova_runtime() -> Dict[str, Any]:
    global _RUNTIME_CACHE

    if _RUNTIME_CACHE is not None:
        return _RUNTIME_CACHE

    try:
        configured_database_url, database_url_source = _configure_database_environment()
        _install_optional_import_guards()
        core = importlib.import_module("supernovacore")

        create_app = getattr(core, "create_app", None)
        if callable(create_app) and not getattr(core, "_social_wrapper_initialized", False):
            core_app = create_app()
            setattr(core, "_social_wrapper_initialized", True)
        else:
            core_app = getattr(core, "app", None)

        _attach_late_core_router_routes(core, core_app)

        db_models = getattr(core, "db_models", None) or importlib.import_module("db_models")
        models = _model_map(db_models)

        _RUNTIME_CACHE = {
            "available": True,
            "core_module": core,
            "core_app": core_app,
            "core_routes": _core_route_summary(core_app),
            "db_engine_url": getattr(core, "DB_ENGINE_URL", None)
            or getattr(getattr(core, "get_settings")(), "engine_url", None)
            or configured_database_url,
            "database_url_source": database_url_source,
            "session_local": getattr(core, "SessionLocal"),
            "get_db": getattr(core, "get_db"),
            "get_settings": getattr(core, "get_settings"),
            "get_weighted_threshold": getattr(core, "get_threshold"),
            "weighted_decide": getattr(core, "decide"),
            "tally_votes": getattr(core, "tally_votes"),
            "models": models,
            "error": None,
            "traceback": None,
        }
        return _RUNTIME_CACHE
    except Exception as exc:  # pragma: no cover - dependency/import failures
        _RUNTIME_CACHE = {
            "available": False,
            "core_module": None,
            "core_app": None,
            "core_routes": [],
            "db_engine_url": None,
            "database_url_source": None,
            "session_local": None,
            "get_db": None,
            "get_settings": None,
            "get_weighted_threshold": None,
            "weighted_decide": None,
            "tally_votes": None,
            "models": {},
            "error": exc,
            "traceback": traceback.format_exc(),
        }
        return _RUNTIME_CACHE


def runtime_status(runtime: Dict[str, Any] | None = None) -> Dict[str, Any]:
    current = runtime or load_supernova_runtime()
    error = current.get("error")
    routes = current.get("core_routes") or []
    return {
        "supernova_available": bool(current.get("available")),
        "core_mounted": bool(current.get("core_app")),
        "db_engine_url": current.get("db_engine_url"),
        "database_url_source": current.get("database_url_source"),
        "core_routes_count": len(routes),
        "core_routes": routes,
        "error": str(error) if error else None,
    }
