# No changes needed in this file since the instructions specify editing `voting_engine.py` or wherever the votes query is, not the moderation_router.py file. The moderation_router.py file does not contain any query related to "votes" or "proposal_votes_records". Therefore, the file remains unchanged.

# STRICTLY A SOCIAL MEDIA PLATFORM
# Intellectual Property & Artistic Inspiration
# Legal & Ethical Safeguards
"""Moderation endpoints for reviewing flagged content."""

from __future__ import annotations

from typing import List
import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db_models import FlaggedItem, Harmonizer

router = APIRouter(prefix="/api/moderation", tags=["Moderation"])


class FlaggedItemCreate(BaseModel):
    content: str
    reason: str


class FlaggedItemOut(FlaggedItemCreate):
    id: int
    status: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class FlaggedItemUpdate(BaseModel):
    status: str


def _get_item(item_id: int, db: Session) -> FlaggedItem:
    item = db.query(FlaggedItem).filter(FlaggedItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


def _set_status(item: FlaggedItem, status_value: str, db: Session) -> FlaggedItem:
    item.status = status_value
    db.commit()
    db.refresh(item)
    return item


def get_db_local():
    import sys
    import os
    sys.path.insert(0, "/app/backend")
    from superNova_2177 import get_db
    return get_db()


@router.get("/queue", response_model=List[FlaggedItemOut])
def get_queue(db: Session = Depends(get_db_local)):
    return db.query(FlaggedItem).filter(FlaggedItem.status == "pending").all()


@router.post("/", response_model=FlaggedItemOut, status_code=status.HTTP_201_CREATED)
def flag_content(item: FlaggedItemCreate, db: Session = Depends(get_db_local)):
    flagged = FlaggedItem(content=item.content, reason=item.reason)
    db.add(flagged)
    db.commit()
    db.refresh(flagged)
    return flagged


@router.put("/{item_id}", response_model=FlaggedItemOut)
def update_item(item_id: int, update: FlaggedItemUpdate, db: Session = Depends(get_db_local)):
    item = _get_item(item_id, db)
    return _set_status(item, update.status, db)


@router.post("/{item_id}/approve", response_model=FlaggedItemOut)
def approve_item(item_id: int, db: Session = Depends(get_db_local)):
    item = _get_item(item_id, db)
    return _set_status(item, "approved", db)


@router.post("/{item_id}/reject", response_model=FlaggedItemOut)
def reject_item(item_id: int, db: Session = Depends(get_db_local)):
    item = _get_item(item_id, db)
    return _set_status(item, "rejected", db)


@router.post("/{item_id}/censor", response_model=FlaggedItemOut)
def censor_item(item_id: int, db: Session = Depends(get_db_local)):
    item = _get_item(item_id, db)
    return _set_status(item, "censored", db)


@router.post("/{item_id}/ban_user", response_model=FlaggedItemOut)
def ban_user_for_item(item_id: int, db: Session = Depends(get_db_local)):
    item = _get_item(item_id, db)
    # Placeholder for actual user ban logic
    return _set_status(item, "banned", db)
