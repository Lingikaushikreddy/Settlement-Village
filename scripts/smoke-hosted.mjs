// Checks that a deployed (or locally started) Settlement build serves a playable game.
// Usage: node scripts/smoke-hosted.mjs https://example.vercel.app
import { pathToFileURL } from "node:url";

export const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-content-type-options",
  "referrer-policy",
];

export function assetPaths(html) {
  const paths = new Set();
  for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?#]+)/g))
    paths.add(match[1]);
  return [...paths];
}

export function checkPage(html, headers) {
  const failures = [];
  if (!/<title>[^<]*Settlement/.test(html))
    failures.push("Home page title does not mention Settlement");
  if (assetPaths(html).length === 0)
    failures.push("Home page references no /_next/static assets");
  for (const name of REQUIRED_HEADERS)
    if (!headers.get(name)) failures.push(`Missing ${name} header`);
  if (!/property="og:image"/.test(html))
    failures.push("Home page has no og:image preview");
  return failures;
}

export async function smoke(base, fetchImpl = fetch) {
  const url = (path) => new URL(path, base).toString();
  const failures = [];
  const home = await fetchImpl(url("/"));
  const html = await home.text();
  if (home.status !== 200) failures.push(`GET / returned ${home.status}`);
  if (!home.headers.get("content-type")?.includes("text/html"))
    failures.push("GET / is not HTML");
  failures.push(...checkPage(html, home.headers));

  for (const path of [
    ...assetPaths(html),
    "/game/terrain.png",
    "/game/sprites.png",
    "/game/residents-v3.png",
    "/game/willowmere-vista.png",
  ]) {
    const res = await fetchImpl(url(path));
    if (res.status !== 200) failures.push(`GET ${path} returned ${res.status}`);
    await res.arrayBuffer();
  }

  const lab = await fetchImpl(url("/lab?seed=7"), { redirect: "manual" });
  const location = lab.headers.get("location") ?? "";
  if (lab.status < 300 || lab.status > 399 || !location.includes("view=research") || !location.includes("seed=7"))
    failures.push(`GET /lab?seed=7 did not redirect to research (status ${lab.status}, location "${location}")`);
  return failures;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const base = process.argv[2];
  if (!base) {
    console.error("Usage: node scripts/smoke-hosted.mjs <base-url>");
    process.exit(2);
  }
  const failures = await smoke(base);
  if (failures.length) {
    console.error(`Smoke test failed for ${base}:`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }
  console.log(`Smoke test passed for ${base}`);
}
