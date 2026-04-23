
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

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from backend.db_utils import get_db

try:
    from db_models import ProposalVote, Harmonizer
except ImportError:
    ProposalVote = None
    Harmonizer = None

router = APIRouter()
logger = logging.getLogger("votes_router")

class VoteIn(BaseModel):
    proposal_id: int
    username: str
    choice: str
    voter_type: str

@router.post("/votes")
def add_vote(v: VoteIn, db: Session = Depends(get_db)):
    """Register or update a vote for a proposal. Creates the Harmonizer if needed."""
    if ProposalVote is None or Harmonizer is None:
        raise HTTPException(status_code=503, detail="Voting system unavailable")

    logger.info("Vote payload: proposal=%s user=%s choice=%s type=%s",
                v.proposal_id, v.username, v.choice, v.voter_type)
    try:
        harmonizer = db.query(Harmonizer).filter_by(username=v.username).first()
        if harmonizer is None:
            harmonizer = Harmonizer(
                username=v.username,
                email=f"{v.username}@example.com",
                hashed_password="dummy",
                species=v.voter_type,
            )
            db.add(harmonizer)
            db.commit()
            db.refresh(harmonizer)
            logger.info("Auto-created harmonizer '%s'", v.username)
        else:
            if hasattr(harmonizer, "species") and harmonizer.species != v.voter_type:
                harmonizer.species = v.voter_type

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
            existing_vote.voter_type = v.voter_type
            if hasattr(existing_vote, "species"):
                existing_vote.species = v.voter_type
        else:
            vote_kwargs = {
                "proposal_id": v.proposal_id,
                "harmonizer_id": harmonizer_id,
                "voter_type": v.voter_type,
            }
            if hasattr(ProposalVote, "vote"):
                vote_kwargs["vote"] = v.choice
            if hasattr(ProposalVote, "choice"):
                vote_kwargs["choice"] = v.choice
            if hasattr(ProposalVote, "species"):
                vote_kwargs["species"] = v.voter_type
            vote = ProposalVote(**vote_kwargs)
            db.add(vote)

        db.commit()
        logger.info("Vote recorded: proposal=%s user=%s choice=%s",
                     v.proposal_id, v.username, v.choice)
        return {"ok": True}
    except Exception as e:
        db.rollback()
        logger.exception("Failed to register vote: %s", str(e))
        raise HTTPException(status_code=500, detail=f"Failed to register vote: {str(e)}")

@router.delete("/votes")
def remove_vote(proposal_id: int, username: str, db: Session = Depends(get_db)):
    """Remove a user's vote from a proposal."""
    if ProposalVote is None or Harmonizer is None:
        raise HTTPException(status_code=503, detail="Voting system unavailable")

    try:
        harmonizer = db.query(Harmonizer).filter_by(username=username).first()
        if harmonizer is None:
            raise HTTPException(status_code=404, detail=f"User '{username}' not found")

        harmonizer_id = harmonizer.id
        deleted_count = db.query(ProposalVote).filter(
            ProposalVote.proposal_id == proposal_id,
            ProposalVote.harmonizer_id == harmonizer_id
        ).delete()
        db.commit()

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail="Vote not found")

        logger.info("Removed %d vote(s) for proposal=%s user=%s",
                     deleted_count, proposal_id, username)
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
