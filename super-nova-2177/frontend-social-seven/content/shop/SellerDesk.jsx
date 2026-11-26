"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { sellerApi } from "./sellerApi";
import { money, editionLabel } from "./catalog";
import NewEdition from "./NewEdition";

function FileUpload({ piece, run, busy }) {
  async function upload(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(() => sellerApi("/pieces/" + piece.id + "/file", "PUT", data), "Download attached.");
  }
  return <form className="edition-upload" onSubmit={upload}><label>Buyer’s file, up to 10 MB<input type="file" name="file" required/></label>
    <div><button className="edition-outline" disabled={busy}>Attach file</button></div></form>;
}

function DeliveryInfo({ order }) {
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  async function show() {
    try { setDetails(await sellerApi("/orders/" + order.id + "/delivery")); }
    catch (e) { setError(e.message); }
  }
  if (!details) return <><button type="button" className="edition-text-link" onClick={show}>View delivery details</button>{error && <p role="alert">{error}</p>}</>;
  const address = details.address;
  return <p>{details.name}<br/>{details.email}{address && <><br/>{[address.line1, address.line2, address.city, address.state, address.postal_code, address.country].filter(Boolean).join(", ")}</>}</p>;
}

export default function SellerDesk() {
  const [shop, setShop] = useState(null);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function reload() {
    const result = await Promise.all([sellerApi(""), sellerApi("/orders")]);
    setShop(result[0]); setOrders(result[1]);
  }
  useEffect(() => { reload().catch(e => setError(e.message)); }, []);
  async function run(task, message) {
    setBusy(true); setError(""); setStatus("");
    try { await task(); await reload(); setStatus(message); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await run(() => sellerApi("", "PUT", { name: data.get("name"), contact: data.get("contact"),
      terms: data.get("terms"), enabled: data.get("enabled") === "on" }), "Shop settings saved.");
  }
  async function connect() {
    setBusy(true); setError("");
    try { const result = await sellerApi("/connect", "POST"); window.location.assign(result.url); }
    catch (e) { setError(e.message); setBusy(false); }
  }
  return <div className="edition-panel"><p className="edition-kicker">Creator profile</p><h1>My shop</h1>
    {error && <p className="edition-notice" role="alert">{error} {!shop && <Link href="/profile">Open your profile to sign in</Link>}</p>}
    {status && <p className="edition-notice" role="status">{status}</p>}
    {!shop && !error && <p role="status">Loading your shop…</p>}
    {shop && <>
      <section><h2>Shop settings</h2><form onSubmit={save}><label>Shop name<input name="name" defaultValue={shop.name} maxLength="90" required/></label>
      <label>Public seller contact<input name="contact" type="email" defaultValue={shop.contact} required/></label>
      <label>Shipping times, returns, and customer support<textarea name="terms" defaultValue={shop.terms} maxLength="1200" required/></label>
      <label className="edition-check"><input name="enabled" type="checkbox" defaultChecked={shop.enabled}/>Show a shop on my profile</label>
      <div className="edition-actions"><button disabled={busy} className="edition-primary">Save settings</button>{shop.enabled && <Link className="edition-outline" href={shop.path}>View my shop</Link>}</div></form>{shop.official && <a href="/shop/qr?target=about" download>Download the free contact magnet QR</a>}</section>
      <section><h2>Payments</h2><p>{shop.ready ? "Stripe is connected. Payouts go to your connected account." : shop.connected ? "Continue your Stripe setup to accept payments." : "Connect your own Stripe account to accept payments."}</p>
        {!shop.can_connect && <p>Platform payment setup is pending. You can prepare your editions now.</p>}
        {shop.can_connect && !shop.ready && <button className="edition-outline" onClick={connect} disabled={busy}>Continue with Stripe</button>}
        {shop.ready && <a href="https://dashboard.stripe.com" rel="noreferrer" target="_blank">Open Stripe Dashboard</a>}
        {!shop.can_sell && <p>Independent seller checkout is awaiting marketplace activation.</p>}</section>
      <section><h2>Create an edition</h2><NewEdition shop={shop} run={run} busy={busy}/></section>
      <section><h2>Your editions</h2>{!shop.pieces.length && <p>Your saved drafts will appear here.</p>}
        {shop.pieces.map(p => <article key={p.id}><h3>{p.title}</h3><p>{p.code} · {editionLabel(p)} · {money(p.price)} · {p.published ? "Published" : p.released ? "Archived" : "Draft"}</p>
          {shop.official && p.kind === "physical" && <label className="edition-check"><input type="checkbox" checked={p.pickup_enabled} disabled={busy}
            onChange={e => { const enabled = e.target.checked; run(() => sellerApi("/pieces/" + p.id + "/pickup?enabled=" + enabled, "PUT"), "Event inventory updated."); }}/>Bring this edition to the authorized Redwood City pickup</label>}
          {!p.released && <details><summary>Edit draft</summary><NewEdition shop={shop} run={run} busy={busy} piece={p}/></details>}
          {p.kind === "digital" && !p.released && <>{p.has_file && <p>A buyer’s file is attached.</p>}<FileUpload piece={p} run={run} busy={busy}/></>}
          <div className="edition-actions"><button type="button" className="edition-outline" disabled={busy || (!p.published && (!shop.ready || !shop.enabled || !shop.can_sell || (p.kind === "digital" && !p.has_file)))}
            onClick={() => run(() => sellerApi("/pieces/" + p.id + "/visibility", "PUT", { published: !p.published }), p.published ? "Edition archived. Its story is still available." : "Edition published.")}>{p.published ? "Archive edition" : "Publish edition"}</button>
          {p.released && <><Link href={"/pieces/" + p.id}>Open edition</Link><a href={"/shop/qr?piece=" + p.id} download>Download print QR</a></>}</div></article>)}</section>
      <section><h2>Orders</h2>{!orders.length && <p>Your paid orders will appear here.</p>}
        {orders.map(o => <article key={o.id}><h3>{o.title}</h3><p>{new Date(o.date * 1000).toLocaleDateString()} · {o.delivery === "ship" ? "Ship" : o.delivery === "pickup" ? "Event pickup" : "Digital download"}</p>
          <p>Order {o.id} · {o.payment_state.replaceAll("_", " ")}</p><DeliveryInfo order={o}/>
          {o.delivery !== "digital" && (o.fulfilled ? <p>Fulfilled</p> : <button disabled={busy || !["paid","partially_refunded"].includes(o.payment_state)} className="edition-outline" onClick={() => run(() => sellerApi("/orders/" + o.id + "/fulfilled", "PUT"), "Order marked fulfilled.")}>Mark fulfilled</button>)}</article>)}</section>
    </>}</div>;
}
