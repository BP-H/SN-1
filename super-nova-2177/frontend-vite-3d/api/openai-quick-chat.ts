// /api/openai-quick-chat.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const { apiKey } = (req.body || {});
  if (!apiKey) return res.status(400).json({ ok: false, error: "Missing apiKey" });

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an API check. Reply with exactly PONG." },
          { role: "user", content: "say PONG" },
        ],
        temperature: 0,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: data?.error?.message || "Failed" });
    const text = data?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ ok: true, text });
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : "Network error";
    return res.status(500).json({ ok: false, error: errorMessage });
  }
}
