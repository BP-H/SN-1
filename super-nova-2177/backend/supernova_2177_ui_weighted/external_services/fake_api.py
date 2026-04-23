_DB = {"profiles": {}, "proposals": {}, "votes": [], "decisions": {}, "runs": {}}
_counters = {"proposal": 0, "decision": 0, "run": 0}

# --- existing profile helpers kept ---
def get_profile(username: str):
    return _DB["profiles"].get(username, {"username": username, "avatar_url": "", "bio": "", "location": "", "website": ""})

def save_profile(data: dict):
    if "username" not in data: return False
    _DB["profiles"][data["username"]] = data
    return True

# --- proposals ---
def create_proposal(author: str, title: str, body: str):
    _counters["proposal"] += 1
    pid = _counters["proposal"]
    _DB["proposals"][pid] = {"id": pid, "author": author, "title": title, "body": body, "created": True}
    return _DB["proposals"][pid]

def list_proposals():
    return sorted(_DB["proposals"].values(), key=lambda x: x["id"], reverse=True)

# --- voting ---
def vote(proposal_id: int, voter: str, choice: str):
    if proposal_id not in _DB["proposals"]: return {"ok": False}
    if choice not in {"up","down"}: return {"ok": False}
    _DB["votes"].append({"proposal_id": proposal_id, "voter": voter, "choice": choice})
    return {"ok": True}

def tally_proposal(proposal_id: int):
    up = sum(1 for v in _DB["votes"] if v["proposal_id"] == proposal_id and v["choice"]=="up")
    down = sum(1 for v in _DB["votes"] if v["proposal_id"] == proposal_id and v["choice"]=="down")
    return {"up": up, "down": down}

# --- decisions ---
def decide(proposal_id: int, threshold: float = 0.6):
    t = tally_proposal(proposal_id)
    total = t["up"] + t["down"]
    status = "rejected"
    if total > 0 and (t["up"]/total) >= threshold:
        status = "accepted"
    _counters["decision"] += 1
    did = _counters["decision"]
    _DB["decisions"][did] = {"id": did, "proposal_id": proposal_id, "status": status}
    return _DB["decisions"][did]

def list_decisions():
    return sorted(_DB["decisions"].values(), key=lambda x: x["id"], reverse=True)

# --- execution runs ---
def create_run(decision_id: int):
    _counters["run"] += 1
    rid = _counters["run"]
    _DB["runs"][rid] = {"id": rid, "decision_id": decision_id, "status": "done"}  # simulate instant success
    return _DB["runs"][rid]

def list_runs():
    return sorted(_DB["runs"].values(), key=lambda x: x["id"], reverse=True)

# --- weighted voting (non-breaking additions) ---
try:
    from voting_engine import Vote, decide_weighted as _decide_w, tally_weighted as _tally_w
except Exception:
    Vote = None  # type: ignore

_WEIGHTS: list = []  # List[Vote]-like dicts

def vote_weighted(proposal_id: int, voter: str, choice: str, species: str = "human"):
    if proposal_id not in _DB["proposals"]: return {"ok": False}
    if choice not in {"up","down"}: return {"ok": False}
    if species not in {"human","company","agent"}: species = "human"
    _WEIGHTS.append({"proposal_id": proposal_id, "voter": voter, "choice": choice, "species": species})
    return {"ok": True}

def tally_proposal_weighted(proposal_id: int):
    if Vote is None: return {"up": 0.0, "down": 0.0, "total": 0.0}
    votes = [Vote(**v) for v in _WEIGHTS if v["proposal_id"] == proposal_id]
    up, down, total, _ = _tally_w(votes, proposal_id)
    return {"up": up, "down": down, "total": total}

def decide_weighted_api(proposal_id: int, level: str = "standard"):
    if Vote is None: return {"proposal_id": proposal_id, "status": "rejected"}
    votes = [Vote(**v) for v in _WEIGHTS if v["proposal_id"] == proposal_id]
    return _decide_w(votes, proposal_id, level if level in {"standard","important"} else "standard")

