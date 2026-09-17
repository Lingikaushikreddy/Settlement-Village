import test from "node:test";
import assert from "node:assert/strict";
import { newGame, command } from "../lib/game/economy.ts";
import { CampaignSession } from "../lib/game/campaign-session.ts";
const settle = () => new Promise((resolve) => setImmediate(resolve));

// Mirrors the browser's exclusive ifAvailable contract; no DOM is needed to
// exercise the real session lifecycle and shared campaign storage.
class Locks {
  held = false;
  async request(_name, options, callback) {
    assert.equal(_name, "settlement-village-game-v2");
    assert.deepEqual(options, { mode: "exclusive", ifAvailable: true });
    if (this.held) return callback(null);
    this.held = true;
    try {
      return await callback({ name: _name });
    } finally {
      this.held = false;
    }
  }
}
function fixture() {
  const locks = new Locks();
  const values = new Map();
  const writes = [];
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      writes.push(value);
      values.set(key, value);
    },
  };
  const open = (overrides = {}) => {
    return new CampaignSession({
      locks,
      storage,
      now: () => 1000,
      ...overrides,
    });
  };
  return { locks, values, writes, storage, open };
}

test("a second tab cannot overwrite the owner's built village or save when closed", async () => {
  const f = fixture(),
    a = f.open(),
    b = f.open();
  a.start();
  await settle();
  b.start();
  await settle();
  assert.equal(a.state, "active");
  assert.equal(b.state, "blocked");
  const progressed = command(a.game, {
    type: "build",
    kind: "farm",
    x: 1,
    y: 1,
  });
  assert.equal(a.save(progressed), true);
  assert.equal(b.save(newGame()), false);
  b.close();
  assert.equal(f.writes.length, 1);
  assert.equal(JSON.parse(f.writes[0]).game.buildings.length, 7);
  a.close();
});

test("closing the owner stops and flushes exactly once before the next tab loads", async () => {
  const f = fixture(),
    a = f.open();
  a.start();
  await settle();
  const progressed = command(a.game, {
    type: "build",
    kind: "farm",
    x: 1,
    y: 1,
  });
  let stops = 0;
  a.registerShutdown(() => {
    stops++;
    assert.equal(f.locks.held, true, "flush runs under the exclusive lock");
    assert.equal(a.save(progressed), true);
  });
  a.close();
  a.close();
  await settle();
  assert.equal(stops, 1);
  assert.equal(a.save(newGame()), false, "late callbacks cannot save");
  const b = f.open();
  b.start();
  await settle();
  assert.equal(b.game.buildings.length, 7);
  assert.equal(b.game.resources.wood, 780);
  b.close();
});

test("a closed pending StrictMode attempt cannot load, save, or retain a lock", async () => {
  const f = fixture();
  let deliver;
  const delayed = {
    request(name, options, callback) {
      return new Promise((resolve) => {
        deliver = () => resolve(f.locks.request(name, options, callback));
      });
    },
  };
  const abandoned = f.open({ locks: delayed });
  abandoned.start();
  abandoned.close();
  deliver();
  await settle();
  assert.equal(abandoned.state, "closed");
  assert.equal(abandoned.game, null);
  assert.equal(abandoned.save(newGame()), false);
  assert.equal(f.locks.held, false);
  const active = f.open();
  active.start();
  active.start();
  await settle();
  assert.equal(active.state, "active");
  active.close();
});

test("missing Web Locks preserves storage and never allows a writer", async () => {
  const f = fixture();
  f.values.set("settlement-village-game-v2", "original bytes");
  const session = f.open({ locks: undefined });
  session.start();
  await settle();
  assert.equal(session.state, "unsupported");
  assert.equal(session.rawSave, "original bytes");
  assert.equal(session.save(newGame()), false);
  session.close();
  assert.equal(f.writes.length, 0);
});

test("a corrupt save stays intact until an explicit replacement", async () => {
  const f = fixture();
  const raw = '{"game":{"version":2},"savedAt":1000}';
  f.values.set("settlement-village-game-v2", raw);
  const session = f.open();
  session.start();
  await settle();
  assert.equal(session.state, "recovery");
  assert.equal(session.rawSave, raw);
  assert.equal(session.game, null);
  assert.equal(session.save(newGame()), false);
  assert.equal(f.writes.length, 0);
  assert.equal(session.replaceDamagedSave(), true);
  assert.equal(session.state, "active");
  assert.equal(JSON.parse(f.writes[0]).game.version, 2);
  session.close();
});

test("restore validates the save envelope and keeps decisions paused", async () => {
  const f = fixture();
  f.values.set(
    "settlement-village-game-v2",
    JSON.stringify({ game: newGame(), savedAt: "yesterday" }),
  );
  const damaged = f.open();
  damaged.start();
  await settle();
  assert.equal(damaged.state, "recovery");
  damaged.close();
  await settle();
  f.values.set(
    "settlement-village-game-v2",
    JSON.stringify({ game: newGame(), savedAt: 0 }),
  );
  const valid = f.open();
  valid.start();
  await settle();
  assert.equal(valid.state, "active");
  assert.equal(valid.game.clock, 1);
  assert.equal(valid.game.council.playing, false);
  assert.equal(
    f.writes.length,
    0,
    "loading must not write before recovery completes",
  );
  valid.close();
});

test("lock errors and failed storage reads cannot fall back to an unsafe game", async () => {
  const f = fixture();
  const denied = f.open({
    locks: {
      request: async () => {
        throw Error("denied");
      },
    },
  });
  denied.start();
  await settle();
  assert.equal(denied.state, "unavailable");
  assert.equal(denied.save(newGame()), false);
  denied.close();
  const unreadable = f.open({
    storage: {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        assert.fail("must not write");
      },
    },
  });
  unreadable.start();
  await settle();
  assert.equal(unreadable.state, "unavailable");
  assert.equal(unreadable.game, null);
  unreadable.close();
});
