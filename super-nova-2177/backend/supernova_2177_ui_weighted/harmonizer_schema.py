import datetime
from typing import List, Optional

from pydantic import BaseModel

class HarmonizerSchema(BaseModel):
    id: int
    username: str
    email: str
    bio: str
    profile_pic: str
    is_active: bool
    is_admin: bool
    created_at: datetime.datetime | str
    species: str
    harmony_score: str
    creative_spark: str
    is_genesis: bool
    consent_given: bool

    class Config:
        from_attributes = True


class ProposalSchema(BaseModel):
    id: int
    title: str
    description: Optional[str]
    author: Optional[HarmonizerSchema]

    class Config:
        from_attributes = True


class ProposalVoteSchema(BaseModel):
    proposal_id: int
    harmonizer_id: int
    vote: str
    voter_type: str

    class Config:
        from_attributes = True