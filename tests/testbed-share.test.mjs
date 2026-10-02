import test from "node:test";
import assert from "node:assert/strict";
import { MAX_REPORT_BYTES, fetchSharedReport, sharedReportUrl } from "../lib/testbed/share.ts";

test("only https links on the two GitHub raw hosts are accepted", () => {
  assert.ok(sharedReportUrl("https://raw.githubusercontent.com/o/r/main/report.json"));
  assert.ok(sharedReportUrl("https://gist.githubusercontent.com/u/abc/raw/report.json"));
  for (const bad of [
    null, "", "not a url",
    "http://raw.githubusercontent.com/o/r/main/report.json",
    "https://evil.example/report.json",
    "https://raw.githubusercontent.com.evil.example/x.json",
    "https://user:pass@raw.githubusercontent.com/o/r/main/x.json",
    "https://raw.githubusercontent.com:8443/o/r/main/x.json",
    "javascript:alert(1)",
  ]) assert.equal(sharedReportUrl(bad), null, String(bad));
});

test("shared reports are fetched without credentials and size-limited", async () => {
  const url = sharedReportUrl("https://raw.githubusercontent.com/o/r/main/report.json");
  let init;
  const ok = await fetchSharedReport(url, async (_u, i) => {
    init = i;
    return new Response('{"kind":"agent"}', { status: 200 });
  });
  assert.equal(ok, '{"kind":"agent"}');
  assert.equal(init.credentials, "omit");
  await assert.rejects(
    fetchSharedReport(url, async () => new Response("missing", { status: 404 })),
    /HTTP 404/,
  );
  await assert.rejects(
    fetchSharedReport(url, async () => new Response("x".repeat(MAX_REPORT_BYTES + 1), { status: 200 })),
    /5 MB/,
  );
});
