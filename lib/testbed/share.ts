export const SHARE_HOSTS = ["raw.githubusercontent.com", "gist.githubusercontent.com"] as const;
export const MAX_REPORT_BYTES = 5 * 1024 * 1024;

/** Returns the URL only for https links on the allowed raw-content hosts. */
export function sharedReportUrl(raw: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !(SHARE_HOSTS as readonly string[]).includes(url.hostname)
  )
    return null;
  return url;
}

export async function fetchSharedReport(url: URL, fetchImpl: typeof fetch = fetch) {
  const response = await fetchImpl(url, { credentials: "omit", redirect: "error" });
  if (!response.ok) throw new Error(`The shared report could not be loaded (HTTP ${response.status}).`);
  if (Number(response.headers.get("content-length") ?? 0) > MAX_REPORT_BYTES)
    throw new Error("Shared reports must be at most 5 MB.");
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_REPORT_BYTES)
    throw new Error("Shared reports must be at most 5 MB.");
  return text;
}
