// Pure functions behind the research regions. No React, no DOM: tested under node --test,
// which is why the imports are relative with extensions rather than the "@/" alias.
import { supportedEngine, verifyReplay } from "../../lib/sim/engine.ts";
import type {
  Event as RunEvent,
  Incident,
  Run,
  World,
} from "../../lib/sim/types.ts";
import type { ResearchMode } from "./types.ts";

export function validateSaved(x: unknown): x is Run {
  return (
    !!x &&
    typeof x === "object" &&
    (x as Run).schemaVersion === 1 &&
    supportedEngine((x as Run).engineVersion) &&
    Array.isArray((x as Run).snapshots) &&
    (x as Run).snapshots.length <= 151 &&
    Array.isArray((x as Run).events) &&
    Array.isArray((x as Run).incidents) &&
    !!(x as Run).config
  );
}

/** Saved runs from browser storage: only runs that validate and replay exactly, at most eight. */
export function parseSavedLibrary(raw: string | null): {
  runs: Run[];
  error: boolean;
} {
  try {
    const saved = JSON.parse(raw || "[]");
    if (!Array.isArray(saved)) return { runs: [], error: false };
    const runs = saved
      .filter((x) => {
        try {
          return validateSaved(x) && verifyReplay(x).ok;
        } catch {
          return false;
        }
      })
      .slice(0, 8);
    return { runs, error: false };
  } catch {
    return { runs: [], error: true };
  }
}

export function addToLibrary(library: Run[], run: Run): Run[] {
  return [run, ...library.filter((r) => r.id !== run.id)].slice(0, 6);
}

export function parseSeed(text: string): number | null {
  const seed = Number(text);
  return Number.isInteger(seed) && seed >= 0 && seed <= 999999 ? seed : null;
}

export function researchHeading(view: string): string {
  return view === "experiments"
    ? "Test a different decision."
    : view === "library"
      ? "Your village archive."
      : "Follow the evidence.";
}

export function modeLabel(mode: ResearchMode): string {
  return mode === "recorded"
    ? "Recorded evidence"
    : mode === "worker"
      ? "Local worker experiment"
      : "Browser experiment";
}

export function snapshotAt(run: Run, tick: number): World {
  return run.snapshots[tick] || run.snapshots[run.snapshots.length - 1];
}

// Residents are shown by name; "village" and "observer" fall back to their label.
export function nameIn(
  agents: { id: string; name: string }[],
  id: string,
): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

export function incidentEvents(run: Run): RunEvent[] {
  return run.events.filter((e) => e.type === "claim");
}

export function nextIncidentEvent(
  run: Run,
  tick: number,
): RunEvent | undefined {
  const claims = incidentEvents(run);
  return claims.find((e) => e.tick > tick) || claims[0];
}

export function visibleIncidents(run: Run, tick: number): Incident[] {
  return run.incidents.filter((i) => i.tick <= tick);
}

export function incidentOutcome(
  incident: Incident,
  tick: number,
): Incident["outcome"] | "pending" {
  return incident.resolvedTick !== null && incident.resolvedTick <= tick
    ? incident.outcome
    : "pending";
}

export function playbackStatus(
  run: Run,
  tick: number,
  playing: boolean,
): "Playing" | "Completed" | "Paused" {
  return playing
    ? "Playing"
    : tick === run.snapshots.length - 1 && run.status === "completed"
      ? "Completed"
      : "Paused";
}

export function feedEvents(run: Run, tick: number): RunEvent[] {
  return run.events
    .filter((e) => e.tick <= tick)
    .slice(-20)
    .reverse();
}

export function boardEvents(run: Run, tick: number): RunEvent[] {
  return run.events.filter(
    (e) => e.tick <= tick && (e.type === "claim" || e.type === "intervention"),
  );
}

export function wealthBars(world: World) {
  const residents = world.agents
    .filter((a) => a.role === "resident")
    .map((a) => ({ name: a.name, coins: a.inventory.coins, color: a.color }));
  const top = Math.max(40, ...residents.map((x) => x.coins));
  return residents.map((a) => ({ ...a, width: (a.coins / top) * 100 }));
}

export function canAskModel(input: {
  ready: boolean;
  mode: ResearchMode;
  playing: boolean;
  queued: boolean;
  busy: boolean;
  run: Run;
  tick: number;
}): boolean {
  const { ready, mode, playing, queued, busy, run, tick } = input;
  return (
    ready &&
    mode === "worker" &&
    !playing &&
    !queued &&
    !busy &&
    run.incidents.some(
      (i) => ["pending", "checking"].includes(i.decision) && i.deadline > tick,
    )
  );
}
