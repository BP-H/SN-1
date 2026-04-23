export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const corsHeaders = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  let text: string | undefined;
  try {
    const body = await req.json();
    text = body?.text;
  } catch {
    text = undefined;
  }

  if (!text) {
    return new Response(JSON.stringify({ error: 'Missing text' }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        input:
          'Context:\n' +
          text +
          '\n\nInstruction:\nExplain this clearly in a few sentences for a non-technical person.',
        max_output_tokens: 250,
      }),
    });

    const data = await r.json();
    if (!r.ok) {
      const message = data?.error?.message || 'Failed';
      return new Response(JSON.stringify({ error: message }), {
        status: r.status,
        headers: corsHeaders,
      });
    }

    const result = data.output_text ?? data.output?.[0]?.content?.[0]?.text ?? '';

    return new Response(JSON.stringify({ text: result }), {
      headers: corsHeaders,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Network error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
