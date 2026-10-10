#!/usr/bin/env node
// Chrome performance metrics for the campaign and the observatory.
// Not a CI gate: numbers differ between machines. Run against the production build:
//   npm run build && npm start &   then   npm run measure:ui -- --out /tmp/ui-before.json
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

export const METRICS = ["ScriptDuration", "TaskDuration", "LayoutCount", "RecalcStyleCount", "JSHeapUsedSize", "Timestamp"];

/** Difference between two Performance.getMetrics samples, durations in ms, heap in MB. */
export function delta(before, after) {
  const d = (k) => after[k] - before[k];
  return {
    scriptMs: Math.round(d("ScriptDuration") * 1000),
    taskMs: Math.round(d("TaskDuration") * 1000),
    layouts: d("LayoutCount"),
    styleRecalcs: d("RecalcStyleCount"),
    heapMB: d("JSHeapUsedSize") / 1e6,
    seconds: d("Timestamp"),
  };
}

export function formatTable(rows) {
  const lines = [
    "| Scene | Script ms | Task ms | Layouts | Style recalcs | Heap Δ MB | Seconds |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const r of rows)
    lines.push(
      `| ${r.scene} | ${r.scriptMs.toFixed(1)} | ${r.taskMs.toFixed(1)} | ${r.layouts} | ${r.styleRecalcs} | ${r.heapMB.toFixed(2)} | ${Math.round(r.seconds)} |`,
    );
  return lines.join("\n");
}

async function sample(cdp) {
  const { metrics } = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(metrics.filter((m) => METRICS.includes(m.name)).map((m) => [m.name, m.value]));
}

async function measure(page, scene, seconds) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  await page.goto(scene.path);
  await scene.ready(page);
  await page.waitForTimeout(2000); // let the first paint and hydration settle
  const before = await sample(cdp);
  await page.waitForTimeout(seconds * 1000);
  const after = await sample(cdp);
  await cdp.detach();
  return { scene: scene.name, ...delta(before, after) };
}

const scenes = [
  { name: "campaign idle", path: "/", ready: (page) => page.getByLabel("gold: 1250").waitFor() },
  {
    name: "observatory playback",
    // A seeded run has a full timeline to play; the plain research view opens on a one-snapshot council run.
    path: "/?view=research&seed=42&scenario=scarcity&policy=baseline",
    ready: async (page) => {
      await page.getByRole("button", { name: "Rewind to beginning" }).click();
      await page.getByRole("button", { name: "Play", exact: true }).click();
    },
  },
];

async function main() {
  const { values } = parseArgs({
    options: {
      url: { type: "string", default: "http://127.0.0.1:5173" },
      out: { type: "string" },
      seconds: { type: "string", default: "10" },
    },
  });
  const seconds = Number(values.seconds);
  try {
    await fetch(values.url);
  } catch {
    console.error(`Nothing is listening at ${values.url}. Run: npm run build && npm start`);
    process.exit(2);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL: values.url, reducedMotion: "reduce", viewport: { width: 1280, height: 720 } });
  const rows = [];
  for (const scene of scenes) rows.push(await measure(page, scene, seconds));
  const chromiumVersion = browser.version();
  await browser.close();
  const result = {
    machine: `${process.platform} ${process.arch}`,
    node: process.version,
    chromium: chromiumVersion,
    at: new Date().toISOString(),
    rows,
  };
  if (values.out) writeFileSync(values.out, JSON.stringify(result, null, 2) + "\n");
  console.log(formatTable(rows));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
