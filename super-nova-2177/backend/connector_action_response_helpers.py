from typing import Any, Callable, Dict, Iterable


def connector_action_list_response(
    rows: Iterable[Any],
    *,
    limit: int,
    offset: int,
    serialize_connector_action: Callable,
) -> Dict[str, Any]:
    actions = [serialize_connector_action(row) for row in rows]
    return {
        "ok": True,
        "actions": actions,
        "count": len(actions),
        "limit": limit,
        "offset": offset,
    }


def connector_cancel_action_response(
    action: Any,
    *,
    serialize_connector_action: Callable,
) -> Dict[str, Any]:
    return {
        "ok": True,
        "action": serialize_connector_action(action),
        "executed": False,
        "safety": {
            "canceled_only": True,
            "no_write_action_performed": True,
        },
    }


def connector_draft_vote_summary(
    *,
    actor: Any,
    proposal: Any,
    fallback_proposal_id: Any,
    proposal_title: str,
    choice: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "action": "draft_vote",
        "actor": getattr(actor, "username", ""),
        "proposal_id": getattr(proposal, "id", fallback_proposal_id),
        "proposal_title": proposal_title,
        **choice,
    }


def connector_draft_ai_review_summary(
    *,
    actor: Any,
    proposal: Any,
    fallback_proposal_id: Any,
    proposal_title: str,
    actor_metadata: Dict[str, Any],
    rationale: str,
    reasoning_hash: str,
    confidence: Any,
    choice: Dict[str, Any],
) -> Dict[str, Any]:
    return {
        "action": "draft_ai_review",
        "actor": getattr(actor, "username", ""),
        "actor_species": "ai",
        **actor_metadata,
        "proposal_id": getattr(proposal, "id", fallback_proposal_id),
        "proposal_title": proposal_title,
        "rationale": rationale,
        "reasoning_summary": rationale,
        "reasoning_hash": reasoning_hash,
        "confidence": confidence,
        **choice,
        "sealed_reasoning": False,
        "reasoning_source": "ai_actor_submitted_draft",
        "approval_effect": "Publish one AI vote and one AI rationale comment.",
    }


def connector_draft_comment_summary(
    *,
    actor: Any,
    proposal: Any,
    fallback_proposal_id: Any,
    proposal_title: str,
    body: str,
) -> Dict[str, Any]:
    return {
        "action": "draft_comment",
        "actor": getattr(actor, "username", ""),
        "proposal_id": getattr(proposal, "id", fallback_proposal_id),
        "proposal_title": proposal_title,
        "body": body,
    }


def connector_draft_proposal_summary(
    *,
    actor: Any,
    title: str,
    body: str,
) -> Dict[str, Any]:
    return {
        "action": "draft_proposal",
        "actor": getattr(actor, "username", ""),
        "title": title,
        "body": body,
    }


def connector_draft_collab_request_summary(
    *,
    actor: Any,
    proposal: Any,
    fallback_proposal_id: Any,
    proposal_title: str,
    collaborator: Any,
    fallback_collaborator_username: str,
) -> Dict[str, Any]:
    return {
        "action": "draft_collab_request",
        "actor": getattr(actor, "username", ""),
        "proposal_id": getattr(proposal, "id", fallback_proposal_id),
        "proposal_title": proposal_title,
        "collaborator_username": getattr(collaborator, "username", fallback_collaborator_username),
    }
