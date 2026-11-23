/**
 * Streaming proxy with a typed error taxonomy.
 *
 * Demonstrates how a server can proxy a provider stream to the browser while
 * keeping failure modes distinguishable: policy block, rate limit, provider
 * unavailable, unknown. The client can then decide whether to preserve the
 * draft, offer a retry, or explain that quota was not consumed.
 *
 * Run: npx tsx sse_proxy.ts
 */

export type Failure =
  | { kind: "policy_blocked"; message: string }
  | { kind: "rate_limited"; retryAfterSeconds: number }
  | { kind: "provider_unavailable"; message: string }
  | { kind: "unknown"; message: string };

export type ProxyEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; failure: Failure };

const POLICY_CODES = new Set(["content_blocked", "content_filter"]);

/** Maps a provider response to the small taxonomy the UI understands. */
export function classify(status: number, code?: string): Failure {
  if (status === 400 && code && POLICY_CODES.has(code)) {
    return { kind: "policy_blocked", message: "The request was blocked by policy." };
  }
  if (status === 429) {
    return { kind: "rate_limited", retryAfterSeconds: 1 };
  }
  if (status >= 500 || status === 402 || status === 403) {
    return { kind: "provider_unavailable", message: "The model is temporarily unavailable." };
  }
  return { kind: "unknown", message: "Unexpected provider response." };
}

export async function* proxy(
  call: () => Promise<Response>,
  onFirstToken: () => void,
  onFailureBeforeToken: () => void,
): AsyncGenerator<ProxyEvent> {
  let response: Response;
  try {
    response = await call();
  } catch {
    onFailureBeforeToken();
    yield { type: "error", failure: { kind: "provider_unavailable", message: "Connection failed." } };
    return;
  }

  if (!response.ok || !response.body) {
    const code = await safeCode(response);
    onFailureBeforeToken(); // quota is restored: nothing was generated
    yield { type: "error", failure: classify(response.status, code) };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let first = true;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (first) {
      first = false;
      onFirstToken(); // from here on, quota is consumed even if the stream breaks
    }
    const text = decoder.decode(value, { stream: true });
    if (text) yield { type: "delta", text };
  }

  yield { type: "done" };
}

async function safeCode(response: Response): Promise<string | undefined> {
  try {
    const body = (await response.json()) as { code?: string; error?: { code?: string } };
    return body.code ?? body.error?.code;
  } catch {
    return undefined;
  }
}

// --- demonstration ---------------------------------------------------------
async function demo(): Promise<void> {
  const fake = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("Estudar "));
        controller.enqueue(new TextEncoder().encode("junto funciona."));
        controller.close();
      },
    }),
    { status: 200 },
  );

  let committed = false;
  for await (const event of proxy(
    async () => fake,
    () => (committed = true),
    () => (committed = false),
  )) {
    if (event.type === "delta") process.stdout.write(event.text);
    if (event.type === "done") console.log("\nquota consumed:", committed);
  }
}

void demo();
