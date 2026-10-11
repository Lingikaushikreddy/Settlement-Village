import test from "node:test";
import assert from "node:assert/strict";
import { runToEnd } from "../lib/sim/engine.ts";
import {
  addToLibrary, boardEvents, canAskModel, feedEvents, incidentEvents, incidentOutcome, modeLabel,
  nextIncidentEvent, parseSavedLibrary, parseSeed, playbackStatus, researchHeading, snapshotAt,
  visibleIncidents, wealthBars,
} from "../components/research/research-view-model.ts";

const run = runToEnd({ seed: 42, scenario: "scarcity", policy: "baseline", maxTicks: 60 });

test("incident helpers follow the seeded run: first claim at tick 8, four incidents", () => {
  assert.equal(incidentEvents(run)[0].tick, 8);
  assert.equal(nextIncidentEvent(run, 0).tick, 8);
  assert.equal(nextIncidentEvent(run, 60).tick, 8, "wraps to the first claim after the last");
  assert.equal(visibleIncidents(run, 7).length, 0);
  assert.equal(visibleIncidents(run, 60).length, 4);
  const first = run.incidents[0];
  assert.equal(incidentOutcome(first, first.tick), "pending");
  assert.equal(incidentOutcome(first, 60), first.outcome);
});

test("playbackStatus, feedEvents and boardEvents read the tick", () => {
  assert.equal(playbackStatus(run, 60, false), "Completed");
  assert.equal(playbackStatus(run, 3, false), "Paused");
  assert.equal(playbackStatus(run, 3, true), "Playing");
  const feed = feedEvents(run, 60);
  assert.ok(feed.length <= 20 && feed.length > 0);
  assert.ok(feed.every((e, i) => i === 0 || e.tick <= feed[i - 1].tick), "newest first");
  assert.ok(boardEvents(run, 60).every((e) => e.type === "claim" || e.type === "intervention"));
  assert.equal(boardEvents(run, 7).length, 0);
});

test("parseSavedLibrary keeps verified runs and drops tampered ones", () => {
  const tampered = structuredClone(run);
  tampered.snapshots[5].agents[1].inventory.coins += 1;
  assert.deepEqual(parseSavedLibrary(JSON.stringify([run, tampered])).runs.map((r) => r.id), [run.id]);
  assert.deepEqual(parseSavedLibrary(null), { runs: [], error: false });
  assert.deepEqual(parseSavedLibrary('{"not":"a list"}'), { runs: [], error: false });
  assert.equal(parseSavedLibrary("{not json").error, true);
});

test("addToLibrary puts the run first, drops its older copy and keeps six", () => {
  const runs = Array.from({ length: 7 }, (_, i) => ({ ...run, id: `r${i}` }));
  const next = addToLibrary(runs, { ...run, id: "r3" });
  assert.equal(next[0].id, "r3");
  assert.equal(next.length, 6);
  assert.equal(next.filter((r) => r.id === "r3").length, 1);
});

test("parseSeed accepts 0 to 999999 whole numbers", () => {
  assert.equal(parseSeed("42"), 42);
  assert.equal(parseSeed(""), 0, "an empty field is seed 0, as before the split");
  for (const bad of ["-1", "1000000", "4.5", "abc"]) assert.equal(parseSeed(bad), null, bad);
});

test("labels, snapshot, wealth and model gate", () => {
  assert.equal(researchHeading("experiments"), "Test a different decision.");
  assert.equal(researchHeading("library"), "Your village archive.");
  assert.equal(researchHeading("observatory"), "Follow the evidence.");
  assert.equal(modeLabel("recorded"), "Recorded evidence");
  assert.equal(modeLabel("worker"), "Local worker experiment");
  assert.equal(modeLabel("local"), "Browser experiment");
  assert.equal(snapshotAt(run, 999), run.snapshots.at(-1));
  const bars = wealthBars(snapshotAt(run, 0));
  assert.ok(bars.length > 0 && bars.every((b) => b.width >= 0 && b.width <= 100));
  const gate = { ready: true, mode: "worker", playing: false, queued: false, busy: false, run, tick: 8 };
  assert.equal(canAskModel({ ...gate, ready: false }), false);
  assert.equal(canAskModel({ ...gate, mode: "local" }), false);
  assert.equal(canAskModel({ ...gate, tick: 60 }), false, "no pending decision at the end of the run");
});
