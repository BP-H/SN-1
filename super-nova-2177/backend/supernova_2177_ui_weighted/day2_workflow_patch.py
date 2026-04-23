from pathlib import Path
import re, textwrap, json

ROOT = Path(__file__).resolve().parent

def write(p: Path, s: str):
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s.strip() + "\n", encoding="utf-8")
    print("wrote", p.relative_to(ROOT))

# ----------------------------
#  A) Pages: proposals / decisions / execution
# ----------------------------
proposals_py = r"""
import os, json, urllib.request
import streamlit as st
from typing import Dict, Any

def _use_backend() -> bool:
    return os.getenv("USE_REAL_BACKEND", "0").lower() in {"1","true","yes"}

def _burl() -> str:
    return os.getenv("BACKEND_URL","http://127.0.0.1:8000")

def _get(path: str):
    with urllib.request.urlopen(_burl()+path) as r:
        return json.loads(r.read().decode("utf-8"))

def _post(path: str, payload: Dict[str, Any]):
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(_burl()+path, data=data, headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

# local fallback
try:
    from external_services.fake_api import list_proposals, create_proposal, vote, tally_proposal
except Exception:
    def list_proposals(): return []
    def create_proposal(author,title,body): return {}
    def vote(pid,voter,choice): return {"ok":False}
    def tally_proposal(pid): return {"up":0,"down":0}

def main():
    st.subheader("Proposals")
    with st.form("new_proposal"):
        title = st.text_input("Title")
        body  = st.text_area("Description", height=120)
        submitted = st.form_submit_button("Create")
    if submitted and title.strip():
        if _use_backend():
            _post("/proposals", {"title":title, "body":body, "author":"guest"})
        else:
            create_proposal("guest", title, body)
        st.success("Created"); st.rerun()

    # list
    items = _get("/proposals") if _use_backend() else list_proposals()
    for p in items:
        with st.container():
            st.markdown(f"### {p['title']}")
            st.write(p.get("body",""))
            pid = p["id"]
            col1, col2, col3 = st.columns(3)
            if col1.button(f"👍 Upvote #{pid}", key=f"u_{pid}"):
                (_post("/votes", {"proposal_id":pid,"voter":"guest","choice":"up"})
                 if _use_backend() else vote(pid, "guest", "up"))
                st.rerun()
            if col2.button(f"👎 Downvote #{pid}", key=f"d_{pid}"):
                (_post("/votes", {"proposal_id":pid,"voter":"guest","choice":"down"})
                 if _use_backend() else vote(pid, "guest", "down"))
                st.rerun()
            tally = (_get(f"/proposals/{pid}/tally") if _use_backend() else tally_proposal(pid))
            col3.metric("Votes", f"{tally.get('up',0)} 👍 / {tally.get('down',0)} 👎")

def render(): main()
"""

decisions_py = r"""
import os, json, urllib.request
import streamlit as st

def _use_backend(): return os.getenv("USE_REAL_BACKEND","0").lower() in {"1","true","yes"}
def _burl(): return os.getenv("BACKEND_URL","http://127.0.0.1:8000")
def _get(path):
    with urllib.request.urlopen(_burl()+path) as r:
        import json; return json.loads(r.read().decode("utf-8"))
def _post(path, payload):
    import json; data=json.dumps(payload).encode("utf-8")
    import urllib.request as ur; req=ur.Request(_burl()+path, data=data, headers={"Content-Type":"application/json"})
    with ur.urlopen(req) as r: return json.loads(r.read().decode("utf-8"))

try:
    from external_services.fake_api import list_proposals, tally_proposal, decide, list_decisions
except Exception:
    def list_proposals(): return []
    def tally_proposal(pid): return {"up":0,"down":0}
    def decide(pid, threshold=0.6): return {"proposal_id":pid, "status":"rejected"}
    def list_decisions(): return []

def main():
    st.subheader("Decisions")
    st.caption("Rule: accept when 👍 / (👍+👎) ≥ 60% (and at least 1 vote).")

    if _use_backend():
        proposals = _get("/proposals")
    else:
        proposals = list_proposals()

    for p in proposals:
        pid = p["id"]
        tally = (_get(f"/proposals/{pid}/tally") if _use_backend() else tally_proposal(pid))
        up, down = tally.get("up",0), tally.get("down",0)
        total = up+down
        pct = (up/total*100) if total else 0
        st.write(f"**{p['title']}** — {up} 👍 / {down} 👎  ({pct:.0f}%)")
        if st.button(f"Compute decision for #{pid}", key=f"dec_{pid}"):
            res = (_post(f"/decide/{pid}", {}) if _use_backend() else decide(pid))
            st.success(f"Decision: {res.get('status').upper()}")

    st.divider()
    st.markdown("### Decisions log")
    out = (_get("/decisions") if _use_backend() else list_decisions())
    for d in out:
        st.write(f"#{d['id']} — proposal {d['proposal_id']} → **{d['status']}**")

def render(): main()
"""

execution_py = r"""
import os, json, urllib.request
import streamlit as st

def _use_backend(): return os.getenv("USE_REAL_BACKEND","0").lower() in {"1","true","yes"}
def _burl(): return os.getenv("BACKEND_URL","http://127.0.0.1:8000")
def _get(path):
    with urllib.request.urlopen(_burl()+path) as r:
        import json; return json.loads(r.read().decode("utf-8"))
def _post(path, payload):
    import json; data=json.dumps(payload).encode("utf-8")
    import urllib.request as ur; req=ur.Request(_burl()+path, data=data, headers={"Content-Type":"application/json"})
    with ur.urlopen(req) as r: return json.loads(r.read().decode("utf-8"))

try:
    from external_services.fake_api import list_decisions, create_run, list_runs
except Exception:
    def list_decisions(): return []
    def create_run(decision_id): return {"id":0,"status":"done"}
    def list_runs(): return []

def main():
    st.subheader("Execution")
    st.caption("Execute ACCEPTED decisions (simulated).")

    decs = _get("/decisions") if _use_backend() else list_decisions()
    for d in decs:
        if d.get("status") != "accepted":
            continue
        did = d["id"]
        if st.button(f"Execute decision #{did}", key=f"exec_{did}"):
            res = (_post("/runs", {"decision_id":did}) if _use_backend() else create_run(did))
            st.success(f"Run #{res['id']} created (status: {res['status']})")

    st.divider()
    st.markdown("### Runs")
    runs = _get("/runs") if _use_backend() else list_runs()
    for r in runs:
        st.write(f"Run #{r['id']} — decision {r['decision_id']} — **{r['status']}**")

def render(): main()
"""

write(ROOT/"pages"/"proposals.py", proposals_py)
write(ROOT/"pages"/"decisions.py", decisions_py)
write(ROOT/"pages"/"execution.py", execution_py)

# ----------------------------
#  B) Extend fake_api with proposals/votes/decisions/runs
# ----------------------------
fake_api_path = ROOT / "external_services" / "fake_api.py"
fake_api_text = r"""
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
"""
write(fake_api_path, fake_api_text)

# ----------------------------
#  C) Patch ui.py sidebar to add nav buttons (idempotent)
# ----------------------------
ui = ROOT / "ui.py"
text = ui.read_text(encoding="utf-8")
if "key=\"nav_proposals\"" not in text:
    # insert after the Voting button block
    insert_after = 'if st.button("🗳 Voting", key="nav_voting"):'
    add = (
        '        if st.button("📄 Proposals", key="nav_proposals"):\n'
        '            st.session_state.current_page = "proposals"\n'
        '            st.rerun()\n'
        '        if st.button("✅ Decisions", key="nav_decisions"):\n'
        '            st.session_state.current_page = "decisions"\n'
        '            st.rerun()\n'
        '        if st.button("⚙️ Execution", key="nav_execution"):\n'
        '            st.session_state.current_page = "execution"\n'
        '            st.rerun()\n'
    )
    text = text.replace(insert_after, insert_after + "\n" + add, 1)
    ui.write_text(text, encoding="utf-8")
    print("patched ui.py (added nav buttons)")
else:
    print("ui.py already has nav buttons")

# ----------------------------
#  D) Optional FastAPI endpoints (memory store)
# ----------------------------
backend_app = ROOT / "backend" / "app.py"
backend_app.parent.mkdir(parents=True, exist_ok=True)
backend_app.write_text(textwrap.dedent("""
from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional, List, Dict

app = FastAPI(title="superNova_2177 backend", version="0.2")

# in-memory stores
DB = {"proposals": {}, "votes": [], "decisions": {}, "runs": {}}
C = {"proposal": 0, "decision": 0, "run": 0}

class ProposalIn(BaseModel):
    title: str
    body: str
    author: str

class Proposal(BaseModel):
    id: int
    title: str
    body: str
    author: str

class VoteIn(BaseModel):
    proposal_id: int
    voter: str
    choice: str  # 'up' | 'down'

class Decision(BaseModel):
    id: int
    proposal_id: int
    status: str

class Run(BaseModel):
    id: int
    decision_id: int
    status: str

@app.get("/health")
def health(): return {"ok": True}

@app.get("/profile/{username}")
def profile(username: str):
    return {"username": username, "avatar_url":"", "bio":"Explorer of superNova_2177.", "followers":2315, "following":1523, "status":"online"}

@app.post("/proposals", response_model=Proposal)
def create_proposal(p: ProposalIn):
    C["proposal"] += 1
    pid = C["proposal"]
    DB["proposals"][pid] = {"id":pid, **p.dict()}
    return DB["proposals"][pid]

@app.get("/proposals", response_model=List[Proposal])
def list_proposals():
    return list(sorted(DB["proposals"].values(), key=lambda x: x["id"], reverse=True))

@app.get("/proposals/{pid}/tally")
def tally(pid: int):
    up = sum(1 for v in DB["votes"] if v["proposal_id"]==pid and v["choice"]=="up")
    down = sum(1 for v in DB["votes"] if v["proposal_id"]==pid and v["choice"]=="down")
    return {"up":up,"down":down}

@app.post("/votes")
def add_vote(v: VoteIn):
    DB["votes"].append(v.dict()); return {"ok": True}

@app.post("/decide/{pid}", response_model=Decision)
def decide(pid: int, threshold: float = 0.6):
    t = tally(pid); total = t["up"]+t["down"]
    status = "rejected"
    if total>0 and (t["up"]/total)>=threshold: status = "accepted"
    C["decision"] += 1; did = C["decision"]
    DB["decisions"][did] = {"id":did, "proposal_id":pid, "status":status}
    return DB["decisions"][did]

@app.get("/decisions", response_model=List[Decision])
def list_decisions(): return list(sorted(DB["decisions"].values(), key=lambda x: x["id"], reverse=True))

@app.post("/runs", response_model=Run)
def create_run(decision_id: int):
    C["run"] += 1; rid = C["run"]
    DB["runs"][rid] = {"id":rid, "decision_id":decision_id, "status":"done"}  # simulate instant
    return DB["runs"][rid]

@app.get("/runs", response_model=List[Run])
def list_runs(): return list(sorted(DB["runs"].values(), key=lambda x: x["id"], reverse=True))
""").strip()+"\n", encoding="utf-8")
print("wrote backend/app.py")
