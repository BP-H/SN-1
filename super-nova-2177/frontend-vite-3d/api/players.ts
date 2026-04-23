// /api/players.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  // Cool neutrals (no purple/pink)
  const players = [
    { id: "alice",  name: "Alice",  color: "#7dd3fc" }, // sky-300
    { id: "bob",    name: "Bob",    color: "#5eead4" }, // teal-300
    { id: "cairo",  name: "Cairo",  color: "#a7f3d0" }, // green-300
    { id: "dara",   name: "Dara",   color: "#fde68a" }, // amber-300
    { id: "eon",    name: "Eon",    color: "#93c5fd" }, // blue-300
  ];

  return res.status(200).json({ ok: true, players });
}
