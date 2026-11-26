import Link from "next/link";
import { Frame, FieldPhoto, MissionLinks } from "@/content/shop/Gallery";
export const metadata = { title: "Gugu at the window", alternates: { canonical: "/shop/gugu-in-san-francisco" } };
export default function GuguStory() {
  return <Frame><article><div className="edition-hero"><div className="edition-hero-copy"><p className="edition-kicker">SuperNova 2177 / Field notes</p><h1>Gugu at<br/><em>the window.</em></h1>
    <p>From this sill, San Francisco rises behind a pigeon standing on two pink feet. Gugu is the bird people meet beside our green Cybertruck on the traveling art project.</p><Link className="edition-text-link" href="/shop">Browse the collection</Link></div><FieldPhoto/></div>
    <div className="edition-story"><img src="/shop-assets/tour.webp" alt="A helmeted artist holds Gugu next to the green SuperNova truck" loading="lazy" width="750" height="563"/>
      <div><h2>Out on the street</h2><p>The bright helmet hides a face. Gugu brings people closer. The free pink contact magnet carries that introduction home. Each collectible can carry its artist’s story with it, long after the truck leaves.</p><MissionLinks/></div></div></article></Frame>;
}
