import json
from typing import Any, Dict, Optional

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
