"use client";
import { useState } from "react";
import { sellerApi } from "./sellerApi";

export default function NewEdition({ shop, run, busy, piece }) {
  const [medium, setMedium] = useState(piece?.medium || "magnet");
  async function create(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    await run(async () => {
      const digital = medium === "download";
      await sellerApi(piece ? "/pieces/" + piece.id : "/pieces", piece ? "PUT" : "POST", {
        title: values.title.trim(), code: values.code.trim(), story: values.story.trim(),
        artist: values.artist.trim(), image: values.image.trim(), alt: values.alt.trim(), video: values.video.trim(),
        kind: digital ? "digital" : "physical", medium, price: Math.round(Number(values.price) * 100),
        edition: Number(values.edition || 1), tax_code: values.taxCode.trim(),
      });
      if (!piece) { form.reset(); setMedium("magnet"); }
    }, "Draft saved.");
  }
  return <form onSubmit={create}>
    <div className="edition-field-grid"><label>Work title<input name="title" defaultValue={piece?.title || ""} maxLength="120" required/></label>
      <label>Edition code<input name="code" defaultValue={piece?.code || ""} maxLength="48" pattern="[A-Za-z0-9][A-Za-z0-9\-]*" placeholder="SF-GUGU-001" required/></label>
      <label>Artist credit<input name="artist" defaultValue={piece?.artist || shop.name} maxLength="90" required/></label>
      <label>Format<select value={medium} onChange={e => setMedium(e.target.value)}>
        <option value="magnet">Collectible magnet</option><option value="art">Physical art</option><option value="apparel">Apparel</option><option value="other">Other physical item</option><option value="download">Digital download</option></select></label></div>
    <label>Artist’s story<textarea name="story" defaultValue={piece?.story || ""} maxLength="4000" required/></label>
    <label>Public image URL<input name="image" defaultValue={piece?.image || ""} required maxLength="1600" placeholder={shop.official ? "/shop-assets/gugu-sf.webp" : "https://…"}/></label>
    <label>Image description<input name="alt" defaultValue={piece?.alt || ""} required maxLength="350"/></label>
    <label>Artist film URL (optional)<input name="video" defaultValue={piece?.video || ""} type="url" placeholder="https://…"/></label>
    <div className="edition-field-grid"><label>Price in USD, including shipping<input name="price" defaultValue={piece ? (piece.price / 100).toFixed(2) : ""} type="number" required step=".01" min=".50" max="999999.99"/></label>
      {medium !== "download" && <label>Number of physical copies<input name="edition" type="number" required min="1" max={shop.official && medium === "magnet" ? 1 : 10000} defaultValue={piece?.edition || 1}/></label>}</div>
    <label>Stripe product tax code<input name="taxCode" defaultValue={piece?.tax_code || ""} required pattern="txcd_[0-9]{8}" placeholder="txcd_…"/></label>
    <a href="https://docs.stripe.com/tax/tax-codes" target="_blank" rel="noreferrer">Look up the tax code for this item</a>
    <div><button type="submit" disabled={busy} className="edition-primary">{piece ? "Save changes" : "Save draft"}</button></div>
  </form>;
}
