"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "@/utils/apiBase";

export default function Receipt({ id }) {
  const [order, setOrder] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (action) => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("session_id");
    if (!token) throw new Error("Open the private receipt link from your checkout.");
    const res = await fetch(API_BASE_URL + "/commerce/orders/" + id + "/" + action, {
      headers: { Authorization: "Bearer " + token }, cache: "no-store", referrerPolicy: "no-referrer",
    });
    if (!res.ok) throw new Error((await res.json()).detail || "Could not retrieve this order.");
    return res;
  }, [id]);
  const verify = useCallback(async () => {
    setBusy(true); setError("");
    try { const res = await load("receipt"); setOrder(await res.json()); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }, [load]);
  useEffect(() => { verify(); }, [verify]);
  async function download() {
    setBusy(true); setError("");
    try {
      const res = await load("download");
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url; link.download = order.filename || "download"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="edition-panel"><p className="edition-kicker">Order receipt</p><h1>{order ? "Payment received." : "Your order"}</h1>
    {error && <p className="edition-notice" role="alert">{error}</p>}
    {!order ? <button className="edition-outline" onClick={verify} disabled={busy}>{busy ? "Checking payment…" : "Check payment again"}</button> :
      <><h2>{order.title}</h2><p>{order.delivery === "digital" ? "Save this private receipt to return to your download." :
        order.delivery === "pickup" ? order.pickup : "The seller will ship to the address you entered at checkout."}</p>
      <div className="edition-actions">{order.delivery === "digital" && <button className="edition-primary" disabled={busy} onClick={download}>Download your file</button>}
        <Link className="edition-outline" href={"/pieces/" + order.piece_id}>Return to the artist’s story</Link></div></>}
  </div>;
}
