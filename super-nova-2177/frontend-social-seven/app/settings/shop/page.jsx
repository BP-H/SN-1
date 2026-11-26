import { Frame } from "@/content/shop/Gallery";
import SellerDesk from "@/content/shop/SellerDesk";
export const metadata = { title: "Manage my shop", robots: { index: false, follow: false } };
export default function ManageShop() { return <Frame><SellerDesk/></Frame>; }
