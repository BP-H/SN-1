import datetime
import json
from typing import Any, Callable, Dict, Optional, Type

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc
from sqlalchemy.orm import Session


def _compact_payload(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def _safe_int(value: Any) -> Optional[int]:
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _payload_parent_comment_id(*payloads: Dict[str, Any]) -> Optional[int]:
    for payload in payloads:
        if isinstance(payload, dict) and "parent_comment_id" in payload:
            return _safe_int(payload.get("parent_comment_id"))
    return None


def _same_ai_delegate_payload(
    payload: Dict[str, Any],
    *,
    ai_actor_id: Optional[int],
    ai_actor_username: str,
    delegate_harmonizer_user_id: Optional[int],
) -> bool:
    payload_actor_id = _safe_int(payload.get("ai_actor_id") or payload.get("selected_ai_actor_id"))
    if ai_actor_id is not None and payload_actor_id == ai_actor_id:
        return True

    payload_delegate_user_id = _safe_int(payload.get("delegate_harmonizer_user_id"))
    if delegate_harmonizer_user_id is not None and payload_delegate_user_id == delegate_harmonizer_user_id:
        return True

    payload_username = str(payload.get("ai_actor_username") or payload.get("actor") or "").strip().lower()
    return bool(ai_actor_username and payload_username and payload_username == ai_actor_username.strip().lower())


def _find_existing_ai_delegate_comment(
    db: Session,
    *,
    connector_action_proposal_model,
    comment_model,
    proposal_id: int,
    custodian_user_id: Optional[int],
    ai_actor_id: Optional[int],
    ai_actor_username: str,
    delegate_harmonizer_user_id: Optional[int],
    parent_comment_id: Optional[int],
    action_types: tuple[str, ...] = ("draft_ai_comment", "draft_ai_review"),
) -> Dict[str, Any]:
    if connector_action_proposal_model is not None:
        rows = (
            db.query(connector_action_proposal_model)
            .filter(connector_action_proposal_model.action_type.in_(list(action_types)))
            .filter(connector_action_proposal_model.target_id == str(proposal_id))
            .filter(connector_action_proposal_model.status.in_(["draft", "executed"]))
            .order_by(desc(connector_action_proposal_model.id))
            .limit(50)
            .all()
        )
        for row in rows:
            if getattr(row, "status", "") == "draft" and custodian_user_id is not None:
                if getattr(row, "actor_user_id", None) != custodian_user_id:
                    continue
            draft_payload = _compact_payload(getattr(row, "draft_payload", None))
            result_payload = _compact_payload(getattr(row, "result_payload", None))
            if _same_ai_delegate_payload(
                draft_payload,
                ai_actor_id=ai_actor_id,
                ai_actor_username=ai_actor_username,
                delegate_harmonizer_user_id=delegate_harmonizer_user_id,
            ) or _same_ai_delegate_payload(
                result_payload,
                ai_actor_id=ai_actor_id,
                ai_actor_username=ai_actor_username,
                delegate_harmonizer_user_id=delegate_harmonizer_user_id,
            ):
                row_parent_comment_id = _payload_parent_comment_id(draft_payload, result_payload)
                if row_parent_comment_id != parent_comment_id:
                    continue
                return {"action": row, "comment": None, "status": getattr(row, "status", "")}

    if comment_model is not None and delegate_harmonizer_user_id is not None:
        query = (
            db.query(comment_model)
            .filter(comment_model.proposal_id == proposal_id)
            .filter(comment_model.author_id == delegate_harmonizer_user_id)
        )
        if hasattr(comment_model, "parent_comment_id"):
            if parent_comment_id is None:
                query = query.filter(comment_model.parent_comment_id.is_(None))
            else:
                query = query.filter(comment_model.parent_comment_id == parent_comment_id)
        elif parent_comment_id is not None:
            return {}
        comment = query.order_by(desc(comment_model.id)).first()
        if comment:
            return {"action": None, "comment": comment, "status": "published"}

    return {}


def _duplicate_ai_delegate_comment_response(
    *,
    existing: Dict[str, Any],
    proposal_id: int,
    proposal_title: str,
    ai_actor_id: Optional[int],
    ai_actor_username: str,
    parent_comment_id: Optional[int],
) -> Dict[str, Any]:
    action = existing.get("action")
    comment = existing.get("comment")
    existing_action_id = getattr(action, "id", None) if action is not None else None
    existing_comment_id = getattr(comment, "id", None) if comment is not None else None
    status = existing.get("status") or "existing"
    is_reply_scope = parent_comment_id is not None
    if status == "draft":
        action_type = getattr(action, "action_type", "") if action is not None else ""
        if action_type == "draft_ai_review":
            message = "This AI delegate already has a pending review draft that would publish a standalone AI-authored comment for this proposal."
        elif is_reply_scope:
            message = "This AI delegate already has a pending reply draft for this comment."
        else:
            message = "This AI delegate already has a pending standalone comment draft for this proposal."
    elif is_reply_scope:
        message = "This AI delegate already has an AI-authored reply under this comment."
    else:
        message = "This AI delegate already has a standalone AI-authored comment for this proposal."
    return {
        "ok": True,
        "mode": "duplicate_guard",
        "executed": False,
        "duplicate": True,
        "action_proposal": {
            "id": existing_action_id,
            "status": getattr(action, "status", status) if action is not None else status,
            "action_type": getattr(action, "action_type", "draft_ai_comment") if action is not None else "draft_ai_comment",
            "actor_user_id": getattr(action, "actor_user_id", None) if action is not None else None,
            "target_type": getattr(action, "target_type", "proposal_ai_comment") if action is not None else "proposal_ai_comment",
            "target_id": getattr(action, "target_id", str(proposal_id)) if action is not None else str(proposal_id),
        },
        "summary": {
            "action": "duplicate_ai_comment",
            "proposal_id": proposal_id,
            "proposal_title": proposal_title,
            "parent_comment_id": parent_comment_id,
            "ai_actor_id": ai_actor_id,
            "ai_actor_username": ai_actor_username,
            "existing_action_id": existing_action_id,
            "existing_comment_id": existing_comment_id,
            "duplicate_scope": "comment_reply" if is_reply_scope else "top_level_comment",
            "duplicate_reason": status,
            "message": message,
        },
        "safety": {
            "duplicate_guard": True,
            "requires_approval": True,
            "no_execution": True,
            "no_write_action_performed": True,
            "no_private_state": True,
        },
    }


def create_ai_actions_router(
    *,
    get_db: Callable,
    connector_action_proposal_model,
    connector_action_statuses: set[str],
    connector_draft_vote_model: Type[BaseModel],
    connector_draft_ai_review_model: Type[BaseModel],
    connector_draft_ai_delegate_review_model: Type[BaseModel],
    connector_draft_ai_delegate_comment_model: Type[BaseModel],
    ai_delegate_post_draft_model: Type[BaseModel],
    connector_draft_comment_model: Type[BaseModel],
    connector_draft_proposal_model: Type[BaseModel],
    connector_draft_collab_request_model: Type[BaseModel],
    get_current_harmonizer: Callable,
    connector_require_actor: Callable,
    connector_require_ai_actor: Callable,
    connector_get_proposal_or_404: Callable,
    connector_proposal_title: Callable,
    connector_proposal_owner_username: Callable,
    normalize_connector_vote_choice: Callable,
    connector_review_rationale: Callable,
    connector_confidence: Callable,
    create_connector_action_draft: Callable,
    connector_draft_response: Callable,
    serialize_connector_action: Callable,
    ai_delegate_actor_metadata: Callable,
    ai_delegate_action_metadata: Callable,
    hash_text: Callable,
    get_ai_actor_row_by_id: Callable,
    get_ai_actor_row_by_username: Callable,
    row_to_ai_actor_payload: Callable,
    build_ai_actor_context: Callable,
    generate_locked_ai_review: Callable,
    normalize_ai_comment_focus: Callable,
    generate_locked_ai_delegate_comment: Callable,
    generate_ai_delegate_post_draft: Callable,
    comment_public_context: Callable,
    safe_user_key: Callable,
    find_harmonizer_by_username: Callable,
    harmonizer_model,
    comment_model,
    supernova_ai_model_identity: str,
) -> APIRouter:
    router = APIRouter()

    ConnectorDraftVoteIn = connector_draft_vote_model
    ConnectorDraftAiReviewIn = connector_draft_ai_review_model
    ConnectorDraftAiDelegateReviewIn = connector_draft_ai_delegate_review_model
    ConnectorDraftAiDelegateCommentIn = connector_draft_ai_delegate_comment_model
    AiDelegatePostDraftIn = ai_delegate_post_draft_model
    ConnectorDraftCommentIn = connector_draft_comment_model
    ConnectorDraftProposalIn = connector_draft_proposal_model
    ConnectorDraftCollabRequestIn = connector_draft_collab_request_model

    @router.get("/connector/actions", summary="List authenticated connector action proposals")
    def connector_list_actions(
        status: Optional[str] = Query("draft"),
        limit: Optional[int] = Query(50),
        offset: int = Query(0),
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        if connector_action_proposal_model is None:
            raise HTTPException(status_code=503, detail="Connector action proposals are unavailable")

        actor = get_current_harmonizer(authorization, db)
        clean_status = (status or "draft").strip().lower()
        if clean_status not in connector_action_statuses:
            raise HTTPException(status_code=400, detail="Unsupported connector action status")
        try:
            safe_limit = int(limit if limit is not None else 50)
        except (TypeError, ValueError):
            safe_limit = 50
        safe_limit = max(1, min(safe_limit, 100))
        try:
            safe_offset = int(offset)
        except (TypeError, ValueError):
            safe_offset = 0
        safe_offset = max(0, safe_offset)

        query = (
            db.query(connector_action_proposal_model)
            .filter(connector_action_proposal_model.actor_user_id == getattr(actor, "id", None))
            .filter(connector_action_proposal_model.status == clean_status)
            .order_by(desc(connector_action_proposal_model.created_at), desc(connector_action_proposal_model.id))
        )
        rows = query.offset(safe_offset).limit(safe_limit).all()
        return {
            "ok": True,
            "actions": [serialize_connector_action(row) for row in rows],
            "count": len(rows),
            "limit": safe_limit,
            "offset": safe_offset,
        }

    @router.post("/connector/actions/{action_id}/cancel", summary="Cancel an authenticated draft connector action")
    def connector_cancel_action(
        action_id: int,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        if connector_action_proposal_model is None:
            raise HTTPException(status_code=503, detail="Connector action proposals are unavailable")

        actor = get_current_harmonizer(authorization, db)
        action = db.query(connector_action_proposal_model).filter(
            connector_action_proposal_model.id == action_id
        ).first()
        if not action:
            raise HTTPException(status_code=404, detail="Connector action proposal not found")
        if getattr(action, "actor_user_id", None) != getattr(actor, "id", None):
            raise HTTPException(status_code=403, detail="Bearer token does not match connector action actor")
        if getattr(action, "status", "") != "draft":
            raise HTTPException(status_code=409, detail="Only draft connector actions can be canceled")

        try:
            action.status = "canceled"
            db.commit()
            db.refresh(action)
            return {
                "ok": True,
                "action": serialize_connector_action(action),
                "executed": False,
                "safety": {
                    "canceled_only": True,
                    "no_write_action_performed": True,
                },
            }
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to cancel connector action: {str(exc)}")

    @router.post("/connector/actions/draft-vote", summary="Draft a connector vote action without executing it")
    def connector_draft_vote(
        payload: ConnectorDraftVoteIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = connector_require_actor(authorization, db, payload.username)
        proposal = connector_get_proposal_or_404(db, payload.proposal_id)
        choice = normalize_connector_vote_choice(payload.choice)
        summary = {
            "action": "draft_vote",
            "actor": getattr(actor, "username", ""),
            "proposal_id": getattr(proposal, "id", payload.proposal_id),
            "proposal_title": connector_proposal_title(proposal),
            **choice,
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_vote",
                actor_user_id=getattr(actor, "id", None),
                target_type="proposal",
                target_id=getattr(proposal, "id", payload.proposal_id),
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft vote action: {str(exc)}")

    @router.post("/connector/actions/draft-ai-review", summary="Draft one AI review vote and rationale without executing it")
    def connector_draft_ai_review(
        payload: ConnectorDraftAiReviewIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = connector_require_ai_actor(authorization, db, payload.username)
        proposal = connector_get_proposal_or_404(db, payload.proposal_id)
        choice = normalize_connector_vote_choice(payload.choice)
        rationale = connector_review_rationale(payload)
        confidence = connector_confidence(payload.confidence)
        actor_metadata = ai_delegate_actor_metadata(actor)
        reasoning_hash = hash_text(rationale)
        summary = {
            "action": "draft_ai_review",
            "actor": getattr(actor, "username", ""),
            "actor_species": "ai",
            **actor_metadata,
            "proposal_id": getattr(proposal, "id", payload.proposal_id),
            "proposal_title": connector_proposal_title(proposal),
            "rationale": rationale,
            "reasoning_summary": rationale,
            "reasoning_hash": reasoning_hash,
            "confidence": confidence,
            **choice,
            "sealed_reasoning": False,
            "reasoning_source": "ai_actor_submitted_draft",
            "approval_effect": "Publish one AI vote and one AI rationale comment.",
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_ai_review",
                actor_user_id=getattr(actor, "id", None),
                target_type="proposal_ai_review",
                target_id=getattr(proposal, "id", payload.proposal_id),
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft AI review action: {str(exc)}")

    @router.post("/connector/actions/draft-ai-delegate-review", summary="Draft a locked-charter AI delegate review without executing it")
    def connector_draft_ai_delegate_review(
        payload: ConnectorDraftAiDelegateReviewIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        requester = connector_require_actor(authorization, db, payload.username)
        proposal = connector_get_proposal_or_404(db, payload.proposal_id)
        actor_payload = None
        publish_actor = None
        action_actor_user_id = getattr(requester, "id", None)

        if payload.ai_actor_id is not None or payload.ai_actor_username:
            row = (
                get_ai_actor_row_by_id(db, payload.ai_actor_id)
                if payload.ai_actor_id is not None
                else get_ai_actor_row_by_username(db, payload.ai_actor_username or "")
            )
            actor_payload = row_to_ai_actor_payload(row)
            if not actor_payload or actor_payload.get("ai_actor_type") != "principal_delegate":
                raise HTTPException(status_code=404, detail="AI delegate not found")
            if actor_payload.get("custodian_user_id") != getattr(requester, "id", None):
                raise HTTPException(status_code=403, detail="Only the delegate custodian can request this AI review")
            if not actor_payload.get("active"):
                raise HTTPException(status_code=403, detail="AI delegate is disabled")
            publish_actor = db.query(harmonizer_model).filter(
                harmonizer_model.id == actor_payload.get("harmonizer_user_id")
            ).first()
            if not publish_actor or (getattr(publish_actor, "species", "") or "").lower() != "ai":
                raise HTTPException(status_code=409, detail="AI delegate identity is not publishable")
            actor_metadata = ai_delegate_action_metadata(actor_payload)
            duplicate = _find_existing_ai_delegate_comment(
                db,
                connector_action_proposal_model=connector_action_proposal_model,
                comment_model=comment_model,
                proposal_id=getattr(proposal, "id", payload.proposal_id),
                custodian_user_id=getattr(requester, "id", None),
                ai_actor_id=_safe_int(actor_payload.get("id")),
                ai_actor_username=str(actor_payload.get("username") or ""),
                delegate_harmonizer_user_id=_safe_int(actor_payload.get("harmonizer_user_id")),
                parent_comment_id=None,
            )
            if duplicate:
                return _duplicate_ai_delegate_comment_response(
                    existing=duplicate,
                    proposal_id=getattr(proposal, "id", payload.proposal_id),
                    proposal_title=connector_proposal_title(proposal),
                    ai_actor_id=_safe_int(actor_payload.get("id")),
                    ai_actor_username=str(actor_payload.get("username") or ""),
                    parent_comment_id=None,
                )
            actor_metadata["ai_actor_context"] = build_ai_actor_context(db, actor_payload)
            display_name = actor_payload.get("display_name") or actor_payload.get("username")
        else:
            if (getattr(requester, "species", "") or "").strip().lower() != "ai":
                raise HTTPException(status_code=400, detail="ai_actor_id or ai_actor_username is required")
            publish_actor = requester
            actor_metadata = ai_delegate_actor_metadata(requester)
            display_name = getattr(requester, "username", "")

        review = generate_locked_ai_review(
            proposal=proposal,
            actor_payload={
                **actor_metadata,
                "display_name": display_name,
            },
            allow_caution=False,
        )
        choice = normalize_connector_vote_choice(review["vote_intent"])
        confidence = connector_confidence(payload.confidence)
        summary = {
            "action": "draft_ai_review",
            "actor": getattr(publish_actor, "username", ""),
            "actor_species": "ai",
            **actor_metadata,
            "approved_by_required_user_id": action_actor_user_id,
            "proposal_id": getattr(proposal, "id", payload.proposal_id),
            "proposal_title": connector_proposal_title(proposal),
            "rationale": review["reasoning_summary"],
            "reasoning_summary": review["reasoning_summary"],
            "reasoning_text": review["reasoning_text"],
            "reasoning_hash": review["reasoning_hash"],
            "risk_flags": review["risk_flags"],
            "proposal_context": review.get("proposal_context", {}),
            "ai_actor_context": review.get("ai_actor_context", {}),
            "generation_source": review.get("generation_source", "deterministic_fallback_no_key"),
            "model_identity": review.get("model_identity") or actor_metadata.get("model_identity") or supernova_ai_model_identity,
            "confidence": confidence,
            **choice,
            "sealed_reasoning": True,
            "reasoning_source": "locked_server_charter",
            "approval_effect": "Publish one AI vote and one AI rationale comment.",
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_ai_review",
                actor_user_id=action_actor_user_id,
                target_type="proposal_ai_review",
                target_id=getattr(proposal, "id", payload.proposal_id),
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft AI delegate review action: {str(exc)}")

    @router.post("/connector/actions/draft-ai-delegate-comment", summary="Draft a locked-charter AI delegate comment without publishing")
    def connector_draft_ai_delegate_comment(
        payload: ConnectorDraftAiDelegateCommentIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        requester = connector_require_actor(authorization, db, payload.username)
        proposal = connector_get_proposal_or_404(db, payload.proposal_id)
        focus = normalize_ai_comment_focus(payload.instruction or payload.focus or "")
        parent_comment_context = None
        parent_comment_id = payload.parent_comment_id
        if parent_comment_id is not None:
            try:
                parent_comment_id = int(parent_comment_id)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="parent_comment_id must be a comment id")
            if parent_comment_id <= 0:
                raise HTTPException(status_code=400, detail="parent_comment_id must be a comment id")
            parent_comment = db.query(comment_model).filter(comment_model.id == parent_comment_id).first() if comment_model is not None else None
            if not parent_comment:
                raise HTTPException(status_code=404, detail="Reply target comment not found")
            if str(getattr(parent_comment, "proposal_id", "")) != str(getattr(proposal, "id", payload.proposal_id)):
                raise HTTPException(status_code=400, detail="Reply target comment belongs to another post")
            parent_comment_context = comment_public_context(db, parent_comment)
        row = (
            get_ai_actor_row_by_id(db, payload.ai_actor_id)
            if payload.ai_actor_id is not None
            else get_ai_actor_row_by_username(db, payload.ai_actor_username or "")
        )
        actor_payload = row_to_ai_actor_payload(row)
        if not actor_payload or actor_payload.get("ai_actor_type") != "principal_delegate":
            raise HTTPException(status_code=404, detail="AI delegate not found")
        if actor_payload.get("custodian_user_id") != getattr(requester, "id", None):
            raise HTTPException(status_code=403, detail="Only the delegate custodian can request this AI comment draft")
        if not actor_payload.get("active"):
            raise HTTPException(status_code=403, detail="AI delegate is disabled")
        publish_actor = db.query(harmonizer_model).filter(harmonizer_model.id == actor_payload.get("harmonizer_user_id")).first()
        if not publish_actor or (getattr(publish_actor, "species", "") or "").lower() != "ai":
            raise HTTPException(status_code=409, detail="AI delegate identity is not publishable")

        actor_metadata = ai_delegate_action_metadata(actor_payload)
        duplicate = _find_existing_ai_delegate_comment(
            db,
            connector_action_proposal_model=connector_action_proposal_model,
            comment_model=comment_model,
            proposal_id=getattr(proposal, "id", payload.proposal_id),
            custodian_user_id=getattr(requester, "id", None),
            ai_actor_id=_safe_int(actor_payload.get("id")),
            ai_actor_username=str(actor_payload.get("username") or ""),
            delegate_harmonizer_user_id=_safe_int(actor_payload.get("harmonizer_user_id")),
            parent_comment_id=parent_comment_id,
        )
        if duplicate:
            return _duplicate_ai_delegate_comment_response(
                existing=duplicate,
                proposal_id=getattr(proposal, "id", payload.proposal_id),
                proposal_title=connector_proposal_title(proposal),
                ai_actor_id=_safe_int(actor_payload.get("id")),
                ai_actor_username=str(actor_payload.get("username") or ""),
                parent_comment_id=parent_comment_id,
            )

        actor_metadata["ai_actor_context"] = build_ai_actor_context(db, actor_payload)
        display_name = actor_payload.get("display_name") or actor_payload.get("username")
        comment_draft = generate_locked_ai_delegate_comment(
            proposal=proposal,
            actor_payload={
                **actor_metadata,
                "display_name": display_name,
            },
            focus=focus,
            parent_comment_context=parent_comment_context,
        )
        summary = {
            "action": "draft_ai_comment",
            "actor": getattr(publish_actor, "username", ""),
            "actor_species": "ai",
            **actor_metadata,
            "approved_by_required_user_id": getattr(requester, "id", None),
            "proposal_id": getattr(proposal, "id", payload.proposal_id),
            "proposal_title": connector_proposal_title(proposal),
            "parent_comment_id": parent_comment_id,
            "parent_comment_context": parent_comment_context or {},
            "instruction": focus,
            "body": comment_draft["generated_comment"],
            "generated_comment": comment_draft["generated_comment"],
            "content_hash": comment_draft["content_hash"],
            "reasoning_summary": comment_draft["reasoning_summary"],
            "reasoning_text": comment_draft["reasoning_text"],
            "reasoning_hash": comment_draft["reasoning_hash"],
            "proposal_context": comment_draft.get("proposal_context", {}),
            "ai_actor_context": comment_draft.get("ai_actor_context", {}),
            "generation_source": comment_draft.get("generation_source", "deterministic_fallback_no_key"),
            "model_identity": comment_draft.get("model_identity") or actor_metadata.get("model_identity") or supernova_ai_model_identity,
            "sealed_content": True,
            "content_source": "locked_server_charter",
            "approval_effect": "Publish one AI-authored reply." if parent_comment_id else "Publish one AI-authored comment.",
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_ai_comment",
                actor_user_id=getattr(requester, "id", None),
                target_type="proposal_ai_comment",
                target_id=getattr(proposal, "id", payload.proposal_id),
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft AI delegate comment action: {str(exc)}")

    @router.post("/connector/actions/draft-ai-delegate-post", summary="Draft a locked-charter AI delegate post without publishing")
    def connector_draft_ai_delegate_post(
        payload: AiDelegatePostDraftIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        requester = connector_require_actor(authorization, db, payload.username)
        row = (
            get_ai_actor_row_by_id(db, payload.ai_actor_id)
            if payload.ai_actor_id is not None
            else get_ai_actor_row_by_username(db, payload.ai_actor_username or "")
        )
        actor_payload = row_to_ai_actor_payload(row)
        if not actor_payload or actor_payload.get("ai_actor_type") != "principal_delegate":
            raise HTTPException(status_code=404, detail="AI delegate not found")
        if actor_payload.get("custodian_user_id") != getattr(requester, "id", None):
            raise HTTPException(status_code=403, detail="Only the delegate custodian can request this AI post draft")
        if not actor_payload.get("active"):
            raise HTTPException(status_code=403, detail="AI delegate is disabled")
        publish_actor = db.query(harmonizer_model).filter(harmonizer_model.id == actor_payload.get("harmonizer_user_id")).first()
        if not publish_actor or (getattr(publish_actor, "species", "") or "").lower() != "ai":
            raise HTTPException(status_code=409, detail="AI delegate identity is not publishable")

        actor_metadata = ai_delegate_action_metadata(actor_payload)
        actor_metadata["ai_actor_context"] = build_ai_actor_context(db, actor_payload)
        post_draft = generate_ai_delegate_post_draft(
            actor_payload={
                **actor_metadata,
                "display_name": actor_payload.get("display_name") or actor_payload.get("username"),
            },
            current_text=payload.current_text or "",
            focus=payload.focus or "",
            media_type=payload.media_type or "",
            media_label=payload.media_label or "",
            image_count=payload.image_count or 0,
            image_data_urls=payload.image_data_urls or [],
            governance_kind=payload.governance_kind or "post",
            decision_level=payload.decision_level or "",
            voting_days=payload.voting_days,
        )
        summary = {
            "action": "draft_ai_post",
            "actor": getattr(publish_actor, "username", ""),
            "actor_species": "ai",
            **actor_metadata,
            "approved_by_required_user_id": getattr(requester, "id", None),
            "title": post_draft["generated_title"],
            "body": post_draft["generated_post_body"],
            "generated_title": post_draft["generated_title"],
            "generated_post_body": post_draft["generated_post_body"],
            "content_hash": post_draft["content_hash"],
            "context_hash": post_draft.get("context_hash"),
            "reasoning_summary": post_draft.get("reasoning_summary"),
            "reasoning_text": post_draft.get("reasoning_text"),
            "reasoning_hash": post_draft.get("reasoning_hash"),
            "governance_framing": post_draft.get("governance_framing"),
            "media_caption_guidance": post_draft.get("media_caption_guidance"),
            "ai_actor_context": post_draft.get("ai_actor_context", {}),
            "generation_source": post_draft.get("generation_source", "deterministic_fallback_no_key"),
            "model_identity": post_draft.get("model_identity") or actor_metadata.get("model_identity") or supernova_ai_model_identity,
            "prompt_policy_version": post_draft.get("prompt_policy_version") or actor_metadata.get("prompt_policy_version"),
            "charter_name": post_draft.get("charter_name") or actor_metadata.get("charter_name"),
            "governance_kind": payload.governance_kind or "post",
            "decision_level": payload.decision_level or "",
            "voting_days": payload.voting_days,
            "sealed_content": True,
            "content_source": "locked_server_charter",
            "approval_effect": "Publish one AI-authored post.",
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_ai_post",
                actor_user_id=getattr(requester, "id", None),
                target_type="ai_delegate_post",
                target_id=None,
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft AI delegate post action: {str(exc)}")

    @router.post("/connector/actions/draft-comment", summary="Draft a connector comment action without executing it")
    def connector_draft_comment(
        payload: ConnectorDraftCommentIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = connector_require_actor(authorization, db, payload.username)
        proposal = connector_get_proposal_or_404(db, payload.proposal_id)
        body = (payload.body or payload.comment or "").strip()
        if not body:
            raise HTTPException(status_code=400, detail="comment body is required")
        summary = {
            "action": "draft_comment",
            "actor": getattr(actor, "username", ""),
            "proposal_id": getattr(proposal, "id", payload.proposal_id),
            "proposal_title": connector_proposal_title(proposal),
            "body": body,
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_comment",
                actor_user_id=getattr(actor, "id", None),
                target_type="proposal",
                target_id=getattr(proposal, "id", payload.proposal_id),
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft comment action: {str(exc)}")

    @router.post("/connector/actions/draft-proposal", summary="Draft a connector proposal action without executing it")
    def connector_draft_proposal(
        payload: ConnectorDraftProposalIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = connector_require_actor(authorization, db, payload.author)
        title = (payload.title or "").strip()
        body = (payload.body or "").strip()
        if not title:
            raise HTTPException(status_code=400, detail="title is required")
        if not body:
            raise HTTPException(status_code=400, detail="body is required")
        summary = {
            "action": "draft_proposal",
            "actor": getattr(actor, "username", ""),
            "title": title,
            "body": body,
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_proposal",
                actor_user_id=getattr(actor, "id", None),
                target_type="proposal",
                target_id=None,
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft proposal action: {str(exc)}")

    @router.post("/connector/actions/draft-collab-request", summary="Draft a connector collab request without executing it")
    def connector_draft_collab_request(
        payload: ConnectorDraftCollabRequestIn,
        authorization: Optional[str] = Header(default=None),
        db: Session = Depends(get_db),
    ):
        actor = connector_require_actor(authorization, db, payload.author)
        proposal = connector_get_proposal_or_404(db, payload.proposal_id)
        owner = connector_proposal_owner_username(db, proposal)
        if safe_user_key(owner) != safe_user_key(getattr(actor, "username", "")):
            raise HTTPException(status_code=403, detail="Only the proposal author can draft a collab request")

        collaborator_username = (payload.collaborator_username or payload.collaborator or "").strip()
        if not collaborator_username:
            raise HTTPException(status_code=400, detail="collaborator username is required")
        collaborator = find_harmonizer_by_username(db, collaborator_username)
        if not collaborator:
            raise HTTPException(status_code=404, detail="Collaborator not found")

        summary = {
            "action": "draft_collab_request",
            "actor": getattr(actor, "username", ""),
            "proposal_id": getattr(proposal, "id", payload.proposal_id),
            "proposal_title": connector_proposal_title(proposal),
            "collaborator_username": getattr(collaborator, "username", collaborator_username),
        }
        try:
            record = create_connector_action_draft(
                db,
                action_type="draft_collab_request",
                actor_user_id=getattr(actor, "id", None),
                target_type="proposal_collab_request",
                target_id=getattr(proposal, "id", payload.proposal_id),
                draft_payload=summary,
            )
            return connector_draft_response(record, summary)
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Failed to draft collab request action: {str(exc)}")

    return router
