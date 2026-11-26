"use client";
import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/utils/apiBase";
export default function BuyPiece({ piece, held = false }) {
  const [delivery, setDelivery] = useState(piece.kind === "digital" ? "digital" : "ship");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [canResume, setCanResume] = useState(false);
  useEffect(() => {
    if (!held) return;
    const existing = ["ship", "pickup", "digital"].find(d => sessionStorage.getItem("shop-checkout-" + piece.id + "-" + d));
    if (existing) { setDelivery(existing); setCanResume(true); }
  }, [held, piece.id]);
  if (held && !canResume) return null;
  async function buy() {
    setBusy(true);
    setError("");
    try {
      const key = "shop-checkout-" + piece.id + "-" + delivery;
      const attempt = sessionStorage.getItem(key) || crypto.randomUUID();
      sessionStorage.setItem(key, attempt);
      const res = await fetch(API_BASE_URL + "/commerce/pieces/" + piece.id + "/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attempt, delivery }),
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 410 || res.status === 409) sessionStorage.removeItem(key);
        throw new Error(result.detail || "Checkout is temporarily unavailable.");
      }
      window.location.assign(result.url);
    } catch (e) { setError(e.message); setBusy(false); }
  }
  return <div className="edition-buy">
    {!held && (piece.pickup ? <label>Delivery<select value={delivery} onChange={e => setDelivery(e.target.value)}><option value="ship">US shipping included</option><option value="pickup">{piece.pickup}</option></select></label> :
      <p>{piece.kind === "digital" ? "Download after payment." : "US shipping included."} Applicable tax is calculated at checkout.</p>)}
    <button className="edition-primary" type="button" disabled={busy} onClick={buy}>{busy ? "Opening checkout…" : held ? "Resume my checkout" : "Buy with Stripe"}</button>
    {error && <p className="edition-notice" role="alert">{error}</p>}
  </div>;
}
