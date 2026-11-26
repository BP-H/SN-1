import { notFound } from "next/navigation";
import { catalog } from "@/content/shop/catalog";
import { Frame, Collection, OfficialIntro, Unavailable } from "@/content/shop/Gallery";
export const dynamic = "force-dynamic";
export async function generateMetadata({ params }) {
  const { owner } = await params;
  return { title: "Creator collection", alternates: { canonical: "/shops/" + owner } };
}
export default async function ShopPage({ params }) {
  const { owner } = await params;
  if (!/^\d+$/.test(owner)) notFound();
  const { data, missing } = await catalog("shops/" + owner);
  if (missing) notFound();
  if (!data) return <Unavailable title="The shop is temporarily unavailable"/>;
  return <Frame shop={data}>{data.official && <OfficialIntro opened/>}<Collection shop={data}/></Frame>;
}
