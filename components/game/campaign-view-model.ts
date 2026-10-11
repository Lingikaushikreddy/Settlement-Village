// Pure functions behind the campaign regions. No React, no DOM: tested under node --test,
// which is why the imports are relative with extensions rather than the "@/" alias.
import { buildings, freeBuilders } from "../../lib/game/catalog.ts";
import { councilRun, newCouncil } from "../../lib/game/council.ts";
import { crewRoster } from "../../lib/game/crew.ts";
import type {
  Battle,
  Building,
  BuildingKind,
  Game,
  Resource,
} from "../../lib/game/model.ts";
import type { Agent, Run } from "../../lib/sim/types.ts";
import type { ResearchFrame } from "../research/types.ts";

export type HudResource = {
  key: Resource;
  label: "Gold" | "Timber" | "Food";
  amount: number;
  display: string;
};

const labels: Record<Resource, HudResource["label"]> = {
  gold: "Gold",
  wood: "Timber",
  food: "Food",
};

export function hudFigures(game: Game) {
  return {
    hallLevel: game.buildings.find((b) => b.kind === "hall")?.level,
    builders: `${freeBuilders(game)}/2`,
    resources: (["gold", "wood", "food"] as const).map((key) => {
      const amount = Math.floor(game.resources[key]);
      return {
        key,
        label: labels[key],
        amount,
        display: amount.toLocaleString("en-US"),
      };
    }),
  };
}

export function armyTotal(game: Game): number {
  return Object.values(game.army).reduce((a, b) => a + b, 0);
}

export function battleStars(battle: Battle): number {
  const destroyed = battle.buildings.filter((b) => b.hp <= 0).length;
  return (
    Number(battle.buildings.find((b) => b.kind === "hall")!.hp <= 0) +
    Number(destroyed / battle.buildings.length >= 0.5) +
    Number(battle.buildings.every((b) => b.hp <= 0))
  );
}

export function destructionPercent(battle: Battle): number {
  return Math.floor(
    (battle.buildings.filter((b) => b.hp <= 0).length /
      battle.buildings.length) *
      100,
  );
}

export function researchCaption(mode: ResearchFrame["mode"] | undefined) {
  return mode === "worker"
    ? "Worker experiment"
    : mode === "local"
      ? "Browser experiment"
      : "Recorded replay";
}

export function displayedResearch(
  frame: ResearchFrame | null,
  research: { run: Run } | null,
  game: Game,
): { run: Run; tick: number } {
  const run =
    frame?.run ?? research?.run ?? councilRun(game.council ?? newCouncil());
  return { run, tick: frame?.tick ?? run.snapshots.length - 1 };
}

/** Residents for the map; crew roles and colours overlay the social agents while the crew works. */
export function sceneResidents(
  run: Run,
  tick: number,
  game: Game,
  crewVisible: boolean,
): Agent[] {
  const overlay = crewVisible && game.crew?.objective;
  return run.snapshots[tick].agents.map((a) => {
    const crewPerson = overlay ? crewRoster.find((r) => r.id === a.id) : null;
    return crewPerson
      ? { ...a, occupation: crewPerson.role, color: crewPerson.color }
      : a;
  });
}

export function activeIncidentTargets(run: Run, tick: number): string[] {
  return run.incidents
    .filter(
      (i) =>
        i.tick <= tick && (i.resolvedTick === null || i.resolvedTick > tick),
    )
    .map((i) => i.target);
}

export function buildingSummary(game: Game, building: Building): string {
  const def = buildings[building.kind];
  if (building.readyAt)
    return `Ready in ${Math.ceil(building.readyAt - game.clock)} seconds`;
  if (def.resource)
    return `${def.rate * building.level} ${def.resource} / second · ${Math.floor(building.stored)} / ${def.capacity * building.level} stored`;
  return def.description;
}

export function placementTitle(game: Game, placing: string): string {
  return game.buildings.some((b) => b.id === placing)
    ? "Choose a new location"
    : `Place your ${buildings[placing.slice(4) as BuildingKind].name.toLowerCase()}`;
}
