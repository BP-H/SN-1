import { NextResponse } from "next/server";
import OpenAI from "openai";

const MISSING_API_KEY_MESSAGE = "Missing OPENAI_API_KEY environment variable.";
const CLIENT_KEYS_DISABLED_MESSAGE = "Local browser keys are disabled on this deployment.";
const OPENAI_FAILED_MESSAGE = "OpenAI request failed.";

function responsePayload(reply, overrides = {}) {
  return {
    reply,
    ai_configured: false,
    used_key_source: "none",
    client_keys_allowed: process.env.ALLOW_CLIENT_AI_KEY === "true",
    ...overrides,
  };
}

export async function POST(request) {
  try {
    const { prompt, apiKey: requestApiKey } = await request.json();
    const allowClientKey = process.env.ALLOW_CLIENT_AI_KEY === "true";
    const serverApiKey = String(process.env.OPENAI_API_KEY || "").trim();
    const clientApiKey = typeof requestApiKey === "string" ? requestApiKey.trim() : "";
    const apiKey = serverApiKey || (allowClientKey ? clientApiKey : "");
    const usedKeySource = serverApiKey ? "server" : apiKey ? "client" : "none";

    if (!serverApiKey && clientApiKey && !allowClientKey) {
      return NextResponse.json(
        responsePayload(CLIENT_KEYS_DISABLED_MESSAGE, {
          client_keys_allowed: false,
          error_code: "client_keys_disabled",
        }),
        { status: 403 }
      );
    }

    if (!apiKey) {
      return NextResponse.json(
        responsePayload(MISSING_API_KEY_MESSAGE, {
          error_code: "server_key_missing",
        }),
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0].message.content;
    return NextResponse.json(
      responsePayload(reply, {
        ai_configured: true,
        used_key_source: usedKeySource,
      })
    );
  } catch {
    return NextResponse.json(
      responsePayload(OPENAI_FAILED_MESSAGE, {
        error_code: "openai_request_failed",
      }),
      { status: 500 }
    );
  }
}
