from typing import Callable

from fastapi import APIRouter


def create_comments_router(
    *,
    connector_get_proposal_comments_endpoint: Callable,
    list_comments_endpoint: Callable,
    add_comment_endpoint: Callable,
    update_comment_endpoint: Callable,
    vote_comment_endpoint: Callable,
    remove_comment_vote_endpoint: Callable,
    delete_comment_endpoint: Callable,
) -> APIRouter:
    router = APIRouter()

    router.add_api_route(
        "/connector/proposals/{proposal_id}/comments",
        connector_get_proposal_comments_endpoint,
        methods=["GET"],
        summary="Read public proposal comments through the connector facade",
    )
    router.add_api_route(
        "/comments",
        list_comments_endpoint,
        methods=["GET"],
    )
    router.add_api_route(
        "/comments",
        add_comment_endpoint,
        methods=["POST"],
    )
    router.add_api_route(
        "/comments/{comment_id}",
        update_comment_endpoint,
        methods=["PATCH"],
    )
    router.add_api_route(
        "/comments/{comment_id}/votes",
        vote_comment_endpoint,
        methods=["POST"],
    )
    router.add_api_route(
        "/comments/{comment_id}/votes",
        remove_comment_vote_endpoint,
        methods=["DELETE"],
    )
    router.add_api_route(
        "/comments/{comment_id}",
        delete_comment_endpoint,
        methods=["DELETE"],
    )

    return router
