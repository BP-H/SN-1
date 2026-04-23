import { NextResponse } from "next/server";
import OpenAI from "openai";

const MISSING_API_KEY_MESSAGE = "Missing OPENAI_API_KEY environment variable.";

export async function POST(request) {
  try {
    const { prompt } = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { reply: MISSING_API_KEY_MESSAGE },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const reply = completion.choices[0].message.content;
    return NextResponse.json({ reply });
  } catch (error) {
    const message =
      error?.message === MISSING_API_KEY_MESSAGE
        ? MISSING_API_KEY_MESSAGE
        : "OpenAI API error: " + error.message;

    return NextResponse.json({ reply: message }, { status: 500 });
  }
}