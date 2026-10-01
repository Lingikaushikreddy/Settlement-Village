import { parseAgentResponse, type AgentAnswer, type AnswerSource } from "./protocol.ts";

export const MAX_RESPONSE_BYTES = 64 * 1024;

async function readLimited(response: Response, limit: number): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/** Calls the builder's agent once per decision. No retries: a run means the same thing every time. */
export function httpSource(
  url: string,
  options: { headers?: Record<string, string>; timeoutMs?: number } = {},
): AnswerSource {
  const timeoutMs = options.timeoutMs ?? 30_000;
  return async (request) => {
    const started = performance.now();
    const elapsed = () => Math.round(performance.now() - started);
    const invalid = (reason: Extract<AgentAnswer, { status: "invalid" }>["reason"]): AgentAnswer => ({
      status: "invalid",
      reason,
      latencyMs: elapsed(),
    });
    const headers = new Headers(options.headers);
    headers.set("content-type", "application/json");
    headers.set("settlement-protocol", "1");
    const signal = AbortSignal.timeout(timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
        redirect: "error",
        signal,
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        return invalid("http_status");
      }
      const body = await readLimited(response, MAX_RESPONSE_BYTES);
      if (body === null) return invalid("too_large");
      return parseAgentResponse(body, request, elapsed());
    } catch {
      return invalid(signal.aborted ? "timeout" : "network");
    }
  };
}
