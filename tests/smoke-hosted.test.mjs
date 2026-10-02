import test from "node:test";
import assert from "node:assert/strict";
import { assetPaths, checkPage, smoke } from "../scripts/smoke-hosted.mjs";

const html = `<!DOCTYPE html><html><head><title>Settlement — Multi-Agent Village Game</title>
<meta property="og:image" content="https://x.test/opengraph-image.png"/>
<link rel="stylesheet" href="/_next/static/css/app.css"/>
<script src="/_next/static/chunks/main.js?dpl=abc" async></script>
<script src="/_next/static/chunks/main.js"></script></head><body></body></html>`;
const secureHeaders = new Headers({
  "content-type": "text/html; charset=utf-8",
  "content-security-policy": "default-src 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
});

test("asset paths are deduplicated and stripped of query strings", () => {
  assert.deepEqual(assetPaths(html), [
    "/_next/static/css/app.css",
    "/_next/static/chunks/main.js",
  ]);
});

test("a healthy page passes and a bare page reports each problem", () => {
  assert.deepEqual(checkPage(html, secureHeaders), []);
  const failures = checkPage("<title>Other</title>", new Headers());
  assert.equal(failures.length, 6);
  assert.ok(failures.includes("Missing content-security-policy header"));
});

function fakeFetch(routes) {
  return async (input) => {
    const { pathname, search } = new URL(input);
    const route = routes[pathname + search] ?? routes[pathname];
    return route ? route() : new Response("missing", { status: 404 });
  };
}

test("smoke checks assets, artwork and the research redirect", async () => {
  const ok = () => new Response("x", { status: 200 });
  const routes = {
    "/": () => new Response(html, { status: 200, headers: secureHeaders }),
    "/_next/static/css/app.css": ok,
    "/_next/static/chunks/main.js": ok,
    "/game/terrain.png": ok,
    "/game/sprites.png": ok,
    "/game/residents-v3.png": ok,
    "/game/willowmere-vista.png": ok,
    "/lab?seed=7": () =>
      new Response(null, {
        status: 307,
        headers: { location: "/?view=research&seed=7" },
      }),
  };
  assert.deepEqual(await smoke("https://x.test", fakeFetch(routes)), []);

  delete routes["/game/sprites.png"];
  delete routes["/game/residents-v3.png"];
  delete routes["/game/willowmere-vista.png"];
  routes["/lab?seed=7"] = () => new Response("page", { status: 200 });
  const failures = await smoke("https://x.test", fakeFetch(routes));
  assert.deepEqual(failures, [
    "GET /game/sprites.png returned 404",
    "GET /game/residents-v3.png returned 404",
    "GET /game/willowmere-vista.png returned 404",
    'GET /lab?seed=7 did not redirect to research (status 200, location "")',
  ]);
});
