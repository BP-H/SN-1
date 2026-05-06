from typing import Callable

from fastapi import APIRouter


def create_proposals_router(
    *,
    proposal_response_model,
    proposal_list_response_model,
    decision_response_model,
    decision_list_response_model,
    run_response_model,
    run_list_response_model,
    create_proposal_endpoint: Callable,
    list_proposals_endpoint: Callable,
    tally_weighted_endpoint: Callable,
    decide_endpoint: Callable,
    list_decisions_endpoint: Callable,
    create_run_endpoint: Callable,
    list_runs_endpoint: Callable,
    get_proposal_endpoint: Callable,
    update_proposal_endpoint: Callable,
    delete_proposal_endpoint: Callable,
    delete_all_proposals_endpoint: Callable,
) -> APIRouter:
    router = APIRouter()

    router.add_api_route(
        "/proposals",
        create_proposal_endpoint,
        methods=["POST"],
        response_model=proposal_response_model,
        response_model_exclude={"collabs"},
        summary="Create a new proposal",
    )
    router.add_api_route(
        "/proposals",
        list_proposals_endpoint,
        methods=["GET"],
        response_model=proposal_list_response_model,
    )
    router.add_api_route(
        "/proposals/{pid}/tally-weighted",
        tally_weighted_endpoint,
        methods=["GET"],
    )
    router.add_api_route(
        "/decide/{pid}",
        decide_endpoint,
        methods=["POST"],
        response_model=decision_response_model,
    )
    router.add_api_route(
        "/decisions",
        list_decisions_endpoint,
        methods=["GET"],
        response_model=decision_list_response_model,
    )
    router.add_api_route(
        "/runs",
        create_run_endpoint,
        methods=["POST"],
        response_model=run_response_model,
    )
    router.add_api_route(
        "/runs",
        list_runs_endpoint,
        methods=["GET"],
        response_model=run_list_response_model,
    )
    router.add_api_route(
        "/proposals/{pid}",
        get_proposal_endpoint,
        methods=["GET"],
        response_model=proposal_response_model,
    )
    router.add_api_route(
        "/proposals/{pid}",
        update_proposal_endpoint,
        methods=["PATCH"],
        response_model=proposal_response_model,
        response_model_exclude={"collabs"},
    )
    router.add_api_route(
        "/proposals/{pid}",
        delete_proposal_endpoint,
        methods=["DELETE"],
    )
    router.add_api_route(
        "/proposals",
        delete_all_proposals_endpoint,
        methods=["DELETE"],
    )

    return router
