import QRCode from "qrcode";
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const piece = params.get("piece");
  const contactCard = params.get("target") === "about";
  if (piece && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(piece)) {
    return new Response("Invalid edition ID", { status: 400 });
  }
  const path = piece ? "/pieces/" + piece.toLowerCase() : contactCard ? "/about" : "/shop";
  const origin = process.env.SHOP_QR_ORIGIN || "https://supernova2177.com";
  const svg = await QRCode.toString(new URL(path, origin).href, { type: "svg", margin: 4, width: 420, errorCorrectionLevel: "M" });
  return new Response(svg, { headers: {
    "Content-Type": "image/svg+xml", "Content-Disposition": 'attachment; filename="supernova-' + (piece || (contactCard ? "about" : "shop")) + '.svg"',
    "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff",
  } });
}
