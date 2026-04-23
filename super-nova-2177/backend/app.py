import datetime
import hashlib
import os
import shutil
import sys
import uuid
from datetime import timedelta
from pathlib import Path
from typing import Dict, List, Optional

from fastapi import Depends, FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy import asc, desc, func, or_, text
from sqlalchemy.orm import Session

try:
    from jose import JWTError, jwt
except Exception:  # pragma: no cover - optional dependency during partial environments
    JWTError = Exception
    jwt = None

BACKEND_DIR = Path(__file__).resolve().parent
SUPER_NOVA_DIR = BACKEND_DIR / 'supernova_2177_ui_weighted'

for path in (BACKEND_DIR, SUPER_NOVA_DIR):
    path_str = str(path)
    if path_str not in sys.path:
        sys.path.insert(0, path_str)


def _load_supernova_runtime():
    try:
        from supernovacore import (
            DB_ENGINE_URL,
            SessionLocal,
            get_db,
            get_settings,
            get_threshold as get_weighted_threshold,
            decide as weighted_decide,
            tally_votes,
        )
        from db_models import (
            Comment,
            Decision,
            Harmonizer,
            Proposal,
            ProposalVote,
            Run,
            SystemState,
            VibeNode,
        )

        return {
            'available': True,
            'db_engine_url': DB_ENGINE_URL,
            'session_local': SessionLocal,
            'get_db': get_db,
            'get_settings': get_settings,
            'get_weighted_threshold': get_weighted_threshold,
            'weighted_decide': weighted_decide,
            'tally_votes': tally_votes,
            'models': {
                'Comment': Comment,
                'Decision': Decision,
                'Harmonizer': Harmonizer,
                'Proposal': Proposal,
                'ProposalVote': ProposalVote,
                'Run': Run,
                'SystemState': SystemState,
                'VibeNode': VibeNode,
            },
        }
    except Exception as exc:  # pragma: no cover - dependency/import failures
        print(f'Warning: falling back to standalone backend mode: {exc}')
        return {'available': False, 'error': exc}

try:
    import auth_utils
except Exception:  # pragma: no cover - auth helpers may be unavailable in partial environments
    auth_utils = None


_runtime = _load_supernova_runtime()
SUPER_NOVA_AVAILABLE = _runtime['available']

if SUPER_NOVA_AVAILABLE:
    SessionLocal = _runtime['session_local']
    get_db = _runtime['get_db']
    get_settings = _runtime['get_settings']
    weighted_decide = _runtime['weighted_decide']
    get_weighted_threshold = _runtime['get_weighted_threshold']
    tally_votes = _runtime['tally_votes']
    DB_ENGINE_URL = _runtime['db_engine_url']
    Proposal = _runtime['models']['Proposal']
    ProposalVote = _runtime['models']['ProposalVote']
    Comment = _runtime['models']['Comment']
    Decision = _runtime['models']['Decision']
    Run = _runtime['models']['Run']
    Harmonizer = _runtime['models']['Harmonizer']
    VibeNode = _runtime['models']['VibeNode']
    SystemState = _runtime['models']['SystemState']
else:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///./supernova_local.db')
    engine = create_engine(
        DATABASE_URL,
        future=True,
        connect_args={'check_same_thread': False} if DATABASE_URL.startswith('sqlite') else {},
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    DB_ENGINE_URL = DATABASE_URL

    try:
        from db_models import (
            Base as SharedBase,
            Comment,
            Decision,
            Harmonizer,
            Proposal,
            ProposalVote,
            Run,
            SystemState,
            VibeNode,
        )

        SharedBase.metadata.create_all(bind=engine)
    except Exception as exc:
        print(f"Warning: could not initialize standalone database schema: {exc}")
        Proposal = ProposalVote = Comment = Decision = Run = Harmonizer = VibeNode = SystemState = None

    def get_db():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    def weighted_decide(*_args, **_kwargs):
        return {'status': 'undecided', 'note': 'standalone mode'}

    def tally_votes(*_args, **_kwargs):
        return {'up': 0, 'down': 0, 'total': 0}

    def get_weighted_threshold(level: str = 'standard'):
        return 0.9 if str(level).lower() == 'important' else 0.6

    def get_settings():
        class Settings:
            DB_MODE = 'standalone'
            UNIVERSE_ID = 'standalone'
            SECRET_KEY = os.environ.get('SECRET_KEY', 'changeme')
            ALGORITHM = os.environ.get('ALGORITHM', 'HS256')

            @property
            def engine_url(self):
                return DB_ENGINE_URL

        return Settings()


CRUD_MODELS_AVAILABLE = all(
    model is not None for model in (Proposal, ProposalVote, Comment, Harmonizer, VibeNode)
)
WORKFLOW_MODELS_AVAILABLE = all(
    model is not None for model in (Decision, Run)
)


def persist_weighted_vote_record(
    proposal_id: int, voter: str, choice: str, species: str = 'human'
):
    if ProposalVote is None:
        return {'ok': True, 'note': 'standalone mode'}

    try:
        session = SessionLocal()
        vote_entry = ProposalVote(
            proposal_id=proposal_id,
            harmonizer_id=voter,
            vote=choice,
            voter_type=species,
        )
        session.add(vote_entry)
        session.commit()
        return {'ok': True, 'proposal_id': proposal_id, 'voter': voter, 'choice': choice}
    except Exception as exc:
        return {'ok': False, 'error': str(exc)}
    finally:
        if 'session' in locals():
            session.close()
# --- FastAPI setup ---
app = FastAPI(
    title="SuperNova 2177 API",
    description="Backend API for SuperNova 2177 - Unified Version",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")


def _format_timestamp(value) -> str:
    if not value:
        return ""
    if isinstance(value, datetime.datetime):
        return value.isoformat()
    if isinstance(value, str):
        normalized = value.strip()
        if not normalized:
            return ""
        try:
            return datetime.datetime.fromisoformat(normalized.replace("Z", "+00:00")).isoformat()
        except Exception:
            return normalized
    isoformat = getattr(value, "isoformat", None)
    if callable(isoformat):
        try:
            return isoformat()
        except Exception:
            pass
    return str(value)


def _serialize_comment_record(db: Session, comment) -> Dict:
    author_obj = None
    if CRUD_MODELS_AVAILABLE and getattr(comment, "author_id", None):
        author_obj = db.query(Harmonizer).filter(Harmonizer.id == comment.author_id).first()

    user_name = (
        getattr(author_obj, "username", None)
        or getattr(comment, "user", None)
        or "Anonymous"
    )
    user_img = (
        getattr(author_obj, "profile_pic", None)
        or getattr(comment, "user_img", None)
        or ""
    )
    species = (
        getattr(author_obj, "species", None)
        or getattr(comment, "species", None)
        or "human"
    )
    content = getattr(comment, "content", None) or getattr(comment, "comment", None) or ""

    return {
        "proposal_id": getattr(comment, "proposal_id", None),
        "user": user_name,
        "user_img": "" if user_img == "default.jpg" else user_img,
        "species": species,
        "comment": content,
    }


def _serialize_vote_record(db: Session, vote) -> tuple[Optional[Dict], Optional[Dict]]:
    voter_name = getattr(vote, "voter", None) or getattr(vote, "username", None)
    voter_type = getattr(vote, "voter_type", None) or getattr(vote, "species", None) or "human"

    if CRUD_MODELS_AVAILABLE and getattr(vote, "harmonizer_id", None):
        harmonizer_obj = db.query(Harmonizer).filter(Harmonizer.id == vote.harmonizer_id).first()
        if harmonizer_obj and hasattr(harmonizer_obj, "username"):
            voter_name = harmonizer_obj.username

    vote_field = getattr(vote, "vote", None)
    if vote_field is None:
        vote_field = getattr(vote, "choice", None)

    payload = {"voter": voter_name, "type": voter_type}
    if vote_field == "up":
        return payload, None
    if vote_field == "down":
        return None, payload
    return None, None


def _compute_vote_totals(db: Session, proposal_id: int) -> Dict[str, int]:
    up = 0
    down = 0

    if CRUD_MODELS_AVAILABLE:
        votes = db.query(ProposalVote).filter(ProposalVote.proposal_id == proposal_id).all()
        for vote in votes:
            if getattr(vote, "vote", None) == "up":
                up += 1
            elif getattr(vote, "vote", None) == "down":
                down += 1
        return {"up": up, "down": down}

    try:
        rows = db.execute(
            text("SELECT vote FROM proposal_votes WHERE proposal_id = :pid"),
            {"pid": proposal_id},
        ).fetchall()
        for row in rows:
            value = getattr(row, "vote", None) or row[0]
            if value == "up":
                up += 1
            elif value == "down":
                down += 1
    except Exception:
        pass

    return {"up": up, "down": down}

# --- Schemas (compat frontend) ---
class ProposalIn(BaseModel):
    title: str
    body: str
    author: str
    author_type: Optional[str] = ""
    author_img: Optional[str] = ""
    date: Optional[str] = ""
    image: Optional[str] = ""
    video: Optional[str] = ""
    link: Optional[str] = ""
    file: Optional[str] = ""

class ProposalSchema(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    id: int
    title: str
    text: str
    userName: str
    userInitials: str
    author_img: str
    time: str
    author_type: Optional[str] = ""
    likes: List[Dict] = []
    dislikes: List[Dict] = []
    comments: List[Dict] = []
    media: Dict = {}

class VoteIn(BaseModel):
    proposal_id: int
    voter: str
    choice: str
    voter_type: str

class DecisionSchema(BaseModel):
    id: int
    proposal_id: int
    status: str

class RunSchema(BaseModel):
    id: int
    decision_id: int
    status: str

class CommentIn(BaseModel):
    proposal_id: int
    user: str = "guest"
    user_img: str = ""
    species: Optional[str] = "human"
    comment: str


class RegisterUserIn(BaseModel):
    username: str
    password: str
    email: Optional[str] = None
    species: Optional[str] = "human"
    bio: Optional[str] = ""


def _normalize_species(value: Optional[str]) -> str:
    species = (value or "human").strip().lower()
    if species not in {"human", "ai", "company"}:
        raise HTTPException(status_code=400, detail="Invalid species")
    return species


def _build_status_payload(db: Session) -> Dict:
    total_harmonizers = 0
    total_vibenodes = 0
    total_proposals = 0
    total_comments = 0
    total_votes = 0

    try:
        if CRUD_MODELS_AVAILABLE:
            total_harmonizers = db.query(Harmonizer).count()
            total_vibenodes = db.query(VibeNode).count() if VibeNode is not None else 0
            total_proposals = db.query(Proposal).count()
            total_comments = db.query(Comment).count()
            total_votes = db.query(ProposalVote).count()
        else:
            total_harmonizers = db.execute(text("SELECT COUNT(*) FROM harmonizers")).scalar() or 0
            total_vibenodes = db.execute(text("SELECT COUNT(*) FROM vibenodes")).scalar() or 0
            total_proposals = db.execute(text("SELECT COUNT(*) FROM proposals")).scalar() or 0
            total_comments = db.execute(text("SELECT COUNT(*) FROM comments")).scalar() or 0
            total_votes = db.execute(text("SELECT COUNT(*) FROM proposal_votes")).scalar() or 0
    except Exception:
        pass

    return {
        "status": "online",
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "metrics": {
            "total_harmonizers": int(total_harmonizers or 0),
            "total_vibenodes": int(total_vibenodes or total_proposals or 0),
            "community_wellspring": str((total_votes or 0) + (total_comments or 0)),
            "current_system_entropy": round(max(1.0, (total_proposals or 0) * 0.4 + (total_comments or 0) * 0.2), 2),
        },
        "mission": "To create order and meaning from chaos through collective resonance.",
    }


def _build_network_payload(db: Session, limit: int = 100) -> Dict:
    nodes: List[Dict] = []
    edges: List[Dict] = []
    seen_users: Dict[str, Dict] = {}

    proposals = []
    if CRUD_MODELS_AVAILABLE:
        proposals = (
            db.query(Proposal)
            .order_by(desc(Proposal.id))
            .limit(limit)
            .all()
        )
    else:
        proposals = db.execute(
            text(
                "SELECT id, title, userName, author_type, created_at "
                "FROM proposals ORDER BY id DESC LIMIT :limit"
            ),
            {"limit": limit},
        ).fetchall()

    for proposal in proposals:
        proposal_id = getattr(proposal, "id", None)
        username = getattr(proposal, "userName", None) or getattr(proposal, "author_username", None) or f"user-{proposal_id}"
        author_type = getattr(proposal, "author_type", None) or "human"
        user_id = f"user:{username}"
        proposal_node_id = f"proposal:{proposal_id}"

        if user_id not in seen_users:
            user_node = {
                "id": user_id,
                "label": username,
                "type": "harmonizer",
            }
            seen_users[user_id] = user_node
            nodes.append(user_node)

        nodes.append(
            {
                "id": proposal_node_id,
                "label": getattr(proposal, "title", None) or f"Proposal {proposal_id}",
                "type": "proposal",
                "echo": 0,
            }
        )
        edges.append(
            {
                "source": user_id,
                "target": proposal_node_id,
                "type": f"authored_by_{author_type}",
                "strength": 1,
            }
        )

    node_count = len(nodes)
    edge_count = len(edges)
    density = 0.0
    if node_count > 1:
        density = round(edge_count / (node_count * (node_count - 1)), 4)

    return {
        "nodes": nodes,
        "edges": edges,
        "metrics": {
            "node_count": node_count,
            "edge_count": edge_count,
            "density": density,
        },
    }

# --- Universe Info Endpoint ---
@app.get("/universe/info", tags=["System"])
def universe_info():
    """Return details about the current database configuration."""
    if not SUPER_NOVA_AVAILABLE:
        # Fallback response when SuperNova is not available
        return {
            "mode": "standalone",
            "engine": "sqlite:///fallback.db", 
            "universe_id": "standalone_universe",
            "note": "SuperNova integration not available"
        }
    
    try:
        s = get_settings()
        return {
            "mode": s.DB_MODE,
            "engine": DB_ENGINE_URL or s.engine_url,
            "universe_id": s.UNIVERSE_ID,
        }
    except Exception as e:
        return {
            "error": f"Failed to get universe info: {str(e)}",
            "mode": "error",
            "engine": "unknown",
            "universe_id": "error"
        }

# --- Health & Status ---
@app.get("/health", summary="Check API health")
def health(db: Session = Depends(get_db)):
    supernova_status = "connected" if SUPER_NOVA_AVAILABLE else "disconnected"
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    
    return {
        "ok": True,
        "database": db_status,
        "supernova_integration": supernova_status,
        "timestamp": datetime.datetime.now().isoformat()
    }

@app.get("/universe", summary="Get simplified universe state")
def get_universe_state():
    """
    Returns a mock representation of the current universe graph,
    including proposals, decisions, and links.
    """
    return {
        "nodes": [
            {"id": "u1", "label": "Proposal A", "type": "proposal", "votes": {"human": 12, "company": 5, "ai": 2}},
            {"id": "u2", "label": "Decision B", "type": "decision", "votes": {"human": 4, "company": 10, "ai": 1}},
        ],
        "links": [
            {"source": "u1", "target": "u2"},
        ]
    }
   
@app.get("/supernova-status", summary="Check SuperNova integration status")
def supernova_status():
    return {
        "supernova_connected": SUPER_NOVA_AVAILABLE,
        "features_available": {
            "weighted_voting": SUPER_NOVA_AVAILABLE,
            "karma_system": SUPER_NOVA_AVAILABLE,
            "governance": SUPER_NOVA_AVAILABLE,
            "search_filters": True,
            "advanced_sorting": True
        }
    }


@app.get("/status", tags=["System"])
def get_status(db: Session = Depends(get_db)):
    return _build_status_payload(db)


@app.get("/network-analysis/", tags=["System"])
def get_network_analysis(limit: int = Query(100, ge=1, le=500), db: Session = Depends(get_db)):
    return _build_network_payload(db, limit=limit)


@app.post("/users/register", tags=["Harmonizers"])
def register_user(payload: RegisterUserIn, db: Session = Depends(get_db)):
    if Harmonizer is None:
        raise HTTPException(status_code=503, detail="User system unavailable")

    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    species = _normalize_species(payload.species)
    existing = db.query(Harmonizer).filter(func.lower(Harmonizer.username) == username.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists")

    email = (payload.email or f"{username.lower()}@local.supernova").strip().lower()
    email_owner = db.query(Harmonizer).filter(func.lower(Harmonizer.email) == email).first()
    if email_owner:
        raise HTTPException(status_code=409, detail="Email already exists")

    if not payload.password:
        raise HTTPException(status_code=400, detail="Password is required")

    hashed_password = hashlib.sha256(payload.password.encode()).hexdigest()
    if auth_utils and hasattr(auth_utils, "pwd_context"):
        try:
            hashed_password = auth_utils.pwd_context.hash(payload.password)
        except Exception:
            hashed_password = hashlib.sha256(payload.password.encode()).hexdigest()

    user = Harmonizer(
        username=username,
        email=email,
        hashed_password=hashed_password,
        species=species,
        bio=payload.bio or "",
        profile_pic="default.jpg",
        is_active=True,
        consent_given=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "species": user.species,
        "harmony_score": str(getattr(user, "harmony_score", "100.0")),
        "creative_spark": str(getattr(user, "creative_spark", "1000000.0")),
        "network_centrality": float(getattr(user, "network_centrality", 0.0)),
        "bio": getattr(user, "bio", ""),
    }

#
@app.get("/debug-supernova")
def debug_supernova():
    if os.environ.get("SUPERNOVA_ENV", "development") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "supernova_available": SUPER_NOVA_AVAILABLE,
        "python_path": sys.path,
        "current_dir": os.getcwd(),
        "dir_contents": os.listdir('.'),
        "supernova_dir_exists": os.path.exists('./supernova_2177_ui_weighted')
    }

@app.get("/debug/search-test")
def debug_search(search: str = Query(...), db: Session = Depends(get_db)):
    if os.environ.get("SUPERNOVA_ENV", "development") == "production":
        raise HTTPException(status_code=404, detail="Not found")
    try:
        if CRUD_MODELS_AVAILABLE:
            results = db.query(Proposal).filter(
                or_(
                    Proposal.title.ilike(f"%{search}%"),
                    Proposal.description.ilike(f"%{search}%"),
                    Proposal.userName.ilike(f"%{search}%")
                )
            ).limit(5).all()
            
            return {
                "search_term": search,
                "found_proposals": len(results),
                "results": [
                    {"id": r.id, "title": r.title, "author": r.userName} 
                    for r in results
                ],
                "method": "orm"
            }
        else:
            result = db.execute(
                text(
                    "SELECT id, title, userName FROM proposals "
                    "WHERE title ILIKE :search OR description ILIKE :search OR userName ILIKE :search "
                    "LIMIT 5"
                ),
                {"search": f"%{search}%"}
            )
            rows = result.fetchall()
            
            return {
                "search_term": search,
                "found_proposals": len(rows),
                "results": [dict(row) for row in rows],
                "method": "sql"
            }
    except Exception as e:
        return {"error": str(e), "query_working": False}

#
@app.get("/profile/{username}", summary="Get user profile")
def profile(username: str, db: Session = Depends(get_db)):
    if SUPER_NOVA_AVAILABLE:
        try:
            user = db.query(Harmonizer).filter(Harmonizer.username == username).first()
            if user:
                return {
                    "username": user.username,
                    "avatar_url": user.avatar_url or "",
                    "bio": user.bio or "Explorer of superNova_2177.",
                    "followers": getattr(user, 'followers_count', 2315),
                    "following": getattr(user, 'following_count', 1523),
                    "status": "online",
                    "karma": float(getattr(user, 'karma_score', 0)),
                    "harmony_score": float(getattr(user, 'harmony_score', 0)),
                    "creative_spark": float(getattr(user, 'creative_spark', 0)),
                    "species": getattr(user, 'species', 'human')
                }
        except Exception as e:
            print(f"Error fetching SuperNova profile: {e}")
    
    # Fallback
    return {
        "username": username,
        "avatar_url": "",
        "bio": "Explorer of superNova_2177.",
        "followers": 2315,
        "following": 1523,
        "status": "online"
    }

@app.post("/proposals", response_model=ProposalSchema, summary="Create a new proposal")
async def create_proposal(
    title: str = Form(...),
    body: str = Form(...),
    author: str = Form(...),
    author_type: str = Form("human"),
    author_img: str = Form(""),
    date: Optional[str] = Form(None),
    video: str = Form(""),
    link: str = Form(""),
    image: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    voting_deadline: Optional[datetime.datetime] = Form(None),
    db: Session = Depends(get_db)
):
    if author_type not in ("human", "company", "ai"):
        raise HTTPException(status_code=400, detail="Invalid author_type")
    
    os.makedirs(uploads_dir, exist_ok=True)
    image_filename = None
    file_filename = None

    # --- Process uploads ---
    if image:
        ext = os.path.splitext(image.filename)[1]
        image_filename = f"{uuid.uuid4().hex}{ext}"
        image_path = os.path.join(uploads_dir, image_filename)
        with open(image_path, "wb") as f:
            f.write(await image.read())
    
    if file:
        ext = os.path.splitext(file.filename)[1]
        file_filename = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(uploads_dir, file_filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

    from datetime import datetime as dt
    if date:
        normalized_date = date.replace("Z", "+00:00")
        created_at = dt.fromisoformat(normalized_date)
    else:
        created_at = dt.now()
    if not voting_deadline:
        voting_deadline = dt.utcnow() + timedelta(days=7)

    try:
        final_user = None
        if author and author.strip():
            final_user = author.strip()
        if 'userName' in locals() and userName and userName.strip():
            final_user = userName.strip()
        if not final_user:
            final_user = "Unknown"
        initials = (final_user[:2].upper() if final_user else "UN")

        if CRUD_MODELS_AVAILABLE:
            author_obj = db.query(Harmonizer).filter(Harmonizer.username == final_user).first()
            if author_obj:
                user_name = author_obj.username
            else:
                user_name = final_user
            import datetime
            db_proposal = Proposal(
                title=title,
                description=body,
                userName=user_name,
                userInitials=(user_name[:2]).upper() if user_name else "UN",
                author_type=author_type,
                author_img=author_img,
                image=image_filename,
                video=video,
                link=link,
                file=file_filename,
                created_at=created_at,
                voting_deadline=created_at + datetime.timedelta(days=7)
            )
            db.add(db_proposal)
            db.commit()
            db.refresh(db_proposal)
        else:
            result = db.execute(
                text("""
                    INSERT INTO proposals (
                        title, description, userName, userInitials, author_type,
                        author_img, created_at, voting_deadline, image, video, link, file
                    )
                    VALUES (
                        :title, :description, :userName, :userInitials, :author_type,
                        :author_img, :created_at, :voting_deadline, :image, :video, :link, :file
                    )
                    RETURNING id
                """),
                {
                    "title": title,
                    "description": body,
                    "userName": final_user,
                    "userInitials": initials,
                    "author_type": author_type,
                    "author_img": author_img,
                    "created_at": created_at,
                    "voting_deadline": voting_deadline,
                    "image": image_filename, "video": video, "link": link, "file": file_filename
                }
            )
            row = result.fetchone()
            if not row:
                raise HTTPException(status_code=500, detail="Failed to create proposal")
            db.commit()
            db_proposal = type("Temp", (), {})()
            db_proposal.id = row[0]
            db_proposal.title = title
            db_proposal.description = body
            db_proposal.userName = final_user
            db_proposal.userInitials = initials
            db_proposal.author_type = author_type
            db_proposal.author_img = author_img
            db_proposal.image = image_filename
            db_proposal.video = video
            db_proposal.link = link
            db_proposal.file = file_filename
            db_proposal.created_at = created_at
            db_proposal.voting_deadline = voting_deadline
            user_name = final_user

        return ProposalSchema(
            id=db_proposal.id,
            title=db_proposal.title,
            text=db_proposal.description,
            userName=user_name,
            userInitials=(user_name[:2]).upper() if user_name else "UN",
            author_img=db_proposal.author_img or "",
            time=_format_timestamp(db_proposal.created_at),
            author_type=db_proposal.author_type,
            likes=[],
            dislikes=[],
            comments=[],
            media={
                "image": f"/uploads/{db_proposal.image}" if db_proposal.image else "",
                "video": db_proposal.video or "",
                "link": db_proposal.link or "",
                "file": f"/uploads/{db_proposal.file}" if db_proposal.file else ""
            }
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create proposal: {str(e)}")
#
# --- Harmonizer serialization helper ---
def serialize_harmonizer(h):
    if not h:
        return None
    # Only select safe fields for serialization
    return {
        "id": getattr(h, "id", None),
        "username": getattr(h, "username", None),
        "avatar_url": getattr(h, "avatar_url", "") if h else "",
        "species": getattr(h, "species", None),
        "karma_score": float(getattr(h, "karma_score", 0)) if hasattr(h, "karma_score") else 0,
        "harmony_score": float(getattr(h, "harmony_score", 0)) if hasattr(h, "harmony_score") else 0,
        "creative_spark": float(getattr(h, "creative_spark", 0)) if hasattr(h, "creative_spark") else 0,
    }


def get_current_harmonizer(
    authorization: Optional[str], db: Session
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    if jwt is None:
        raise HTTPException(status_code=500, detail="JWT support is unavailable")

    token = authorization.split(" ", 1)[1].strip()
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    username = payload.get("sub")
    if not username or Harmonizer is None:
        raise HTTPException(status_code=401, detail="User not found")

    user = db.query(Harmonizer).filter(Harmonizer.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.get("/users/me")
def read_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
):
    current_user = get_current_harmonizer(authorization, db)
    return serialize_harmonizer(current_user)

@app.get("/proposals", response_model=List[ProposalSchema])
def list_proposals(
    filter: str = Query("all"),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    List proposals, supporting filters:
    - all, latest, oldest, topLikes, fewestLikes, popular, ai, company, human
    - search: string search on title/description
    """
    try:
        # --- ORM MODE ---
        if CRUD_MODELS_AVAILABLE:
            query = db.query(Proposal)

            # SEARCH
            if search and search.strip():
                search_filter = f"%{search}%"
                query = query.filter(
                    or_(
                        Proposal.title.ilike(search_filter),
                        Proposal.description.ilike(search_filter)
                    )
                )

            # FILTERS
            from sqlalchemy import func, case
            filter = (filter or "all").lower()
            # Sorting/Filtering logic
            if filter == "latest":
                query = query.order_by(desc(Proposal.created_at))
            elif filter == "oldest":
                query = query.order_by(asc(Proposal.created_at))
            elif filter == "toplikes":
                vote_count = func.sum(case((ProposalVote.vote == "up", 1), else_=0)).label("upvote_count")
                query = query.outerjoin(ProposalVote, Proposal.id == ProposalVote.proposal_id)\
                    .group_by(Proposal.id)\
                    .order_by(desc(vote_count))
            elif filter == "fewestlikes":
                vote_count = func.sum(case((ProposalVote.vote == "up", 1), else_=0)).label("upvote_count")
                query = query.outerjoin(ProposalVote, Proposal.id == ProposalVote.proposal_id)\
                    .group_by(Proposal.id)\
                    .order_by(asc(vote_count))
            elif filter == "popular":
                from datetime import datetime, timedelta
                since = datetime.utcnow() - timedelta(days=1)
                vote_count = func.sum(case((ProposalVote.vote == "up", 1), else_=0)).label("upvote_count")
                query = db.query(Proposal, vote_count)\
                          .outerjoin(ProposalVote, Proposal.id == ProposalVote.proposal_id)\
                          .filter(Proposal.created_at >= since)\
                          .group_by(Proposal.id)\
                          .order_by(desc(vote_count))
                proposals = [p for p, _ in query.all()]
            elif filter == "ai":
                query = query.filter(Proposal.author_type == "ai").order_by(desc(Proposal.created_at))
            elif filter == "company":
                query = query.filter(Proposal.author_type == "company").order_by(desc(Proposal.created_at))
            elif filter == "human":
                query = query.filter(Proposal.author_type == "human").order_by(desc(Proposal.created_at))
            else:
                # Default: all, order by id desc
                query = query.order_by(desc(Proposal.id))

            if filter != "popular":
                proposals = query.all()

        # --- FALLBACK (RAW SQL) ---
        else:
            filter_sql = (filter or "all").lower()
            base_query = "SELECT * FROM proposals"
            where_clauses = []
            order_clause = "ORDER BY id DESC"
            votes_table_exists = False
            comments_table_exists = False

            try:
                table_rows = db.execute(
                    text("SELECT name FROM sqlite_master WHERE type='table'")
                ).fetchall()
                existing_tables = {row[0] for row in table_rows}
                votes_table_exists = "proposal_votes" in existing_tables
                comments_table_exists = "comments" in existing_tables
            except Exception:
                pass

            # SEARCH
            params = {}
            if search and search.strip():
                where_clauses.append(
                    "(title ILIKE :search OR description ILIKE :search OR userName ILIKE :search)"
                )
                params["search"] = f"%{search}%"

            # FILTERS
            if filter_sql == "latest":
                order_clause = "ORDER BY created_at DESC"
            elif filter_sql == "oldest":
                order_clause = "ORDER BY created_at ASC"
            elif filter_sql == "ai":
                where_clauses.append("author_type = 'ai'")
            elif filter_sql == "company":
                where_clauses.append("author_type = 'company'")
            elif filter_sql == "human":
                where_clauses.append("author_type = 'human'")
            # For topLikes, fewestLikes, popular, fallback: order by likes/dislikes if possible
            elif filter_sql in ("toplikes", "fewestlikes", "popular"):
                # For fallback, try to join votes table if exists
                # We assume a "votes" table with proposal_id, choice ('up'/'down')
                if filter_sql == "toplikes":
                    base_query = """
                        SELECT p.*, COUNT(v.proposal_id) AS upvotes
                        FROM proposals p
                        LEFT JOIN proposal_votes v ON p.id = v.proposal_id AND v.vote = 'up'
                        GROUP BY p.id
                        ORDER BY upvotes DESC
                    """
                    order_clause = ""
                elif filter_sql == "fewestlikes":
                    base_query = """
                        SELECT p.*, COUNT(v.proposal_id) AS upvotes
                        FROM proposals p
                        LEFT JOIN proposal_votes v ON p.id = v.proposal_id AND v.vote = 'up'
                        GROUP BY p.id
                        ORDER BY upvotes ASC
                    """
                    order_clause = ""
                elif filter_sql == "popular":
                    base_query = """
                        SELECT p.*, COUNT(v.proposal_id) AS total_votes
                        FROM proposals p
                        LEFT JOIN proposal_votes v ON p.id = v.proposal_id
                        GROUP BY p.id
                        ORDER BY total_votes DESC
                    """
                    order_clause = ""

            # Compose query
            if "GROUP BY" not in base_query:
                if where_clauses:
                    base_query += " WHERE " + " AND ".join(where_clauses)
                if order_clause:
                    base_query += f" {order_clause}"
            proposals = db.execute(text(base_query), params).fetchall()

        # --- SERIALIZATION ---
        proposals_list = []
        for prop in proposals:
            if CRUD_MODELS_AVAILABLE:
                user_name = ""
                author_obj = None
                if hasattr(prop, "author_id") and prop.author_id:
                    author_obj = db.query(Harmonizer).filter(Harmonizer.id == prop.author_id).first()
                    if author_obj and hasattr(author_obj, "username"):
                        user_name = author_obj.username
                if not user_name:
                    # fallback para userName, author_username, author, "Unknown"
                    if hasattr(prop, "userName") and prop.userName:
                        user_name = prop.userName
                    elif hasattr(prop, "author_username") and prop.author_username:
                        user_name = prop.author_username
                    elif hasattr(prop, "author") and prop.author:
                        user_name = prop.author
                    else:
                        user_name = "Unknown"
                user_initials = (user_name[:2].upper() if user_name else "UN")
            else:
                user_name = getattr(prop, "userName", None) or getattr(prop, "author", None) or "Unknown"
                user_initials = (user_name[:2].upper() if user_name else "UN")

            # Votes and Comments
            if CRUD_MODELS_AVAILABLE:
                votes = db.query(ProposalVote).filter(ProposalVote.proposal_id == prop.id).all()
                comments = db.query(Comment).filter(Comment.proposal_id == prop.id).all()
            else:
                # fallback: try to get from votes and comments tables
                if votes_table_exists:
                    votes = db.execute(
                        text("SELECT * FROM proposal_votes WHERE proposal_id = :pid"),
                        {"pid": prop.id}
                    ).fetchall()
                else:
                    votes = []
                if comments_table_exists:
                    comments = db.execute(
                        text("SELECT * FROM comments WHERE proposal_id = :pid"),
                        {"pid": prop.id}
                    ).fetchall()
                else:
                    comments = []

            # Likes/Dislikes
            likes = []
            dislikes = []
            for v in votes:
                like_entry, dislike_entry = _serialize_vote_record(db, v)
                if like_entry:
                    likes.append(like_entry)
                if dislike_entry:
                    dislikes.append(dislike_entry)

            # Comments
            comments_list = []
            if CRUD_MODELS_AVAILABLE or comments_table_exists:
                for c in comments:
                    comments_list.append(_serialize_comment_record(db, c))

            proposals_list.append({
                "id": prop.id,
                "title": getattr(prop, "title", ""),
                "userName": str(user_name),
                "userInitials": user_initials,
                "text": getattr(prop, "description", "") if SUPER_NOVA_AVAILABLE else getattr(prop, "body", None) or getattr(prop, "description", ""),
                "author_img": getattr(prop, "author_img", ""),
                "time": _format_timestamp(getattr(prop, "created_at", None) or getattr(prop, "date", "")),
                "author_type": getattr(prop, "author_type", "human"),
                "likes": likes,
                "dislikes": dislikes,
                "comments": comments_list,
                "media": {
                    "image": f"/uploads/{getattr(prop, 'image', '')}" if getattr(prop, "image", None) else "",
                    "video": getattr(prop, "video", ""),
                    "link": getattr(prop, "link", ""),
                    "file": f"/uploads/{getattr(prop, 'file', '')}" if getattr(prop, "file", None) else ""
                }
            })

        return proposals_list

    except Exception as e:
        import traceback
        print(f"Error in list_proposals: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to list proposals: {str(e)}")

#
#
# --- Tally endpoints ---
# REMOVE DUPLICATE get_proposal ENDPOINT
    
@app.get("/proposals/{pid}/tally-weighted")
def tally_weighted(pid: int):
    if not SUPER_NOVA_AVAILABLE:
        raise HTTPException(status_code=501, detail="SuperNova weighted voting not available")
    return tally_votes(pid)

# --- Decision endpoint ---
@app.post("/decide/{pid}", response_model=DecisionSchema)
def decide(pid: int, threshold: float = 0.6, db: Session = Depends(get_db)):
    try:
        # Sistema ponderado
        weighted_decision = None
        if CRUD_MODELS_AVAILABLE:
            try:
                level = "important" if threshold >= 0.9 else "standard"
                weighted_decision = weighted_decide(pid, level)
                status = weighted_decision.get("status", "undecided")
            except Exception as e:
                print(f"Weighted decision failed: {e}")
        
        # Fallback para sistema tradicional
        if not weighted_decision:
            tally_result = _compute_vote_totals(db, pid)
            total = tally_result["up"] + tally_result["down"]
            status = "rejected"
            if total > 0 and (tally_result["up"] / total) >= threshold:
                status = "accepted"
        
        #
        if CRUD_MODELS_AVAILABLE:
            existing = db.query(Decision).filter(Decision.proposal_id == pid).first()
            if existing:
                existing.status = status
            else:
                decision = Decision(proposal_id=pid, status=status)
                db.add(decision)
        else:
            existing = db.execute(
                text("SELECT * FROM decisions WHERE proposal_id = :pid"),
                {"pid": pid}
            ).fetchone()
            
            if existing:
                db.execute(
                    text("UPDATE decisions SET status = :status WHERE id = :id"),
                    {"status": status, "id": existing.id}
                )
            else:
                db.execute(
                    text("INSERT INTO decisions (proposal_id, status) VALUES (:pid, :status)"),
                    {"pid": pid, "status": status}
                )
        
        db.commit()
        
        #
        if CRUD_MODELS_AVAILABLE:
            decision_obj = db.query(Decision).filter(Decision.proposal_id == pid).first()
            return DecisionSchema(
                id=decision_obj.id,
                proposal_id=decision_obj.proposal_id,
                status=decision_obj.status
            )
        else:
            decision_obj = db.execute(
                text("SELECT * FROM decisions WHERE proposal_id = :pid"),
                {"pid": pid}
            ).fetchone()
            return DecisionSchema(
                id=decision_obj.id,
                proposal_id=decision_obj.proposal_id,
                status=decision_obj.status
            )
            
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save decision: {str(e)}")

# --- Comment endpoint ---
@app.get("/comments")
def list_comments(proposal_id: int, db: Session = Depends(get_db)):
    if CRUD_MODELS_AVAILABLE:
        comments = db.query(Comment).filter(Comment.proposal_id == proposal_id).all()
        return [_serialize_comment_record(db, comment) for comment in comments]

    result = db.execute(
        text("SELECT * FROM comments WHERE proposal_id = :pid"),
        {"pid": proposal_id},
    )
    return [_serialize_comment_record(db, comment) for comment in result.fetchall()]


@app.post("/comments")
def add_comment(c: CommentIn, db: Session = Depends(get_db)):
    import datetime
    try:
        # --- 1. Obter ou criar Harmonizer ---
        author_obj = db.query(Harmonizer).filter(Harmonizer.username == c.user).first() if CRUD_MODELS_AVAILABLE else None
        if CRUD_MODELS_AVAILABLE and not author_obj:
            author_obj = Harmonizer(
                username=c.user,
                email=f"{c.user}@example.com",
                hashed_password="fallback",
                species=c.species or "human",
                profile_pic="default.jpg",
                created_at=datetime.datetime.utcnow(),
                is_active=True,
                is_admin=False,
                harmony_score=0.0,
                creative_spark=0.0,
                karma_score=0.0,
                network_centrality=0.0,
                last_passive_aura_timestamp=datetime.datetime.utcnow(),
                consent_given=True,
                bio=""
            )
            db.add(author_obj)
            db.commit()
            db.refresh(author_obj)

        species_value = getattr(author_obj, "species", c.species or "human") if author_obj else (c.species or "human")

        # --- 2. Obter ou criar VibeNode ---
        vibenode_id = None
        if CRUD_MODELS_AVAILABLE:
            vibenode_obj = db.query(VibeNode).first()
            if not vibenode_obj:
                vibenode_obj = VibeNode(
                    name="default",
                    author_id=author_obj.id if author_obj else 1
                )
                db.add(vibenode_obj)
                db.commit()
                db.refresh(vibenode_obj)
            vibenode_id = vibenode_obj.id

        # --- 3. Criar Comment ---
        comments_list = []
        if CRUD_MODELS_AVAILABLE:
            if author_obj and author_obj.id and vibenode_id:
                # Atualizar profile_pic se frontend enviou imagem
                if c.user_img and c.user_img.strip():
                    author_obj.profile_pic = c.user_img
                    db.add(author_obj)
                    db.commit()
                    db.refresh(author_obj)

                comment = Comment(
                    proposal_id=c.proposal_id,
                    content=c.comment,
                    author_id=author_obj.id,
                    vibenode_id=vibenode_id,
                    parent_comment_id=None,
                    created_at=datetime.datetime.utcnow()
                )
                db.add(comment)
                db.commit()
                db.refresh(comment)
                # Serializar comment com profile_pic somente se não for "default.jpg"
                comments_list = [_serialize_comment_record(db, comment)]
        else:
            user_img_value = c.user_img if c.user_img else ""
            db.execute(
                text("INSERT INTO comments (proposal_id, user, user_img, comment) VALUES (:pid, :user, :user_img, :comment)"),
                {
                    "pid": c.proposal_id,
                    "user": c.user or "Anonymous",
                    "user_img": user_img_value,
                    "comment": c.comment
                }
            )
            db.commit()
            comments_list = [{
                "proposal_id": c.proposal_id,
                "user": c.user or "Anonymous",
                "user_img": user_img_value,
                "species": c.species or "human",
                "comment": c.comment
            }]

        return {
            "ok": True,
            "species": species_value,
            "comments": comments_list
        }
    except Exception as e:
        db.rollback()
        import traceback
        print("Failed to add comment:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")

# --- Karma endpoint ---
@app.get("/users/{username}/karma")
def get_user_karma(username: str, db: Session = Depends(get_db)):
    if not SUPER_NOVA_AVAILABLE:
        raise HTTPException(status_code=501, detail="Karma system not available")
    
    user = db.query(Harmonizer).filter(Harmonizer.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "username": user.username,
        "karma": float(user.karma_score),
        "harmony_score": float(user.harmony_score),
        "creative_spark": float(user.creative_spark),
        "species": user.species,
        "network_centrality": user.network_centrality
    }

# --- Restante dos endpoints (mantidos da sua versão) ---
@app.get("/decisions", response_model=List[DecisionSchema])
def list_decisions(db: Session = Depends(get_db)):
    if SUPER_NOVA_AVAILABLE:
        decisions = db.query(Decision).order_by(Decision.id.desc()).all()
        return [DecisionSchema(id=d.id, proposal_id=d.proposal_id, status=d.status) for d in decisions]
    else:
        result = db.execute(text("SELECT * FROM decisions ORDER BY id DESC"))
        return [DecisionSchema(id=d.id, proposal_id=d.proposal_id, status=d.status) for d in result.fetchall()]

@app.post("/runs", response_model=RunSchema)
def create_run(decision_id: int, db: Session = Depends(get_db)):
    try:
        if SUPER_NOVA_AVAILABLE:
            run = Run(decision_id=decision_id, status="done")
            db.add(run)
        else:
            db.execute(
                text("INSERT INTO runs (decision_id, status) VALUES (:did, 'done')"),
                {"did": decision_id}
            )
        
        db.commit()
        
        if SUPER_NOVA_AVAILABLE:
            db.refresh(run)
            return RunSchema(id=run.id, decision_id=run.decision_id, status=run.status)
        else:
            result = db.execute(
                text("SELECT * FROM runs WHERE decision_id = :did ORDER BY id DESC LIMIT 1"),
                {"did": decision_id}
            )
            row = result.fetchone()
            return RunSchema(id=row.id, decision_id=row.decision_id, status=row.status)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create run: {str(e)}")

@app.get("/runs", response_model=List[RunSchema])
def list_runs(db: Session = Depends(get_db)):
    if SUPER_NOVA_AVAILABLE:
        runs = db.query(Run).order_by(Run.id.desc()).all()
        return [RunSchema(id=r.id, decision_id=r.decision_id, status=r.status) for r in runs]
    else:
        result = db.execute(text("SELECT * FROM runs ORDER BY id DESC"))
        return [RunSchema(id=r.id, decision_id=r.decision_id, status=r.status) for r in result.fetchall()]

# --- Proposal detail endpoint (final version, single definition) ---
@app.get("/proposals/{pid}", response_model=ProposalSchema)
def get_proposal(pid: int, db: Session = Depends(get_db)):
    if CRUD_MODELS_AVAILABLE:
        row = db.query(Proposal).filter(Proposal.id == pid).first()
        if not row:
            raise HTTPException(status_code=404, detail="Proposal not found")

        # Garantir que userName é sempre uma string do username do utilizador (Harmonizer.username) se possível
        user_name = ""
        author_obj = None
        if hasattr(row, "author_id") and row.author_id:
            author_obj = db.query(Harmonizer).filter(Harmonizer.id == row.author_id).first()
            if author_obj and hasattr(author_obj, "username"):
                user_name = author_obj.username
        if not user_name:
            if hasattr(row, "userName") and row.userName:
                user_name = row.userName
            elif hasattr(row, "author_username") and row.author_username:
                user_name = row.author_username
            elif hasattr(row, "author") and row.author:
                user_name = row.author
            else:
                user_name = "Unknown"
        user_initials = (user_name[:2].upper() if user_name else "UN")

        votes = db.query(ProposalVote).filter(ProposalVote.proposal_id == pid).all()
        # Serialize Harmonizer for likes/dislikes
        likes = []
        dislikes = []
        for v in votes:
            like_entry, dislike_entry = _serialize_vote_record(db, v)
            if like_entry:
                likes.append(like_entry)
            if dislike_entry:
                dislikes.append(dislike_entry)

        comments = db.query(Comment).filter(Comment.proposal_id == pid).all()
        comments_list = [_serialize_comment_record(db, c) for c in comments]

        return ProposalSchema(
            id=row.id,
            title=row.title,
            text=row.description,
            userName=str(user_name),
            userInitials=user_initials,
            author_img=row.author_img,
            time=_format_timestamp(row.created_at),
            author_type=row.author_type,
            likes=likes,
            dislikes=dislikes,
            comments=comments_list,
            media={
                "image": f"/uploads/{row.image}" if row.image else "",
                "video": row.video,
                "link": row.link,
                "file": f"/uploads/{row.file}" if row.file else ""
            }
        )
    else:
        result = db.execute(
            text("SELECT * FROM proposals WHERE id = :pid"),
            {"pid": pid}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Proposal not found")

        votes_result = db.execute(
            text("SELECT * FROM proposal_votes WHERE proposal_id = :pid"),
            {"pid": pid}
        )
        votes = votes_result.fetchall()
        # fallback for harmonizer_id: use voter if exists
        likes = [{"voter": getattr(v, "harmonizer_id", None) or getattr(v, "voter", ""), "type": v.voter_type} for v in votes if getattr(v, "choice", None) == "up"]
        dislikes = [{"voter": getattr(v, "harmonizer_id", None) or getattr(v, "voter", ""), "type": v.voter_type} for v in votes if getattr(v, "choice", None) == "down"]

        comments_result = db.execute(
            text("SELECT * FROM comments WHERE proposal_id = :pid"),
            {"pid": pid}
        )
        comments = comments_result.fetchall()
        comments_list = [{"proposal_id": c.proposal_id, "user": c.user, "user_img": c.user_img, "species": "human", "comment": c.comment} for c in comments]

        user_name = getattr(row, "userName", None) or getattr(row, "author", None) or "Unknown"
        user_initials = (user_name[:2].upper() if user_name else "UN")
        return ProposalSchema(
            id=row.id,
            title=row.title,
            text=getattr(row, "body", None) or getattr(row, "description", ""),
            userName=str(user_name),
            userInitials=user_initials,
            author_img=getattr(row, "author_img", ""),
            time=_format_timestamp(getattr(row, "date", "") or getattr(row, "created_at", "")),
            author_type=getattr(row, "author_type", ""),
            likes=likes,
            dislikes=dislikes,
            comments=comments_list,
            media={
                "image": f"/uploads/{getattr(row, 'image', '')}" if getattr(row, "image", None) else "",
                "video": getattr(row, "video", ""),
                "link": getattr(row, "link", ""),
                "file": f"/uploads/{getattr(row, 'file', '')}" if getattr(row, "file", None) else ""
            }
        )

# --- Upload endpoints ---
@app.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    os.makedirs(uploads_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(uploads_dir, unique_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"filename": unique_name, "url": f"/uploads/{unique_name}"}

@app.post("/upload-file")
async def upload_file(file: UploadFile = File(...)):
    os.makedirs(uploads_dir, exist_ok=True)
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(uploads_dir, unique_name)
    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    return {"filename": unique_name, "url": f"/uploads/{unique_name}"}

# --- Delete endpoints ---
@app.delete("/proposals/{pid}")
def delete_proposal(pid: int, db: Session = Depends(get_db)):
    try:
        if CRUD_MODELS_AVAILABLE:
            db.query(Comment).filter(Comment.proposal_id == pid).delete()
            db.query(ProposalVote).filter(ProposalVote.proposal_id == pid).delete()
            db.query(Proposal).filter(Proposal.id == pid).delete()
        else:
            db.execute(text("DELETE FROM comments WHERE proposal_id = :pid"), {"pid": pid})
            db.execute(text("DELETE FROM proposal_votes WHERE proposal_id = :pid"), {"pid": pid})
            db.execute(text("DELETE FROM proposals WHERE id = :pid"), {"pid": pid})
        
        db.commit()
        return {"ok": True, "deleted_id": pid}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete proposal: {str(e)}")

@app.delete("/proposals")
def delete_all_proposals(
    x_confirm_delete: Optional[str] = Header(default=None, alias="x-confirm-delete"),
    db: Session = Depends(get_db),
):
    """Delete all proposals. Requires 'x-confirm-delete: yes' header to prevent accidental calls."""
    if x_confirm_delete != "yes":
        raise HTTPException(
            status_code=400,
            detail="Send header 'x-confirm-delete: yes' to confirm bulk deletion"
        )
    try:
        if CRUD_MODELS_AVAILABLE:
            db.query(Comment).delete()
            db.query(ProposalVote).delete()
            deleted_count = db.query(Proposal).delete()
        else:
            db.execute(text("DELETE FROM comments"))
            db.execute(text("DELETE FROM proposal_votes"))
            result = db.execute(text("DELETE FROM proposals"))
            deleted_count = result.rowcount
        
        db.commit()
        return {"ok": True, "deleted_count": deleted_count}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete all proposals: {str(e)}")





# --- Register routers ---

# Import routers from backend package
from backend.votes_router import router as votes_router
from supernova_2177_ui_weighted.login_router import router as login_router

app.include_router(votes_router)
app.include_router(login_router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

