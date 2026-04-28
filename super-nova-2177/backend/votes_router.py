
# --- Ensure the backend directory is importable ---
import sys
import os
import logging

backend_path = os.path.dirname(__file__)
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# --- Ensure supernova_2177_ui_weighted is importable ---
supernova_path = os.path.join(os.path.dirname(__file__), "supernova_2177_ui_weighted")
if supernova_path not in sys.path:
    sys.path.insert(0, supernova_path)

from fastapi import APIRouter, Header, HTTPException, Depends
from jose import JWTError, jwt
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
try:
    from .db_utils import get_db
    from .supernova_runtime import load_supernova_runtime
    from .supernova_2177_ui_weighted.auth_utils import get_auth_settings
except ImportError:  # pragma: no cover - supports running votes_router as a top-level module
    from db_utils import get_db
    from supernova_runtime import load_supernova_runtime
    from auth_utils import get_auth_settings

try:
    _runtime = load_supernova_runtime()
    _models = _runtime.get("models") or {}
    ProposalVote = _models.get("ProposalVote")
    Harmonizer = _models.get("Harmonizer")
    if ProposalVote is None or Harmonizer is None:
        from db_models import ProposalVote, Harmonizer
except Exception:
    ProposalVote = None
    Harmonizer = None

router = APIRouter()
logger = logging.getLogger("votes_router")
VALID_SPECIES = {"human", "ai", "company"}


def normalize_species(value: str | None) -> str:
    species = (value or "human").strip().lower()
    if species not in VALID_SPECIES:
        raise HTTPException(status_code=400, detail="Invalid voter_type")
    return species


def _safe_user_key(value: str | None) -> str:
    return (value or "").strip().lower()


def _username_from_token(
    authorization: str | None,
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.split(" ", 1)[1].strip()
    settings = get_auth_settings()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    username = payload.get("sub")
    if not username:
        raise HTTPException(status_code=401, detail="User not found")
    return str(username)


def _require_token_identity_match(
    authorization: str | None,
    expected_username: str,
):
    token_username = _username_from_token(authorization)
    token_key = _safe_user_key(token_username)
    expected_key = _safe_user_key(expected_username)
    if expected_key and expected_key != token_key:
        raise HTTPException(status_code=403, detail="Bearer token does not match requested user")
    return token_username

class VoteIn(BaseModel):
    proposal_id: int
    username: str
    choice: str
    voter_type: str

@router.post("/votes")
def add_vote(
    v: VoteIn,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Register or update a vote for an authenticated existing Harmonizer."""
    if ProposalVote is None or Harmonizer is None:
        raise HTTPException(status_code=503, detail="Voting system unavailable")
    username = (v.username or "").strip()
    if not username:
        raise HTTPException(status_code=400, detail="username is required")
    if v.choice not in {"up", "down"}:
        raise HTTPException(status_code=400, detail="Invalid choice")

    logger.info("Vote payload: proposal=%s user=%s choice=%s type=%s",
                v.proposal_id, username, v.choice, v.voter_type)
    try:
        requested_species = normalize_species(v.voter_type)
        _require_token_identity_match(authorization, username)
        harmonizer = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()
        if harmonizer is None:
            raise HTTPException(status_code=404, detail=f"User '{username}' not found")
        else:
            saved_species = getattr(harmonizer, "species", None)
            if saved_species in VALID_SPECIES:
                requested_species = saved_species
            elif hasattr(harmonizer, "species"):
                harmonizer.species = requested_species

        harmonizer_id = harmonizer.id

        existing_vote = db.query(ProposalVote).filter(
            ProposalVote.proposal_id == v.proposal_id,
            ProposalVote.harmonizer_id == harmonizer_id
        ).first()

        if existing_vote:
            if hasattr(existing_vote, "vote"):
                existing_vote.vote = v.choice
            if hasattr(existing_vote, "choice"):
                existing_vote.choice = v.choice
            existing_vote.voter_type = requested_species
            if hasattr(existing_vote, "species"):
                existing_vote.species = requested_species
        else:
            vote_kwargs = {
                "proposal_id": v.proposal_id,
                "harmonizer_id": harmonizer_id,
                "voter_type": requested_species,
            }
            if hasattr(ProposalVote, "vote"):
                vote_kwargs["vote"] = v.choice
            if hasattr(ProposalVote, "choice"):
                vote_kwargs["choice"] = v.choice
            if hasattr(ProposalVote, "species"):
                vote_kwargs["species"] = requested_species
            vote = ProposalVote(**vote_kwargs)
            db.add(vote)

        db.commit()
        logger.info("Vote recorded: proposal=%s user=%s choice=%s",
                     v.proposal_id, username, v.choice)
        return {"ok": True}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to register vote: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to register vote: {str(e)}")

@router.delete("/votes")
def remove_vote(
    proposal_id: int,
    username: str,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Remove a user's vote from a proposal."""
    if ProposalVote is None or Harmonizer is None:
        raise HTTPException(status_code=503, detail="Voting system unavailable")
    clean_username = (username or "").strip()
    if not clean_username:
        raise HTTPException(status_code=400, detail="username is required")

    try:
        _require_token_identity_match(authorization, clean_username)
        harmonizer = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == clean_username.lower()).first()
        if harmonizer is None:
            raise HTTPException(status_code=404, detail=f"User '{clean_username}' not found")

        harmonizer_id = harmonizer.id
        deleted_count = db.query(ProposalVote).filter(
            ProposalVote.proposal_id == proposal_id,
            ProposalVote.harmonizer_id == harmonizer_id
        ).delete()
        db.commit()

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vote not found")

        logger.info("Removed %d vote(s) for proposal=%s user=%s",
                     deleted_count, proposal_id, clean_username)
        return {"ok": True, "removed": deleted_count}
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.exception("Failed to remove vote: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to remove vote: {str(e)}")


@router.get("/votes")
def list_votes(db: Session = Depends(get_db)):
    """List all votes (debug endpoint)."""
    if ProposalVote is None:
        return []

    votes = db.query(ProposalVote).all()
    return [
        {
            "proposal_id": v.proposal_id,
            "harmonizer_id": v.harmonizer_id,
            "vote": getattr(v, "vote", None),
            "choice": getattr(v, "choice", getattr(v, "vote", None)),
            "voter_type": getattr(v, "voter_type", None),
            "species": getattr(v, "species", getattr(v, "voter_type", None)),
        } for v in votes
    ]
