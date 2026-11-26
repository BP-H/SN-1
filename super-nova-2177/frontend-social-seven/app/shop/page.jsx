import { redirect } from "next/navigation";
import { catalog } from "@/content/shop/catalog";
import { Frame, OfficialIntro } from "@/content/shop/Gallery";
export const dynamic = "force-dynamic";
export const metadata = { title: "Artist editions", alternates: { canonical: "/shop" } };
export default async function OfficialShop() {
  const result = await catalog("official");
  if (result.data) redirect(result.data.path);
  return <Frame><OfficialIntro offline={result.offline}/>{result.missing && <section className="edition-section"><h2>Upcoming editions</h2><p>The first collection is in preparation.</p></section>}</Frame>;
}
