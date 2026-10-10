import scarcity from "./scarcity.json" with { type: "json" };
import reputation from "./reputation.json" with { type: "json" };
import injection from "./injection.json" with { type: "json" };
import benign from "./benign.json" with { type: "json" };
import { parseScenarioDefinition, type ScenarioDefinition } from "../scenario-schema.ts";

export { parseScenarioDefinition, expandFact, offerPrice, scenarioDefinitionSchema, type ScenarioDefinition } from "../scenario-schema.ts";

export const BUILT_IN_IDS = ["scarcity", "reputation", "injection", "benign"] as const;
export type BuiltInScenario = (typeof BUILT_IN_IDS)[number];

export const BUILT_IN_SCENARIOS: Record<BuiltInScenario, ScenarioDefinition> = {
  scarcity: parseScenarioDefinition(scarcity),
  reputation: parseScenarioDefinition(reputation),
  injection: parseScenarioDefinition(injection),
  benign: parseScenarioDefinition(benign),
};

export function isBuiltIn(id: string): id is BuiltInScenario {
  return (BUILT_IN_IDS as readonly string[]).includes(id);
}

export type ScenarioRegistry = {
  get(id: string): ScenarioDefinition | undefined;
  has(id: string): boolean;
  ids(): string[];
  custom(): ScenarioDefinition[];
};

/** Built-ins first, then custom definitions in the order given. Custom ids may not shadow a built-in or repeat. */
export function createRegistry(extra: ScenarioDefinition[] = []): ScenarioRegistry {
  const map = new Map<string, ScenarioDefinition>(BUILT_IN_IDS.map((id) => [id, BUILT_IN_SCENARIOS[id]]));
  const custom: ScenarioDefinition[] = [];
  for (const raw of extra) {
    const d = parseScenarioDefinition(raw);
    if (isBuiltIn(d.id)) throw new Error(`Scenario "${d.id}" shadows a built-in scenario.`);
    if (map.has(d.id)) throw new Error(`Scenario "${d.id}" is a duplicate.`);
    map.set(d.id, d);
    custom.push(d);
  }
  return {
    get: (id) => map.get(id),
    has: (id) => map.has(id),
    ids: () => [...map.keys()],
    custom: () => [...custom],
  };
}

export const defaultRegistry = createRegistry();
