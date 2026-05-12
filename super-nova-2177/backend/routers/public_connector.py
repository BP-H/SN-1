from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, text
from sqlalchemy.orm import Session


def create_public_connector_router(
    *,
    get_db: Callable,
    public_base_url: str,
    crud_models_available: bool,
    proposal_model,
    harmonizer_model,
    comment_model,
    connector_get_proposal_or_404: Callable,
    public_vote_summary: Callable,
    find_harmonizer_by_username: Callable,
    social_avatar: Callable,
    format_timestamp: Callable,
    approved_proposal_collabs: Callable,
    media_payload: Callable,
    follow_counts: Callable,
    serialize_comment_record: Callable,
) -> APIRouter:
    router = APIRouter()

    def connector_public_web_url(path: str) -> str:
        return f"{public_base_url}{path}"

    def connector_author_context(db: Session, proposal) -> Dict[str, Any]:
        user_name = ""
        author_obj = None
        if crud_models_available and getattr(proposal, "author_id", None):
            author_obj = db.query(harmonizer_model).filter(harmonizer_model.id == proposal.author_id).first()
            if author_obj and getattr(author_obj, "username", None):
                user_name = author_obj.username

        if not user_name:
            user_name = (
                getattr(proposal, "userName", None)
                or getattr(proposal, "author_username", None)
                or getattr(proposal, "author", None)
                or "Unknown"
            )
        if author_obj is None:
            author_obj = find_harmonizer_by_username(db, user_name)

        avatar_value = getattr(proposal, "author_img", "")
        if author_obj is not None:
            avatar_value = getattr(author_obj, "profile_pic", None) or avatar_value

        return {
            "username": str(user_name),
            "species": getattr(author_obj, "species", None)
            or getattr(proposal, "author_type", "human")
            or "human",
            "avatar_url": social_avatar(avatar_value),
            "profile_url": connector_public_web_url(f"/users/{user_name}"),
        }

    def connector_vote_summary(db: Session, proposal_id: int) -> Dict[str, Any]:
        return public_vote_summary(db, proposal_id)

    def connector_comment_count(db: Session, proposal_id: int) -> int:
        if proposal_id is None:
            return 0
        try:
            if crud_models_available:
                return int(db.query(comment_model).filter(comment_model.proposal_id == proposal_id).count() or 0)
            return int(
                db.execute(
                    text("SELECT COUNT(*) FROM comments WHERE proposal_id = :proposal_id"),
                    {"proposal_id": proposal_id},
                ).scalar()
                or 0
            )
        except Exception:
            return 0

    def connector_text_snippet(value: str, limit: int = 220) -> str:
        clean = " ".join(str(value or "").split())
        if len(clean) <= limit:
            return clean
        return clean[: max(0, limit - 1)].rstrip() + "..."

    def connector_public_media_preview(value: str) -> str:
        clean = str(value or "").strip()
        if clean.startswith("data:image/"):
            media_type = clean.split(";", 1)[0]
            return f"{media_type};base64,<redacted>"
        return clean

    def connector_media_summary(media: Dict[str, Any]) -> Dict[str, Any]:
        image_values = media.get("images") if isinstance(media.get("images"), list) else []
        if not image_values and media.get("image"):
            image_values = [media.get("image")]
        images = [str(item or "").strip() for item in image_values if str(item or "").strip()]
        data_image_count = sum(1 for item in images if item.startswith("data:image/"))
        upload_image_count = sum(1 for item in images if item.startswith("/uploads/"))
        first_image = next((item for item in images if item), "")
        return {
            "image_count": len(images),
            "upload_image_count": upload_image_count,
            "data_image_fallback_count": data_image_count,
            "first_image_url": connector_public_media_preview(first_image),
            "has_video": bool(media.get("video")),
            "has_file": bool(media.get("file")),
            "has_external_link": bool(media.get("link")),
            "governance_kind": (media.get("governance") or {}).get("kind") if isinstance(media.get("governance"), dict) else None,
        }

    def connector_proposal_payload(db: Session, proposal, include_text: bool = True) -> Dict[str, Any]:
        proposal_id = getattr(proposal, "id", None)
        author = connector_author_context(db, proposal)
        payload = {
            "id": proposal_id,
            "type": "proposal",
            "title": getattr(proposal, "title", "") or "",
            "author": author,
            "created_at": format_timestamp(
                getattr(proposal, "created_at", None) or getattr(proposal, "date", None)
            ),
            "web_url": connector_public_web_url(f"/proposals/{proposal_id}"),
            "vote_summary": connector_vote_summary(db, proposal_id),
            "collabs": approved_proposal_collabs(db, proposal_id),
            "media": media_payload(
                getattr(proposal, "image", ""),
                getattr(proposal, "video", ""),
                getattr(proposal, "link", ""),
                getattr(proposal, "file", ""),
                getattr(proposal, "payload", None),
                getattr(proposal, "voting_deadline", None),
            ),
        }
        if include_text:
            payload["text"] = (
                getattr(proposal, "description", None)
                or getattr(proposal, "body", None)
                or ""
            )
        return payload

    def connector_public_digest_item(db: Session, proposal) -> Dict[str, Any]:
        payload = connector_proposal_payload(db, proposal, include_text=True)
        proposal_id = payload["id"]
        return {
            "id": proposal_id,
            "title": payload.get("title", ""),
            "text_snippet": connector_text_snippet(payload.get("text", "")),
            "author": {
                "username": (payload.get("author") or {}).get("username", ""),
                "species": (payload.get("author") or {}).get("species", "human"),
                "profile_url": (payload.get("author") or {}).get("profile_url", ""),
                "connector_profile_url": f"/connector/profiles/{(payload.get('author') or {}).get('username', '')}",
            },
            "created_at": payload.get("created_at"),
            "vote_summary": payload.get("vote_summary", {}),
            "comment_count": connector_comment_count(db, proposal_id),
            "media_summary": connector_media_summary(payload.get("media") or {}),
            "web_url": payload.get("web_url", ""),
            "connector_urls": {
                "proposal": f"/connector/proposals/{proposal_id}",
                "comments": f"/connector/proposals/{proposal_id}/comments",
                "votes": f"/connector/proposals/{proposal_id}/votes",
            },
        }

    def connector_profile_payload(db: Session, username: str) -> Dict[str, Any]:
        clean_username = (username or "").strip()
        if not clean_username:
            raise HTTPException(status_code=404, detail="Profile not found")

        user = None
        latest_post = None
        post_count = 0
        if crud_models_available:
            user = (
                db.query(harmonizer_model)
                .filter(func.lower(harmonizer_model.username) == clean_username.lower())
                .first()
            )
            latest_post = (
                db.query(proposal_model)
                .filter(func.lower(proposal_model.userName) == clean_username.lower())
                .order_by(desc(proposal_model.id))
                .first()
            )
            post_count = (
                db.query(proposal_model)
                .filter(func.lower(proposal_model.userName) == clean_username.lower())
                .count()
            )
        else:
            latest_post = db.execute(
                text(
                    "SELECT * FROM proposals WHERE lower(userName) = lower(:username) "
                    "ORDER BY id DESC LIMIT 1"
                ),
                {"username": clean_username},
            ).fetchone()
            post_count = int(
                db.execute(
                    text("SELECT COUNT(*) FROM proposals WHERE lower(userName) = lower(:username)"),
                    {"username": clean_username},
                ).scalar()
                or 0
            )

        if user is None and latest_post is None:
            raise HTTPException(status_code=404, detail="Profile not found")

        resolved_username = getattr(user, "username", None) or clean_username
        avatar_value = getattr(user, "profile_pic", None) or getattr(latest_post, "author_img", "") or ""
        species = getattr(user, "species", None) or getattr(latest_post, "author_type", None) or "human"
        counts = follow_counts(resolved_username)

        return {
            "username": resolved_username,
            "type": "profile",
            "species": species,
            "bio": getattr(user, "bio", "") if user is not None else "",
            "avatar_url": social_avatar(avatar_value),
            "web_url": connector_public_web_url(f"/users/{resolved_username}"),
            "post_count": post_count,
            "followers": counts["followers"],
            "following": counts["following"],
        }

    @router.get("/connector/supernova", summary="Describe the public read-only SuperNova connector facade")
    def connector_supernova_discovery():
        return {
            "name": "SuperNova",
            "mode": "public_read_only",
            "description": "Prototype SuperNova-owned public read facade for future connector surfaces.",
            "resources": ["profiles", "proposals", "comments", "vote_summaries", "ai_actor_profiles", "system_ai_reviews", "public_protocol_docs"],
            "endpoints": {
                "public_digest": "/connector/public-digest",
                "proposals": "/connector/proposals?search=&limit=&offset=",
                "proposal": "/connector/proposals/{id}",
                "proposal_comments": "/connector/proposals/{id}/comments?limit=&offset=",
                "proposal_votes": "/connector/proposals/{id}/votes",
                "system_ai_review": "/proposals/{id}/system-ai-review",
                "ai_review_ledger": "/proposals/{id}/ai-review-ledger",
                "ai_actor": "/ai-actors/{username}",
                "profile": "/connector/profiles/{username}",
                "spec": "/connector/supernova/spec",
            },
            "write_tools_enabled": False,
            "private_user_state_exposed": False,
            "action_tools": [],
            "safety": {
                "read_only": True,
                "public_only": True,
                "requires_auth": False,
                "no_private_notifications": True,
                "no_pending_collab_requests": True,
                "no_protected_core_internals": True,
            },
        }

    @router.get("/connector/supernova/spec", summary="Describe the public read-only connector metadata shape")
    def connector_supernova_spec():
        return {
            "name": "SuperNova",
            "mode": "public_read_only",
            "base_url": public_base_url,
            "resources": {
                "profiles": {
                    "endpoint": "/connector/profiles/{username}",
                    "summary": "Public profile identity, species, bio, avatar, public web URL, and public counts.",
                    "parameters": {
                        "username": {"in": "path", "type": "string", "required": True},
                    },
                    "response_shape": {
                        "mode": "public_read_only",
                        "resource": "profile",
                        "item": ["username", "type", "species", "bio", "avatar_url", "web_url", "post_count"],
                    },
                },
                "proposals": {
                    "endpoint": "/connector/proposals",
                    "summary": "Public proposal/post search and list results.",
                    "parameters": {
                        "search": {"in": "query", "type": "string", "required": False},
                        "limit": {"in": "query", "type": "integer", "required": False, "default": 20, "maximum": 50},
                        "offset": {"in": "query", "type": "integer", "required": False, "default": 0},
                    },
                    "response_shape": {
                        "mode": "public_read_only",
                        "resource": "proposals",
                        "items": ["id", "type", "title", "text", "author", "created_at", "web_url", "vote_summary", "collabs", "media"],
                    },
                },
                "proposal": {
                    "endpoint": "/connector/proposals/{id}",
                    "summary": "One public proposal/post by id.",
                    "parameters": {
                        "id": {"in": "path", "type": "integer", "required": True},
                    },
                    "response_shape": {
                        "mode": "public_read_only",
                        "resource": "proposal",
                        "item": ["id", "type", "title", "text", "author", "created_at", "web_url", "vote_summary", "collabs", "media"],
                    },
                },
                "comments": {
                    "endpoint": "/connector/proposals/{id}/comments",
                    "summary": "Public comments for one proposal/post.",
                    "parameters": {
                        "id": {"in": "path", "type": "integer", "required": True},
                        "limit": {"in": "query", "type": "integer", "required": False, "default": 20, "maximum": 100},
                        "offset": {"in": "query", "type": "integer", "required": False, "default": 0},
                    },
                    "response_shape": {
                        "mode": "public_read_only",
                        "resource": "comments",
                        "items": ["id", "proposal_id", "parent_comment_id", "user", "species", "comment", "created_at"],
                    },
                },
                "vote_summaries": {
                    "endpoint": "/connector/proposals/{id}/votes",
                    "embedded_in": ["proposals", "proposal"],
                    "summary": "Public aggregate support/opposition counts exposed as vote_summary.",
                    "parameters": {
                        "id": {"in": "path", "type": "integer", "required": True},
                    },
                    "response_shape": ["up", "down", "support", "oppose", "total", "approval_ratio"],
                },
                "public_digest": {
                    "endpoint": "/connector/public-digest",
                    "summary": "Compact public protocol and latest proposal digest for AI readers.",
                    "parameters": {
                        "limit": {"in": "query", "type": "integer", "required": False, "default": 10, "maximum": 20},
                    },
                    "response_shape": {
                        "mode": "public_read_only",
                        "resource": "public_digest",
                        "items": ["id", "title", "text_snippet", "author", "created_at", "vote_summary", "comment_count", "media_summary", "web_url", "connector_urls"],
                    },
                },
            },
            "endpoints": {
                "discovery": "/connector/supernova",
                "spec": "/connector/supernova/spec",
                "public_digest": "/connector/public-digest",
                "proposals": "/connector/proposals",
                "proposal": "/connector/proposals/{id}",
                "proposal_comments": "/connector/proposals/{id}/comments",
                "proposal_votes": "/connector/proposals/{id}/votes",
                "profile": "/connector/profiles/{username}",
            },
            "parameters": {
                "search": {"type": "string", "used_by": ["/connector/proposals"]},
                "limit": {"type": "integer", "used_by": ["/connector/public-digest", "/connector/proposals", "/connector/proposals/{id}/comments"]},
                "offset": {"type": "integer", "used_by": ["/connector/proposals", "/connector/proposals/{id}/comments"]},
            },
            "write_tools_enabled": False,
            "action_tools": [],
            "private_user_state_exposed": False,
            "safety": {
                "public_only": True,
                "read_only": True,
                "requires_auth": False,
                "no_private_notifications": True,
                "no_pending_collab_requests": True,
                "no_protected_core_internals": True,
                "no_writes": True,
            },
        }

    @router.get("/connector/public-digest", summary="Read compact public protocol and proposal digest for AI readers")
    def connector_public_digest(
        limit: int = Query(10, ge=1, le=20),
        db: Session = Depends(get_db),
    ):
        if crud_models_available:
            proposals = db.query(proposal_model).order_by(desc(proposal_model.created_at), desc(proposal_model.id)).limit(limit).all()
        else:
            proposals = db.execute(
                text("SELECT * FROM proposals ORDER BY created_at DESC, id DESC LIMIT :limit"),
                {"limit": limit},
            ).fetchall()

        return {
            "name": "SuperNova 2177",
            "mode": "public_read_only",
            "resource": "public_digest",
            "species_lanes": ["human", "ai", "company"],
            "safety": {
                "read_only": True,
                "public_only": True,
                "requires_auth": False,
                "no_writes": True,
                "no_private_state": True,
                "no_private_notifications": True,
                "no_pending_collab_requests": True,
                "no_autonomous_execution": True,
                "approval_required_ai_actions": True,
                "no_auth_state": True,
                "no_protected_core_internals": True,
                "no_raw_upload_bytes": True,
                "data_image_urls_redacted": True,
            },
            "links": {
                "discovery": "/connector/supernova",
                "spec": "/connector/supernova/spec",
                "public_digest": "/connector/public-digest",
                "proposals": "/connector/proposals",
                "profile": "/connector/profiles/{username}",
                "proposal_comments": "/connector/proposals/{id}/comments",
                "proposal_votes": "/connector/proposals/{id}/votes",
            },
            "items": [connector_public_digest_item(db, proposal) for proposal in proposals],
        }

    @router.get("/connector/proposals", summary="Search public proposals through the read-only connector facade")
    def connector_list_proposals(
        search: Optional[str] = Query(None),
        limit: int = Query(20, ge=1, le=50),
        offset: int = Query(0, ge=0),
        db: Session = Depends(get_db),
    ):
        if crud_models_available:
            query = db.query(proposal_model)
            if search and search.strip():
                search_filter = f"%{search.strip()}%"
                query = query.filter(
                    or_(
                        proposal_model.title.ilike(search_filter),
                        proposal_model.description.ilike(search_filter),
                        proposal_model.userName.ilike(search_filter),
                    )
                )
            proposals = query.order_by(desc(proposal_model.created_at), desc(proposal_model.id)).offset(offset).limit(limit).all()
        else:
            params: Dict[str, Any] = {"limit": limit, "offset": offset}
            where_clause = ""
            if search and search.strip():
                where_clause = (
                    "WHERE lower(title) LIKE lower(:search) "
                    "OR lower(description) LIKE lower(:search) "
                    "OR lower(userName) LIKE lower(:search)"
                )
                params["search"] = f"%{search.strip()}%"
            proposals = db.execute(
                text(
                    f"SELECT * FROM proposals {where_clause} "
                    "ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset"
                ),
                params,
            ).fetchall()

        return {
            "mode": "public_read_only",
            "resource": "proposals",
            "limit": limit,
            "offset": offset,
            "items": [connector_proposal_payload(db, proposal, include_text=True) for proposal in proposals],
        }

    @router.get("/connector/proposals/{proposal_id}", summary="Read one public proposal through the connector facade")
    def connector_get_proposal(proposal_id: int, db: Session = Depends(get_db)):
        proposal = connector_get_proposal_or_404(db, proposal_id)
        return {
            "mode": "public_read_only",
            "resource": "proposal",
            "item": connector_proposal_payload(db, proposal, include_text=True),
        }

    @router.get("/connector/proposals/{proposal_id}/comments", summary="Read public proposal comments through the connector facade")
    def connector_get_proposal_comments(
        proposal_id: int,
        limit: int = Query(20, ge=1, le=100),
        offset: int = Query(0, ge=0),
        db: Session = Depends(get_db),
    ):
        connector_get_proposal_or_404(db, proposal_id)
        if crud_models_available:
            comments = (
                db.query(comment_model)
                .filter(comment_model.proposal_id == proposal_id)
                .order_by(comment_model.id.asc())
                .offset(offset)
                .limit(limit)
                .all()
            )
        else:
            comments = db.execute(
                text(
                    "SELECT * FROM comments WHERE proposal_id = :proposal_id "
                    "ORDER BY id ASC LIMIT :limit OFFSET :offset"
                ),
                {"proposal_id": proposal_id, "limit": limit, "offset": offset},
            ).fetchall()

        return {
            "mode": "public_read_only",
            "resource": "comments",
            "proposal_id": proposal_id,
            "limit": limit,
            "offset": offset,
            "items": [serialize_comment_record(db, comment) for comment in comments],
        }

    @router.get("/connector/proposals/{proposal_id}/votes", summary="Read public proposal vote summary through the connector facade")
    def connector_get_proposal_vote_summary(proposal_id: int, db: Session = Depends(get_db)):
        connector_get_proposal_or_404(db, proposal_id)
        return {
            "mode": "public_read_only",
            "resource": "proposal_vote_summary",
            "proposal_id": proposal_id,
            "vote_summary": connector_vote_summary(db, proposal_id),
        }

    @router.get("/connector/profiles/{username}", summary="Read one public profile through the connector facade")
    def connector_get_profile(username: str, db: Session = Depends(get_db)):
        return {
            "mode": "public_read_only",
            "resource": "profile",
            "item": connector_profile_payload(db, username),
        }

    return router
