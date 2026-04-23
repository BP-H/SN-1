def tally_proposal_weighted(proposal_id, votes):
    # lógica mínima de teste
    up = sum(1 for v in votes if v["choice"]=="up")
    down = sum(1 for v in votes if v["choice"]=="down")
    return {"up": up, "down": down}