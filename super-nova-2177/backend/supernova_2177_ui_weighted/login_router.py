
"""
# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""

from __future__ import annotations

import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

try:  # pragma: no cover - allow usage as standalone module
    from supernova_2177_ui_weighted import auth_utils
    from supernova_2177_ui_weighted.db_models import Harmonizer
    from supernova_2177_ui_weighted.harmonizer_schema import HarmonizerSchema
    from supernova_2177_ui_weighted.universe_manager import UniverseManager
except ImportError:  # pragma: no cover - fallback for relative imports
    from . import auth_utils
    from .db_models import Harmonizer
    from .harmonizer_schema import HarmonizerSchema
    from .universe_manager import UniverseManager

router = APIRouter()


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    universe_id: str | None
    user: HarmonizerSchema


class LoginResult(LoginResponse):
    detail: str




@router.post("/token", response_model=LoginResponse, tags=["Harmonizers"])
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(auth_utils.get_db),
):
    user = db.query(Harmonizer).filter(Harmonizer.username == form_data.username).first()
    if not user or not auth_utils.verify_password(
        form_data.password, user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    if not user.consent_given:
        raise auth_utils.InvalidConsentError("User has revoked consent.")

    streaks = user.engagement_streaks or {}
    try:
        last_login = datetime.datetime.fromisoformat(streaks.get("last_login", "1970-01-01T00:00:00"))
    except ValueError:
        last_login = datetime.datetime(1970, 1, 1)

    now = datetime.datetime.utcnow()
    if (now.date() - last_login.date()).days == 1:
        streaks["daily"] = streaks.get("daily", 0) + 1
    elif now.date() > last_login.date():
        streaks["daily"] = 1
    streaks["last_login"] = now.isoformat()
    user.engagement_streaks = streaks
    db.commit()

    universe_id = UniverseManager.initialize_for_entity(user.id, user.species)
    access_token = auth_utils.create_access_token(
        {"sub": user.username, "universe_id": universe_id}
    )

    from supernova_2177_ui_weighted.harmonizer_schema import HarmonizerSchema

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "universe_id": universe_id,
        "user": HarmonizerSchema.from_orm(user),
    }


@router.post("/login", response_model=LoginResult, tags=["Harmonizers"])
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(auth_utils.get_db),
):
    """Validate credentials and set a signed session cookie."""
    result = login_for_access_token(form_data, db)
    response.set_cookie(
        "session",
        result["access_token"],
        httponly=True,
        samesite="lax",
    )
    return {"detail": "login successful", **result}


@router.post("/logout", tags=["Harmonizers"])
def logout(response: Response) -> dict:
    """Clear the session cookie."""
    response.delete_cookie("session")
    return {"detail": "logged out"}
