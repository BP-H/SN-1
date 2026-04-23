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
