// Server-only: reads GEMINI_API_KEY, which must never reach the browser.

export type LlmCall = {
  ok: boolean;
  status: number | null;   // HTTP status, or null if the request never completed
  text: string | null;     // the model's raw output
  error: string | null;
  durationMs: number;
};

// One request to one Gemini model. Never throws: the result is logged either way.
export async function callGemini(
  model: string,
  prompt: string,
  { temperature = 1, json = false }: { temperature?: number; json?: boolean } = {}
): Promise<LlmCall> {
  const apiKey = process.env.GEMINI_API_KEY;
  const started = Date.now();
  if (!apiKey) return { ok: false, status: null, text: null, error: 'GEMINI_API_KEY is not set', durationMs: 0 };

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          // Low thinking keeps responses around 2s instead of 6s+.
          thinkingConfig: { thinkingLevel: 'low' },
          ...(json ? { responseMimeType: 'application/json' } : {}),
        },
      }),
      // The free tier sometimes hangs under load; give up and let the caller try another model.
      signal: AbortSignal.timeout(15_000),
    });
    const durationMs = Date.now() - started;

    if (!res.ok) {
      const body = (await res.text()).slice(0, 500);
      return { ok: false, status: res.status, text: null, error: body || `HTTP ${res.status}`, durationMs };
    }
    const data = await res.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ok: false, status: res.status, text: null, error: 'Empty response', durationMs };
    return { ok: true, status: res.status, text, error: null, durationMs };
  } catch (e) {
    const err = e as Error;
    return {
      ok: false,
      status: null,
      text: null,
      error: err.name === 'TimeoutError' ? 'Timed out after 15s' : err.message,
      durationMs: Date.now() - started,
    };
  }
}
