import Link from "next/link";
import { notFound } from "next/navigation";
import { catalog, money, editionLabel, availability } from "@/content/shop/catalog";
import { Frame, MissionLinks, Unavailable } from "@/content/shop/Gallery";
import BuyPiece from "@/content/shop/BuyPiece";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: "Artist edition", alternates: { canonical: "/pieces/" + id } };
}
export default async function PiecePage({ params }) {
  const { id } = await params;
  const { data: p, missing } = await catalog("pieces/" + encodeURIComponent(id));
  if (missing) notFound();
  if (!p) return <Unavailable title="This edition is temporarily unavailable"/>;
  return <Frame shop={p.open ? p.shop : undefined}><article className="edition-piece">
    <figure className="edition-work-photo"><img src={p.image} alt={p.alt} referrerPolicy="no-referrer"/></figure>
    <div><p className="edition-kicker">{editionLabel(p)} / {p.code}</p><h1>{p.title}</h1>
      <p className="edition-byline">By {p.artist}</p><p className="edition-prose">{p.story}</p>
      {p.video && <a className="edition-text-link" href={p.video} target="_blank" rel="noopener noreferrer">Watch the artist’s film</a>}
      {p.available ? <><h2>{money(p.price)}</h2><BuyPiece piece={p}/></> :
        <p className="edition-notice">{p.published && p.remaining !== 0 ? "Sales are paused." : availability(p)}</p>}
      {!p.available && p.open && p.published && p.remaining === 0 && p.sold < p.edition && <BuyPiece piece={p} held/>}
      <div className="edition-info"><h3>{p.shop.name}</h3><p>{p.shop.terms}</p><a href={"mailto:" + p.shop.contact}>Contact the seller</a></div>
      <div className="edition-actions">{p.open && <Link className="edition-outline" href={p.shop.path}>More from this shop</Link>}
        <a className="edition-text-link" href={"/shop/qr?piece=" + p.id} download>Download edition QR</a></div>
      {p.shop.official && <MissionLinks/>}
    </div></article></Frame>;
}
