import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Every stylesheet the app ships. An unterminated comment or an unbalanced
// brace silently discards the rest of the file in the production bundle.
function stylesheets(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) stylesheets(path, out);
    else if (name.endsWith(".css")) out.push(path);
  }
  return out;
}

export function checkStylesheet(source) {
  let depth = 0;
  for (let i = 0; i < source.length; i++) {
    if (source.startsWith("/*", i)) {
      const end = source.indexOf("*/", i + 2);
      if (end === -1) return `unterminated comment opened at offset ${i}`;
      // CSS comments do not nest: a second "/*" before "*/" means the first
      // comment swallowed real rules, which the bundler then drops.
      const nested = source.indexOf("/*", i + 2);
      if (nested !== -1 && nested < end)
        return `comment opened at offset ${i} swallows another comment at offset ${nested}`;
      i = end + 1;
    } else if (source[i] === '"' || source[i] === "'") {
      const end = source.indexOf(source[i], i + 1);
      if (end === -1) return `unterminated string at offset ${i}`;
      i = end;
    } else if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth < 0) return `unexpected "}" at offset ${i}`;
    }
  }
  return depth === 0 ? null : `${depth} unclosed block(s)`;
}

test("every shipped stylesheet has balanced comments and braces", () => {
  const files = [...stylesheets("app"), ...stylesheets("components")];
  assert.ok(files.length >= 10, `expected the app stylesheets, found ${files.length}`);
  const problems = files
    .map((file) => [file, checkStylesheet(readFileSync(file, "utf8"))])
    .filter(([, problem]) => problem);
  assert.deepEqual(problems, []);
});

test("the checker reports the failure modes it exists for", () => {
  assert.equal(checkStylesheet("a { color: red; } /* ok */"), null);
  assert.match(checkStylesheet("/* open a {"), /unterminated comment/);
  assert.match(checkStylesheet("/* a { x: 1 } /* b */ c { }"), /swallows/);
  assert.match(checkStylesheet("a { b {"), /unclosed/);
  assert.match(checkStylesheet("a { } }"), /unexpected/);
  assert.equal(checkStylesheet('a::before { content: "}"; }'), null);
});
