import { Frame } from "@/content/shop/Gallery";
import Receipt from "@/content/shop/Receipt";
export const metadata = { title: "Your order", robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function ReceiptPage({ params }) {
  const { id } = await params;
  return <Frame><Receipt id={id}/></Frame>;
}
