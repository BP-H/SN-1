import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

const MISSING_API_KEY_MESSAGE = "Missing OPENAI_API_KEY environment variable.";
const OPENAI_FAILED_MESSAGE = "OpenAI request failed.";
const INVALID_JSON_MESSAGE = "Request body must be valid JSON.";
const PROMPT_REQUIRED_MESSAGE = "Prompt must be a non-empty string.";
const PROMPT_TOO_LONG_MESSAGE = "Prompt is too long for this optional AI route.";
const RATE_LIMITED_MESSAGE = "Too many AI requests. Please wait and try again.";
const OPENAI_TIMEOUT_MESSAGE = "OpenAI request timed out.";
const MAX_REQUEST_BYTES = 24_000;
const MAX_PROMPT_CHARS = 4_000;
const MAX_OUTPUT_TOKENS = 420;
const OPENAI_TIMEOUT_MS = 15_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const RATE_LIMIT_STORE_KEY = "__supernova_fe7_ai_route_rate_limit__";

function rateLimitStore() {
  if (!globalThis[RATE_LIMIT_STORE_KEY]) {
    globalThis[RATE_LIMIT_STORE_KEY] = new Map();
  }
  return globalThis[RATE_LIMIT_STORE_KEY];
}

function responsePayload(reply, overrides = {}) {
  return {
    reply,
    ai_configured: false,
    used_key_source: "none",
    client_keys_allowed: false,
    safety: {
      max_request_bytes: MAX_REQUEST_BYTES,
      max_prompt_chars: MAX_PROMPT_CHARS,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      timeout_ms: OPENAI_TIMEOUT_MS,
    },
    ...overrides,
  };
}

function clientKey(request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const firstForwarded = forwardedFor.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip") || "";
  return String(firstForwarded || realIp || "unknown").slice(0, 80);
}

function requestContentLength(request) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return 0;
  const parsed = Number.parseInt(rawLength, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function checkRateLimit(key) {
  const now = Date.now();
  const store = rateLimitStore();
  if (store.size > 1_000) {
    for (const [storedKey, bucket] of store.entries()) {
      if (!bucket || bucket.resetAt <= now) store.delete(storedKey);
    }
  }

  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

async function readJsonBody(request) {
  try {
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      return { body: null, error: "request_too_large" };
    }
    return { body: JSON.parse(rawBody), error: null };
  } catch {
    return { body: null, error: "invalid_json" };
  }
}

function normalizePrompt(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { prompt: "", error: "prompt_required" };
  }
  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) return { prompt: "", error: "prompt_required" };
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { prompt, error: "prompt_too_long" };
  }
  return { prompt, error: null };
}

function isTimeoutError(error) {
  const name = String(error?.name || "").toLowerCase();
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    name.includes("timeout") ||
    code.includes("timeout") ||
    message.includes("timeout")
  );
}

export async function POST(request) {
  try {
    const contentLength = requestContentLength(request);
    if (contentLength > MAX_REQUEST_BYTES) {
      return NextResponse.json(
        responsePayload(PROMPT_TOO_LONG_MESSAGE, {
          error_code: "request_too_large",
        }),
        { status: 413 }
      );
    }

    const { body, error: bodyError } = await readJsonBody(request);
    if (bodyError) {
      const isTooLarge = bodyError === "request_too_large";
      return NextResponse.json(
        responsePayload(
          isTooLarge ? PROMPT_TOO_LONG_MESSAGE : INVALID_JSON_MESSAGE,
          {
            error_code: bodyError,
          }
        ),
        { status: isTooLarge ? 413 : 400 }
      );
    }

    const { prompt, error: promptError } = normalizePrompt(body);
    if (promptError) {
      return NextResponse.json(
        responsePayload(
          promptError === "prompt_too_long"
            ? PROMPT_TOO_LONG_MESSAGE
            : PROMPT_REQUIRED_MESSAGE,
          {
            error_code: promptError,
          }
        ),
        { status: promptError === "prompt_too_long" ? 413 : 400 }
      );
    }

    const serverApiKey = String(process.env.OPENAI_API_KEY || "").trim();

    if (!serverApiKey) {
      return NextResponse.json(
        responsePayload(MISSING_API_KEY_MESSAGE, {
          error_code: "server_key_missing",
        }),
        { status: 503 }
      );
    }

    const rateLimit = checkRateLimit(clientKey(request));
    if (!rateLimit.allowed) {
      return NextResponse.json(
        responsePayload(RATE_LIMITED_MESSAGE, {
          error_code: "rate_limited",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
        }
      );
    }

    const openai = new OpenAI({
      apiKey: serverApiKey,
      maxRetries: 0,
      timeout: OPENAI_TIMEOUT_MS,
    });

    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: MAX_OUTPUT_TOKENS,
      },
      { timeout: OPENAI_TIMEOUT_MS }
    );

    const reply = completion.choices?.[0]?.message?.content || "";
    return NextResponse.json(
      responsePayload(reply, {
        ai_configured: true,
        used_key_source: "server",
      })
    );
  } catch (error) {
    if (isTimeoutError(error)) {
      return NextResponse.json(
        responsePayload(OPENAI_TIMEOUT_MESSAGE, {
          error_code: "openai_timeout",
        }),
        { status: 504 }
      );
    }
    return NextResponse.json(
      responsePayload(OPENAI_FAILED_MESSAGE, {
        error_code: "openai_request_failed",
      }),
      { status: 500 }
    );
  }
}
