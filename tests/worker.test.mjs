import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const W = await import("../worker/store.ts").catch(() => ({}));
function setup() {
  assert.equal(typeof W.RunStore, "function", "RunStore must exist");
  const dir = mkdtempSync(join(tmpdir(), "settlement-"));
  const file = join(dir, "test.sqlite");
  return { dir, file, store: new W.RunStore(file) };
}

test("a committed run survives database restart without duplicate command effects", () => {
  const { dir, file, store } = setup();
  try {
    const original = store.create({ seed: 42 });
    const stepped = store.command(original.run.id, {
      id: "first",
      action: "step",
      expectedVersion: 0,
    });
    assert.equal(stepped.run.snapshots.length, 2);
    store.close();
    const recovered = new W.RunStore(file);
    assert.equal(recovered.get(original.run.id).version, 1);
    const retry = recovered.command(original.run.id, {
      id: "first",
      action: "step",
      expectedVersion: 0,
    });
    assert.equal(retry.run.snapshots.length, 2);
    assert.equal(retry.version, 1);
    recovered.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
test("stale commands are rejected and pause/resume are durable", () => {
  const { dir, store } = setup();
  try {
    const a = store.create({});
    store.command(a.run.id, {
      id: "resume",
      action: "resume",
      expectedVersion: 0,
    });
    assert.equal(store.active().length, 1);
    assert.throws(
      () =>
        store.command(a.run.id, {
          id: "stale",
          action: "step",
          expectedVersion: 0,
        }),
      /version/i,
    );
    const tick = store.tick(a.run.id);
    assert.equal(tick.run.snapshots.length, 2);
    store.command(a.run.id, {
      id: "pause",
      action: "pause",
      expectedVersion: tick.version,
    });
    assert.equal(store.active().length, 0);
    assert.equal(store.get(a.run.id).run.snapshots.length, 2);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("interventions are applied once at the next tick", () => {
  const { dir, store } = setup();
  try {
    let r = store.create({});
    r = store.command(r.run.id, {
      id: "intervene",
      action: "intervene",
      intervention: "add-grain",
      expectedVersion: 0,
    });
    assert.equal(r.run.snapshots.length, 1);
    r = store.command(r.run.id, {
      id: "step",
      action: "step",
      expectedVersion: 1,
    });
    assert.equal(r.run.interventions.length, 1);
    assert.equal(r.run.interventions[0].type, "add-grain");
    r = store.command(r.run.id, {
      id: "step2",
      action: "step",
      expectedVersion: 2,
    });
    assert.equal(r.run.interventions.length, 1);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
test("unknown command and reused IDs with different content are rejected", () => {
  const { dir, store } = setup();
  try {
    const r = store.create({});
    assert.throws(
      () =>
        store.command(r.run.id, {
          id: "x",
          action: "erase",
          expectedVersion: 0,
        }),
      /command/i,
    );
    store.command(r.run.id, { id: "y", action: "step", expectedVersion: 0 });
    assert.throws(
      () =>
        store.command(r.run.id, {
          id: "y",
          action: "pause",
          expectedVersion: 0,
        }),
      /reused/i,
    );
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
