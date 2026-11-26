import Link from "next/link";
import { availability, editionLabel } from "./catalog";
import "./shop.css";

export function Frame({ children, shop }) {
  return <div className="edition-shell">
    <header className="edition-nav">
      <Link href="/about" aria-label="SuperNova 2177 About" className="edition-wordmark">superNova<span>2177</span></Link>
      <nav aria-label="Shop navigation">
        <Link href={shop?.path || "/shop"}>Collection</Link>
        <Link href="/about">About</Link>
        <Link href="/profile">My profile</Link>
      </nav>
    </header>
    <div className="edition-body">{children}</div>
    <footer className="edition-footer"><Link href="/shop">SuperNova 2177</Link><Link href="/settings/shop">Manage my shop</Link></footer>
  </div>;
}

export function MissionLinks() {
  return <div className="edition-actions"><Link className="edition-primary" href="/about">Explore the mission</Link>
    <Link className="edition-outline" href="/donate">Support SuperNova</Link></div>;
}

export function FieldPhoto() {
  return <figure className="edition-hero-photo">
    <img src="/shop-assets/gugu-sf.webp" alt="Gugu perched on a windowsill above the San Francisco skyline" width="1120" height="844"/>
    <figcaption>Gugu at the window <span>San Francisco, CA</span></figcaption>
  </figure>;
}

export function OfficialIntro({ offline, opened }) {
  return <section className="edition-hero">
    <div className="edition-hero-copy"><p className="edition-kicker">SuperNova 2177 / Artist editions</p>
      <h1>Gugu in<br/><em>San Francisco.</em></h1>
      <p>A pigeon, a city, and the people who stop to meet her. Explore the photographs and objects from SuperNova’s traveling art project.</p>
      <div className="edition-actions"><Link className="edition-primary" href="/shop/gugu-in-san-francisco">Read Gugu’s story</Link>
        <a className="edition-text-link" href={opened ? "#collection" : "/about#support"}>{opened ? "View editions" : "Support the project"}</a></div>
      {offline && <p className="edition-notice" role="status">The catalog is temporarily unavailable. Please check back for current editions.</p>}
    </div><FieldPhoto/>
  </section>;
}

export function Collection({ shop }) {
  return <section id="collection" className="edition-section">
    {shop.official ? <h2>From the collection</h2> : <><p className="edition-kicker">Creator shop</p><h1>{shop.name}</h1></>}
    {!shop.pieces.length ? <p>Releases will appear here when the artist publishes an edition.</p> :
      <div className="edition-grid">{shop.pieces.map(piece => <Link key={piece.id} href={"/pieces/" + piece.id} className="edition-card">
        <div className="edition-card-photo"><img src={piece.image} alt={piece.alt} loading="lazy" referrerPolicy="no-referrer"/></div>
        <div className="edition-meta"><span>{editionLabel(piece)}</span><span>{availability(piece)}</span></div>
        <h3>{piece.title}</h3><p>{piece.artist}</p>
      </Link>)}</div>}
    {shop.profile_path && <Link className="edition-text-link" href={shop.profile_path}>See the creator’s posts and videos</Link>}
    {shop.terms && <div className="edition-info"><h3>Orders and returns</h3><p>{shop.terms}</p><a href={"mailto:" + shop.contact}>Contact {shop.name}</a></div>}
    {shop.official && <MissionLinks/>}
  </section>;
}

export function Unavailable({ title }) {
  return <Frame><section className="edition-section"><h1>{title}</h1><p>Please reload in a moment.</p><Link href="/shop">Back to the collection</Link></section></Frame>;
}
